import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const RoleRoute: React.FC<{ children: React.ReactElement; role: "admin" | "user" }> = ({ children, role }) => {
  const { user, loading, role: currentRole } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role === "admin" && currentRole !== "admin") return <Navigate to="/dashboard" replace />;
  if (role === "user" && currentRole !== "user") return <Navigate to="/admin" replace />;
  return children;
};

export default RoleRoute;
