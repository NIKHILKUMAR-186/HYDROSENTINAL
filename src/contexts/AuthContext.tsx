import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "user" | "admin";

type AuthUser = {
  uid: string;
  email: string | null;
  provider: "supabase";
  profile_completion?: number;
};

type SignupData = {
  email: string;
  password: string;
  fullName?: string;
  username?: string;
  organizationType?: string;
  organizationName?: string;
  recoveryCode?: string;
};

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  updateProfile: (updates: Partial<{ full_name?: string; city?: string; state?: string; organization_name?: string; profile_completion?: number; }>) => Promise<void>;
  signupWithProfile: (data: SignupData) => Promise<{ uid: string; systemId?: string; syncStatus: "synced" | "pending" }>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  resetPasswordWithRecoveryCode: (email: string, password: string, recoveryCode: string) => Promise<void>;
  logout: () => Promise<void>;
  getUserRole: () => UserRole | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// session persistence is handled by Supabase; no local session caching.

const getUserProfile = async (uid: string) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, role, username, full_name, organization_type, organization_name, system_id, reset_code, profile_completion")
      .eq("id", uid)
      .single();

    if (error) {
      if ((error as any).code === "PGRST116") {
        return null;
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.warn("Supabase profile fetch failed:", error);
    return null;
  }
};

