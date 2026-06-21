import React, { createContext, useContext, useEffect, useState } from "react";
import * as bcrypt from "bcryptjs";
import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
} from "firebase/auth";
import { auth, db, isFirebaseConfigured } from "../firebase";
import { where, serverTimestamp } from "firebase/firestore";
import { docSafe, collectionSafe, getDocSafe, setDocSafe, getDocsSafe, querySafe } from "@/lib/firestoreSafe";
import {
  queuePendingSignup as syncQueuePendingSignup,
  removePendingSignup as syncRemovePendingSignup,
  readPendingSignups as syncReadPendingSignups,
} from "@/lib/syncEngine";
import { getConnectionSnapshot } from "@/lib/connectionManager";

type UserRole = "user" | "admin";

type AuthUser = {
  uid: string;
  email: string | null;
  provider: "firebase" | "local";
};

type LocalAccount = {
  uid: string;
  email: string;
  password: string;
  role: UserRole;
  resetCode?: string;
  fullName?: string;
  username?: string;
  organization?: string;
  systemId?: string;
};

type SignupData = {
  email: string;
  password: string;
  fullName: string;
  username: string;
  organizationType: string;
  organizationName?: string;
  recoveryCode: string;
};

const LOCAL_ACCOUNTS_KEY = "hydrosentinel.localAccounts";
const LOGIN_ATTEMPTS_KEY = "hydrosentinel.loginAttempts";
const LOCAL_SESSION_KEY = "hydrosentinel.session";
const PENDING_SIGNUPS_KEY = "hydrosentinel.pendingSignups";
const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_HASH_ROUNDS = 12;
const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const DEMO_ACCOUNTS: LocalAccount[] = [
  {
    uid: "demo-user",
    email: "user@demo.com",
    password: "password",
    role: "user",
    resetCode: "1234",
  },
  {
    uid: "admin-nikhil",
    email: "nikhil@admin.com",
    password: "$2b$12$J3AYQrgqtTX0Aibn/siaoeF0sziefYJTwJ9vq1xa0St9d5PtxED.m",
    role: "admin",
    resetCode: "1234",
  },
  {
    uid: "admin-harsh",
    email: "harsh@admin.com",
    password: "$2b$12$Vjhh19iCPF6kF0UMKFjDruiTRpgP3.DLXpY693TlA/PJxkld5lQS2",
    role: "admin",
    resetCode: "1234",
  },
  {
    uid: "admin-himanshu",
    email: "himanshu@admin.com",
    password: "$2b$12$xRspQZ8Tm4vRb6lXSkl3OecWHwPmvppP3zhqfkBPPh4NJxBOPVuaa",
    role: "admin",
    resetCode: "1234",
  },
  {
    uid: "admin-kartik",
    email: "kartik@admin.com",
    password: "$2b$12$kFBj/0ZDWPApwepo2VHj5O4pXw54MywPKEYqirM94aKv6JsYlckAq",
    role: "admin",
    resetCode: "1234",
  },
  {
    uid: "admin-khushi",
    email: "khushi@admin.com",
    password: "$2b$12$Qd28ijAc3oZVrmq3H6ykO.olL0zP79q8B8VZFOtN03ACc83KDac8e",
    role: "admin",
    resetCode: "1234",
  },
];

interface AuthContextType {
  user: AuthUser | null;
  role: UserRole | null;
  loading: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  signup: (email: string, password: string, role: UserRole, resetCode: string) => Promise<void>;
  signupWithProfile: (data: SignupData) => Promise<{ uid: string; systemId: string; syncStatus: "synced" | "pending" }>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  resetPasswordWithRecoveryCode: (email: string, password: string, recoveryCode: string) => Promise<void>;
  logout: () => Promise<void>;
  getUserRole: () => UserRole | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type LoginAttemptState = {
  failures: number;
  lockUntil: number | null;
  updatedAt: string;
};

const isBcryptHash = (value: string) => /^\$2[aby]\$\d{2}\$/.test(value);

const readJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
      return fallback;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
};

