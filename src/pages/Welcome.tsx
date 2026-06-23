import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export const Welcome = () => {
  const [step, setStep] = useState(1);
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [organization, setOrganization] = useState("");
  const { updateProfile, user } = useAuth();
  const navigate = useNavigate();

  const next = () => setStep((s) => Math.min(4, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const finish = async () => {
    if (!user) return navigate('/login');
    await updateProfile({ city, state: stateVal, organization_name: organization, profile_completion: 100 });
    navigate('/dashboard');
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white/95 dark:bg-slate-900/80 p-8 rounded-2xl border">
        <h2 className="text-2xl font-bold">Welcome to HydroSentinal</h2>
        <p className="text-sm text-slate-500 mt-1">Let's complete your profile</p>

        <div className="mt-6">
          <div className="mb-4 text-sm">Step {step} of 4</div>

          {step === 1 && (
            <div>
              <label className="block text-sm font-medium">City</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1 w-full rounded p-2 border" />
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="block text-sm font-medium">State</label>
              <input value={stateVal} onChange={(e) => setStateVal(e.target.value)} className="mt-1 w-full rounded p-2 border" />
            </div>
          )}

          {step === 3 && (
            <div>
              <label className="block text-sm font-medium">Organization (optional)</label>
              <input value={organization} onChange={(e) => setOrganization(e.target.value)} className="mt-1 w-full rounded p-2 border" />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-2">
              <p className="font-semibold">Review</p>
              <div className="text-sm text-slate-700">City: {city || '—'}</div>
              <div className="text-sm text-slate-700">State: {stateVal || '—'}</div>
              <div className="text-sm text-slate-700">Organization: {organization || '—'}</div>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            {step > 1 && <Button onClick={prev} variant="outline">Back</Button>}
            {step < 4 && <Button onClick={next}>Next</Button>}
            {step === 4 && <Button onClick={finish}>Finish</Button>}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Welcome;
