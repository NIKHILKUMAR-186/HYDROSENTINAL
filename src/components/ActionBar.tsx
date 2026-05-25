import { Play, Pause, Upload, Download } from "lucide-react";

interface ActionBarProps {
  monitorRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  onLoad: () => void;
  onSave: () => void;
}

const ActionBar = ({ monitorRunning, onStart, onStop, onLoad, onSave }: ActionBarProps) => {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <button
        onClick={onStart}
        disabled={monitorRunning}
        className="group relative flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-cyan-500/90 to-cyan-600/90 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:from-cyan-400/95 hover:to-cyan-500/95 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
      >
        <Play className="h-4 w-4" />
        <span>Start</span>
      </button>

      <button
        onClick={onStop}
        disabled={!monitorRunning}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-red-500/90 to-red-600/90 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-red-500/20 transition hover:from-red-400/95 hover:to-red-500/95 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
      >
        <Pause className="h-4 w-4" />
        <span>Stop</span>
      </button>

      <button
        onClick={onLoad}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-amber-500/90 to-amber-600/90 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-amber-500/20 transition hover:from-amber-400/95 hover:to-amber-500/95 active:scale-95"
      >
        <Upload className="h-4 w-4" />
        <span>Load</span>
      </button>

      <button
        onClick={onSave}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-emerald-500/90 to-emerald-600/90 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400/95 hover:to-emerald-500/95 active:scale-95"
      >
        <Download className="h-4 w-4" />
        <span>Save</span>
      </button>
    </div>
  );
};

export default ActionBar;
