import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

// Mock supabase client
vi.mock("@/integrations/supabase/client", () => {
  const mockFrom = (_table: string) => ({
    select: (_sel: any, _opts?: any) => ({
      eq: (_col: any, _val: any) => ({
        single: async () => ({ data: null, error: { code: "PGRST116" } }),
      }),
    }),
    upsert: async (_payload: any, _opts?: any) => ({ error: null }),
  });

  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: "test-user", email: "test@example.com", user_metadata: { full_name: "Test User" } } } } }),
        onAuthStateChange: (_cb: any) => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signInWithOAuth: vi.fn(),
        signOut: vi.fn(),
      },
      from: mockFrom,
    },
  };
});

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const Consumer: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  return <div>{user ? user.email : "no-user"}</div>;
};

test("AuthProvider restores session from Supabase", async () => {
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>
  );

  await waitFor(() => expect(screen.queryByText("loading")).not.toBeInTheDocument());
  expect(screen.getByText("test@example.com")).toBeInTheDocument();
});
