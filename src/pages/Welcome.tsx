import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import * as authService from "@/services/authService";
import { checkUsernameAvailable } from "@/services/profileService";
import { useToast } from "@/hooks/use-toast";

const ORG_TYPES = [
  "Student",
  "Researcher",
  "NGO",
  "Government",
  "Industry",
  "Farmer",
  "Individual User",
  "Other",
];

const WATER_SOURCES = ["Ground Water", "River", "Lake", "Municipal Supply", "Borewell", "Rainwater", "Other"];

const USE_CASES = [
  "Drinking Water",
  "Agriculture",
  "Fish Farming",
  "Industrial Use",
  "Research",
  "Municipal Monitoring",
  "Other",
];

const normalizeUsername = (v?: string) => (v || "").toLowerCase().trim().replace(/[^a-z0-9_]/g, "");

const calculateCompletion = (obj: Record<string, any>) => {
  let score = 0;
  if (obj.full_name) score += 15;
  if (obj.username) score += 15;
  if (obj.phone) score += 10;
  if (obj.organization_type) score += 10;
  if (obj.organization_name) score += 10;
  if (obj.city) score += 10;
  if (obj.state) score += 10;
  if (obj.country) score += 10;
  if (obj.water_source) score += 5;
  if (obj.use_case) score += 5;
  return score;
};

