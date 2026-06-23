import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { lazy, Suspense, useEffect, useState } from "react";
// import Loader from "./components/Loader.tsx";
import NotFound from "./pages/NotFound.tsx";
import SharedAnimatedBackground from "./components/SharedAnimatedBackground";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { isSupabaseConfigured, missingSupabaseKeys } from "./integrations/supabase/client";

const Login = lazy(() => import("./pages/Login.tsx"));
const Signup = lazy(() => import("./pages/Signup.tsx"));
const Welcome = lazy(() => import("./pages/Welcome.tsx"));
const Index = lazy(() => import("./pages/Index.tsx"));
const UserDashboard = lazy(() => import("./pages/UserDashboard.tsx"));
const AlertPanel = lazy(() => import("./components/AlertPanel.tsx"));
const AdminPanel = lazy(() => import("./pages/AdminPanel.tsx"));
const Help = lazy(() => import("./pages/Help.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
// const PremiumShowcase = lazy(() => import("./pages/PremiumShowcase.tsx"));

const queryClient = new QueryClient();

const SupabaseSetupNotice = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-2xl rounded-[2rem] border border-amber-200 bg-white/95 p-6 shadow-2xl dark:border-amber-500/30 dark:bg-slate-900/95">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700 dark:text-amber-300">
          Supabase setup required
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
          Missing Supabase values are blocking the app from starting.
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Set the environment variables below in the project root and restart the dev server.
        </p>

        <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-semibold">Required keys</p>
          <ul className="mt-2 space-y-1 font-mono text-xs leading-5">
            {missingSupabaseKeys.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Where to find them</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              In Supabase Dashboard, open your project, go to Settings  API, and copy the URL and anon key.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Where to edit</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Save the values in <span className="font-semibold">.env</span> using the same <span className="font-mono">VITE_SUPABASE_*</span> variable names. Then restart the dev server.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          <p className="font-semibold">Example</p>
          <pre className="mt-2 overflow-x-auto text-xs leading-5">{`VITE_SUPABASE_URL=https://xyzcompany.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=public-anon-key`}</pre>
        </div>
      </div>
    </div>
  );
};

// Protected Route Component
const ProtectedRoute = ({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: "user" | "admin";
}) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900/90">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="mt-4 h-4 w-56 rounded-full" />
          <Skeleton className="mt-2 h-4 w-40 rounded-full" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // If user hasn't completed onboarding, redirect to welcome flow
  if (user?.profile_completion && user.profile_completion < 100) {
    return <Navigate to="/welcome" />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/" />;
  }

  return children;
};

const AppRoutes = () => {
  const { loading } = useAuth();
  // const [showLoader, setShowLoader] = useState(true);
  //   useEffect(() => {
  //   if (!loading) {
  //     setTimeout(() => {
  //       setShowLoader(false);
  //     }, 800); // minimum display time
  //   }
  // }, [loading]);
  // if (loading || showLoader) {
  //   return <Loader />;
  // }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white/95 p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900/90">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="mt-4 h-4 w-56 rounded-full" />
          <Skeleton className="mt-2 h-4 w-40 rounded-full" />
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-transparent flex items-center justify-center px-4">
          <div className="w-full max-w-3xl space-y-4">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </div>
            <Skeleton className="h-64 rounded-3xl" />
          </div>
        </div>
      }
    >
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/welcome" element={
          <ProtectedRoute>
            <Welcome />
          </ProtectedRoute>
        } />
        <Route path="/home" element={<Index />} />

        {/* User routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredRole="user">
              <UserDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/alert-panel"
          element={
            <ProtectedRoute requiredRole="user">
              <AlertPanel />
            </ProtectedRoute>
          }
        />
        <Route path="/command-center" element={<Navigate to="/alert-panel" replace />} />

        {/* <Route path="/premium-showcase" element={<PremiumShowcase />} /> */}

        <Route
          path="/help"
          element={
            <ProtectedRoute requiredRole="user">
              <Help />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute requiredRole="user">
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute requiredRole="user">
              <Profile />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminPanel />
            </ProtectedRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const ThemeBackground = () => {
  return <SharedAnimatedBackground />;
};

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <ThemeBackground />
      <div className="app-content-layer">
        <AppErrorBoundary>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            {isSupabaseConfigured ? (
              <BrowserRouter>
                <AuthProvider>
                  <AppRoutes />
                </AuthProvider>
              </BrowserRouter>
            ) : (
              <SupabaseSetupNotice />
            )}
          </TooltipProvider>
        </AppErrorBoundary>
      </div>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
