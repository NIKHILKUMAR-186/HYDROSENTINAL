import { Menu, UserCircle } from "lucide-react";

interface MobileHeaderProps {
  userEmail?: string | null;
  onMenuClick: () => void;
  onProfileClick: () => void;
}

const MobileHeader = ({ userEmail, onMenuClick, onProfileClick }: MobileHeaderProps) => {
  return (
    <div
      className="md:hidden sticky top-0 z-50 border-b border-slate-800/20 bg-slate-950/80 px-4 py-2.5 backdrop-blur-sm text-slate-100"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex h-12 items-center justify-between gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/50 bg-slate-900/60 text-slate-200 transition hover:bg-slate-800 active:scale-95"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400/90">
            HydroSentinal
          </p>
        </div>

        <button
          type="button"
          onClick={onProfileClick}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/50 bg-slate-900/60 text-slate-200 transition hover:bg-slate-800 active:scale-95"
          aria-label="Open profile"
        >
          <UserCircle className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default MobileHeader;
