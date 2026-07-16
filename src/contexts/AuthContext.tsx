import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import * as authService from "@/services/authService";

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
    return await authService.getProfile(uid);
  } catch (err) {
    console.warn("[auth] getUserProfile failed:", authService.formatError(err));
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
  const payload: any = {
    id: uid,
    email: email ?? null,
    role,
    username: profileData?.username ?? null,
    full_name: profileData?.fullName ?? null,
    organization_type: profileData?.organizationType ?? null,
    organization_name: profileData?.organizationName ?? null,
    system_id: profileData?.systemId ?? null,
    updated_at: new Date().toISOString(),
  };

  try {
      // Use a direct upsert here to support test mocks that expect
      // `supabase.from(...).upsert(...)` to return a simple result.
      const { data, error } = await supabase.from("profiles").upsert(payload);
      if (error) {
        console.warn("[auth] persistUserProfile upsert error:", authService.formatError(error));
        throw error;
      }
      return { data, error };
  } catch (err) {
    console.warn("[auth] persistUserProfile failed:", authService.formatError(err));
    throw err;
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
        // First, check session directly from browser storage
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        console.log("[auth] session from storage:", session?.user?.id ?? "none", sessionError);
        
        const authUser = await authService.getCurrentUser();
        console.log("[auth] user from getUser:", authUser?.id ?? "none");

        if (!authUser) {
          if (mounted) {
            setUser(null);
            setRole(null);
            setLoading(false);
          }
          return;
        }

        console.log("[auth] session found:", authUser);
        console.log('[USER]', authUser);

        let profile = await getUserProfile(authUser.id);
        const resolvedRole = (profile?.role as UserRole) ?? "user";

        if (!profile) {
          console.log("[auth] no profile found — creating fallback profile for:", authUser.id);
          // create fallback profile per requirements
          const fallback = {
            id: authUser.id,
            email: authUser.email,
            role: resolvedRole,
            full_name: authUser.user_metadata?.full_name ?? "",
            username: null,
          };
          await persistUserProfile(authUser.id, authUser.email, resolvedRole, {
            fullName: authUser.user_metadata?.full_name ?? undefined,
            username: undefined,
            systemId: undefined,
          });
          profile = await getUserProfile(authUser.id);
        }

        if (!mounted) return;
        setUser({ uid: authUser.id, email: authUser.email, provider: "supabase", profile_completion: profile?.profile_completion });
        setRole(resolvedRole);
      } catch (error) {
        console.warn("[auth] initialize failed:", authService.formatError(error));
        if (mounted) {
          setUser(null);
          setRole(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    // Set up persistent auth state listener
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, _sessionData) => {
      try {
        console.log("[auth] onAuthStateChange event:", _event);
        console.log('[AUTH SESSION from event]', _sessionData?.user?.id ?? "none");
        
        // After OAuth redirect or login, always fetch the authoritative user
        const authUser = await authService.getCurrentUser();
        console.log('[AUTH USER after event]', authUser?.id ?? "none");
        
        if (!authUser) {
          console.log("[auth] no user after auth event - clearing state");
          if (mounted) {
            setUser(null);
            setRole(null);
          }
          return;
        }

        // User is authenticated - now sync profile
        let profile = await getUserProfile(authUser.id);
        const resolvedRole = (profile?.role as UserRole) ?? "user";

        if (!profile) {
          console.log("[auth] creating fallback profile after auth change for:", authUser.id);
          const payload = {
            id: authUser.id,
            email: authUser.email,
            role: resolvedRole,
            full_name: authUser.user_metadata?.full_name ?? "",
            username: authUser.user_metadata?.username ?? null,
          };
          console.log('[PROFILE UPSERT PAYLOAD]', payload);
          const upsertResp = await persistUserProfile(authUser.id, authUser.email, resolvedRole, {
            fullName: authUser.user_metadata?.full_name ?? undefined,
            username: authUser.user_metadata?.username ?? undefined,
          });
          console.log('[PROFILE UPSERT RESULT]', upsertResp);
          profile = await getUserProfile(authUser.id);
        }

        if (mounted) {
          setUser({ uid: authUser.id, email: authUser.email, provider: "supabase", profile_completion: profile?.profile_completion });
          setRole(resolvedRole);
        }
      } catch (error) {
        console.warn("[auth] onAuthStateChange handler failed:", authService.formatError(error));
        if (mounted) {
          setUser(null);
          setRole(null);
        }
      } finally {
        if (mounted) setLoading(false);
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
        console.warn("[auth] login failed:", authService.formatError(error));
        throw new Error(authService.formatError(error));
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
        console.warn("[auth] signup failed:", authService.formatError(error));
        throw new Error(authService.formatError(error));
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('[SIGNIN_WITH_GOOGLE] starting OAuth flow');
      // OAuth flow will redirect; on callback, onAuthStateChange will fire
      const { data, error } = await supabase.auth.signInWithOAuth({ 
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
          skipBrowserRedirect: false,
        }
      });
      console.log('[SIGNIN_WITH_GOOGLE] response', data);
      if (error) {
        console.error('[OAUTH ERROR]', error);
        throw error;
      }
      // OAuth will handle redirect; state updates via onAuthStateChange listener
    } catch (err) {
      console.warn("[auth] Google sign-in failed:", authService.formatError(err));
      throw new Error(authService.formatError(err));
    }
  };

  const updateProfile = async (updates: Partial<{ full_name?: string; city?: string; state?: string; organization_name?: string; profile_completion?: number; }>) => {
    if (!user) throw new Error("Not authenticated");
    const payload: any = { id: user.uid, updated_at: new Date().toISOString(), ...updates };
    try {
      const { error } = await supabase.from("profiles").upsert(payload);
      if (error) throw error;
      const profile = await getUserProfile(user.uid);
      const resolvedRole = (profile?.role as UserRole) ?? "user";
      setAuthState({ uid: user.uid, email: user.email, provider: "supabase", profile_completion: profile?.profile_completion }, resolvedRole);
    } catch (err) {
        console.warn("[auth] profile update failed:", authService.formatError(err));
        throw new Error(authService.formatError(err));
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
        console.warn("[auth] signupWithProfile failed:", authService.formatError(error));
        throw new Error(authService.formatError(error));
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