const persistUserProfile = async (
  uid: string,
  email: string | null,
  role: UserRole,
  profileData?: {
    fullName?: string;
    username?: string;
    organizationType?: string;
    organizationName?: string;
    systemId?: string;
  }
) => {
  const payload = {
    id: uid,
    email: email ?? null,
    role,
    username: profileData?.username ?? null,
    full_name: profileData?.fullName ?? null,
    organization_type: profileData?.organizationType ?? null,
    organization_name: profileData?.organizationName ?? null,
    system_id: profileData?.systemId ?? null,
    profile_completion: profileData?.systemId ? 100 : null,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("profiles").upsert(payload, { returning: "minimal" });
  if (error) {
    console.warn("Supabase profile persist failed:", error);
    throw error;
  }
};
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        console.log("[auth] initializing: checking existing session");
        const { data } = await supabase.auth.getSession();
        const sessionData = data.session;

        if (!sessionData || !sessionData.user) {
          if (mounted) setLoading(false);
          return;
        }

        const authUser = sessionData.user;
        console.log("[auth] session found:", authUser);

        const profile = await getUserProfile(authUser.id);
        const resolvedRole = (profile?.role as UserRole) ?? "user";

        if (!profile) {
          console.log("[auth] no profile found — creating profile row for:", authUser.id);
          await persistUserProfile(authUser.id, authUser.email, resolvedRole, {
            fullName: authUser.user_metadata?.full_name ?? undefined,
            username: authUser.user_metadata?.username ?? undefined,
          });
        }

        if (!mounted) return;
        setUser({ uid: authUser.id, email: authUser.email, provider: "supabase", profile_completion: profile?.profile_completion });
        setRole(resolvedRole);
      } catch (error) {
        console.warn("[auth] initialize failed:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, sessionData) => {
      try {
        console.log("[auth] onAuthStateChange event:", _event, sessionData?.session?.user?.id ?? null);
        const userObj = sessionData?.session?.user ?? null;
        if (!userObj) {
          setUser(null);
          setRole(null);
          setLoading(false);
          return;
        }

        const profile = await getUserProfile(userObj.id);
        const resolvedRole = (profile?.role as UserRole) ?? "user";

        if (!profile) {
          console.log("[auth] creating profile after auth change for:", userObj.id);
          await persistUserProfile(userObj.id, userObj.email, resolvedRole, {
            fullName: userObj.user_metadata?.full_name ?? undefined,
            username: userObj.user_metadata?.username ?? undefined,
          });
        }

        setUser({ uid: userObj.id, email: userObj.email, provider: "supabase", profile_completion: profile?.profile_completion });
        setRole(resolvedRole);
      } catch (error) {
        console.warn("[auth] onAuthStateChange handler failed:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const setAuthState = (nextUser: AuthUser, nextRole: UserRole) => {
    setUser(nextUser);
    setRole(nextRole);
  };

  const resolveRole = async (uid: string, fallbackRole: UserRole) => {
    try {
      const profile = await getUserProfile(uid);
      if (profile?.role) return profile.role as UserRole;
    } catch (error) {
      console.warn("[auth] role lookup failed:", error);
    }
    return fallbackRole;
  };

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    try {
      const normalized = String(username || "").toLowerCase().trim().replace(/\s+/g, "");
      if (!normalized) return false;
      const { data, error } = await supabase.from("profiles").select("id", { count: "exact" }).eq("username", normalized).limit(1);
      if (error) {
        console.warn("[auth] username check skipped:", error);
        return true;
      }
      return !data?.length;
    } catch (error) {
      console.warn("[auth] username check error:", error);
      return true;
    }
  };

  const login = async (email: string, password: string) => {
    const normalizedEmail = String(email).trim().toLowerCase();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) throw error;
      const userId = data.user?.id;
      if (!userId) throw new Error("Unable to resolve user from Supabase login response.");
      const profile = await getUserProfile(userId);
      const resolvedRole = (profile?.role as UserRole) ?? "user";
      if (!profile) await persistUserProfile(userId, normalizedEmail, resolvedRole);
      setAuthState({ uid: userId, email: normalizedEmail, provider: "supabase", profile_completion: profile?.profile_completion }, resolvedRole);
      console.log("[auth] login successful:", userId);
    } catch (error) {
      console.warn("[auth] login failed:", error);
      throw error;
    }
  };

  const signup = async (email: string, password: string) => {
    const normalizedEmail = String(email).trim().toLowerCase();
    try {
      const { data, error } = await supabase.auth.signUp({ email: normalizedEmail, password });
      if (error) throw error;
      const uid = data.user?.id;
      if (uid) {
        await persistUserProfile(uid, normalizedEmail, "user");
        setAuthState({ uid, email: normalizedEmail, provider: "supabase" }, "user");
        console.log("[auth] signup successful:", uid);
      }
    } catch (error) {
      console.warn("[auth] signup failed:", error);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      await supabase.auth.signInWithOAuth({ provider: "google" });
    } catch (err) {
      console.warn("[auth] Google sign-in failed:", err);
      throw err;
    }
  };

  const updateProfile = async (updates: Partial<{ full_name?: string; city?: string; state?: string; organization_name?: string; profile_completion?: number; }>) => {
    if (!user) throw new Error("Not authenticated");
    const payload: any = { id: user.uid, updated_at: new Date().toISOString(), ...updates };
    try {
      const { error } = await supabase.from("profiles").upsert(payload, { returning: "minimal" });
      if (error) throw error;
      const profile = await getUserProfile(user.uid);
      const resolvedRole = (profile?.role as UserRole) ?? "user";
      setAuthState({ uid: user.uid, email: user.email, provider: "supabase", profile_completion: profile?.profile_completion }, resolvedRole);
    } catch (err) {
      console.warn("[auth] profile update failed:", err);
      throw err;
    }
  };

  const signupWithProfile = async (data: SignupData) => {
    const { email, password, fullName, username, organizationType, organizationName } = data;
    const normalizedEmail = String(email).trim().toLowerCase();
    try {
      const { data: signupData, error } = await supabase.auth.signUp({ email: normalizedEmail, password });
      if (error) throw error;
      const uid = signupData.user?.id;
      if (uid) {
        await persistUserProfile(uid, normalizedEmail, "user", { fullName, username, organizationType, organizationName });
        setAuthState({ uid, email: normalizedEmail, provider: "supabase" }, "user");
        return { uid, systemId: undefined, syncStatus: "synced" as const };
      }
      return { uid: "", systemId: undefined, syncStatus: "pending" as const };
    } catch (error) {
      console.warn("[auth] signupWithProfile failed:", error);
      throw error;
    }
  };

  const resetPasswordWithRecoveryCode = async (
    _email: string,
    _password: string,
    _recoveryCode: string,
  ) => {
    // Recovery-by-code flow removed. Use Supabase's reset password email flow instead.
    throw new Error("Recovery by local code is not supported. Use 'Forgot password' to request a reset email.");
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[auth] signOut failed:", err);
    }
    setRole(null);
    setUser(null);
  };

  const getUserRole = () => role;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        login,
        signup,
        signInWithGoogle,
        updateProfile,
        signupWithProfile,
        checkUsernameAvailable,
        resetPasswordWithRecoveryCode,
        logout,
        getUserRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
