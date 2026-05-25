import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import ComplaintForm from "./ComplaintForm";
import { Sparkles, CheckCircle2, AlertCircle, Loader2, Send, X } from "lucide-react";

interface AIDiagnosticProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DiagnosticStep = "input" | "analyzing" | "solution" | "escalate";

interface Solution {
  title: string;
  steps: string[];
  estimatedTime: string;
  successRate: string;
}

const AIDiagnostic: React.FC<AIDiagnosticProps> = ({ open, onOpenChange }) => {
  const [step, setStep] = useState<DiagnosticStep>("input");
  const [userProblem, setUserProblem] = useState("");
  const [solution, setSolution] = useState<Solution | null>(null);
  const [complaintFormOpen, setComplaintFormOpen] = useState(false);
  const [solutionTried, setSolutionTried] = useState(false);

  // AI Problem Analysis Simulation
  const analyzeProblem = async () => {
    if (!userProblem.trim()) return;

    setStep("analyzing");

    // Simulate AI thinking
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mock solutions based on keywords
    const solutionMap: Record<string, Solution> = {
      offline: {
        title: "🔌 Device Offline - Connection Recovery",
        steps: [
          "Check WiFi connection strength (should be > -70 dBm)",
          "Restart the ESP32 device (power off for 10 seconds)",
          "Verify WiFi credentials are correct",
          "Move device closer to WiFi router if signal is weak",
          "Check firewall isn't blocking device",
          "Wait 2-3 minutes for reconnection",
        ],
        estimatedTime: "3-5 minutes",
        successRate: "94%",
      },
      ph: {
        title: "⚗️ pH Level Issue - Water Balance Fix",
        steps: [
          "Verify sensor is calibrated (do calibration if > 30 days old)",
          "Check if reading is from correct zone/location",
          "Review water quality history to see trend",
          "For high pH (> 8.5): Consider water treatment or dilution",
          "For low pH (< 6.5): May need alkalinity adjustment",
          "Retest after any treatment adjustments",
        ],
        estimatedTime: "30 minutes - 2 hours",
        successRate: "88%",
      },
      tds: {
        title: "🧂 TDS Reading High - Water Purity Check",
        steps: [
          "Confirm location of sensor (different zones have different TDS)",
          "Check if reading is abnormal or normal for your area",
          "Verify sensor calibration (do if > 60 days old)",
          "Review historical data for trends",
          "TDS > 500 ppm: May need water treatment (RO filter)",
          "Test with known source for accuracy",
        ],
        estimatedTime: "30 minutes - 2 hours",
        successRate: "91%",
      },
      sensor: {
        title: "📊 Sensor Error - Calibration & Reset",
        steps: [
          "Check sensor power connection",
          "Verify sensor is not physically damaged",
          "Perform full sensor calibration with buffer solutions",
          "Wait 1 hour after calibration before use",
          "Check for air bubbles in sensor reading area",
          "If error persists, sensor may need replacement",
        ],
        estimatedTime: "1-2 hours",
        successRate: "85%",
      },
      data: {
        title: "📈 Wrong Data - Validation & Recalibration",
        steps: [
          "Verify data is from correct time period",
          "Check environmental factors (temperature affects readings)",
          "Ensure sensor is reading from same location consistently",
          "Perform sensor calibration",
          "Compare with manual water testing if possible",
          "Review multiple readings to confirm pattern",
        ],
        estimatedTime: "30 minutes - 2 hours",
        successRate: "89%",
      },
      default: {
        title: "🔍 General Troubleshooting - System Check",
        steps: [
          "Check device is powered on and connected",
          "Verify internet connectivity",
          "Check recent error logs in dashboard",
          "Restart the monitoring device",
          "Clear browser cache and refresh page",
          "Check system status page for any outages",
        ],
        estimatedTime: "15-30 minutes",
        successRate: "92%",
      },
    };

    // Find matching solution
    const problemLower = userProblem.toLowerCase();
    let matchedSolution = solutionMap.default;

    Object.entries(solutionMap).forEach(([key, sol]) => {
      if (problemLower.includes(key) && key !== "default") {
        matchedSolution = sol;
      }
    });

    setSolution(matchedSolution);
    setStep("solution");
  };

  const handleTrySolution = () => {
    setSolutionTried(true);
    // Reset after showing success state
    setTimeout(() => {
      setStep("solution");
    }, 2000);
  };

  const handleStillHaveIssue = () => {
    setStep("escalate");
    setComplaintFormOpen(true);
  };

  const handleClose = () => {
    setStep("input");
    setUserProblem("");
    setSolution(null);
    setSolutionTried(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open && !complaintFormOpen} onOpenChange={handleClose}>
        <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-0 shadow-2xl dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          {/* Glassmorphism background */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-cyan-500/5 backdrop-blur-xl" />

          {/* Content */}
          <div className="relative z-10">
            <DialogHeader className="border-b border-purple-500/20 px-6 py-4">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="h-5 w-5 text-purple-400" />
                </motion.div>
                <DialogTitle className="text-xl font-bold text-transparent bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text">
                  AI Problem Solver
                </DialogTitle>
              </div>
              <DialogDescription className="mt-1 text-sm text-slate-400">
                Describe your issue. I'll analyze and suggest solutions.
              </DialogDescription>
            </DialogHeader>

            <AnimatePresence mode="wait">
              {/* STEP 1: Input */}
              {step === "input" && (
                <motion.div
                  key="input"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="px-6 py-6 space-y-4"
                >
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-300">
                      What's the issue? 🔍
                    </label>
                    <Textarea
                      placeholder="Describe your water quality issue or device problem..."
                      value={userProblem}
                      onChange={(e) => setUserProblem(e.target.value)}
                      className="min-h-28 border-purple-500/30 bg-slate-800/50 text-white placeholder:text-slate-500 focus:border-purple-400 focus:ring-purple-400/30"
                    />
                    <p className="text-xs text-slate-500">
                      Examples: "Device offline", "pH reading too high", "TDS sensor error"
                    </p>
                  </div>

                  <Button
                    onClick={analyzeProblem}
                    disabled={!userProblem.trim()}
                    className="w-full h-11 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-lg hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Analyze with AI
                  </Button>
                </motion.div>
              )}

              {/* STEP 2: Analyzing */}
              {step === "analyzing" && (
                <motion.div
                  key="analyzing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="px-6 py-12 flex flex-col items-center justify-center gap-4"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Sparkles className="h-8 w-8 text-purple-400" />
                  </motion.div>
                  <p className="text-slate-300 font-medium">Analyzing your issue...</p>
                  <p className="text-sm text-slate-500">AI is processing your problem</p>
                </motion.div>
              )}

              {/* STEP 3: Solution */}
              {step === "solution" && solution && (
                <motion.div
                  key="solution"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="px-6 py-6 space-y-6"
                >
                  {/* Solution Title */}
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4"
                  >
                    <p className="text-lg font-bold text-white">{solution.title}</p>
                  </motion.div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-slate-800/30 border border-blue-500/20 p-3">
                      <p className="text-xs text-slate-400">Estimated Time</p>
                      <p className="text-sm font-bold text-blue-300">{solution.estimatedTime}</p>
                    </div>
                    <div className="rounded-lg bg-slate-800/30 border border-emerald-500/20 p-3">
                      <p className="text-xs text-slate-400">Success Rate</p>
                      <p className="text-sm font-bold text-emerald-300">{solution.successRate}</p>
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-300">📋 Steps to Fix:</p>
                    <motion.div
                      className="space-y-2"
                      variants={{
                        hidden: { opacity: 0 },
                        visible: {
                          opacity: 1,
                          transition: { staggerChildren: 0.1 },
                        },
                      }}
                      initial="hidden"
                      animate="visible"
                    >
                      {solution.steps.map((step, idx) => (
                        <motion.div
                          key={idx}
                          variants={{
                            hidden: { opacity: 0, x: -10 },
                            visible: { opacity: 1, x: 0 },
                          }}
                          className="rounded-lg bg-slate-800/30 border border-slate-700 p-3 flex gap-3"
                        >
                          <span className="text-purple-400 font-bold text-sm min-w-6">
                            {idx + 1}.
                          </span>
                          <span className="text-slate-300 text-sm">{step}</span>
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>

                  {/* Action Buttons */}
                  {!solutionTried ? (
                    <div className="grid grid-cols-2 gap-3 pt-4">
                      <Button
                        onClick={handleTrySolution}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Try Solution
                      </Button>
                      <Button
                        onClick={handleStillHaveIssue}
                        variant="outline"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <AlertCircle className="mr-2 h-4 w-4" />
                        Still Have Issue
                      </Button>
                    </div>
                  ) : (
                    <motion.div
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-center gap-3"
                    >
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                      <div>
                        <p className="font-semibold text-emerald-300">Great!</p>
                        <p className="text-sm text-emerald-200">Try the steps above. Contact support if you need more help.</p>
                      </div>
                    </motion.div>
                  )}

                  <Button
                    onClick={handleClose}
                    variant="ghost"
                    className="w-full text-slate-400 hover:text-slate-300"
                  >
                    Back to Help
                  </Button>
                </motion.div>
              )}

              {/* STEP 4: Escalate */}
              {step === "escalate" && (
                <motion.div
                  key="escalate"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-6 py-6 text-center space-y-4"
                >
                  <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
                  <div>
                    <p className="font-bold text-white">Issue Persists?</p>
                    <p className="text-sm text-slate-400 mt-1">
                      Let's escalate this to our support team for faster resolution.
                    </p>
                  </div>
                  <Button
                    onClick={handleStillHaveIssue}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    File Formal Complaint
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complaint Form Modal */}
      <ComplaintForm
        open={complaintFormOpen}
        onOpenChange={setComplaintFormOpen}
      />
    </>
  );
};

export default AIDiagnostic;
