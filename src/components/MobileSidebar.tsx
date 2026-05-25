import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  ChartLine,
  Waves,
  Cpu,
  Brain,
  Cloud,
  FileBarChart2,
  UserRound,
  Settings,
  HelpCircle,
  AlertTriangle,
  Bell,
  X,
} from "lucide-react";

export type MobileSidebarTab =
  | "Overview"
  | "Command Center"
  | "Charts"
  | "Water Distribution"
  | "Hardware"
  | "AI"
  | "Cloud"
  | "Reports"
  | "Profile"
  | "Settings"
  | "Help";

interface MobileSidebarProps {
  open: boolean;
  userEmail?: string | null;
  activeTab: MobileSidebarTab;
  onClose: () => void;
  onTabChange: (tab: MobileSidebarTab) => void;
  onLogout: () => void;
}

const menuItems: Array<{
  label: MobileSidebarTab;
  icon: typeof LayoutDashboard;
}> = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Command Center", icon: AlertTriangle },
  { label: "Charts", icon: ChartLine },
  { label: "Water Distribution", icon: Waves },
  { label: "Hardware", icon: Cpu },
  { label: "AI", icon: Brain },
  { label: "Cloud", icon: Cloud },
  { label: "Reports", icon: FileBarChart2 },
  { label: "Profile", icon: UserRound },
  { label: "Settings", icon: Settings },
  { label: "Help", icon: HelpCircle },
];

const MobileSidebar = ({
  open,
  userEmail,
  activeTab,
  onClose,
  onTabChange,
  onLogout,
}: MobileSidebarProps) => {
  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-label="Close menu"
          />
          <motion.aside
            className="fixed left-0 top-0 z-50 h-full w-[85vw] max-w-xs overflow-hidden bg-slate-950/98 shadow-2xl shadow-slate-950/40 border-r border-slate-800/70 p-5 text-slate-100"
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ type: "spring", bounce: 0.12, duration: 0.25 }}
            drag="x"
            dragConstraints={{ left: -280, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -80) {
                onClose();
              }
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">
                  HydroSentinal
                </p>
                <p className="mt-2 text-sm font-semibold text-white truncate">
                  {userEmail ?? "Guest"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700/90 bg-slate-900/80 text-slate-200 transition hover:bg-slate-800"
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-6 space-y-1">
              {menuItems.map(({ label, icon: Icon }) => {
                const active = activeTab === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      onTabChange(label);
                      onClose();
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${active ? "bg-cyan-500/15 text-cyan-100 shadow-sm shadow-cyan-500/10" : "text-slate-300 hover:bg-slate-900/80 hover:text-white"}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </nav>

            <div className="mt-auto pt-6">
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center justify-center rounded-2xl border border-slate-700/80 bg-slate-900/85 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
              >
                <Bell className="mr-2 h-4 w-4 text-cyan-300" />
                Log out
              </button>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
};

export default MobileSidebar;
