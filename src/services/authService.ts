import { supabase } from "@/integrations/supabase/client";
import * as bcrypt from "bcryptjs";
import { getProfile as getProfileRow, upsertProfile as upsertProfileRow } from "./profileService";

const fmtError = (err: any) => err?.message || err?.error_description || (typeof err === "string" ? err : JSON.stringify(err, null, 2));

export const getCurrentUser = async () => {
  try {
    if (typeof supabase.auth.getUser === "function") {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw new Error(fmtError(error));
      const user = data?.user ?? null;
      console.log('[AUTH USER]', user);
      return user;
    }
  } catch (e) {
    console.log("[AUTH] getUser failed, falling back:", fmtError(e));
  }

  // Fallback for environments/mocks where getUser isn't available
  try {
    const { data, error } = await supabase.auth.getSession();
    console.log('[AUTH SESSION]', data);
    if (error) throw new Error(fmtError(error));
    const user = data?.session?.user ?? null;
    console.log('[AUTH USER]', user);
    return user;
  } catch (err) {
    throw new Error(fmtError(err));
  }
};

export const getProfile = async (uid: string) => {
  try {
    console.log('[PROFILE FETCH]', uid);
    const profile = await getProfileRow(uid);
    console.log('[PROFILE FOUND]', profile);
    return profile;
  } catch (err) {
    console.log('[PROFILE FETCH] error', fmtError(err));
    throw err;
  }
};

export const createProfile = async (payload: any) => {
  try {
    console.log('[PROFILE UPSERT PAYLOAD]', payload);
    // Use upsert to be idempotent (handles race conditions)
    const created = await upsertProfileRow(payload);
    console.log('[PROFILE UPSERT RESULT]', created);
    return created;
  } catch (err) {
    console.log('[PROFILE UPSERT ERROR]', err);
    throw err;
  }
};

export const upsertProfile = async (payload: any) => {
  try {
    console.log('[PROFILE UPSERT PAYLOAD]', payload);
    const result = await upsertProfileRow(payload);
    console.log('[PROFILE UPSERT RESULT]', result);
    return result;
  } catch (err) {
    console.log('[PROFILE UPSERT ERROR]', err);
    throw err;
  }
};

export const redirectByRole = (role: string | null) => {
  const r = role === "admin" ? "/admin" : "/dashboard";
  console.log('[ROLE RESOLUTION]', role);
  console.log('[REDIRECT TARGET]', r);
  return r;
};

export const formatError = fmtError;

export default {
  getCurrentUser,
  getProfile,
  createProfile,
  upsertProfile,
  redirectByRole,
  formatError,
};

const PASSWORD_HASH_ROUNDS = 12;

export const hashPassword = async (password: string): Promise<string> => bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
export const verifyPasswordHash = async (password: string, hash: string): Promise<boolean> => bcrypt.compare(password, hash);

// Phone-based authentication and Firebase-backed registration were removed.
// Use Supabase Auth (email/password or Google OAuth) instead.
export const initializeRecaptcha = () => {
  throw new Error("Phone OTP authentication removed. Use Supabase email/Google flows.");
};

export const sendOTP = async (_phoneNumber: string) => {
  throw new Error("Phone OTP authentication removed. Use Supabase email/Google flows.");
};

export const verifyOTP = async (_confirmationResult: any, _otp: string) => {
  throw new Error("Phone OTP authentication removed. Use Supabase email/Google flows.");
};

export const checkPhoneExists = async (_phone: string): Promise<boolean> => {
  throw new Error("Phone lookups removed. Use Supabase users/profiles instead.");
};

export const registerUser = async (_uid: string, _phone: string, _password: string, _name = "") => {
  throw new Error("Phone-based registration removed. Use Supabase signUp instead.");
};

export const loginWithPhonePassword = async (_phone: string, _password: string) => {
  throw new Error("Phone login removed. Use Supabase email/password login instead.");
};

export const getStoredSession = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session ?? null;
  } catch {
    return null;
  }
};

export const clearSession = async (): Promise<void> => {
  try {
    await supabase.auth.signOut();
    try {
      localStorage.removeItem("hydrosentinel_user");
    } catch {}
  } catch (error) {
    console.error("Error logging out:", error);
    throw new Error("Failed to logout");
  }
};

