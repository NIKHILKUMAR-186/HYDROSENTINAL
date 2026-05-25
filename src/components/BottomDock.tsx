import { LayoutDashboard, ChartLine, Globe, Bell, UserRound } from "lucide-react";
import { motion } from "framer-motion";

interface BottomDockProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
}

const navigationItems: Array<{ key: string; label: string; icon: typeof LayoutDashboard }> = [
  { key: "Overview", label: "Home", icon: LayoutDashboard },
  { key: "Charts", label: "Analytics", icon: ChartLine },
  { key: "Water Distribution", label: "Map", icon: Globe },
  { key: "Alerts", label: "Alerts", icon: Bell },
  { key: "Profile", label: "Profile", icon: UserRound },
];

const BottomDock = ({ activeTab, onNavigate }: BottomDockProps) => {
  return (
    <div
      className="md:hidden fixed inset-x-0 bottom-0 z-40 flex justify-center pb-4 pointer-events-none"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
    >
      <nav className="pointer-events-auto inline-flex items-center gap-1 rounded-2xl border border-slate-700/40 bg-slate-950/80 p-1.5 backdrop-blur-lg shadow-2xl shadow-slate-950/40">
        {navigationItems.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <motion.button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`flex flex-col items-center justify-center rounded-xl px-3 py-2.5 text-[10px] font-medium uppercase transition ${
                active
                  ? "bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/10"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="mt-1">{label}</span>
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
};

export default BottomDock;
