import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Upload,
  Droplet,
  Send,
} from "lucide-react";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/firebase";

interface ComplaintFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedDeviceId?: string;
}

type FormData = {
  fullName: string;
  email: string;
  deviceId: string;
  category: string;
  severity: string;
  location: string;
  message: string;
  screenshot?: File;
};

type FormError = Partial<Record<keyof FormData, string>>;

const ComplaintForm: React.FC<ComplaintFormProps> = ({
  open,
  onOpenChange,
  preselectedDeviceId,
}) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<FormData>({
    fullName: "",
    email: user?.email || "",
    deviceId: preselectedDeviceId || "",
    category: "",
    severity: "",
    location: "",
    message: "",
  });

  const [errors, setErrors] = useState<FormError>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [complaintId, setComplaintId] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");

  const getFormspreeErrorMessage = async (response: Response) => {
    if (response.status !== 429) {
      return "Failed to submit form to Formspree";
    }

    try {
      const payload = await response.clone().json();
      const retryAfterSeconds = Number(payload?.retryAfterSeconds ?? response.headers.get("Retry-After") ?? NaN);

      return Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? `Too many requests. Please try again in ${retryAfterSeconds} seconds.`
        : "Too many requests. Please try again shortly.";
    } catch {
      const retryAfterSeconds = Number(response.headers.get("Retry-After") || NaN);
      return Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? `Too many requests. Please try again in ${retryAfterSeconds} seconds.`
        : "Too many requests. Please try again shortly.";
    }
  };

  useEffect(() => {
    if (user?.email) {
      setFormData((prev) => ({ ...prev, email: user.email }));
    }
  }, [user?.email]);

  useEffect(() => {
    if (preselectedDeviceId) {
      setFormData((prev) => ({ ...prev, deviceId: preselectedDeviceId }));
    }
  }, [preselectedDeviceId]);

  const validateForm = (): boolean => {
    const newErrors: FormError = {};

    if (!formData.fullName.trim()) newErrors.fullName = "Full name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    if (!formData.deviceId.trim()) newErrors.deviceId = "Device ID is required";
    if (!formData.category) newErrors.category = "Category is required";
    if (!formData.severity) newErrors.severity = "Severity is required";
    if (!formData.location.trim()) newErrors.location = "Location is required";
    if (!formData.message.trim()) newErrors.message = "Message is required";

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Maximum file size is 5MB",
          variant: "destructive",
        });
        return;
      }
      setFormData((prev) => ({ ...prev, screenshot: file }));
      setFileName(file.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Generate complaint ID
      const id = `CMP-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      setComplaintId(id);

      // Prepare form data for Formspree
      const formDataToSend = new FormData();
      formDataToSend.append("fullName", formData.fullName);
      formDataToSend.append("email", formData.email);
      formDataToSend.append("deviceId", formData.deviceId);
      formDataToSend.append("category", formData.category);
      formDataToSend.append("severity", formData.severity);
      formDataToSend.append("location", formData.location);
      formDataToSend.append("message", formData.message);
      formDataToSend.append("complaintId", id);
      formDataToSend.append("timestamp", new Date().toISOString());

      if (formData.screenshot) {
        formDataToSend.append("screenshot", formData.screenshot);
      }

      // Send to Formspree
      const formspreeResponse = await fetch(
        "https://formspree.io/f/xwvyrepy",
        {
          method: "POST",
          body: formDataToSend,
        }
      );

      if (!formspreeResponse.ok) {
        throw new Error(await getFormspreeErrorMessage(formspreeResponse));
      }

      // Store complaint in Firestore
      try {
        const complaintRef = await addDoc(collection(db, "complaints"), {
          complaintId: id,
          userId: user?.uid || "anonymous",
          email: formData.email,
          fullName: formData.fullName,
          deviceId: formData.deviceId,
          category: formData.category,
          severity: formData.severity,
          location: formData.location,
          message: formData.message,
          hasScreenshot: !!formData.screenshot,
          status: "received",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Update document with reference
        await updateDoc(complaintRef, {
          docRef: complaintRef.id,
        });
      } catch (firestoreError) {
        console.warn("Failed to store complaint in Firestore:", firestoreError);
        // Continue even if Firestore storage fails
      }

      setSuccess(true);

      // Reset form after 2 seconds
      setTimeout(() => {
        setFormData({
          fullName: "",
          email: user?.email || "",
          deviceId: preselectedDeviceId || "",
          category: "",
          severity: "",
          location: "",
          message: "",
        });
        setFileName("");
        setErrors({});
        setSuccess(false);
        setComplaintId("");
        onOpenChange(false);
      }, 2500);
    } catch (error) {
      console.error("Submission error:", error);
      toast({
        title: "Submission Failed",
        description:
          error instanceof Error ? error.message : "Failed to submit complaint",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading && !success) {
      onOpenChange(false);
    }
  };

  const isDark = theme === "dark";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-0 shadow-2xl dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:max-w-2xl">
        {/* Glassmorphism background */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/5 via-blue-500/5 to-purple-500/5 backdrop-blur-xl" />

        {/* Water gradient glow border */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 p-[1px]">
          <div className="rounded-2xl bg-slate-900 dark:bg-slate-950" />
        </div>

        {/* Content */}
        <div className="relative z-10">
          <DialogHeader className="border-b border-cyan-500/20 px-6 py-4">
            <div className="flex items-center gap-2">
              <Droplet className="h-5 w-5 text-cyan-400" />
              <DialogTitle className="text-xl font-bold text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text">
                Raise a Complaint
              </DialogTitle>
            </div>
            <DialogDescription className="mt-1 text-sm text-slate-400">
              Help us improve HydroSentinal by reporting issues
            </DialogDescription>
          </DialogHeader>

          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center justify-center px-6 py-12 text-center"
              >
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                    rotate: [0, 5, -5, 0],
                  }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                >
                  <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-400" />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h3 className="mt-4 text-2xl font-bold text-white">
                    Complaint Submitted
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Thank you for helping us improve
                  </p>
                  <p className="mt-4 rounded-lg bg-slate-800/50 px-4 py-3 font-mono text-sm text-cyan-300 border border-cyan-500/30">
                    Tracking ID: <strong>{complaintId}</strong>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    We'll contact you at{" "}
                    <span className="text-cyan-400">{formData.email}</span>
                  </p>
                </motion.div>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 px-6 py-6"
              >
                {/* Full Name */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <Input
                    name="fullName"
                    placeholder="Your full name"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className={`border-cyan-500/30 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400/30 ${
                      errors.fullName ? "border-red-500/50" : ""
                    }`}
                  />
                  {errors.fullName && (
                    <p className="text-xs text-red-400">{errors.fullName}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <Input
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className={`border-cyan-500/30 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400/30 ${
                      errors.email ? "border-red-500/50" : ""
                    }`}
                  />
                  {errors.email && (
                    <p className="text-xs text-red-400">{errors.email}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Device ID */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">
                      Device ID <span className="text-red-400">*</span>
                    </label>
                    <Input
                      name="deviceId"
                      placeholder="DEV-12345"
                      value={formData.deviceId}
                      onChange={(e) =>
                        setFormData({ ...formData, deviceId: e.target.value })
                      }
                      className={`border-cyan-500/30 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400/30 ${
                        errors.deviceId ? "border-red-500/50" : ""
                      }`}
                    />
                    {errors.deviceId && (
                      <p className="text-xs text-red-400">{errors.deviceId}</p>
                    )}
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">
                      Category <span className="text-red-400">*</span>
                    </label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) =>
                        setFormData({ ...formData, category: value })
                      }
                    >
                      <SelectTrigger
                        className={`border-cyan-500/30 bg-slate-800/50 text-white focus:border-cyan-400 focus:ring-cyan-400/30 ${
                          errors.category ? "border-red-500/50" : ""
                        }`}
                      >
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="border-cyan-500/30 bg-slate-800">
                        <SelectItem value="water-quality">Water Quality</SelectItem>
                        <SelectItem value="device-offline">Device Offline</SelectItem>
                        <SelectItem value="sensor-error">Sensor Error</SelectItem>
                        <SelectItem value="wrong-data">Wrong Data</SelectItem>
                        <SelectItem value="leakage">Leakage</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.category && (
                      <p className="text-xs text-red-400">{errors.category}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Severity */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">
                      Severity <span className="text-red-400">*</span>
                    </label>
                    <Select
                      value={formData.severity}
                      onValueChange={(value) =>
                        setFormData({ ...formData, severity: value })
                      }
                    >
                      <SelectTrigger
                        className={`border-cyan-500/30 bg-slate-800/50 text-white focus:border-cyan-400 focus:ring-cyan-400/30 ${
                          errors.severity ? "border-red-500/50" : ""
                        }`}
                      >
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent className="border-cyan-500/30 bg-slate-800">
                        <SelectItem value="low">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                            Low
                          </span>
                        </SelectItem>
                        <SelectItem value="medium">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-yellow-500" />
                            Medium
                          </span>
                        </SelectItem>
                        <SelectItem value="high">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-orange-500" />
                            High
                          </span>
                        </SelectItem>
                        <SelectItem value="emergency">
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-red-500" />
                            Emergency
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.severity && (
                      <p className="text-xs text-red-400">{errors.severity}</p>
                    )}
                  </div>

                  {/* Location */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">
                      Location <span className="text-red-400">*</span>
                    </label>
                    <Input
                      name="location"
                      placeholder="Device location"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData({ ...formData, location: e.target.value })
                      }
                      className={`border-cyan-500/30 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400/30 ${
                        errors.location ? "border-red-500/50" : ""
                      }`}
                    />
                    {errors.location && (
                      <p className="text-xs text-red-400">{errors.location}</p>
                    )}
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">
                    Complaint Details <span className="text-red-400">*</span>
                  </label>
                  <Textarea
                    name="message"
                    placeholder="Describe your issue in detail..."
                    value={formData.message}
                    onChange={(e) =>
                      setFormData({ ...formData, message: e.target.value })
                    }
                    className={`min-h-24 border-cyan-500/30 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400/30 ${
                      errors.message ? "border-red-500/50" : ""
                    }`}
                  />
                  {errors.message && (
                    <p className="text-xs text-red-400">{errors.message}</p>
                  )}
                </div>

                {/* File Upload */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-300">
                    Screenshot (Optional) - Max 5MB
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="relative w-full rounded-lg border-2 border-dashed border-cyan-500/30 bg-slate-800/50 px-4 py-6 text-center transition-all hover:border-cyan-400/50 hover:bg-slate-800/70"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-5 w-5 text-cyan-400" />
                      <span className="text-sm text-slate-300">
                        {fileName || "Click to upload or drag and drop"}
                      </span>
                      <span className="text-xs text-slate-500">PNG, JPG up to 5MB</span>
                    </div>
                  </button>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="relative w-full h-11 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-cyan-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Complaint
                    </>
                  )}
                </Button>

                {/* Help Text */}
                <p className="text-xs text-slate-500 text-center">
                  Your complaint will be securely transmitted and stored. We'll
                  respond within 24 hours.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Close Button */}
        {!loading && !success && (
          <DialogClose className="absolute right-4 top-4 z-20 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition-colors" />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ComplaintForm;
