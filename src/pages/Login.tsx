import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, ArrowLeft, Lock, User, Eye, EyeOff, CheckCircle2, Info, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";

type UserRole = "user" | "admin";

interface ValidationState {
  email: boolean;
  password: boolean;
  recovery?: boolean;
  fullName?: boolean;
  organization?: boolean;
  username?: boolean;
}

const DEMO_ACCOUNTS = [
    { email: "user@demo.com", role: "user" as UserRole },
    { email: "admin@demo.com", role: "admin" as UserRole },
];

export const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>("user");
  const [isLogin, setIsLogin] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [organizationType, setOrganizationType] = useState("");
  const [customOrganization, setCustomOrganization] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState<Partial<ValidationState>>({});
  const [showDemoHint, setShowDemoHint] = useState(false);
  const { login, signup, signupWithProfile, checkUsernameAvailable, resetPasswordWithRecoveryCode, user, role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Validation helpers
  const validateEmail = (email: string): boolean => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const validatePassword = (password: string): boolean => {
    if (isLogin) {
      return password.length > 0;
    }
    return password.length >= 12;
  };

  const isValidEmail = email.length > 0 && validateEmail(email);
  const isValidPassword = validatePassword(password);
  const isRecoveryCodeValid = recoveryCode.trim().length > 0;
  const isSignup = !isLogin && !isRecovering;
  const isValidFullName = fullName.trim().length > 0;
  const isValidOrganization = organizationType.trim().length > 0 && (organizationType !== "Other" || customOrganization.trim().length > 0);
  const isValidUsername = username.trim().length > 0 && /^[a-z0-9_-]+$/.test(username);

  const isFormValid = isLogin
    ? isValidEmail && isValidPassword
    : isRecovering
    ? isValidEmail && isValidPassword && isRecoveryCodeValid
    : isValidEmail && isValidPassword && isRecoveryCodeValid && isValidFullName && isValidOrganization && isValidUsername && usernameAvailable !== false;

  // Reset form when toggling login/signup
  const handleToggleMode = () => {
    setIsRecovering(false);
    const nextLogin = !isLogin;
    setIsLogin(nextLogin);
    if (!nextLogin) {
      setSelectedRole("user");
      setRecoveryCode("");
    }
    setError("");
    setTouched({});
  };

  // Reset form when changing role
  const handleRoleChange = (newRole: UserRole) => {
    if (!isLogin) {
      return;
    }

    setSelectedRole(newRole);
    setError("");
    setTouched({});
  };

  const handleStartRecovery = () => {
    setIsRecovering(true);
    setIsLogin(true);
    setError("");
    setTouched({});
  };

  const handleCancelRecovery = () => {
    setIsRecovering(false);
    setError("");
    setTouched({});
    setRecoveryCode("");
  };

  useEffect(() => {
    if (!user) {
      return;
    }

    navigate(role === "admin" ? "/admin" : "/dashboard", { replace: true });
  }, [navigate, role, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Mark all fields as touched for validation display
    setTouched({ email: true, password: true, recovery: true, fullName: true, organization: true, username: true });

    if (!isFormValid) {
      setError("Please fill in all fields correctly");
      return;
    }

    setLoading(true);

    try {
      if (isRecovering) {
        await resetPasswordWithRecoveryCode(email, password, recoveryCode);
        setError("Password updated successfully. Please login.");
        setIsRecovering(false);
        setTouched({});
        setRecoveryCode("");
        return;
      }

      if (isLogin) {
        await login(email, password, selectedRole);
      } else {
        // Signup with profile
        try {
          const payload = {
            email,
            password,
            fullName: fullName.trim(),
            username: username.trim(),
            organizationType: organizationType,
            organizationName: organizationType === "Other" ? customOrganization.trim() : undefined,
            recoveryCode,
          };

          const { syncStatus } = await signupWithProfile(payload as any);
          if (syncStatus === "pending") {
            toast({
              title: "Account created locally",
              description: "Firebase sync is pending right now. We will retry automatically when the connection stabilizes.",
            });
          } else {
            toast({ title: "Account created", description: `Welcome ${fullName}` });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Signup failed";
          setError(msg === "Username already taken" ? "Username already taken" : msg);
          return;
        }
      }

      if (selectedRole === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = (demoEmail: string) => {
    const demo = DEMO_ACCOUNTS.find((acc) => acc.email === demoEmail);
    if (demo) {
      setEmail(demo.email);
      setSelectedRole(demo.role);
      setTouched({ email: true });
      setShowDemoHint(false);
    }
  };


  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent px-4 py-4 flex items-center justify-center">
      {/* Light mode background with subtle gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none dark:hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-100/30 via-transparent to-blue-100/20" />
        <div className="absolute left-1/4 top-1/3 h-96 w-96 rounded-full bg-cyan-200/20 blur-3xl" />
        <div className="absolute right-1/4 bottom-1/4 h-96 w-96 rounded-full bg-blue-200/20 blur-3xl" />
      </div>

      {/* Dark mode tech background with grid and lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden dark:block">
        {/* Animated grid pattern */}
        <svg
          className="absolute inset-0 h-full w-full opacity-25"
          preserveAspectRatio="none"
          viewBox="0 0 1200 1200"
        >
          <defs>
            <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <path
                d="M 100 0 L 0 0 0 100"
                fill="none"
                stroke="rgba(34, 211, 238, 0.15)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="1200" height="1200" fill="url(#grid)" />
        </svg>

        {/* Glowing cyan wavy lines */}
        <div className="absolute inset-0">
          <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="line1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(6, 182, 212, 0.35)" />
                <stop offset="50%" stopColor="rgba(6, 182, 212, 0.08)" />
                <stop offset="100%" stopColor="rgba(6, 182, 212, 0)" />
              </linearGradient>
              <linearGradient id="line2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(34, 211, 238, 0.3)" />
                <stop offset="50%" stopColor="rgba(34, 211, 238, 0.05)" />
                <stop offset="100%" stopColor="rgba(34, 211, 238, 0)" />
              </linearGradient>
            </defs>
            <path d="M 0 0 Q 300 150 600 200 T 1200 300" stroke="url(#line1)" strokeWidth="2" fill="none" />
            <path d="M 0 400 Q 300 350 600 300 T 1200 200" stroke="url(#line2)" strokeWidth="2" fill="none" />
            <path d="M 1200 600 Q 900 650 600 700 T 0 800" stroke="url(#line1)" strokeWidth="2" fill="none" />
            <path d="M 0 1000 Q 300 900 600 800 T 1200 600" stroke="url(#line2)" strokeWidth="2" fill="none" />
          </svg>
        </div>

        {/* Glowing cyan blur orbs */}
        <div className="absolute top-1/4 left-1/4 h-32 w-32 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 h-40 w-40 rounded-full bg-cyan-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 left-1/3 h-36 w-36 rounded-full bg-cyan-500/8 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/3 h-28 w-28 rounded-full bg-cyan-500/12 blur-3xl" />

        {/* Floating glowing particles */}
        <div className="absolute top-20 left-20 h-2 w-2 rounded-full bg-cyan-400 opacity-70 shadow-lg shadow-cyan-400/50" />
        <div className="absolute top-1/3 right-32 h-1.5 w-1.5 rounded-full bg-cyan-300 opacity-60 shadow-lg shadow-cyan-300/50" />
        <div className="absolute bottom-32 left-1/4 h-2 w-2 rounded-full bg-cyan-400 opacity-70 shadow-lg shadow-cyan-400/50" />
        <div className="absolute bottom-20 right-1/4 h-1.5 w-1.5 rounded-full bg-cyan-300 opacity-50" />
        <div className="absolute top-1/2 left-1/2 h-1.5 w-1.5 rounded-full bg-cyan-400 opacity-60 shadow-lg shadow-cyan-400/50" />
        <div className="absolute top-2/3 right-1/3 h-1 w-1 rounded-full bg-cyan-300 opacity-40" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10 w-full max-w-[420px]"
      >
        <div className="relative overflow-hidden rounded-[2rem] border border-cyan-200/40 bg-white/95 px-6 py-6 shadow-[0_24px_80px_-36px_rgba(6,182,212,0.15)] backdrop-blur-xl dark:border-cyan-500/30 dark:bg-slate-900/80 dark:shadow-[0_24px_80px_-36px_rgba(6,182,212,0.25)] clay-card">
          {/* <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-r from-cyan-100/60 via-cyan-50/40 to-transparent dark:from-cyan-500/20 dark:via-cyan-500/10 dark:to-transparent" /> */}

          {/* Header row positioned inside the top strip */}
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

          <div className="relative pt-6">
            {/* Header */}
            <p className="text-center text-[0.68rem] font-medium tracking-[0.42em] text-slate-600 dark:text-cyan-300">
              HYDROSENTINEL
            </p>

            <div className="mt-4 text-center">
              <h1 className="text-[2.35rem] leading-[0.98] font-black tracking-tight text-slate-800 dark:text-white">
                Monitor Water.
                <br />
                Protect Life.
              </h1>
              <p className="mx-auto mt-5 max-w-[18rem] text-sm leading-6 text-slate-600 dark:text-slate-300">
                Smart water quality analytics with a clean, premium dashboard experience.
              </p>
            </div>

            {/* Role selector with enhanced styling */}
            <div className="mt-6 grid grid-cols-2 gap-2.5 rounded-[1.2rem] bg-slate-100/60 p-1.5 dark:bg-slate-800/50 dark:ring-1 dark:ring-cyan-500/20">
              <button
                type="button"
                onClick={() => handleRoleChange("user")}
                aria-pressed={selectedRole === "user"}
                aria-label="Select user role"
                className={`inline-flex items-center justify-center gap-2 rounded-[1rem] px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                  selectedRole === "user"
                    ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-[0_12px_26px_-14px_rgba(8,145,178,0.9)] clay-button"
                      : "bg-transparent text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-700/70 clay-toggle"
                }`}
              >
                <User className="h-4 w-4" />
                User
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange("admin")}
                aria-pressed={selectedRole === "admin"}
                aria-label="Select admin role"
                disabled={!isLogin}
                className={`inline-flex items-center justify-center gap-2 rounded-[1rem] px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                  !isLogin
                    ? "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-800/60 dark:text-slate-500 clay-toggle"
                    : selectedRole === "admin"
                    ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white shadow-[0_12px_26px_-14px_rgba(8,145,178,0.9)] clay-button"
                    : "bg-transparent text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-700/70 clay-toggle"
                }`}
              >
                <Lock className="h-4 w-4" />
                Admin
              </button>
            </div>

            {!isLogin && (
              <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                Admin sign up is disabled. Only existing admin accounts can log in.
              </div>
            )}

            {/* Demo credentials hint */}
            <AnimatePresence>
              {isLogin && (
                <motion.button
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  type="button"
                  onClick={() => setShowDemoHint(!showDemoHint)}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-300/50 bg-cyan-50/60 px-3 py-2 text-xs font-medium text-cyan-700 transition hover:bg-cyan-100/70 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/15 clay-button clay-ghost"
                >
                  <Info className="h-3.5 w-3.5" />
                  <span>Demo accounts available</span>
                </motion.button>
              )}
            </AnimatePresence>

            {/* Demo credentials dropdown */}
            <AnimatePresence>
              {isLogin && showDemoHint && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-2 space-y-2 rounded-lg border border-slate-300/60 bg-slate-50/80 p-3 dark:border-slate-700/60 dark:bg-slate-800/60"
                >
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Quick login:</p>
                  <div className="space-y-1">
                    {DEMO_ACCOUNTS.map((account) => (
                      <button
                        key={account.email}
                        type="button"
                        onClick={() => fillDemoCredentials(account.email)}
                        className="block w-full rounded px-2 py-1.5 text-left text-xs text-slate-700 transition hover:bg-white/60 dark:text-slate-300 dark:hover:bg-slate-700/60"
                      >
                        <code className="font-mono text-[0.7rem] text-cyan-700 dark:text-cyan-400">{account.email}</code>
                        <span className="ml-2 text-slate-500 dark:text-slate-400">({account.role})</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Use the matching password for each account.</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
              {/* Email field with validation feedback */}
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Email Address
                </label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouched({ ...touched, email: true })}
                    required
                    autoComplete="email"
                    aria-invalid={touched.email && !isValidEmail}
                    aria-describedby={touched.email && !isValidEmail ? "email-error" : undefined}
                    className={`h-12 w-full rounded-2xl border bg-slate-50 px-4 text-slate-700 shadow-inner shadow-slate-100 placeholder:text-slate-400 transition-all focus:ring-2 dark:bg-slate-900/80 dark:text-white dark:shadow-none dark:placeholder:text-slate-500 clay-input ${
                      touched.email
                        ? isValidEmail
                          ? "border-green-500/50 focus:border-green-500 focus:ring-green-500/20"
                          : "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                        : "border-slate-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-slate-700"
                    }`}
                  />
                  {touched.email && isValidEmail && (
                    <CheckCircle2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-green-500" />
                  )}
                </div>
                {touched.email && !isValidEmail && (
                  <p id="email-error" className="text-xs text-red-600 dark:text-red-400">
                    Please enter a valid email address
                  </p>
                )}
              </div>

              {/* Password field with show/hide toggle */}
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Password {!isLogin && <span className="text-xs text-slate-500 dark:text-slate-400">(min. 12 chars)</span>}
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched({ ...touched, password: true })}
                    required
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    aria-invalid={touched.password && !isValidPassword}
                    aria-describedby={touched.password && !isValidPassword ? "password-error" : undefined}
                    className={`h-12 w-full rounded-2xl border bg-slate-50 px-4 pr-12 text-slate-700 shadow-inner shadow-slate-100 placeholder:text-slate-400 transition-all focus:ring-2 dark:bg-slate-900/80 dark:text-white dark:shadow-none dark:placeholder:text-slate-500 clay-input ${
                      touched.password
                        ? isValidPassword
                          ? "border-green-500/50 focus:border-green-500 focus:ring-green-500/20"
                          : "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                        : "border-slate-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-slate-700"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 transition hover:bg-slate-200/50 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  {touched.password && isValidPassword && (
                    <CheckCircle2 className="absolute right-11 top-1/2 h-5 w-5 -translate-y-1/2 text-green-500" />
                  )}
                </div>
                {touched.password && !isValidPassword && (
                  <p id="password-error" className="text-xs text-red-600 dark:text-red-400">
                    {isLogin ? "Password is required" : "Password must be at least 12 characters"}
                  </p>
                )}
              </div>

              {(isSignup || isRecovering) && (
                <div className="space-y-2">
                  <label htmlFor="recovery" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Recovery Code
                  </label>
                  <Input
                    id="recovery"
                    type="text"
                    placeholder="Enter recovery code"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    onBlur={() => setTouched({ ...touched, recovery: true })}
                    required
                    aria-invalid={touched.recovery && !isRecoveryCodeValid}
                    aria-describedby={touched.recovery && !isRecoveryCodeValid ? "recovery-error" : undefined}
                    className={`h-12 w-full rounded-2xl border bg-slate-50 px-4 text-slate-700 shadow-inner shadow-slate-100 placeholder:text-slate-400 transition-all focus:ring-2 dark:bg-slate-900/80 dark:text-white dark:shadow-none dark:placeholder:text-slate-500 clay-input ${
                      touched.email
                        ? isRecoveryCodeValid
                          ? "border-green-500/50 focus:border-green-500 focus:ring-green-500/20"
                          : "border-red-500/50 focus:border-red-500 focus:ring-red-500/20"
                        : "border-slate-200 focus:border-cyan-500 focus:ring-cyan-500/20 dark:border-slate-700"
                    }`}
                  />
                  {touched.recovery && !isRecoveryCodeValid && (
                    <p id="recovery-error" className="text-xs text-red-600 dark:text-red-400">
                      Please enter your recovery code.
                    </p>
                  )}
                </div>
              )}

              {/* Additional signup fields */}
              {isSignup && (
                <>
                  <div className="space-y-2">
                    <label htmlFor="fullName" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Full Name
                    </label>
                    <div className="relative">
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        onBlur={() => setTouched({ ...touched, fullName: true })}
                        required
                        aria-invalid={!isValidFullName}
                        className="h-12 w-full rounded-2xl border bg-slate-50 px-4 text-slate-700 dark:bg-slate-900/80 dark:text-white"
                      />
                    </div>
                    {!isValidFullName && touched.email && (
                      <p className="text-xs text-red-600 dark:text-red-400">Please enter your full name.</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="organizationType" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Organization Type
                    </label>
                    <div className="relative">
                      <select
                        id="organizationType"
                        value={organizationType}
                        onChange={(e) => setOrganizationType(e.target.value)}
                        onBlur={() => setTouched({ ...touched, organization: true })}
                        required
                        className={`h-12 w-full rounded-2xl border bg-slate-50 px-4 text-slate-700 dark:bg-slate-900/80 dark:text-white focus:ring-2 focus:ring-cyan-200 clay-input`}
                      >
                        <option value="">Select your organization type</option>
                        <option value="School">🏫 School</option>
                        <option value="College">🎓 College</option>
                        <option value="Government">🏛️ Government</option>
                        <option value="Private Company">🏢 Private Company</option>
                        <option value="NGO">🤝 NGO</option>
                        <option value="Startup">🚀 Startup</option>
                        <option value="Other">🔎 Other</option>
                      </select>
                    </div>
                    {!isValidOrganization && touched.organization && (
                      <p className="text-xs text-red-600 dark:text-red-400">Please select your organization type{organizationType === 'Other' ? ' and provide a name' : ''}.</p>
                    )}

                    <AnimatePresence>
                      {organizationType === "Other" && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2">
                          <label htmlFor="customOrganization" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Enter your organization name
                          </label>
                          <Input
                            id="customOrganization"
                            type="text"
                            placeholder="My Local Water NGO"
                            value={customOrganization}
                            onChange={(e) => setCustomOrganization(e.target.value)}
                            onBlur={() => setTouched({ ...touched, organization: true })}
                            className="mt-1 h-12 w-full rounded-2xl border bg-slate-50 px-4 text-slate-700 dark:bg-slate-900/80 dark:text-white clay-input"
                          />
                          {organizationType === 'Other' && !customOrganization && touched.organization && (
                            <p className="text-xs text-red-600 dark:text-red-400">Please enter your organization name.</p>
                          )}
                          <p className="text-xs text-slate-600 dark:text-slate-400">Enter the password from your setup guide to continue.</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="username" className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                      Username
                    </label>
                    <div className="relative">
                      <Input
                        id="username"
                        type="text"
                        placeholder="Choose a username (lowercase, no spaces)"
                        value={username}
                        onChange={(e) => {
                          const cleaned = e.target.value.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9_-]/g, "");
                          setUsername(cleaned);
                          setUsernameAvailable(null);
                        }}
                        onBlur={async () => {
                          setTouched({ ...touched, username: true });
                          if (!username) return setUsernameAvailable(null);
                          try {
                            const ok = await checkUsernameAvailable(username);
                            setUsernameAvailable(ok);
                            if (!ok) {
                              setError("Username already taken");
                            }
                          } catch {
                            setUsernameAvailable(null);
                          }
                        }}
                        required
                        aria-invalid={usernameAvailable === false || !isValidUsername}
                        className={`h-12 w-full rounded-2xl border bg-slate-50 px-4 text-slate-700 dark:bg-slate-900/80 dark:text-white clay-input ${
                          usernameAvailable === false ? "border-red-500/50" : ""
                        }`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                        {username && (
                          <span className="font-mono">
                            {`${(organizationType === 'Other' ? (customOrganization || 'ORG') : (organizationType || 'ORG')).split(" ")[0].toUpperCase()}_${username}`}
                          </span>
                        )}
                      </div>
                    </div>
                    {usernameAvailable === false && (
                      <p className="text-xs text-red-600 dark:text-red-400">Username already taken.</p>
                    )}
                    {!isValidUsername && touched.username && (
                      <p className="text-xs text-red-600 dark:text-red-400">Username must be lowercase, letters/numbers/-/_ only.</p>
                    )}
                  </div>
                </>
              )}

              {/* Error message */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="flex flex-col gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
                    role="alert"
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Account issue</span>
                    </div>
                    <p>{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit button */}
              <Button
                type="submit"
                disabled={loading || !isFormValid}
                className="h-12 w-full rounded-2xl bg-gradient-to-r from-cyan-600 via-cyan-500 to-emerald-500 text-base font-semibold text-white shadow-[0_14px_30px_-18px_rgba(8,145,178,0.95)] transition hover:from-cyan-700 hover:to-emerald-600 disabled:opacity-60 dark:shadow-[0_14px_30px_-18px_rgba(6,182,212,0.5)] clay-button"
              >
                {loading && (
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="mr-2 inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full"
                  />
                )}
                {loading ? "Please wait..." : isLogin ? "Login" : "Create Account"}
              </Button>
            </form>

            {!isRecovering && (
              <div className="mt-5 text-center text-sm text-slate-600 dark:text-slate-400">
                {isLogin ? "Don't have an account? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={handleToggleMode}
                  className="font-semibold text-cyan-700 transition hover:text-cyan-800 dark:text-cyan-300 dark:hover:text-cyan-200"
                >
                  {isLogin ? "Sign Up" : "Login"}
                </button>
              </div>
            )}

            {/* Forgot password link */}
            {isLogin && !isRecovering && (
              <button
                type="button"
                onClick={handleStartRecovery}
                className="mt-3 block w-full text-center text-sm font-semibold text-cyan-700 transition hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300"
              >
                Forgot password?
              </button>
            )}

            {isRecovering && (
              <button
                type="button"
                onClick={handleCancelRecovery}
                className="mt-3 block w-full text-center text-sm font-semibold text-slate-700 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                Back to login
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </main>
  );
};

export default Login;
