import React, { useState, useEffect } from 'react';
import { X, Volume2, Palette, Clock, BarChart2 } from 'lucide-react';
import { audio } from '../../services/AudioService';
import { storage } from '../../services/StorageService';
import { GameStats } from '../../types/game';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'classic' | 'tournament' | 'midnight';
  onThemeChange: (t: 'classic' | 'tournament' | 'midnight') => void;
  showAimLine: boolean;
  onToggleAimLine: () => void;
  turnTimer: number;
  onTurnTimerChange: (sec: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onThemeChange,
  showAimLine,
  onToggleAimLine,
  turnTimer,
  onTurnTimerChange,
}) => {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(audio.isSoundEnabled());
  const [volume, setVolume] = useState<number>(audio.getVolume());
  const [stats, setStats] = useState<GameStats>(storage.getStats());

  useEffect(() => {
    if (isOpen) {
      setSoundEnabled(audio.isSoundEnabled());
      setVolume(audio.getVolume());
      setStats(storage.getStats());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSoundToggle = () => {
    const next = !soundEnabled;
    audio.setSoundEnabled(next);
    setSoundEnabled(next);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    audio.setVolume(v);
    setVolume(v);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
          <div>
            <h2 className="text-lg sm:text-xl font-display font-extrabold text-stone-100 tracking-wide">
              SETTINGS & STATS
            </h2>
            <p className="text-[11px] sm:text-xs text-stone-400">Audio, graphics, and gameplay</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-100 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audio Section */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Volume2 className="w-4 h-4" /> Sound & Audio
          </div>
          <div className="bg-stone-950/60 border border-stone-800/80 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-200">Sound Effects</span>
              <button
                type="button"
                onClick={handleSoundToggle}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  soundEnabled
                    ? 'bg-amber-500 text-stone-950'
                    : 'bg-stone-800 text-stone-400'
                }`}
              >
                {soundEnabled ? 'ON' : 'MUTED'}
              </button>
            </div>
            {soundEnabled && (
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-stone-400">
                  <span>Volume</span>
                  <span className="font-mono">{Math.round(volume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-full accent-amber-500 h-1.5 bg-stone-800 rounded-lg"
                />
              </div>
            )}
          </div>
        </div>

        {/* Visual Themes */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Palette className="w-4 h-4" /> Board Theme
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'classic', label: 'Rosewood' },
              { id: 'tournament', label: 'Maple' },
              { id: 'midnight', label: 'Midnight' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onThemeChange(t.id as any)}
                className={`py-2 px-1 text-xs font-medium rounded-xl border transition-all ${
                  theme === t.id
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Gameplay Assists */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Rules & Assists
          </div>
          <div className="bg-stone-950/60 border border-stone-800/80 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-stone-200">Aim Trajectory Guide</span>
              <button
                type="button"
                onClick={onToggleAimLine}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  showAimLine
                    ? 'bg-amber-500 text-stone-950'
                    : 'bg-stone-800 text-stone-400'
                }`}
              >
                {showAimLine ? 'VISIBLE' : 'HIDDEN'}
              </button>
            </div>
            <div>
              <div className="text-[11px] text-stone-400 mb-1">Turn Timer</div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { sec: 0, label: 'Off' },
                  { sec: 15, label: '15s' },
                  { sec: 25, label: '25s' },
                  { sec: 45, label: '45s' },
                ].map((item) => (
                  <button
                    key={item.sec}
                    type="button"
                    onClick={() => onTurnTimerChange(item.sec)}
                    className={`py-1 text-xs rounded-lg border font-medium transition-colors ${
                      turnTimer === item.sec
                        ? 'bg-amber-500 text-stone-950 border-amber-500 font-bold'
                        : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Career Stats */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4" /> Career Stats
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-stone-950/60 border border-stone-800/80 rounded-xl p-2">
              <div className="text-base sm:text-lg font-display font-extrabold text-stone-100 tabular-nums">
                {stats.matchesWon} / {stats.matchesPlayed}
              </div>
              <div className="text-[9px] sm:text-[10px] text-stone-400 uppercase">Matches Won</div>
            </div>
            <div className="bg-stone-950/60 border border-stone-800/80 rounded-xl p-2">
              <div className="text-base sm:text-lg font-display font-extrabold text-stone-100 tabular-nums">
                {stats.coinsPocketed}
              </div>
              <div className="text-[9px] sm:text-[10px] text-stone-400 uppercase">Coins Sunk</div>
            </div>
            <div className="bg-stone-950/60 border border-stone-800/80 rounded-xl p-2">
              <div className="text-base sm:text-lg font-display font-extrabold text-stone-100 tabular-nums">
                {stats.queensCovered}
              </div>
              <div className="text-[9px] sm:text-[10px] text-stone-400 uppercase">Queens Claimed</div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs tracking-wider transition-colors shadow-lg shadow-amber-950/40 min-h-[42px]"
        >
          SAVE & CLOSE
        </button>
      </div>
    </div>
  );
};
