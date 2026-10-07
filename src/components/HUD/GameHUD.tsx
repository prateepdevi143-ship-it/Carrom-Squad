import React from 'react';
import { GameEngine } from '../../game/GameEngine';
import { Volume2, VolumeX, Pause, Crown, Clock, Settings } from 'lucide-react';

interface GameHUDProps {
  engine: GameEngine;
  onPause: () => void;
  onOpenSettings: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  layout?: 'standard' | 'sidebar';
}

export const GameHUD: React.FC<GameHUDProps> = ({
  engine,
  onPause,
  onOpenSettings,
  soundEnabled,
  onToggleSound,
  layout = 'standard',
}) => {
  const whiteCoinsLeft = engine.coins.filter((c) => !c.pocketed && c.type === 'WHITE').length;
  const blackCoinsLeft = engine.coins.filter((c) => !c.pocketed && c.type === 'BLACK').length;
  const queenOnBoard = engine.coins.some((c) => !c.pocketed && c.type === 'QUEEN');

  const currentP = engine.currentPlayer;

  // SIDEBAR LAYOUT (For Mobile Landscape Left Column)
  if (layout === 'sidebar') {
    return (
      <div className="w-full h-full flex flex-col justify-between p-2 bg-stone-900/90 border border-stone-800/80 rounded-2xl backdrop-blur-md select-none text-xs">
        {/* Top: Current Player Turn */}
        <div className="space-y-1">
          <div className="text-[10px] font-bold tracking-wider text-stone-400 uppercase flex items-center justify-between">
            <span>ACTIVE TURN</span>
            {engine.turnTimerRemaining > 0 && (
              <span className={`font-mono text-[10px] flex items-center gap-0.5 ${engine.turnTimerRemaining < 6 ? 'text-red-400 font-bold animate-pulse' : 'text-amber-400'}`}>
                <Clock className="w-2.5 h-2.5" /> {engine.turnTimerRemaining}s
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-stone-950/60 border border-amber-500/40">
            <div
              className="w-3 h-3 rounded-full shrink-0 shadow-sm animate-pulse"
              style={{ backgroundColor: currentP.color }}
            />
            <span className="font-display font-bold text-xs text-stone-100 truncate flex-1">
              {currentP.name}
            </span>
          </div>
        </div>

        {/* Center: Live Match Scoreboard & Coins */}
        <div className="space-y-1.5 my-auto py-1">
          <div className="text-[10px] font-bold tracking-wider text-stone-400 uppercase">
            SCORES
          </div>
          <div className="space-y-1">
            {engine.players.map((p, idx) => {
              const isTurn = idx === engine.currentTurnIndex;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between px-2 py-1 rounded-lg border transition-all ${
                    isTurn
                      ? 'bg-stone-800/90 border-amber-500/60 shadow-sm text-stone-100'
                      : 'bg-stone-950/40 border-stone-800/50 text-stone-400 opacity-80'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <span className="text-[11px] font-medium truncate max-w-[65px]">
                      {p.name}
                    </span>
                  </div>
                  <span className="font-display font-bold text-amber-400 font-mono text-xs ml-1">
                    {p.score}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Coins Remaining Info */}
          <div className="flex items-center justify-around pt-1 border-t border-stone-800/60 text-[10px] text-stone-400 font-mono">
            <span className="flex items-center gap-1" title="White">
              <span className="w-2 h-2 rounded-full bg-stone-100 inline-block"></span>
              {whiteCoinsLeft}
            </span>
            <span className="flex items-center gap-1" title="Black">
              <span className="w-2 h-2 rounded-full bg-stone-800 border border-stone-600 inline-block"></span>
              {blackCoinsLeft}
            </span>
            <span
              className={`flex items-center gap-0.5 ${queenOnBoard ? 'text-red-400' : 'text-stone-600 line-through'}`}
              title="Queen"
            >
              <Crown className="w-2.5 h-2.5 fill-current" />
            </span>
          </div>
        </div>

        {/* Bottom: Action Controls */}
        <div className="flex items-center justify-between pt-1 border-t border-stone-800/60">
          <button
            type="button"
            onClick={onToggleSound}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
            title={soundEnabled ? 'Mute' : 'Unmute'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onPause}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
            title="Pause Match"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // STANDARD TOP BAR LAYOUT (For Portrait Mobile, Tablets, Desktops)
  return (
    <div className="w-full flex items-center justify-between px-2.5 sm:px-3 py-1 sm:py-1.5 bg-stone-900/85 border border-stone-800/80 rounded-xl backdrop-blur-md select-none shrink-0 min-h-[40px]">
      {/* Left: Current Player Turn Callout with Glow */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full shrink-0 shadow-sm animate-pulse"
          style={{ backgroundColor: currentP.color }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="font-display font-bold text-xs sm:text-sm text-stone-100 truncate max-w-[68px] xs:max-w-[100px] sm:max-w-[150px]">
              {currentP.name}
            </span>
            <span className="hidden xs:inline-block px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[9px] font-bold tracking-wider uppercase">
              TURN
            </span>
          </div>
          {engine.turnTimerRemaining > 0 && (
            <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-stone-400 font-mono mt-0.2">
              <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
              <span className={engine.turnTimerRemaining < 6 ? 'text-red-400 font-bold' : 'text-stone-300'}>
                {engine.turnTimerRemaining}s
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Center: Live Match Scoreboard (Compact Responsive Pills) */}
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-hidden">
        {engine.players.map((p, idx) => {
          const isTurn = idx === engine.currentTurnIndex;
          return (
            <div
              key={p.id}
              className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-0.5 rounded-lg border text-xs transition-all ${
                isTurn
                  ? 'bg-stone-800/90 border-amber-500/60 shadow-sm shadow-amber-950/20 ring-1 ring-amber-500/30'
                  : 'bg-stone-950/50 border-stone-800/60 opacity-75'
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-[11px] font-medium text-stone-300 hidden md:inline truncate max-w-[60px]">
                {p.name}:
              </span>
              <span className="font-display font-bold text-amber-400 font-mono tabular-nums text-xs sm:text-sm">
                {p.score}
              </span>
            </div>
          );
        })}
      </div>

      {/* Right: Coins Remaining & Quick Action Buttons */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Remaining Coins Counter (Visible on width >= 480px) */}
        <div className="hidden sm:flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-stone-300 font-mono text-[11px]" title="White Coins Left">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-100 border border-stone-300 inline-block"></span>
            <span>{whiteCoinsLeft}</span>
          </div>
          <div className="flex items-center gap-1 text-stone-400 font-mono text-[11px]" title="Black Coins Left">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-800 border border-stone-600 inline-block"></span>
            <span>{blackCoinsLeft}</span>
          </div>
          <div
            className={`flex items-center gap-1 font-mono text-[11px] ${
              queenOnBoard ? 'text-red-400' : 'text-stone-500 line-through'
            }`}
            title="Queen Status"
          >
            <Crown className="w-3 h-3 fill-current" />
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            type="button"
            onClick={onToggleSound}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
            title={soundEnabled ? 'Mute' : 'Unmute'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button
            type="button"
            onClick={onPause}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
            title="Pause Match"
          >
            <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
