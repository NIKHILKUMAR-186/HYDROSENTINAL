import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as authService from "@/services/authService";

export const Signup = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { signupWithProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password || !confirm) return toast({ title: "Fill fields" });
    if (password !== confirm) return toast({ title: "Passwords do not match" });
    if (!checks.length || !checks.upper || !checks.lower || !checks.digit) return toast({ title: "Choose a stronger password" });

    setLoading(true);
    try {
      const payload = {
        email,
        password,
        fullName,
        username: email.split("@")[0],
        organizationType: "Individual",
        recoveryCode: "",
      } as any;

      console.log('[AUTH SESSION]', null);
      console.log('[AUTH USER]', { email });
      console.log('[PROFILE UPSERT PAYLOAD]', payload);

      const { syncStatus } = await signupWithProfile(payload);
      if (syncStatus === "pending") {
        toast({ title: "Account created (pending)", description: "We will sync when online" });
      } else {
        toast({ title: "Welcome", description: `Thanks for joining, ${fullName}` });
      }

      navigate("/welcome");
    } catch (err) {
      toast({ title: "Signup failed", description: authService.formatError(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/95 dark:bg-slate-900/80 p-8 rounded-2xl border">
        <h2 className="text-2xl font-bold">Create your account</h2>
        <p className="text-sm text-slate-500 mt-1">Join HydroSentinal — premium water intelligence</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium">Full name</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Confirm password</label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>

          <div className="mt-2 text-sm text-slate-600">
            <p className="font-semibold mb-1">Password requirements</p>
            <ul className="space-y-1">
              <li className={`${checks.length ? "text-emerald-600" : "text-red-600"}`}> {checks.length ? <CheckCircle2 className="inline" /> : "○"} 8+ characters</li>
              <li className={`${checks.upper ? "text-emerald-600" : "text-red-600"}`}> {checks.upper ? <CheckCircle2 className="inline" /> : "○"} Uppercase letter</li>
              <li className={`${checks.lower ? "text-emerald-600" : "text-red-600"}`}> {checks.lower ? <CheckCircle2 className="inline" /> : "○"} Lowercase letter</li>
              <li className={`${checks.digit ? "text-emerald-600" : "text-red-600"}`}> {checks.digit ? <CheckCircle2 className="inline" /> : "○"} Number</li>
            </ul>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating..." : "Create account"}</Button>
        </form>

        <div className="mt-4 text-sm text-center">Already have an account? <button onClick={() => navigate('/login')} className="text-cyan-700">Sign in</button></div>
      </div>
    </main>
  );
};

export default Signup;
