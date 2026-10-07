import React from 'react';
import { Play, RotateCcw, Settings, Home } from 'lucide-react';

interface PauseModalProps {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onQuit: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  isOpen,
  onResume,
  onRestart,
  onOpenSettings,
  onQuit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm max-h-[92dvh] overflow-y-auto bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-2xl text-center space-y-3 sm:space-y-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-stone-100 tracking-wide">
            GAME PAUSED
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">Take a break or adjust match settings</p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-950/40 min-h-[42px]"
          >
            <Play className="w-4 h-4 fill-current" /> RESUME MATCH
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2 sm:py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs tracking-wider flex items-center justify-center gap-2 transition-colors border border-stone-700/60 min-h-[40px]"
          >
            <RotateCcw className="w-4 h-4" /> RESTART MATCH
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="w-full py-2 sm:py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs tracking-wider flex items-center justify-center gap-2 transition-colors border border-stone-700/60 min-h-[40px]"
          >
            <Settings className="w-4 h-4" /> SETTINGS
          </button>

          <button
            type="button"
            onClick={onQuit}
            className="w-full py-2 sm:py-2.5 px-4 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-300 font-semibold text-xs tracking-wider flex items-center justify-center gap-2 transition-colors border border-red-900/40 mt-0.5 min-h-[40px]"
          >
            <Home className="w-4 h-4" /> QUIT TO MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
};
