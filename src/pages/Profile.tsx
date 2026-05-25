import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDevices } from "@/hooks/useDevices";
import {
  ArrowLeft,
  LogOut,
  Check,
  Loader2,
  Upload,
  X,
  AlertCircle,
  Save,
  Shield,
  Lock,
  Send,
  Clock,
  Edit2,
  Smartphone,
  Plus,
  Trash2,
} from "lucide-react";

type ProfileData = {
  fullName: string;
  email: string;
  phoneNumber: string;
  photoURL?: string;
  role: string;
  twoFactorEnabled: boolean;
  twoFactorPhone?: string;
};

const buildProfile = (user: any): ProfileData => ({
  fullName: user?.displayName || user?.email?.split("@")[0] || "User",
  email: user?.email || "",
  phoneNumber: user?.phoneNumber || "",
  photoURL: user?.photoURL || "",
  role: "user",
  twoFactorEnabled: false,
  twoFactorPhone: user?.phoneNumber || "",
});

export const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { devices, addDevice, removeDevice } = useDevices();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData>(buildProfile(user));
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [twoFAModalOpen, setTwoFAModalOpen] = useState(false);
  const [pictureUploading, setPictureUploading] = useState(false);

  useEffect(() => {
    setProfile(buildProfile(user));
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [user]);

  const handleLogout = async () => {
    if (logout) {
      await logout();
    }
    navigate("/login");
  };

  const handleSaveProfile = async (updates: Partial<ProfileData>) => {
    setProfile((prev) => ({ ...prev, ...updates }));
  };

  const handleEditPicture = async (file: File) => {
    setPictureUploading(true);
    const photoURL = URL.createObjectURL(file);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setProfile((prev) => ({ ...prev, photoURL }));
    setPictureUploading(false);
  };

  const setupTwoFA = async (phoneNumber: string) => {
    setProfile((prev) => ({ ...prev, twoFactorEnabled: true, twoFactorPhone: phoneNumber }));
  };

  const disableTwoFA = async () => {
    setProfile((prev) => ({ ...prev, twoFactorEnabled: false, twoFactorPhone: "" }));
  };

  const handleAddDevice = () => {
    addDevice({ name: `Sensor ${devices.length + 1}`, lat: 0, lng: 0, zone: "Remote" });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 sm:p-8 flex items-center justify-center">
        <Skeleton className="h-32 rounded-2xl mb-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          className="absolute top-0 left-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl"
          animate={{ x: [0, 50, 0], y: [0, 50, 0] }}
          transition={{ duration: 15, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-purple-500/10 blur-3xl"
          animate={{ x: [0, -50, 0], y: [0, -50, 0] }}
          transition={{ duration: 15, repeat: Infinity }}
        />
      </div>

      <header className="sticky top-0 z-40 border-b border-cyan-500/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back to Dashboard</span>
          </motion.button>

          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Account Settings</h1>
            <p className="text-sm text-slate-400">Manage your HydroSentinal profile, devices, and security settings</p>
          </div>

          <motion.button
            onClick={handleLogout}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2 rounded-lg bg-red-600/20 px-4 py-2 text-red-400 hover:bg-red-600/30 transition border border-red-500/30"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm font-medium">Logout</span>
          </motion.button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <ProfileHeader
              profile={profile}
              onEditPicture={handleEditPicture}
              uploading={pictureUploading}
              onEditProfile={() => setEditModalOpen(true)}
            />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-slate-900/80 via-blue-900/20 to-slate-900/80 p-8 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/20 p-3 border border-blue-500/30">
                    <Edit2 className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Profile Information</h2>
                    <p className="text-xs text-slate-400">Update your account details</p>
                  </div>
                </div>
                <Button onClick={() => setEditModalOpen(true)} className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white">
                  <Edit2 className="h-4 w-4" />
                  Edit Profile
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoCard label="Full Name" value={profile.fullName || "Not set"} />
                <InfoCard label="Email" value={profile.email || "Not set"} />
                <InfoCard label="Phone" value={profile.phoneNumber || "Not set"} />
                <InfoCard label="Role" value={profile.role} />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-slate-900/80 via-blue-900/20 to-slate-900/80 p-8 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/20 p-3 border border-blue-500/30">
                    <Smartphone className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Connected Devices</h2>
                    <p className="text-xs text-slate-400">Track hardware currently onboarded to your account</p>
                  </div>
                </div>
                <Button onClick={handleAddDevice} className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white">
                  <Plus className="h-4 w-4" />
                  Add Device
                </Button>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {devices.length === 0 ? (
                  <div className="rounded-3xl border border-slate-700/50 bg-slate-950/60 p-6 text-center text-slate-400">
                    No devices connected yet. Add a device to start monitoring.
                  </div>
                ) : (
                  devices.map((device) => (
                    <motion.div
                      key={device.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="rounded-3xl border border-slate-700/50 bg-slate-950/70 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div>
                        <p className="text-sm text-slate-400">{device.zone}</p>
                        <h3 className="text-lg font-semibold text-white">{device.name}</h3>
                        <p className="text-xs text-slate-500">Added {new Date(device.createdAt).toLocaleDateString()}</p>
                      </div>
                      <Button onClick={() => removeDevice(device.id)} variant="outline" className="gap-2 border-slate-600 text-slate-300 hover:bg-slate-800">
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </div>

          <aside className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80 p-8 backdrop-blur-xl"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300">
                  <Shield className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Security</h2>
                  <p className="text-sm text-slate-400">Keep your account protected.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl bg-slate-950/80 border border-slate-700/50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-400">Two-factor authentication</p>
                      <p className="text-sm font-semibold text-white">
                        {profile.twoFactorEnabled ? "Enabled" : "Disabled"}
                      </p>
                    </div>
                    <Button onClick={() => setTwoFAModalOpen(true)} className="bg-cyan-600 hover:bg-cyan-700 text-white gap-2">
                      {profile.twoFactorEnabled ? <Lock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                      {profile.twoFactorEnabled ? "Manage" : "Enable"}
                    </Button>
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-950/80 border border-slate-700/50 p-4">
                  <p className="text-sm text-slate-400">Account status</p>
                  <p className="text-sm font-semibold text-emerald-300">Active</p>
                </div>
              </div>
            </motion.div>
          </aside>
        </div>
      </main>

      <EditProfileModal
        profile={profile}
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSave={handleSaveProfile}
      />

      <TwoFAModal
        profile={profile}
        open={twoFAModalOpen}
        onClose={() => setTwoFAModalOpen(false)}
        onEnable={setupTwoFA}
        onDisable={disableTwoFA}
      />
    </div>
  );
};

export default ProfilePage;

const ProfileHeader: React.FC<{
  profile: ProfileData;
  onEditPicture: (file: File) => void;
  uploading: boolean;
  onEditProfile: () => void;
}> = ({ profile, onEditPicture, uploading, onEditProfile }) => {
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onEditPicture(file);
    }
  };

  const initials =
    profile.fullName?.charAt(0)?.toUpperCase() || profile.email?.charAt(0)?.toUpperCase() || "U";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-slate-900/80 via-cyan-900/20 to-slate-900/80 p-8 backdrop-blur-xl transition-all hover:border-cyan-500/40"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-purple-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl transition-all group-hover:bg-cyan-500/20" />

      <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="relative">
          <label className="cursor-pointer group/avatar">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
            />
            <motion.div whileHover={{ scale: 1.05 }} className="relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400 blur-lg opacity-0 transition-opacity group-hover/avatar:opacity-50" />
              <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-2 border-cyan-400/50 bg-gradient-to-br from-cyan-500 to-blue-600 text-2xl font-bold text-white shadow-lg shadow-cyan-500/50 transition-all group-hover/avatar:border-cyan-300">
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : profile.photoURL ? (
                  <img src={profile.photoURL} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              {!uploading && (
                <motion.div
                  className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-cyan-500"
                  whileHover={{ scale: 1.1 }}
                >
                  <Upload className="h-3 w-3 text-white" />
                </motion.div>
              )}
            </motion.div>
          </label>
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h2 className="text-2xl font-bold text-white">{profile.fullName}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
              <Check className="h-3 w-3" />
              Verified
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-300 border border-cyan-500/30">
              Premium
            </span>
          </div>

          <p className="text-sm text-slate-400 mb-3">{profile.email}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-lg bg-slate-800/50 px-3 py-2 border border-slate-700/50">
              <p className="text-xs text-slate-500">Role</p>
              <p className="text-sm font-semibold text-cyan-300 capitalize">{profile.role}</p>
            </div>
            <div className="rounded-lg bg-slate-800/50 px-3 py-2 border border-slate-700/50">
              <p className="text-xs text-slate-500">2FA Status</p>
              <p className={`text-sm font-semibold ${profile.twoFactorEnabled ? "text-emerald-300" : "text-yellow-300"}`}>
                {profile.twoFactorEnabled ? "Enabled" : "Disabled"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-800/50 px-3 py-2 border border-slate-700/50">
              <p className="text-xs text-slate-500">Status</p>
              <p className="text-sm font-semibold text-emerald-300">Active</p>
            </div>
            <div className="rounded-lg bg-slate-800/50 px-3 py-2 border border-slate-700/50">
              <p className="text-xs text-slate-500">Phone</p>
              <p className="text-sm font-semibold text-cyan-300 break-all">{profile.phoneNumber || "Not set"}</p>
            </div>
          </div>

          <Button onClick={onEditProfile} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            Edit Profile
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

const EditProfileModal: React.FC<{
  profile: ProfileData;
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<ProfileData>) => Promise<void> | void;
}> = ({ profile, open, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    fullName: profile.fullName,
    phoneNumber: profile.phoneNumber,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData({ fullName: profile.fullName, phoneNumber: profile.phoneNumber });
  }, [profile]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg rounded-2xl border border-cyan-500/20 bg-slate-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Edit Profile</h3>
              <button onClick={onClose} className="rounded-lg bg-slate-700/50 p-2 text-slate-300 hover:bg-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Full Name</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
                <input
                  type="email"
                  disabled
                  value={profile.email}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-2 text-slate-500 cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  placeholder="+1 (555) 000-0000"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={onClose} variant="outline" className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800" disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white gap-2" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const TwoFAModal: React.FC<{
  profile: ProfileData;
  open: boolean;
  onClose: () => void;
  onEnable: (phoneNumber: string) => Promise<void> | void;
  onDisable: () => Promise<void> | void;
}> = ({ profile, open, onClose, onEnable, onDisable }) => {
  const [step, setStep] = useState<"phone" | "verify">("phone");
  const [phoneNumber, setPhoneNumber] = useState(profile.twoFactorPhone || "");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    setPhoneNumber(profile.twoFactorPhone || "");
  }, [profile.twoFactorPhone]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  const handleEnable = async () => {
    try {
      setLoading(true);
      setError(null);
      await onEnable(phoneNumber);
      setStep("verify");
      setTimeLeft(120);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error enabling 2FA");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    try {
      setLoading(true);
      setError(null);
      await onDisable();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error disabling 2FA");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg rounded-2xl border border-cyan-500/20 bg-slate-950 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                <Shield className="h-6 w-6 text-cyan-400" />
                Two-Factor Authentication
              </h3>
              <button onClick={onClose} className="rounded-lg bg-slate-700/50 p-2 text-slate-300 hover:bg-slate-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                {error}
              </div>
            )}

            {profile.twoFactorEnabled ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4">
                  <p className="text-emerald-300 font-semibold mb-2 flex items-center gap-2">
                    <Check className="h-5 w-5" />
                    2FA is enabled
                  </p>
                  <p className="text-sm text-slate-400">Verified phone: {profile.twoFactorPhone || "Not set"}</p>
                </div>
                <Button onClick={handleDisable} className="w-full bg-red-600 hover:bg-red-700 text-white gap-2" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Disabling...
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      Disable 2FA
                    </>
                  )}
                </Button>
              </div>
            ) : step === "phone" ? (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">
                  Enter your phone number to enable two-factor authentication. You'll receive an OTP to verify.
                </p>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
                <Button onClick={handleEnable} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white" disabled={loading || !phoneNumber}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Send OTP
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-slate-400">Enter the OTP sent to {phoneNumber}</p>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Verification Code</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full text-center text-2xl tracking-widest rounded-lg border border-slate-700 bg-slate-800/50 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 font-mono"
                  />
                </div>
                <div className="flex gap-2 text-xs text-slate-500 items-center">
                  <Clock className="h-4 w-4" />
                  {timeLeft > 0 ? `Expires in ${timeLeft}s` : "OTP expired"}
                </div>
                <div className="flex gap-3">
                  <Button onClick={() => setStep("phone")} variant="outline" className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800">
                    Back
                  </Button>
                  <Button onClick={onClose} className="flex-1 bg-cyan-600 hover:bg-cyan-700 text-white" disabled={loading || otp.length !== 6}>
                    Verify
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const InfoCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-lg bg-slate-800/50 p-4 border border-slate-700/50">
    <p className="text-xs text-slate-400 mb-2">{label}</p>
    <p className="font-semibold text-white">{value}</p>
  </div>
);

