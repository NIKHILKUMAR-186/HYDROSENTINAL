import { useTheme } from "@/contexts/ThemeContext";
import { motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={
        ` inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium shadow-sm transition ` +
        (isDark
          ? `border border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800/80`
          : ` border border-transparent bg-gradient-to-r from-cyan-200/80 to-cyan-100/80 text-slate-900 hover:from-cyan-300`)
      }
    >
      <motion.div
        initial={false}
        animate={{ rotate: isDark ? 180 : 0 }}
        transition={{ duration: 0.3 }}
      >
        {isDark ? (
          <Sun className="h-4 w-4 text-amber-400" />
        ) : (
          <Moon className="h-4 w-4 text-slate-700" />
        )}
      </motion.div>
      <span className="hidden sm:inline text-sm font-medium">
        {isDark ? "Dark" : "Light"}
      </span>
      <span className="sr-only">Toggle theme</span>
    </motion.button>
  );
};

export default ThemeToggle;
