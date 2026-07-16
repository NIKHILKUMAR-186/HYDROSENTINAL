import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

const PROFILE_TABLE = "profiles";

export const getProfile = async (uid: string): Promise<ProfileRow | null> => {
  console.log('[PROFILE FETCH]', uid);
  const { data, error } = await supabase
    .from("profiles" as const)
    .select("*")
    .eq("id", uid)
    .single();
  if (error) {
    // PostgREST returns PGRST116 when no rows found
    if ((error as any)?.code === "PGRST116" || (error as any)?.details?.includes("No rows found")) {
      console.log('[PROFILE FOUND]', null);
      return null;
    }
    console.log('[PROFILE UPSERT ERROR]', error);
    console.warn('[PROFILE] getProfile error', error);
    throw error;
  }

  console.log('[PROFILE FOUND]', data);
  return data;
};

export const upsertProfile = async (
  profile: ProfileInsert,
): Promise<ProfileRow> => {
  console.log('[PROFILE UPSERT PAYLOAD]', profile);

  // Ensure `id` is a valid UUID. If it's not, generate a UUID and preserve
  // the original identifier in `system_id`. This prevents DB errors when
  // non-UUID IDs (e.g., legacy or external auth ids) are passed.
  const isUuid = (val?: any) => typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

  const originalId = profile.id as any;
  let finalId = originalId;
  const payloadBase: any = { ...profile };

  if (!isUuid(originalId)) {
    try {
      // Use the global crypto API where available to generate a UUID.
      // Fallback to a random string if crypto.randomUUID is not present.
      finalId = (globalThis as any).crypto?.randomUUID?.() ?? `gen-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      console.warn("[PROFILE] upsertProfile: generated uuid for non-uuid id", originalId, "->", finalId);
      // preserve the original external id
      payloadBase.system_id = originalId ?? payloadBase.system_id;
    } catch (e) {
      console.warn("[PROFILE] upsertProfile: uuid generation failed, preserving id as-is", e);
    }
  }

  const payload: ProfileInsert = {
    ...payloadBase,
    id: finalId,
    role: profile.role ?? "user",
    created_at: profile.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
    profile_completion: profile.profile_completion ?? 0,
    is_active: profile.is_active ?? true,
  };

  const { data, error } = await supabase
    .from("profiles" as const)
    .upsert(payload as ProfileInsert, { onConflict: "id" })
    .select()
    .single();

  if (error) {
    console.log('[PROFILE UPSERT ERROR]', error);
    console.warn('[PROFILE] upsertProfile error', error);
    throw error;
  }
  console.log('[PROFILE UPSERT RESULT]', data);
  return data;
};

export const checkUsernameAvailable = async (
  username: string,
  currentUserId?: string,
): Promise<boolean> => {
  console.log("[PROFILE] checkUsernameAvailable", username, currentUserId);
  const normalized = String(username || "").toLowerCase().trim();
  if (!normalized) return false;

  let query = supabase
    .from("profiles" as const)
    .select("id", { count: "exact" })
    .eq("username", normalized);

  if (currentUserId) {
    query = query.neq("id", currentUserId);
  }

  const { data, error } = await query.limit(1);
  if (error) {
    console.warn("[PROFILE] checkUsernameAvailable error", error);
    return false;
  }

  return !(data?.length > 0);
};
