import { LayoutDashboard, ChartLine, Globe, Bell, UserRound } from "lucide-react";
import { motion } from "framer-motion";

interface BottomNavigationProps {
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

const BottomNavigation = ({ activeTab, onNavigate }: BottomNavigationProps) => {
  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/95 backdrop-blur-lg px-4 py-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-12px_30px_-20px_rgba(15,23,42,0.45)] dark:border-slate-700 dark:bg-slate-950/95"
    >
      <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
        {navigationItems.map(({ key, label, icon: Icon }) => {
          const active = activeTab === key;
          return (
            <motion.button
              key={`${key}-${label}`}
              type="button"
              onClick={() => onNavigate(key)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`flex flex-1 flex-col items-center justify-center rounded-2xl px-2 py-2 text-[11px] font-semibold transition ${active ? "text-cyan-500" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"}`}
            >
              <Icon className="h-5 w-5" />
              <span className="mt-1">{label}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
