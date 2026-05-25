import { Cloud } from "lucide-react";
import { motion } from "framer-motion";

interface FloatingSyncWidgetProps {
  syncing: boolean;
  onSync: () => void;
}

const FloatingSyncWidget = ({ syncing, onSync }: FloatingSyncWidgetProps) => {
  return (
    <motion.button
      type="button"
      onClick={onSync}
      disabled={syncing}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="md:hidden fixed bottom-24 right-4 z-50 flex items-center justify-center gap-2 rounded-full border border-slate-700/40 bg-slate-950/85 px-3 py-2.5 text-xs font-semibold text-slate-100 shadow-lg shadow-slate-950/30 backdrop-blur transition"
    >
      {syncing ? (
        <span className="inline-flex h-3 w-3 animate-spin rounded-full border border-cyan-400/60 border-t-cyan-400" />
      ) : (
        <Cloud className="h-3.5 w-3.5" />
      )}
      <span>{syncing ? "Syncing" : "Sync"}</span>
    </motion.button>
  );
};

export default FloatingSyncWidget;