const saveJson = <T,>(key: string, value: T) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
};

const hashPassword = async (password: string) => bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

const verifyPassword = async (password: string, storedPassword: string) => {
  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(password, storedPassword);
  }

  return password === storedPassword;
};

const normalizeLocalAccounts = (accounts: LocalAccount[]) => {
  const accountMap = new Map<string, LocalAccount>();

  for (const account of accounts) {
    accountMap.set(normalizeEmail(account.email), {
      ...account,
      email: normalizeEmail(account.email),
    });
  }

  return Array.from(accountMap.values());
};

const readLoginAttempts = (): Record<string, LoginAttemptState> =>
  readJson<Record<string, LoginAttemptState>>(LOGIN_ATTEMPTS_KEY, {});

const saveLoginAttempts = (attempts: Record<string, LoginAttemptState>) => {
  saveJson(LOGIN_ATTEMPTS_KEY, attempts);
};

const getLoginAttemptKey = (email: string) => normalizeEmail(email);

const getLockoutMessage = (lockUntil: number) => {
  const remainingMs = Math.max(lockUntil - Date.now(), 0);
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `Too many failed login attempts. Please wait ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"} and try again.`;
};

const clearLoginAttempts = (email: string) => {
  const key = getLoginAttemptKey(email);
  const attempts = readLoginAttempts();

  if (attempts[key]) {
    delete attempts[key];
    saveLoginAttempts(attempts);
  }
};

const ensureLoginAllowed = (email: string) => {
  const key = getLoginAttemptKey(email);
  const attempts = readLoginAttempts();
  const state = attempts[key];

  if (!state) {
    return;
  }

  if (state.lockUntil && state.lockUntil > Date.now()) {
    throw new Error(getLockoutMessage(state.lockUntil));
  }

  if (state.lockUntil && state.lockUntil <= Date.now()) {
    delete attempts[key];
    saveLoginAttempts(attempts);
  }
};

const recordLoginFailure = (email: string) => {
  const key = getLoginAttemptKey(email);
  const attempts = readLoginAttempts();
  const previous = attempts[key];
  const failures = (previous?.failures ?? 0) + 1;

  attempts[key] = {
    failures,
    lockUntil: failures >= LOGIN_LOCKOUT_THRESHOLD ? Date.now() + LOGIN_LOCKOUT_DURATION_MS : previous?.lockUntil ?? null,
    updatedAt: new Date().toISOString(),
  };

  saveLoginAttempts(attempts);
};

const migrateLegacyLocalAccount = async (account: LocalAccount) => {
  if (isBcryptHash(account.password)) {
    return account;
  }

  const hashedPassword = await hashPassword(account.password);
  return { ...account, password: hashedPassword };
};

const migrateLegacyAccounts = async () => {
  const accounts = readLocalAccounts();
  const migratedAccounts = await Promise.all(accounts.map((account) => migrateLegacyLocalAccount(account)));
  saveLocalAccounts(migratedAccounts);
};

const readLocalAccounts = (): LocalAccount[] => {
  if (typeof window === "undefined") {
    return normalizeLocalAccounts(DEMO_ACCOUNTS);
  }

  try {
    const rawAccounts = window.localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (!rawAccounts) {
      return normalizeLocalAccounts(DEMO_ACCOUNTS);
    }

    const parsedAccounts = JSON.parse(rawAccounts) as LocalAccount[];
    return normalizeLocalAccounts([...DEMO_ACCOUNTS, ...parsedAccounts]);
  } catch {
    return normalizeLocalAccounts(DEMO_ACCOUNTS);
  }
};

const saveLocalAccounts = (accounts: LocalAccount[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(normalizeLocalAccounts(accounts)));
};

const saveSession = (session: { user: AuthUser; role: UserRole } | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(LOCAL_SESSION_KEY);
    return;
  }

  window.localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(session));
};

const readSession = (): { user: AuthUser; role: UserRole } | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawSession = window.localStorage.getItem(LOCAL_SESSION_KEY);
    if (!rawSession) {
      return null;
    }

    return JSON.parse(rawSession) as { user: AuthUser; role: UserRole };
  } catch {
    return null;
  }
};

