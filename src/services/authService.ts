import {
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
  signOut,
  Auth,
} from "firebase/auth";
import { where } from "firebase/firestore";
import { auth, db } from "@/firebase";
import { docSafe, collectionSafe, getDocsSafe, querySafe, setDocSafe } from "@/lib/firestoreSafe";
import * as bcrypt from "bcryptjs";

const PASSWORD_HASH_ROUNDS = 12;
const LOGIN_LOCKOUT_THRESHOLD = 5;
const LOGIN_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPTS_KEY = "hydrosentinel.phoneLoginAttempts";

type LoginAttemptState = {
  failures: number;
  lockUntil: number | null;
  updatedAt: string;
};

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) {
      return fallback;
    }

    return JSON.parse(rawValue) as T;
  } catch {
    return fallback;
  }
};

const saveJson = <T,>(key: string, value: T) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const normalizePhone = (phone: string) => `+91${phone.replace(/\D/g, "").slice(-10)}`;

const isBcryptHash = (value: string) => /^\$2[aby]\$\d{2}\$/.test(value);

const hashPasswordSecure = async (password: string): Promise<string> => bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

const verifyPasswordSecure = async (password: string, hash: string): Promise<boolean> => {
  if (isBcryptHash(hash)) {
    return bcrypt.compare(password, hash);
  }

  const passwordHash = await hashPasswordSecure(password);
  return passwordHash === hash;
};

const readLoginAttempts = (): Record<string, LoginAttemptState> =>
  readJson<Record<string, LoginAttemptState>>(LOGIN_ATTEMPTS_KEY, {});

const saveLoginAttempts = (attempts: Record<string, LoginAttemptState>) => {
  saveJson(LOGIN_ATTEMPTS_KEY, attempts);
};

const getAttemptKey = (phone: string) => normalizePhone(phone);

const getLockoutMessage = (lockUntil: number) => {
  const remainingMs = Math.max(lockUntil - Date.now(), 0);
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return `Too many failed login attempts. Please wait ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"} and try again.`;
};

const ensureLoginAllowed = (phone: string) => {
  const key = getAttemptKey(phone);
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

const clearLoginAttempts = (phone: string) => {
  const key = getAttemptKey(phone);
  const attempts = readLoginAttempts();

  if (attempts[key]) {
    delete attempts[key];
    saveLoginAttempts(attempts);
  }
};

const recordLoginFailure = (phone: string) => {
  const key = getAttemptKey(phone);
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

export const hashPassword = async (password: string): Promise<string> => hashPasswordSecure(password);

export const verifyPasswordHash = async (password: string, hash: string): Promise<boolean> =>
  verifyPasswordSecure(password, hash);

// Initialize reCAPTCHA verifier (invisible)
export const initializeRecaptcha = (auth: Auth): RecaptchaVerifier => {
  try {
    return new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
      callback: (token) => {
        console.log("reCAPTCHA token received:", token);
      },
    });
  } catch (error) {
    console.error("Error initializing reCAPTCHA:", error);
    throw new Error("Failed to initialize reCAPTCHA");
  }
};

// Send OTP to phone number
export const sendOTP = async (phoneNumber: string): Promise<ConfirmationResult> => {
  try {
    const cleanedNumber = phoneNumber.replace(/\D/g, "");
    if (cleanedNumber.length < 10) {
      throw new Error("Invalid phone number format");
    }

    let formattedNumber = phoneNumber;
    if (!phoneNumber.startsWith("+")) {
      formattedNumber = "+91" + cleanedNumber.slice(-10);
    }

    const recaptchaVerifier = initializeRecaptcha(auth);
    const confirmationResult = await signInWithPhoneNumber(
      auth,
      formattedNumber,
      recaptchaVerifier
    );

    return confirmationResult;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to send OTP";
    throw new Error(errorMessage);
  }
};

// Verify OTP
export const verifyOTP = async (
  confirmationResult: ConfirmationResult,
  otp: string
): Promise<string> => {
  try {
    const userCredential = await confirmationResult.confirm(otp);
    return userCredential.user.uid;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Invalid OTP";
    throw new Error(errorMessage);
  }
};

// Check if phone number already exists
export const checkPhoneExists = async (phone: string): Promise<boolean> => {
  try {
    const cleanedPhone = "+91" + phone.replace(/\D/g, "").slice(-10);
    const usersRef = collectionSafe(db, "users");
    const q = querySafe(usersRef, where("phone", "==", cleanedPhone));
    const snapshot = await getDocsSafe(q);
    return !snapshot.empty;
  } catch (error) {
    console.error("Error checking phone:", error);
    return false;
  }
};

// Register user with phone and password
export const registerUser = async (
  uid: string,
  phone: string,
  password: string,
  name: string = ""
): Promise<void> => {
  try {
    if (password.trim().length < 12) {
      throw new Error("Password must be at least 12 characters long.");
    }

    const cleanedPhone = normalizePhone(phone);
    const passwordHash = await hashPassword(password);

    await setDocSafe(docSafe(db, "users", uid), {
      uid,
      phone: cleanedPhone,
      passwordHash,
      name: name || "Water Monitor",
      role: "user",
      provider: "phone",
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      locations: ["default"],
      deviceCount: 0,
      uniqueId: `USER_${uid.slice(0, 8).toUpperCase()}`,
    });

    // Store in localStorage for offline access
    const userSession = {
      uid,
      phone: cleanedPhone,
      name: name || "Water Monitor",
      lastLoginAt: new Date().toISOString(),
    };
    localStorage.setItem("hydrosentinel_user", JSON.stringify(userSession));
  } catch (error) {
    console.error("Error registering user:", error);
    throw new Error("Failed to register user");
  }
};

// Phone + Password Login
export const loginWithPhonePassword = async (
  phone: string,
  password: string
): Promise<{ uid: string; name: string }> => {
  try {
    const cleanedPhone = normalizePhone(phone);
    ensureLoginAllowed(cleanedPhone);

    // Query Firestore for user with this phone
    const usersRef = collectionSafe(db, "users");
    const q = querySafe(usersRef, where("phone", "==", cleanedPhone));
    const snapshot = await getDocsSafe(q);

    if (snapshot.empty) {
      recordLoginFailure(cleanedPhone);
      throw new Error("User not found");
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    // Verify password
    const isPasswordValid = await verifyPasswordHash(password, userData.passwordHash);
    if (!isPasswordValid) {
      recordLoginFailure(cleanedPhone);
      throw new Error("Incorrect password");
    }

    // Update last login
    await setDocSafe(
      docSafe(db, "users", userDoc.id),
      { lastLoginAt: new Date().toISOString() },
      { merge: true }
    );

    // Store session
    const userSession = {
      uid: userDoc.id,
      phone: cleanedPhone,
      name: userData.name,
      lastLoginAt: new Date().toISOString(),
    };
    localStorage.setItem("hydrosentinel_user", JSON.stringify(userSession));
    clearLoginAttempts(cleanedPhone);

    return {
      uid: userDoc.id,
      name: userData.name,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Too many failed login attempts")) {
      throw error;
    }

    const errorMessage = error instanceof Error ? error.message : "Login failed";
    throw new Error(errorMessage);
  }
};

// Get stored session
export const getStoredSession = () => {
  try {
    const session = localStorage.getItem("hydrosentinel_user");
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
};

// Clear session
export const clearSession = async (): Promise<void> => {
  try {
    await signOut(auth);
    localStorage.removeItem("hydrosentinel_user");
  } catch (error) {
    console.error("Error logging out:", error);
    throw new Error("Failed to logout");
  }
};

