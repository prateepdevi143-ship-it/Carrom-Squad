import React from 'react';
import { X, Target, Crown, AlertTriangle, ShieldCheck } from 'lucide-react';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl max-h-[92dvh] overflow-y-auto bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
          <div>
            <h2 className="text-lg sm:text-xl font-display font-extrabold text-stone-100 tracking-wide">
              HOW TO PLAY CARROM
            </h2>
            <p className="text-[11px] sm:text-xs text-stone-400">Rules & Strategy Guide</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-100 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 4 Rules Sections */}
        <div className="space-y-3 sm:space-y-4 text-xs text-stone-300 leading-relaxed">
          {/* 1. Objective */}
          <div className="bg-stone-950/60 border border-stone-800/80 rounded-xl p-3 sm:p-3.5 space-y-1">
            <div className="font-semibold text-stone-100 flex items-center gap-2 text-xs sm:text-sm">
              <Target className="w-4 h-4 text-amber-400 shrink-0" />
              1. Objective of the Game
            </div>
            <p className="text-[11px] sm:text-xs text-stone-300">
              Pocket all your assigned carrom coins (White or Black in standard matches, or high-value coins in casual mode) into any of the 4 corner pockets before your opponent. The player with the highest points wins!
            </p>
          </div>

          {/* 2. Striker Positioning & Shooting */}
          <div className="bg-stone-950/60 border border-stone-800/80 rounded-xl p-3 sm:p-3.5 space-y-1">
            <div className="font-semibold text-stone-100 flex items-center gap-2 text-xs sm:text-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              2. Positioning & Shooting
            </div>
            <p className="text-[11px] sm:text-xs text-stone-300">
              1. Slide the striker along your baseline to position it. 2. Press and hold the striker, then pull back like a slingshot to adjust your 360° aim angle and power. 3. Release to shoot! You can also tap <strong>STRIKE</strong> or press <strong>Space</strong>. Pocketing a legal coin earns another turn!
            </p>
          </div>

          {/* 3. The Red Queen */}
          <div className="bg-stone-950/60 border border-stone-800/80 rounded-xl p-3 sm:p-3.5 space-y-1">
            <div className="font-semibold text-stone-100 flex items-center gap-2 text-xs sm:text-sm">
              <Crown className="w-4 h-4 text-purple-400 shrink-0" />
              3. The Red Queen Rule (Must Cover)
            </div>
            <p className="text-[11px] sm:text-xs text-stone-300">
              The Red Queen is worth 3 points in standard play (or 25 in casual). When pocketed, the Queen is held in escrow. You must pocket another valid coin on that turn or the subsequent shot to <strong>"cover"</strong> the Queen. Failing to cover returns the Queen to the center of the board!
            </p>
          </div>

          {/* 4. Common Fouls */}
          <div className="bg-stone-950/60 border border-stone-800/80 rounded-xl p-3 sm:p-3.5 space-y-1">
            <div className="font-semibold text-stone-100 flex items-center gap-2 text-xs sm:text-sm">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              4. Penalties & Fouls
            </div>
            <ul className="list-disc list-inside space-y-1 text-stone-400 text-[11px] sm:text-xs">
              <li>
                <strong className="text-stone-300">Striker Pocketed:</strong> Penalty applies (-1 pt or 1 previously pocketed coin returned to board). Your turn immediately ends.
              </li>
              <li>
                <strong className="text-stone-300">Invalid Queen Shot:</strong> Pocketing the striker while the Queen is awaiting cover returns the Queen to the center.
              </li>
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs tracking-wider transition-colors shadow-lg shadow-amber-950/40 min-h-[42px]"
        >
          GOT IT, LET'S PLAY
        </button>
      </div>
    </div>
  );
};
