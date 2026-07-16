import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, AlertCircle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import * as authService from "@/services/authService";

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, signInWithGoogle, user, role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    // redirect by role
    navigate(role === "admin" ? "/admin" : "/dashboard", { replace: true });
  }, [user, role, navigate]);

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = authService.formatError(err);
      toast({ title: "Google sign-in failed", description: msg });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      toast({ title: "Signed in", description: "Redirecting..." });
    } catch (err) {
      setError(authService.formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    if (!email)
      return toast({
        title: "Enter email",
        description: "Please enter your account email first",
      });
    try {
      await supabase.auth.resetPasswordForEmail(email);
      toast({
        title: "Reset email sent",
        description: "Check your email for password reset instructions",
      });
    } catch (err) {
      toast({ title: "Reset failed", description: authService.formatError(err) });
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-transparent p-6">
      <div className="w-full max-w-6xl bg-cyan/95   justify-center flex-center grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* <div className="w-full max-w-6xl justify-center flex-center  gap-8"> */}
        {/* LEFT: Branding */}
        {/* <section className=" md:flex flex-col justify-center gap-6 rounded-3xl p-12 bg-gradient-to-br from-cyan-600/8 to-blue-600/6 backdrop-blur-lg border border-cyan-200/10"> */}
        <section className="w-full glass max-w-md rounded-3xl bg-slate-300/95 dark:bg-slate-900/80 p-8  shadow-lg backdrop-blur-sm">
          <div>
            <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white">
              HydroSentinal
            </h2>
            <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">
              AI-Powered Water Intelligence
            </p>
          </div>

          <ul className="mt-6 space-y-3 text-slate-700 dark:text-slate-300">
            <li>✓ Real-time Monitoring</li>
            <li>✓ Smart Alerts</li>
            <li>✓ Predictive Analytics</li>
            <li>✓ Community Water Safety</li>
          </ul>

          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
            Premium experience — modern, secure, and fast.
          </p>
        </section>

        {/* RIGHT: Auth card */}
        <section className="flex items-center  justify-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md rounded-3xl bg-white/95 dark:bg-slate-900/80 p-8 border border-slate-200/60 shadow-lg backdrop-blur-sm"
          >
            <div className="absolute inset-x-4 top-2 z-30 flex items-center justify-between  ">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-yellow/90 p-2 text-slate-700 shadow-sm   shadow-slate-900/10 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label="Back to landing page"
            >
              <ArrowLeft className="h-4 w-4 text-cyan-500" />
            </button>

            <ThemeToggle />
          </div>
          <div className="mt-5"> </div>
            <h3 className="text-2xl text-center font-bold text-slate-900 dark:text-white">
              Sign in to HydroSentinal
            </h3>
            <p className="mt-1 text-sm text-center text-slate-500">
              Access your water intelligence dashboard
            </p>

            <div className="mt-6">
              <Button
                onClick={handleGoogle}
                className="w-full flex items-center justify-center gap-3 bg-cyan-200  hover:shadow-md text-black dark:bg-cyan-700 dark:text-white hover:bg-white shadow-[0_12px_26px_-14px_rgba(8,145,178,0.9)] clay-button"
              >
                <img src="/google-logo.svg" alt="Google" className="h-5 w-5" />
                Continue with Google
              </Button>

              <div className="flex items-center gap-3 my-4">
                <hr className="flex-1 border-slate-200" />
                <span className="text-xs text-slate-400">OR</span>
                <hr className="flex-1 border-slate-200" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email
                  </label>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  <div className="relative mt-1">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={handleForgot}
                    className="text-sm text-cyan-700"
                  >
                    Forgot password?
                  </button>
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="h-4 w-4" /> Authentication issue
                    </div>
                    <p className="mt-1">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="shadow-[0_12px_26px_-14px_rgba(8,145,178,0.9)] clay-button w-full h-12 bg-gradient-to-r from-cyan-600 to-emerald-500 text-white from-cyan-600 to-cyan-500"
                  disabled={loading}
                >
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>

              <div className="mt-4 text-center text-sm text-slate-600">
                New here?{" "}
                <button
                  onClick={() => navigate("/signup")}
                  className="text-cyan-700 font-semibold"
                >
                  Create an account
                </button>
              </div>
            </div>
          </motion.div>
        </section>
      </div>
    </main>
  );
};

export default Login;
