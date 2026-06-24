import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { getProfile, upsertProfile, checkUsernameAvailable } from "./profileService";

vi.mock("@/integrations/supabase/client");

describe("profileService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProfile", () => {
    it("fetches a profile by uid", async () => {
      const mockProfile = {
        id: "user-123",
        email: "test@example.com",
        full_name: "John Doe",
        username: "johndoe",
        phone: "+1234567890",
        organization_type: "Student",
        organization_name: "University XYZ",
        city: "Boston",
        state: "MA",
        country: "USA",
        water_source: "Municipal Supply",
        use_case: "Research",
        profile_completion: 100,
        role: "user",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
          }),
        }),
      });

      const result = await getProfile("user-123");
      expect(result).toEqual(mockProfile);
    });

    it("returns null when profile does not exist", async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      const result = await getProfile("nonexistent-user");
      expect(result).toBeNull();
    });

    it("throws error on unexpected query failure", async () => {
      const error = new Error("Database connection failed");
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error }),
          }),
        }),
      });

      await expect(getProfile("user-123")).rejects.toThrow("Database connection failed");
    });
  });

  describe("upsertProfile", () => {
    it("inserts a new profile with calculated completion", async () => {
      const newProfile = {
        id: "new-user",
        email: "newuser@example.com",
        full_name: "Jane Doe",
        username: "janedoe",
      };

      const savedProfile = {
        ...newProfile,
        phone: null,
        organization_type: null,
        organization_name: null,
        city: null,
        state: null,
        country: null,
        water_source: null,
        use_case: null,
        profile_completion: 30, // full_name (15) + username (15)
        role: "user",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      (supabase.from as any).mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: savedProfile, error: null }),
          }),
        }),
      });

      const result = await upsertProfile(newProfile as any);
      expect(result.full_name).toBe("Jane Doe");
      expect(result.profile_completion).toBeGreaterThanOrEqual(0);
    });

    it("updates existing profile with new fields", async () => {
      const update = {
        id: "existing-user",
        phone: "+9876543210",
        city: "New York",
        water_source: "River",
        profile_completion: 50,
      };

      const updated = {
        id: "existing-user",
        email: "user@example.com",
        full_name: "John Doe",
        username: "johndoe",
        ...update,
        role: "user",
        created_at: "2025-01-01T00:00:00Z",
        updated_at: new Date().toISOString(),
      };

      (supabase.from as any).mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updated, error: null }),
          }),
        }),
      });

      const result = await upsertProfile(update as any);
      expect(result.phone).toBe("+9876543210");
      expect(result.city).toBe("New York");
      expect(result.water_source).toBe("River");
    });

    it("sets default values for missing fields", async () => {
      const minimal = { id: "user-456" };

      (supabase.from as any).mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "user-456",
                role: "user",
                profile_completion: 0,
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await upsertProfile(minimal as any);
      expect(result.role).toBe("user");
      expect(result.is_active).toBe(true);
      expect(result.profile_completion).toBe(0);
    });

    it("throws error on upsert failure", async () => {
      const error = new Error("Duplicate key violation");
      (supabase.from as any).mockReturnValue({
        upsert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error }),
          }),
        }),
      });

      await expect(upsertProfile({ id: "user-123" } as any)).rejects.toThrow("Duplicate key violation");
    });
  });

  describe("checkUsernameAvailable", () => {
    it("returns true when username is available", async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const available = await checkUsernameAvailable("newusername");
      expect(available).toBe(true);
    });

    it("returns false when username is taken", async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: "existing-user" }],
              error: null,
            }),
          }),
        }),
      });

      const available = await checkUsernameAvailable("takenusername");
      expect(available).toBe(false);
    });

    it("normalizes username before checking", async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      await checkUsernameAvailable("  MyUserName  ");
      
      const eqCall = (supabase.from as any).mock.results[0].value.select().eq;
      expect(eqCall).toHaveBeenCalledWith("username", "myusername");
    });

    it("excludes current user when checking availability", async () => {
      const mockQuery = {
        eq: vi.fn(),
        neq: vi.fn(),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      };

      // Make eq() return the mockQuery so neq() can be chained
      mockQuery.eq.mockReturnValue(mockQuery);
      // Make neq() return the mockQuery so limit() can be chained
      mockQuery.neq.mockReturnValue(mockQuery);

      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue(mockQuery),
      });

      await checkUsernameAvailable("myusername", "current-user-id");
      
      expect(mockQuery.eq).toHaveBeenCalledWith("username", "myusername");
      expect(mockQuery.neq).toHaveBeenCalledWith("id", "current-user-id");
      expect(mockQuery.limit).toHaveBeenCalledWith(1);
    });

    it("returns false for empty or invalid username", async () => {
      const empty = await checkUsernameAvailable("");
      const spaces = await checkUsernameAvailable("   ");
      
      expect(empty).toBe(false);
      expect(spaces).toBe(false);
    });

    it("returns false on query error", async () => {
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: new Error("Query failed"),
            }),
          }),
        }),
      });

      const available = await checkUsernameAvailable("anyusername");
      expect(available).toBe(false);
    });
  });
});
