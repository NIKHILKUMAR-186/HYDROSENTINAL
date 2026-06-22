import { supabase } from "@/integrations/supabase/client";
import * as bcrypt from "bcryptjs";

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

