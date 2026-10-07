import React, { useEffect } from 'react';
import { Player, QueenState } from '../../types/game';
import confetti from 'canvas-confetti';
import { Trophy, RotateCcw, Home, PlusCircle, Crown } from 'lucide-react';

interface GameOverModalProps {
  isOpen: boolean;
  winner: Player | null;
  players: Player[];
  queenState: QueenState;
  onRematch: () => void;
  onNewGame: () => void;
  onMainMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isOpen,
  winner,
  players,
  onRematch,
  onNewGame,
  onMainMenu,
}) => {
  useEffect(() => {
    if (isOpen) {
      // Fire victory confetti burst
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#ffffff'],
      });
    }
  }, [isOpen]);

  if (!isOpen || !winner) return null;

  // Sort players by score descending
  const rankedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-2xl text-center space-y-4 sm:space-y-6">
        {/* Trophy & Winner Title */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2 sm:mb-3 shadow-inner">
            <Trophy className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>
          <span className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase tracking-widest">
            Victory!
          </span>
          <h1 className="text-xl sm:text-3xl font-display font-black text-stone-100 tracking-wide mt-0.5">
            {winner.name.toUpperCase()} WINS!
          </h1>
          <p className="text-xs text-stone-400 mt-0.5">
            Final Score: <span className="text-amber-400 font-bold">{winner.score} Points</span>
          </p>
        </div>

        {/* Match Breakdown Table */}
        <div className="bg-stone-950/60 border border-stone-800/80 rounded-xl overflow-hidden p-2.5 sm:p-3 space-y-1.5 text-left">
          <div className="text-[10px] sm:text-[11px] font-bold text-stone-400 uppercase tracking-wider px-1">
            Match Standings
          </div>
          <div className="divide-y divide-stone-800/60">
            {rankedPlayers.map((player, idx) => (
              <div
                key={player.id}
                className="py-1.5 px-1.5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="font-mono text-stone-400 w-3.5 font-bold text-[11px]">
                    #{idx + 1}
                  </span>
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="font-medium text-stone-200 truncate max-w-[100px] sm:max-w-[140px]">
                    {player.name}
                  </span>
                  {idx === 0 && (
                    <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                </div>

                <div className="flex items-center gap-3 sm:gap-4 text-stone-300 text-xs shrink-0">
                  <span className="text-stone-400 text-[11px]">
                    Coins: <span className="text-stone-200 font-mono">{player.coinsPocketed}</span>
                  </span>
                  <span className="font-display font-bold text-amber-400 font-mono tabular-nums text-xs sm:text-sm">
                    {player.score} pts
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={onRematch}
            className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-amber-950/40 min-h-[42px]"
          >
            <RotateCcw className="w-3.5 h-3.5" /> REMATCH
          </button>
          <button
            type="button"
            onClick={onNewGame}
            className="w-full py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs tracking-wider flex items-center justify-center gap-1.5 transition-colors border border-stone-700/60 min-h-[42px]"
          >
            <PlusCircle className="w-3.5 h-3.5" /> NEW GAME
          </button>
          <button
            type="button"
            onClick={onMainMenu}
            className="w-full py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs tracking-wider flex items-center justify-center gap-1.5 transition-colors border border-stone-700/60 min-h-[42px]"
          >
            <Home className="w-3.5 h-3.5" /> MENU
          </button>
        </div>
      </div>
    </div>
  );
};
