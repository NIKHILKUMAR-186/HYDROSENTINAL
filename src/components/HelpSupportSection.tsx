import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import ComplaintForm from "./ComplaintForm";
import AIDiagnostic from "./AIDiagnostic";
import {
  AlertTriangle,
  Droplet,
  HelpCircle,
  Mail,
  Phone,
  Clock,
  ChevronRight,
  Zap,
  Shield,
  TrendingUp,
  MessageCircle,
  FileText,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

const HelpSupportSection: React.FC = () => {
  const { theme } = useTheme();
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<string>("");
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [agentData, setAgentData] = useState<any>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [aiDiagnosticOpen, setAiDiagnosticOpen] = useState(false);

  // Agent calling system
  const callAgent = async (agentType: string) => {
    setActiveAgent(agentType);
    setAgentLoading(true);

    // Simulate agent call
    await new Promise((resolve) => setTimeout(resolve, 800));

    const agentResponses: Record<string, any> = {
      sensors: {
        title: "🔍 Sensor Management Agent",
        status: "Active",
        data: [
          { id: "SEN-001", name: "North Zone A", signal: "95%", lastUpdate: "2s ago" },
          { id: "SEN-002", name: "South Zone B", signal: "92%", lastUpdate: "1s ago" },
          { id: "SEN-003", name: "East Zone C", signal: "88%", lastUpdate: "3s ago" },
          { id: "SEN-004", name: "Central Hub", signal: "98%", lastUpdate: "Just now" },
        ],
        action: "Monitoring all sensors in real-time",
      },
      alerts: {
        title: "⚡ Alert Processing Agent",
        status: "Active",
        data: [
          { alert: "pH Level Warning", device: "SEN-001", severity: "High", time: "2m ago" },
          { alert: "TDS Alert", device: "SEN-003", severity: "Medium", time: "5m ago" },
          { alert: "Temperature Shift", device: "SEN-002", severity: "Low", time: "10m ago" },
        ],
        action: "Processing alerts in < 2 seconds",
      },
      accuracy: {
        title: "✓ Data Validation Agent",
        status: "Active",
        data: [
          { metric: "pH Accuracy", value: "99.4%", confidence: "High" },
          { metric: "TDS Accuracy", value: "99.1%", confidence: "High" },
          { metric: "Temperature", value: "99.2%", confidence: "High" },
          { metric: "Turbidity", value: "98.9%", confidence: "High" },
        ],
        action: "Validating all sensor readings",
      },
      uptime: {
        title: "🟢 System Health Agent",
        status: "Healthy",
        data: [
          { component: "Sensor Network", uptime: "99.9%", status: "Online" },
          { component: "Cloud Backend", uptime: "99.95%", status: "Online" },
          { component: "Data Pipeline", uptime: "99.8%", status: "Online" },
          { component: "Alert System", uptime: "99.99%", status: "Online" },
        ],
        action: "All systems operating normally",
      },
    };

    setAgentData(agentResponses[agentType]);
    setAgentLoading(false);
  };

  const stats = [
    {
      label: "Active Sensors",
      value: "1,200+",
      color: "cyan",
      description: "Monitoring water 24/7",
      agentType: "sensors",
    },
    {
      label: "Alert Speed",
      value: "< 2s",
      color: "emerald",
      description: "Real-time notifications",
      agentType: "alerts",
    },
    {
      label: "Accuracy",
      value: "99.2%",
      color: "blue",
      description: "Data reliability",
      agentType: "accuracy",
    },
    {
      label: "Uptime",
      value: "99.9%",
      color: "purple",
      description: "System availability",
      agentType: "uptime",
    },
  ];

  const faqItems = [
    {
      id: "faq-1",
      question: "What is normal water pH level?",
      answer:
        "Normal drinking water pH should be between 6.5 and 8.5. Our sensors monitor pH in real-time. If readings go beyond this range, you'll receive an alert immediately.",
    },
    {
      id: "faq-2",
      question: "Why is my device showing offline?",
      answer:
        "Your device may be offline due to: weak WiFi signal, power issues, or network connectivity problems. Check your WiFi connection and ensure the device has stable power. Restart the device if needed.",
    },
    {
      id: "faq-3",
      question: "How often should I calibrate my sensor?",
      answer:
        "We recommend sensor calibration every 30-60 days depending on water quality variations. Regular calibration ensures accurate readings and prevents sensor drift.",
    },
    {
      id: "faq-4",
      question: "Can I export my water quality data?",
      answer:
        "Yes! You can export historical data in CSV format from the Analytics section. Go to Dashboard > Reports > Download Data to get your water quality records.",
    },
    {
      id: "faq-5",
      question: "What does the TDS reading mean?",
      answer:
        "TDS (Total Dissolved Solids) measures the concentration of dissolved substances in water. Readings below 500 ppm are generally considered safe for drinking. Higher readings may indicate water treatment needs.",
    },
    {
      id: "faq-6",
      question: "How are alerts generated?",
      answer:
        "Alerts are automatically generated when sensor readings exceed safe thresholds. You can customize alert thresholds in Settings for each water quality parameter.",
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  const isDark = theme === "dark";

  return (
    <div className="min-h-screen space-y-8 py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Droplet className="h-8 w-8 text-cyan-400" />
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 rounded-full bg-cyan-400/20"
            />
          </div>
          <h1 className="text-4xl font-bold text-white">Help & Support</h1>
        </div>
        <p className="text-slate-400">
          Get assistance, learn more about water monitoring, or report issues
        </p>
      </motion.div>

      {/* System Stats - Agent Calling */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => {
          const colorMap: Record<string, string> = {
            cyan: "from-cyan-500/10 via-cyan-500/5 to-transparent border-cyan-500/20 hover:border-cyan-500/40 hover:from-cyan-500/20 hover:via-cyan-500/10 hover:shadow-lg hover:shadow-cyan-500/20",
            emerald: "from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/20 hover:border-emerald-500/40 hover:from-emerald-500/20 hover:via-emerald-500/10 hover:shadow-lg hover:shadow-emerald-500/20",
            blue: "from-blue-500/10 via-blue-500/5 to-transparent border-blue-500/20 hover:border-blue-500/40 hover:from-blue-500/20 hover:via-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20",
            purple: "from-purple-500/10 via-purple-500/5 to-transparent border-purple-500/20 hover:border-purple-500/40 hover:from-purple-500/20 hover:via-purple-500/10 hover:shadow-lg hover:shadow-purple-500/20",
          };

          const textColorMap: Record<string, string> = {
            cyan: "text-cyan-400",
            emerald: "text-emerald-400",
            blue: "text-blue-400",
            purple: "text-purple-400",
          };

          const isActive = activeAgent === stat.agentType;

          return (
            <motion.button
              key={stat.label}
              variants={itemVariants}
              onClick={() => callAgent(stat.agentType)}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${colorMap[stat.color]} p-6 border transition-all cursor-pointer ${
                isActive ? "ring-2 ring-offset-2 ring-offset-slate-950" : ""
              }`}
              style={isActive ? { boxShadow: `0 0 20px var(--color-${stat.color})` } : {}}
            >
              <motion.div
                animate={isActive ? { rotate: 360 } : { rotate: 0 }}
                transition={{ duration: 2, repeat: isActive ? Infinity : 0 }}
                className="absolute top-2 right-2 h-2 w-2 rounded-full bg-current opacity-60"
                style={{ color: textColorMap[stat.color] }}
              />
              <div className="relative space-y-3">
                <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                <motion.p
                  animate={isActive ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                  transition={{ duration: 1, repeat: isActive ? Infinity : 0 }}
                  className={`text-3xl font-bold ${textColorMap[stat.color]}`}
                >
                  {stat.value}
                </motion.p>
                <p className="text-xs text-slate-500">{stat.description}</p>
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Agent Response Panel */}
      <AnimatePresence>
        {agentData && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="rounded-2xl border border-cyan-500/30 bg-slate-900/50 backdrop-blur p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: agentLoading ? 360 : 0 }}
                  transition={{ duration: 2, repeat: agentLoading ? Infinity : 0 }}
                >
                  {agentLoading ? (
                    <Loader2 className="h-5 w-5 text-cyan-400" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  )}
                </motion.div>
                <div>
                  <h3 className="font-bold text-white">{agentData.title}</h3>
                  <p className="text-xs text-slate-400">{agentData.action}</p>
                </div>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  setActiveAgent(null);
                  setAgentData(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </motion.button>
            </div>

            <motion.div
              className="space-y-3"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {agentData.data.map((item: any, idx: number) => (
                <motion.div
                  key={idx}
                  variants={itemVariants}
                  className="rounded-lg border border-cyan-500/20 bg-slate-800/30 p-4 hover:border-cyan-500/40 transition-colors"
                >
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {Object.entries(item).map(([key, value]: [string, any]) => (
                      <div key={key}>
                        <p className="text-slate-400 capitalize text-xs">{key}</p>
                        <p className="text-white font-medium">{value}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-4"
            >
              <p className="text-sm text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Agent Status: <span className="font-bold">{agentData.status}</span>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Actions */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {/* AI Diagnostic Card */}
        <motion.div variants={itemVariants}>
          <button
            onClick={() => setAiDiagnosticOpen(true)}
            className="group relative h-full w-full overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-transparent p-6 transition-all hover:from-purple-500/20 hover:via-blue-500/10 border border-purple-500/20 hover:border-purple-500/40"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-transparent to-purple-500/0 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Sparkles className="h-8 w-8 text-purple-400" />
                </motion.div>
                <ChevronRight className="h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-1" />
              </div>
              <div className="space-y-1 text-left">
                <h3 className="font-semibold text-white">AI Problem Solver</h3>
                <p className="text-sm text-slate-400">
                  Let AI diagnose & fix your issue
                </p>
              </div>
            </div>
          </button>
        </motion.div>

        {/* Raise Complaint Card */}
        <motion.div variants={itemVariants}>
          <button
            onClick={() => setComplaintModalOpen(true)}
            className="group relative h-full w-full overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/10 via-orange-500/5 to-transparent p-6 transition-all hover:from-red-500/20 hover:via-orange-500/10 border border-red-500/20 hover:border-red-500/40"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-transparent to-red-500/0 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <AlertTriangle className="h-8 w-8 text-red-400" />
                <ChevronRight className="h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-1" />
              </div>
              <div className="space-y-1 text-left">
                <h3 className="font-semibold text-white">Raise Complaint</h3>
                <p className="text-sm text-slate-400">
                  Report issues or problems
                </p>
              </div>
            </div>
          </button>
        </motion.div>

        {/* Emergency Hotline Card */}
        <motion.div variants={itemVariants}>
          <div className="group relative h-full w-full overflow-hidden rounded-2xl bg-gradient-to-br from-red-600/10 via-rose-500/5 to-transparent p-6 border border-red-600/30 hover:border-red-500/50 transition-all hover:from-red-600/20 hover:via-rose-500/10">
            <div className="absolute inset-0 bg-gradient-to-r from-red-600/0 via-transparent to-red-600/0 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <Zap className="h-8 w-8 text-red-500 animate-pulse" />
                <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              </div>
              <div className="space-y-2 text-left">
                <h3 className="font-semibold text-white">Emergency Hotline</h3>
                <a
                  href="tel:+919876543210"
                  className="inline-flex items-center gap-2 text-lg font-bold text-red-400 hover:text-red-300 transition-colors"
                >
                  <Phone className="h-5 w-5" />
                  +91 9876 543210
                </a>
                <p className="text-xs text-slate-500">Available 24/7</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Contact Support Card */}
        <motion.div variants={itemVariants}>
          <a
            href="mailto:support@hydrosentinal.com"
            className="group relative h-full w-full block overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent p-6 transition-all hover:from-blue-500/20 hover:via-cyan-500/10 border border-blue-500/20 hover:border-blue-500/40"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-transparent to-blue-500/0 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative space-y-4">
              <div className="flex items-center justify-between">
                <Mail className="h-8 w-8 text-blue-400" />
                <ChevronRight className="h-5 w-5 text-slate-500 transition-transform group-hover:translate-x-1" />
              </div>
              <div className="space-y-1 text-left">
                <h3 className="font-semibold text-white">Email Support</h3>
                <p className="text-xs text-blue-400 truncate">
                  support@hydrosentinal.com
                </p>
                <p className="text-xs text-slate-500">Response in 2-4 hours</p>
              </div>
            </div>
          </a>
        </motion.div>
      </motion.div>

      {/* FAQ Section */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2">
          <HelpCircle className="h-6 w-6 text-cyan-400" />
          <h2 className="text-2xl font-bold text-white">Frequently Asked Questions</h2>
        </div>

        <Card className="border-cyan-500/20 bg-slate-900/50 backdrop-blur">
          <CardContent className="p-0">
            <Accordion
              type="single"
              collapsible
              value={expandedFaq}
              onValueChange={setExpandedFaq}
            >
              {faqItems.map((item, index) => (
                <AccordionItem
                  key={item.id}
                  value={item.id}
                  className="border-b border-cyan-500/10 last:border-0"
                >
                  <AccordionTrigger className="px-6 py-4 hover:bg-cyan-500/5 transition-colors hover:no-underline">
                    <span className="flex items-start gap-3 text-left">
                      <span className="mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-500/20 text-sm font-semibold text-cyan-400 flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-white">{item.question}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4 text-slate-300 border-t border-cyan-500/10">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </motion.div>

      {/* Feature Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-purple-400" />
          <h2 className="text-2xl font-bold text-white">Our Features</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: TrendingUp,
              title: "Real-Time Monitoring",
              description:
                "Track water quality metrics 24/7 with instant notifications",
              color: "cyan",
            },
            {
              icon: Shield,
              title: "Data Security",
              description: "Your water quality data is encrypted and secure",
              color: "green",
            },
            {
              icon: Clock,
              title: "Historical Data",
              description: "Access 2+ years of water quality history",
              color: "blue",
            },
            {
              icon: FileText,
              title: "Detailed Reports",
              description: "Generate comprehensive water analysis reports",
              color: "purple",
            },
            {
              icon: Droplet,
              title: "Multi-Parameter",
              description:
                "Monitor pH, TDS, Temperature, Turbidity, and more",
              color: "cyan",
            },
            {
              icon: AlertTriangle,
              title: "Smart Alerts",
              description:
                "Customizable thresholds for all water quality parameters",
              color: "orange",
            },
          ].map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                className={`group relative overflow-hidden rounded-xl bg-gradient-to-br from-${feature.color}-500/10 via-${feature.color}-500/5 to-transparent p-6 border border-${feature.color}-500/20 hover:border-${feature.color}-500/40 transition-all hover:shadow-lg hover:shadow-${feature.color}-500/20`}
              >
                <div className={`absolute inset-0 bg-gradient-to-r from-${feature.color}-500/0 via-transparent to-${feature.color}-500/0 opacity-0 transition-opacity group-hover:opacity-100`} />
                <div className="relative space-y-2">
                  <Icon className={`h-8 w-8 text-${feature.color}-400`} />
                  <h3 className="font-semibold text-white">{feature.title}</h3>
                  <p className="text-sm text-slate-400">{feature.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Contact Info */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        className="space-y-4"
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-cyan-400" />
          <h2 className="text-2xl font-bold text-white">Contact Information</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Email Support */}
          <motion.div variants={itemVariants}>
            <Card className="border-cyan-500/20 bg-slate-900/50 hover:bg-slate-800/50 transition-colors">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-cyan-400" />
                  <CardTitle className="text-white">Email Support</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-slate-300">
                  <a
                    href="mailto:support@hydrosentinal.com"
                    className="text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    support@hydrosentinal.com
                  </a>
                </p>
                <p className="text-xs text-slate-500">
                  Typical response time: 2-4 hours
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Phone Support */}
          <motion.div variants={itemVariants}>
            <Card className="border-red-500/20 bg-slate-900/50 hover:bg-slate-800/50 transition-colors">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Phone className="h-5 w-5 text-red-400" />
                  <CardTitle className="text-white">Emergency Line</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-slate-300">
                  <a
                    href="tel:+919876543210"
                    className="text-red-400 hover:text-red-300 transition-colors font-semibold"
                  >
                    +91 9876 543210
                  </a>
                </p>
                <p className="text-xs text-slate-500">Available 24/7 for emergencies</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>

      {/* AI Diagnostic Modal */}
      <AIDiagnostic
        open={aiDiagnosticOpen}
        onOpenChange={setAiDiagnosticOpen}
      />

      {/* Complaint Form Modal */}
      <ComplaintForm
        open={complaintModalOpen}
        onOpenChange={setComplaintModalOpen}
      />
    </div>
  );
};

export default HelpSupportSection;
