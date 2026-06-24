import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "user" | "admin" | "operator" | "researcher";
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

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
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  if (user.profile_completion !== undefined && user.profile_completion < 100 && location.pathname !== "/complete-profile") {
    return <Navigate to="/complete-profile" replace />;
  }

  return <>{children}</>;
};

export const AdminRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requiredRole="admin">{children}</ProtectedRoute>
);

export const OperatorRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requiredRole="operator">{children}</ProtectedRoute>
);

export const ResearcherRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute requiredRole="researcher">{children}</ProtectedRoute>
);

export default ProtectedRoute;