export const Welcome = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [organizationType, setOrganizationType] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [country, setCountry] = useState("");
  const [waterSource, setWaterSource] = useState<string | null>(null);
  const [useCase, setUseCase] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // attempt to prefill from existing profile row
    (async () => {
      try {
        console.log('[AUTH]', user);
        const profile = await authService.getProfile(user.uid);
        console.log('[PROFILE]', profile);
        setFullName(profile?.full_name ?? "");
        setUsername(profile?.username ?? "");
        setPhone(profile?.phone ?? "");
        setOrganizationType(profile?.organization_type ?? null);
        setOrganizationName(profile?.organization_name ?? "");
        setCity(profile?.city ?? "");
        setStateVal(profile?.state ?? "");
        setCountry(profile?.country ?? "");
        setWaterSource(profile?.water_source ?? null);
        setUseCase(profile?.use_case ?? null);
      } catch (err) {
        console.warn("[PROFILE] prefill error", authService.formatError(err));
      }
    })();
  }, [user]);

  const completion = useMemo(() => calculateCompletion({
    full_name: fullName,
    username,
    phone,
    organization_type: organizationType,
    organization_name: organizationName,
    city,
    state: stateVal,
    country,
    water_source: waterSource,
    use_case: useCase,
  }), [fullName, username, phone, organizationType, organizationName, city, stateVal, country, waterSource, useCase]);

  const validateUsername = async (val: string) => {
    const normalized = normalizeUsername(val);
    if (!normalized || normalized.length < 3 || normalized.length > 20) {
      setUsernameAvailable(false);
      return false;
    }
    try {
      const ok = await checkUsernameAvailable(normalized, user?.uid);
      setUsernameAvailable(ok);
      return ok;
    } catch (err) {
      console.warn("[PROFILE] username check failed", err);
      setUsernameAvailable(null);
      return false;
    }
  };

  const handleComplete = async () => {
    setError(null);
    if (!user) {
      setError("Not authenticated");
      return;
    }

    if (!fullName) {
      setError("Full name is required");
      return;
    }
    if (!username) {
      setError("Username is required");
      return;
    }

    const normalized = normalizeUsername(username);
    if (normalized.length < 3 || normalized.length > 20) {
      setError("Username must be 3-20 lowercase characters or numbers");
      return;
    }

    setLoading(true);
    try {
      const ok = await validateUsername(username);
      if (!ok) {
        setError("Username already exists or is invalid");
        setLoading(false);
        return;
      }

      const profilePayload = {
        id: user.uid,
        email: user.email ?? null,
        full_name: fullName || null,
        username: normalized || null,
        phone: phone || null,
        organization_type: organizationType || null,
        organization_name: organizationName || null,
        city: city || null,
        state: stateVal || null,
        country: country || null,
        water_source: waterSource || null,
        use_case: useCase || null,
        profile_completion: completion,
        updated_at: new Date().toISOString(),
      };

      console.log('[PROFILE UPSERT PAYLOAD]', profilePayload);
      const saved = await authService.upsertProfile(profilePayload as any);
      console.log('[PROFILE UPSERT RESULT]', saved);
      toast({ title: "Profile saved", description: "Redirecting..." });

        const fresh = await authService.getProfile(user.uid);
        console.log('[PROFILE FOUND]', fresh);

      // redirect based on role
      console.log('[ROLE RESOLUTION]', role);
        const dest = authService.redirectByRole(fresh?.role ?? role ?? "user");
      console.log('[REDIRECT TARGET]', dest);
        navigate(dest, { replace: true });
    } catch (err: any) {
      console.warn("[PROFILE] save failed", authService.formatError(err));
      const msg = authService.formatError(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Complete your profile</h1>
          <p className="text-sm text-slate-400">This helps us personalize HydroSentinal for your needs.</p>
        </div>

        <div className="rounded-3xl bg-white/5 p-6 backdrop-blur-md border border-white/6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-4">
              <section className="rounded-2xl p-4 bg-white/3 border">
                <h2 className="font-semibold">Personal Information</h2>
                <p className="text-xs text-slate-300">Required fields are marked *</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="text-sm">Full name *</label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">Username *</label>
                    <Input value={username} onBlur={() => validateUsername(username)} onChange={(e) => setUsername(e.target.value)} />
                    {usernameAvailable === false && <p className="text-xs text-red-400">Username already exists</p>}
                  </div>
                </div>

                <div className="mt-3">
                  <label className="text-sm">Phone (optional)</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 555 5555" />
                </div>
              </section>

              <section className="rounded-2xl p-4 bg-white/3 border mt-4">
                <h2 className="font-semibold">Organization Details</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm">Organization Type *</label>
                    <Select onValueChange={(v) => setOrganizationType(v)}>
                      <SelectTrigger>
                        <SelectValue>{organizationType ?? "Select type"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {ORG_TYPES.map((t) => (
                          <SelectItem value={t} key={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm">Organization Name</label>
                    <Input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl p-4 bg-white/3 border mt-4">
                <h2 className="font-semibold">Location</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="text-sm">City</label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">State</label>
                    <Input value={stateVal} onChange={(e) => setStateVal(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm">Country</label>
                    <Input value={country} onChange={(e) => setCountry(e.target.value)} />
                  </div>
                </div>
              </section>

              <section className="rounded-2xl p-4 bg-white/3 border mt-4">
                <h2 className="font-semibold">Water Profile</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-sm">Primary Water Source *</label>
                    <Select onValueChange={(v) => setWaterSource(v)}>
                      <SelectTrigger>
                        <SelectValue>{waterSource ?? "Select source"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {WATER_SOURCES.map((t) => (
                          <SelectItem value={t} key={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm">Use Case *</label>
                    <Select onValueChange={(v) => setUseCase(v)}>
                      <SelectTrigger>
                        <SelectValue>{useCase ?? "Select use case"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {USE_CASES.map((t) => (
                          <SelectItem value={t} key={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <div className="mt-4 flex items-center justify-between">
                <div className="w-2/3">
                  <Progress value={completion} />
                  <p className="mt-2 text-sm text-slate-300">Profile completion: {completion}%</p>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleComplete} disabled={loading} className="bg-cyan-600">
                    {loading ? "Saving..." : "Complete Profile"}
                  </Button>
                </div>
              </div>

              {error && <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl p-4 bg-white/3 border">
                <h3 className="font-semibold">Next step</h3>
                <p className="text-sm text-slate-300">Register your device to start sending readings.</p>
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => toast({ title: "Register device", description: "Device registration is not yet implemented." })} className="w-full">Register Device</Button>
                  <Button variant="outline" onClick={() => navigate("/dashboard")}>Skip For Now</Button>
                </div>
              </div>

              <div className="rounded-2xl p-4 bg-white/3 border text-sm text-slate-300">
                <p className="font-semibold">Why we ask</p>
                <p className="mt-2">Providing these details helps tailor alerts, mapping and device recommendations.</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Welcome;
