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
import HydroBackground from "./components/HydroBackground";
import { useTheme } from "./contexts/ThemeContext";
import AppErrorBoundary from "./components/AppErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { firebaseSetupInfo, isFirebaseConfigured } from "./firebase";

const Login = lazy(() => import("./pages/Login.tsx"));
const Index = lazy(() => import("./pages/Index.tsx"));
const UserDashboard = lazy(() => import("./pages/UserDashboard.tsx"));
const AdminPanel = lazy(() => import("./pages/AdminPanel.tsx"));
const Help = lazy(() => import("./pages/Help.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
// const PremiumShowcase = lazy(() => import("./pages/PremiumShowcase.tsx"));

const queryClient = new QueryClient();

const FirebaseSetupNotice = () => {
  const missingKeys = firebaseSetupInfo.missingRequiredKeys;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-2xl rounded-[2rem] border border-amber-200 bg-white/95 p-6 shadow-2xl dark:border-amber-500/30 dark:bg-slate-900/95">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-700 dark:text-amber-300">
          Firebase setup required
        </p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900 dark:text-white">
          Missing Firebase values are blocking the app from starting.
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          Edit <span className="font-semibold">{firebaseSetupInfo.envFileHint}</span> in the project root and add the values below. Copy them from <span className="font-semibold">{firebaseSetupInfo.sourceHint}</span>.
        </p>

        <div className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="font-semibold">Required keys</p>
          <ul className="mt-2 space-y-1 font-mono text-xs leading-5">
            {missingKeys.map((key) => (
              <li key={key}>{key}</li>
            ))}
          </ul>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Where to find them</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              In Firebase Console, open your project, go to Project settings, then the General tab. Under Your apps, choose the Web app and copy the config values.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Where to edit</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Save the values in <span className="font-semibold">.env</span> using the same <span className="font-mono">VITE_FIREBASE_*</span> variable names. Then restart the dev server.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          <p className="font-semibold">Example</p>
          <pre className="mt-2 overflow-x-auto text-xs leading-5">{`VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_APP_ID=...`}</pre>
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Optional values like <span className="font-mono">VITE_FIREBASE_PROJECT_ID</span>, <span className="font-mono">VITE_FIREBASE_STORAGE_BUCKET</span>, and <span className="font-mono">VITE_FIREBASE_MEASUREMENT_ID</span> improve analytics and storage features, but the required keys above are the ones that stop startup if missing.
        </p>
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
  const { theme } = useTheme();
  return (
    <>
      {/* app-scene-bg is the full-bleed CSS gradient element */}
      <div className="app-scene-bg" aria-hidden />
      {theme === "dark" && <HydroBackground />}
    </>
  );
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
            {isFirebaseConfigured ? (
              <BrowserRouter>
                <AuthProvider>
                  <AppRoutes />
                </AuthProvider>
              </BrowserRouter>
            ) : (
              <FirebaseSetupNotice />
            )}
          </TooltipProvider>
        </AppErrorBoundary>
      </div>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
