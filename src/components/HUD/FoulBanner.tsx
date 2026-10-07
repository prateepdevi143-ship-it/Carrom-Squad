import React from 'react';
import { GameNotification } from '../../game/GameEngine';

interface FoulBannerProps {
  notifications: GameNotification[];
}

export const FoulBanner: React.FC<FoulBannerProps> = ({ notifications }) => {
  if (notifications.length === 0) return null;

  return (
    <div className="absolute top-2 sm:top-14 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-1.5 pointer-events-none w-full max-w-xs sm:max-w-sm px-3">
      {notifications.map((n) => {
        let borderAndBg = 'bg-stone-900/90 border-amber-500/50 text-amber-100';
        if (n.type === 'foul') {
          borderAndBg = 'bg-red-950/95 border-red-500/80 text-red-100 shadow-red-950/50';
        } else if (n.type === 'queen') {
          borderAndBg = 'bg-purple-950/95 border-purple-500/80 text-purple-100 shadow-purple-950/50';
        } else if (n.type === 'extra_turn') {
          borderAndBg = 'bg-emerald-950/95 border-emerald-500/80 text-emerald-100 shadow-emerald-950/50';
        } else if (n.type === 'win') {
          borderAndBg = 'bg-amber-950/95 border-amber-400 text-amber-50 shadow-amber-950/60';
        }

        return (
          <div
            key={n.id}
            className={`w-full py-1.5 sm:py-2 px-3 sm:px-4 rounded-xl border backdrop-blur-md shadow-xl text-center transform transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${borderAndBg}`}
          >
            <div className="font-display font-bold text-xs sm:text-base tracking-wide flex items-center justify-center gap-2">
              {n.title}
            </div>
            {n.subtitle && (
              <div className="text-[10px] sm:text-xs opacity-85 mt-0.5 font-medium">
                {n.subtitle}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