type PendingSignup = SignupData & {
  selectedRole: UserRole;
  queuedAt: string;
  authUid?: string;
  syncUid?: string;
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const assertStrongPassword = (password: string) => {
  if (password.trim().length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`);
  }
};

const buildPendingSignup = (
  data: SignupData,
  selectedRole: UserRole,
  syncUid?: string,
  authUid?: string,
): PendingSignup => ({
  email: normalizeEmail(data.email),
  password: data.password,
  fullName: data.fullName,
  username: normalizeUsername(data.username),
  organizationType: data.organizationType,
  organizationName: data.organizationName,
  recoveryCode: data.recoveryCode,
  selectedRole,
  queuedAt: new Date().toISOString(),
  syncUid,
  authUid,
});

const isBrowserOnline = () =>
  typeof window === "undefined" ? true : getConnectionSnapshot().status !== "OFFLINE";

const readPendingSignups = (): PendingSignup[] => {
  return syncReadPendingSignups();
};

const purgePendingSignups = () => {
  const pendingSignups = readPendingSignups();

  for (const item of pendingSignups) {
    removePendingSignup(item.email);
  }
};

const savePendingSignups = (items: PendingSignup[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PENDING_SIGNUPS_KEY, JSON.stringify(items));
};

const queuePendingSignup = (signup: PendingSignup) => {
  void syncQueuePendingSignup(signup);
};

const removePendingSignup = (email: string) => {
  syncRemovePendingSignup(email);
};

const getAuthErrorCode = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: string }).code ?? "")
    : "";

const isRetryableSyncError = (error: unknown) => {
  const code = getAuthErrorCode(error);
  return ["auth/network-request-failed", "unavailable", "deadline-exceeded", "resource-exhausted", "aborted"].includes(code);
};

const isTransientAuthError = (error: unknown) => {
  const code = getAuthErrorCode(error);
  return [
    "auth/network-request-failed",
    "auth/configuration-not-found",
    "auth/invalid-api-key",
    "auth/app-deleted",
    "auth/unauthorized-domain",
  ].includes(code);
};

const normalizeUsername = (username: string): string => {
  return username
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_-]/g, "");
};

const generateSystemId = (organization: string, username: string): string => {
  const orgPart = organization
    .toUpperCase()
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join("")
    .slice(0, 10);
  const userPart = normalizeUsername(username).slice(0, 10);
  return `${orgPart}_${userPart}`.slice(0, 20);
};

const persistUserDoc = async (
  uid: string,
  email: string | null,
  role: UserRole,
  resetCode?: string,
  profileData?: {
    fullName?: string;
    username?: string;
    organizationType?: string;
    organizationName?: string;
    systemId?: string;
  }
) => {
  try {
    if (!db || !isFirebaseConfigured) {
      console.warn("persistUserDoc skipped: Firebase not configured");
      return;
    }

    await setDocSafe(
      docSafe(db, "users", uid),
      {
        email: email ? normalizeEmail(email) : null,
        role,
        resetCode: resetCode ?? null,
        fullName: profileData?.fullName ?? null,
        username: profileData?.username ?? null,
        organizationType: profileData?.organizationType ?? null,
        organizationName: profileData?.organizationName ?? null,
        organization: profileData?.organizationName ?? profileData?.organizationType ?? null,
        systemId: profileData?.systemId ?? null,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        locations: role === "user" ? ["default"] : [],
        uniqueId: `USER_${uid.slice(0, 8).toUpperCase()}`,
      },
      { merge: true }
    );
  } catch (error) {
    console.warn("Firestore sync skipped:", error);
    throw error;
  }
};

const getErrorMessage = (error: unknown) => {
  const code = getAuthErrorCode(error);
  const mapped: Record<string, string> = {
    "auth/network-request-failed":
      "Unable to connect to login service. Please check your internet connection and try again.",
    "auth/configuration-not-found":
      "Authentication is not configured correctly. Please contact support.",
    "auth/invalid-api-key":
      "There is a problem with the login system configuration. Please refresh the page or try again later.",
    "auth/app-deleted":
      "Authentication service is unavailable at the moment. Please try again later.",
    "auth/unauthorized-domain":
      "This website is not authorized for login. Please use the official Hydrosentinel site.",
    "auth/user-not-found":
      "No account was found for that email. Please check your email or sign up.",
    "auth/wrong-password":
      "Incorrect password. Please try again or reset your password.",
    "auth/invalid-email":
      "Please enter a valid email address.",
    "auth/too-many-requests":
      "Too many login attempts. Please wait a few minutes and try again.",
    "auth/user-disabled":
      "This account has been disabled. If you think this is a mistake, contact support.",
    "auth/email-already-in-use":
      "An account already exists with this email address.",
    "auth/weak-password":
      `Please choose a stronger password with at least ${PASSWORD_MIN_LENGTH} characters.`,
    "auth/operation-not-allowed":
      "Email/password sign-in is currently disabled for this project.",
    "auth/invalid-credential":
      "The email or password is incorrect.",
    "permission-denied":
      "Your account was created, but Firebase denied the profile write. Please contact support or check Firestore rules.",
    "unavailable":
      "Firebase is temporarily unavailable. Please try again shortly.",
    "failed-precondition":
      "Firebase is not ready to save this account yet. Please try again.",
    "deadline-exceeded":
      "Firebase timed out while saving this account. Please try again.",
    "resource-exhausted":
      "Firebase quota was exceeded while saving this account. Please try again later.",
    "aborted":
      "Firebase cancelled the account save. Please try again.",
  };

  if (mapped[code]) {
    return mapped[code];
  }

  if (error instanceof Error) {
    if (error.message.includes("Firebase Auth is temporarily unavailable")) {
      return "Login service is temporarily unavailable. Try again when you are online, or use a cached local account if available.";
    }

    return error.message;
  }

  return "Authentication failed. Please try again.";
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = readSession();

    if (session) {
      setUser(session.user);
      setRole(session.role);
    }

    const flushPendingSignups = async () => {
      if (!isBrowserOnline()) {
        return;
      }

      const pendingSignups = readPendingSignups();
      if (pendingSignups.length === 0) {
        return;
      }

      const remaining: PendingSignup[] = [];

      for (const item of pendingSignups) {
        try {
          const credential = item.authUid
            ? { user: { uid: item.authUid, email: item.email } }
            : await createUserWithEmailAndPassword(auth, item.email, item.password);
          const nextRole = item.selectedRole;
          const orgForSystem =
            item.organizationName && item.organizationName.trim().length > 0
              ? item.organizationName
              : item.organizationType;
          const systemId = generateSystemId(orgForSystem ?? "ORG", item.username);

          await persistUserDoc(credential.user.uid, item.email, nextRole, item.recoveryCode.trim(), {
            fullName: item.fullName,
            username: normalizeUsername(item.username),
            organizationType: item.organizationType,
            organizationName: item.organizationName ?? null,
            systemId,
          });

          const localAccount: LocalAccount = {
            uid: credential.user.uid,
            email: item.email,
            password: item.password,
            role: nextRole,
            resetCode: item.recoveryCode.trim(),
            fullName: item.fullName,
            username: normalizeUsername(item.username),
            organization: item.organizationName ?? item.organizationType,
            systemId,
          };
          updateLocalAccount(localAccount);

          if (readSession()?.user.email?.toLowerCase() === normalizeEmail(item.email)) {
            setAuthState({ uid: credential.user.uid, email: credential.user.email, provider: "firebase" }, nextRole);
          }

          removePendingSignup(item.email);
        } catch (error) {
          if (getAuthErrorCode(error) === "auth/email-already-in-use" && !item.authUid) {
            try {
              const recovered = await signInWithEmailAndPassword(auth, item.email, item.password);
              const nextRole = item.selectedRole;
              const orgForSystem =
                item.organizationName && item.organizationName.trim().length > 0
                  ? item.organizationName
                  : item.organizationType;
              const systemId = generateSystemId(orgForSystem ?? "ORG", item.username);

              await persistUserDoc(recovered.user.uid, item.email, nextRole, item.recoveryCode.trim(), {
                fullName: item.fullName,
                username: normalizeUsername(item.username),
                organizationType: item.organizationType,
                organizationName: item.organizationName ?? null,
                systemId,
              });

              updateLocalAccount({
                uid: recovered.user.uid,
                email: item.email,
                password: item.password,
                role: nextRole,
                resetCode: item.recoveryCode.trim(),
                fullName: item.fullName,
                username: normalizeUsername(item.username),
                organization: item.organizationName ?? item.organizationType,
                systemId,
              });

              if (readSession()?.user.email?.toLowerCase() === normalizeEmail(item.email)) {
                setAuthState({ uid: recovered.user.uid, email: recovered.user.email, provider: "firebase" }, nextRole);
              }

              removePendingSignup(item.email);
              continue;
            } catch (retryError) {
              console.warn("Pending signup recovery failed:", retryError);
            }
          }

          console.warn("Pending signup sync failed:", error);
          remaining.push(item);
        }
      }

      savePendingSignups(remaining);
    };

    void migrateLegacyAccounts();
    purgePendingSignups();
    savePendingSignups([]);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth user:", firebaseUser);

      if (!firebaseUser) {
        if (!session) {
          setUser(null);
          setRole(null);
        }
        setLoading(false);
        return;
      }

      if (!db || !isFirebaseConfigured) {
        // Firestore not available: set minimal auth state and continue
        setAuthState(
          { uid: firebaseUser.uid, email: firebaseUser.email, provider: "firebase" },
          "user",
        );
        setLoading(false);
        return;
      }

      const firestoreUserRef = docSafe(db, "users", firebaseUser.uid);
      try {
        const userDoc = await getDocSafe(firestoreUserRef);
        console.log("Firestore user:", userDoc.data());

        if (!userDoc.exists()) {
          await persistUserDoc(firebaseUser.uid, firebaseUser.email, "user");
        } else {
          await setDocSafe(
            firestoreUserRef,
            {
              email: normalizeEmail(firebaseUser.email ?? userDoc.data()?.email ?? ""),
              lastLoginAt: serverTimestamp(),
            },
            { merge: true },
          );
        }
      } catch (error) {
        console.warn("Firestore profile refresh failed:", error);
      }

      const refreshedDoc = await getDocSafe(firestoreUserRef);
      const resolvedRole = (refreshedDoc.data()?.role as UserRole | undefined) ?? "user";

      setAuthState(
        {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          provider: "firebase",
        },
        resolvedRole,
      );
      setLoading(false);
    });

    const handleOnline = () => {
      console.log("[Auth] Connection restored, flushing pending signups");
      void flushPendingSignups();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isBrowserOnline()) {
        console.log("[Auth] App became visible, flushing pending signups");
        void flushPendingSignups();
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    void flushPendingSignups();
    if (!session) {
      setLoading(false);
    }

    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const setAuthState = (nextUser: AuthUser, nextRole: UserRole) => {
    setUser(nextUser);
    setRole(nextRole);
    saveSession({ user: nextUser, role: nextRole });
  };

  const findLocalAccount = (email: string) =>
    readLocalAccounts().find((account) => account.email.toLowerCase() === email.toLowerCase());

  const updateLocalAccount = (nextAccount: LocalAccount) => {
    const existingAccounts = readLocalAccounts().filter(
      (account) => account.email.toLowerCase() !== nextAccount.email.toLowerCase()
    );
    saveLocalAccounts([...existingAccounts, nextAccount]);
  };

  const persistLocalSession = (nextUser: AuthUser, nextRole: UserRole) => {
    setAuthState(nextUser, nextRole);
  };

  const resolveRole = async (uid: string, fallbackRole: UserRole) => {
    try {
      const userDoc = await getDocSafe(docSafe(db, "users", uid));
      if (userDoc.exists()) {
        return userDoc.data().role as UserRole;
      }
    } catch (error) {
      console.warn("Role lookup skipped:", error);
    }

    return fallbackRole;
  };

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    try {
      const normalizedUsername = normalizeUsername(username);
      if (!normalizedUsername) {
        return false;
      }

      if (!isBrowserOnline()) {
        return !readLocalAccounts().some(
          (account) => normalizeUsername(account.username ?? "") === normalizedUsername,
        );
      }

      const usersRef = collectionSafe(db, "users");
      const q = querySafe(usersRef, where("username", "==", normalizedUsername));
      const snapshot = await getDocsSafe(q);
      return snapshot.empty;
    } catch (error) {
      console.warn("Username check skipped:", error);
      return true;
    }
  };

  const login = async (email: string, password: string, selectedRole: UserRole) => {
    ensureLoginAllowed(email);
    const localAccount = findLocalAccount(email);
    if (!isBrowserOnline()) {
      if (localAccount && (await verifyPassword(password, localAccount.password))) {
        if (localAccount.role !== selectedRole) {
          recordLoginFailure(email);
          throw new Error("Role mismatch or user not found");
        }

        if (!isBcryptHash(localAccount.password)) {
          updateLocalAccount(await migrateLegacyLocalAccount(localAccount));
        }

        clearLoginAttempts(email);
        persistLocalSession(
          { uid: localAccount.uid, email: localAccount.email, provider: "local" },
          selectedRole,
        );
        return;
      }

      recordLoginFailure(email);
      throw new Error("Offline: this account is not cached locally. Connect once to sign in.");
    }

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const firestoreRef = docSafe(db, "users", result.user.uid);
      const userDoc = await getDocSafe(firestoreRef);

      if (!userDoc.exists()) {
        await persistUserDoc(result.user.uid, result.user.email, selectedRole);
      } else {
        await setDocSafe(
          firestoreRef,
          { lastLoginAt: serverTimestamp(), email: normalizeEmail(result.user.email ?? email) },
          { merge: true },
        );
      }

      const resolvedRole = await resolveRole(result.user.uid, selectedRole);

      if (resolvedRole !== selectedRole) {
        await signOut(auth);
        recordLoginFailure(email);
        throw new Error("Role mismatch or user not found");
      }

      clearLoginAttempts(email);
      setAuthState(
        { uid: result.user.uid, email: result.user.email, provider: "firebase" },
        resolvedRole,
      );
    } catch (error) {
      if (localAccount && (await verifyPassword(password, localAccount.password))) {
        if (localAccount.role !== selectedRole) {
          recordLoginFailure(email);
          throw new Error("Role mismatch or user not found");
        }

        if (!isBcryptHash(localAccount.password)) {
          updateLocalAccount(await migrateLegacyLocalAccount(localAccount));
        }

        clearLoginAttempts(email);
        persistLocalSession(
          { uid: localAccount.uid, email: localAccount.email, provider: "local" },
          selectedRole,
        );
        return;
      }

      if (isTransientAuthError(error)) {
        throw new Error("Firebase Auth is temporarily unavailable. Try again when online.");
      }

      recordLoginFailure(email);
      throw new Error(getErrorMessage(error));
    }
  };

  const signup = async (
    email: string,
    password: string,
    selectedRole: UserRole,
    resetCode: string
  ) => {
    const normalizedEmail = normalizeEmail(email);
    assertStrongPassword(password);

    if (!isBrowserOnline()) {
      const nextAccount: LocalAccount = {
        uid: crypto.randomUUID(),
        email: normalizedEmail,
        password: await hashPassword(password),
        role: selectedRole,
        resetCode: resetCode.trim(),
      };
      updateLocalAccount(nextAccount);
      persistLocalSession(
        { uid: nextAccount.uid, email: nextAccount.email, provider: "local" },
        selectedRole,
      );
      return;
    }

    try {
      const credential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      try {
        await persistUserDoc(credential.user.uid, normalizedEmail, selectedRole, resetCode.trim());
      } catch (error) {
        if (isRetryableSyncError(error)) {
          const nextAccount: LocalAccount = {
            uid: credential.user.uid,
            email: normalizedEmail,
            password: await hashPassword(password),
            role: selectedRole,
            resetCode: resetCode.trim(),
          };
          updateLocalAccount(nextAccount);
          persistLocalSession(
            { uid: nextAccount.uid, email: nextAccount.email, provider: "firebase" },
            selectedRole,
          );
          return;
        }

        await signOut(auth);
        throw new Error(getErrorMessage(error));
      }

      updateLocalAccount({
        uid: credential.user.uid,
        email: normalizedEmail,
        password: await hashPassword(password),
        role: selectedRole,
        resetCode: resetCode.trim(),
      });
      setAuthState(
        { uid: credential.user.uid, email: credential.user.email, provider: "firebase" },
        selectedRole,
      );
    } catch (error) {
      if (isTransientAuthError(error)) {
        const nextAccount: LocalAccount = {
          uid: crypto.randomUUID(),
          email: normalizedEmail,
          password: await hashPassword(password),
          role: selectedRole,
          resetCode: resetCode.trim(),
        };
        updateLocalAccount(nextAccount);
        persistLocalSession(
          { uid: nextAccount.uid, email: nextAccount.email, provider: "local" },
          selectedRole,
        );
        return;
      }

      throw new Error(getErrorMessage(error));
    }
  };

  const signupWithProfile = async (data: SignupData) => {
    const { email, password, fullName, username, organizationType, organizationName, recoveryCode } = data;

    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      throw new Error("Invalid username format");
    }

    const isAvailable = await checkUsernameAvailable(normalizedUsername);
    if (!isAvailable) {
      throw new Error("Username already taken");
    }

    const orgForSystem = organizationName && organizationName.trim().length > 0 ? organizationName : organizationType;
    const systemId = generateSystemId(orgForSystem ?? "ORG", normalizedUsername);
    assertStrongPassword(password);

    // Create user securely using Firebase Auth so passwords are not stored locally
    const normalizedEmail = normalizeEmail(email);

    const createLocalPendingSignup = async () => {
      const localUid = crypto.randomUUID();
      updateLocalAccount({
        uid: localUid,
        email: normalizedEmail,
        password: await hashPassword(password),
        role: "user",
        resetCode: recoveryCode.trim(),
        fullName,
        username: normalizedUsername,
        organization: organizationName ?? organizationType,
        systemId,
      });
      persistLocalSession({ uid: localUid, email: normalizedEmail, provider: "local" }, "user");
      return { uid: localUid, systemId, syncStatus: "pending" as const };
    };

    if (!isBrowserOnline()) {
      return createLocalPendingSignup();
    }

    try {
      const userCred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
      const uid = userCred.user.uid;

      try {
        await persistUserDoc(uid, normalizedEmail, "user", recoveryCode.trim(), {
          fullName,
          username: normalizedUsername,
          organizationType,
          organizationName: organizationName ?? null,
          systemId,
        });
      } catch (error) {
        if (isRetryableSyncError(error)) {
          updateLocalAccount({
            uid,
            email: normalizedEmail,
            password: await hashPassword(password),
            role: "user",
            resetCode: recoveryCode.trim(),
            fullName,
            username: normalizedUsername,
            organization: organizationName ?? organizationType,
            systemId,
          });
          setAuthState({ uid, email: normalizedEmail, provider: "firebase" }, "user");
          return { uid, systemId, syncStatus: "pending" as const };
        }

        await signOut(auth);
        throw new Error(getErrorMessage(error));
      }

      updateLocalAccount({
        uid,
        email: normalizedEmail,
        password: await hashPassword(password),
        role: "user",
        resetCode: recoveryCode.trim(),
        fullName,
        username: normalizedUsername,
        organization: organizationName ?? organizationType,
        systemId,
      });

      setAuthState({ uid, email: normalizedEmail, provider: "firebase" }, "user");

      return { uid, systemId, syncStatus: "synced" as const };
    } catch (error) {
      if (isTransientAuthError(error)) {
        return createLocalPendingSignup();
      }

      const msg = error instanceof Error ? error.message : "Signup failed";
      throw new Error(msg);
    }
  };
  const resetPasswordWithRecoveryCode = async (
    email: string,
    password: string,
    recoveryCode: string
  ) => {
    assertStrongPassword(password);
    const existingAccount = findLocalAccount(email);
    if (!existingAccount) {
      throw new Error("Account not found or cannot be recovered with code");
    }

    if (!existingAccount.resetCode || existingAccount.resetCode !== recoveryCode.trim()) {
      throw new Error("Invalid recovery code");
    }

    const updatedAccount: LocalAccount = {
      ...existingAccount,
      password: await hashPassword(password),
    };

    updateLocalAccount(updatedAccount);

    if (isBrowserOnline()) {
      await persistUserDoc(
        updatedAccount.uid,
        updatedAccount.email,
        updatedAccount.role,
        updatedAccount.resetCode,
      );
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch {
      // Ignore when Firebase Auth is not available in the current environment.
    }

    setRole(null);
    setUser(null);
    saveSession(null);
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

// Export for SyncMonitor to read pending signups
export const getPendingSignups = (): Array<SignupData & { selectedRole: UserRole; queuedAt: string; authUid?: string }> => {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem("hydrosentinel.pendingSignups");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const triggerPendingSignupSync = async () => {
  if (typeof window === "undefined") return;
  
  if (!isBrowserOnline()) {
    console.warn("[Sync] Cannot sync pending signups: offline");
    return;
  }

  const pendingSignups = readPendingSignups();
  if (pendingSignups.length === 0) {
    console.log("[Sync] No pending signups to sync");
    return;
  }

  console.log(`[Sync] Attempting to sync ${pendingSignups.length} pending signups`);
  const remaining: PendingSignup[] = [];

  for (const item of pendingSignups) {
    try {
      const credential = item.authUid
        ? { user: { uid: item.authUid, email: item.email } }
        : await createUserWithEmailAndPassword(auth, item.email, item.password);
      const nextRole = item.selectedRole;
      const orgForSystem =
        item.organizationName && item.organizationName.trim().length > 0
          ? item.organizationName
          : item.organizationType;
      const systemId = generateSystemId(orgForSystem ?? "ORG", item.username);

      await persistUserDoc(credential.user.uid, item.email, nextRole, item.recoveryCode.trim(), {
        fullName: item.fullName,
        username: normalizeUsername(item.username),
        organizationType: item.organizationType,
        organizationName: item.organizationName ?? null,
        systemId,
      });

      console.log(`[Sync] Successfully synced signup for ${item.email}`);
      removePendingSignup(item.email);
    } catch (error) {
      if (getAuthErrorCode(error) === "auth/email-already-in-use" && !item.authUid) {
        try {
          const recovered = await signInWithEmailAndPassword(auth, item.email, item.password);
          const nextRole = item.selectedRole;
          const orgForSystem =
            item.organizationName && item.organizationName.trim().length > 0
              ? item.organizationName
              : item.organizationType;
          const systemId = generateSystemId(orgForSystem ?? "ORG", item.username);

          await persistUserDoc(recovered.user.uid, item.email, nextRole, item.recoveryCode.trim(), {
            fullName: item.fullName,
            username: normalizeUsername(item.username),
            organizationType: item.organizationType,
            organizationName: item.organizationName ?? null,
            systemId,
          });

          console.log(`[Sync] Recovered and synced signup for ${item.email}`);
          removePendingSignup(item.email);
          continue;
        } catch (retryError) {
          console.warn(`[Sync] Failed to recover signup for ${item.email}:`, retryError);
        }
      }

      console.warn(`[Sync] Failed to sync signup for ${item.email}:`, error);
      remaining.push(item);
    }
  }

  savePendingSignups(remaining);
  console.log(`[Sync] Completed with ${remaining.length} failures`);
};

export type { SignupData };