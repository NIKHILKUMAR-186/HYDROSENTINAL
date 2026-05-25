import { Wifi } from "lucide-react";

interface StatusBarProps {
  monitorRunning: boolean;
  timerSeconds: number;
  connectionStatus: "connected" | "disconnected";
}

const StatusBar = ({ monitorRunning, timerSeconds, connectionStatus }: StatusBarProps) => {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/40 px-3 py-2.5 text-xs font-medium">
      <div className="flex items-center gap-2">
        <span className={`flex h-2 w-2 rounded-full ${monitorRunning ? "bg-green-400/80" : "bg-slate-500/60"}`} />
        <span className="text-slate-300">{monitorRunning ? "Monitoring" : "Idle"}</span>
      </div>

      <div className="flex items-center gap-2 text-slate-400">
        <span>⏱ {timerSeconds}s</span>
      </div>

      <div className="flex items-center gap-1.5 text-slate-400">
        <Wifi className="h-3 w-3" />
        <span>{connectionStatus === "connected" ? "Live" : "Offline"}</span>
      </div>
    </div>
  );
};

export default StatusBar;

