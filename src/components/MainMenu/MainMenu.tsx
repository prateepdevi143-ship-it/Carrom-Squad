import React from 'react';
import { Users, Bot, Globe, BookOpen, Settings as SettingsIcon, Trophy } from 'lucide-react';
import { storage } from '../../services/StorageService';

interface MainMenuProps {
  onStartLocal: () => void;
  onStartAI: () => void;
  onStartOnline: () => void;
  onHowToPlay: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onStartLocal,
  onStartAI,
  onStartOnline,
  onHowToPlay,
  onOpenSettings,
}) => {
  const stats = storage.getStats();
  const coverImage = '/src/assets/images/carrom_game_cover_1791278509384.jpg';

  return (
    <div className="menu-screen relative w-full min-h-[100dvh] flex flex-col items-center justify-start sm:justify-center p-3 sm:p-6 select-none">
      {/* Background Graphic with Vignette Scrim */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src={coverImage}
          alt="Carrom Board Artwork"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-20 filter blur-[1px] scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/85 to-stone-950/70" />
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-xl mx-auto flex flex-col items-center text-center space-y-4 sm:space-y-6 my-auto py-3 sm:py-6">
        {/* Brand Header */}
        <div className="space-y-1 sm:space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] sm:text-xs font-semibold tracking-wider uppercase">
            Classic Board · Modern Game
          </div>
          <h1 className="text-2xl sm:text-5xl md:text-6xl font-display font-black tracking-tight text-stone-100 uppercase drop-shadow-md">
            CARROM <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">CLASH</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-300 max-w-md mx-auto px-2">
            Experience authentic 2D physics, realistic wooden board collisions, 2–4 player local matches, AI opponents, and online rooms.
          </p>
        </div>

        {/* Primary Action Grid */}
        <div className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          {/* 1. Local Multiplayer */}
          <button
            type="button"
            onClick={onStartLocal}
            className="group relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-stone-900/80 hover:bg-stone-850 border border-stone-800 hover:border-amber-500/50 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 shadow-xl hover:shadow-amber-950/20 text-left min-h-[44px]"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-1.5 sm:mb-2.5 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="font-display font-bold text-xs sm:text-base text-stone-100 group-hover:text-amber-400 transition-colors">
              PLAY LOCAL
            </span>
            <span className="text-[10px] sm:text-[11px] text-stone-400 mt-0.5 text-center">
              2, 3, or 4 Players
            </span>
          </button>

          {/* 2. Computer / AI */}
          <button
            type="button"
            onClick={onStartAI}
            className="group relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-stone-900/80 hover:bg-stone-850 border border-stone-800 hover:border-amber-500/50 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 shadow-xl hover:shadow-amber-950/20 text-left min-h-[44px]"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-1.5 sm:mb-2.5 group-hover:scale-105 transition-transform">
              <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="font-display font-bold text-xs sm:text-base text-stone-100 group-hover:text-cyan-400 transition-colors">
              PLAY WITH AI
            </span>
            <span className="text-[10px] sm:text-[11px] text-stone-400 mt-0.5 text-center">
              Easy, Medium, Hard Bots
            </span>
          </button>

          {/* 3. Online Multiplayer */}
          <button
            type="button"
            onClick={onStartOnline}
            className="group relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-stone-900/80 hover:bg-stone-850 border border-stone-800 hover:border-amber-500/50 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 shadow-xl hover:shadow-amber-950/20 text-left min-h-[44px]"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1.5 sm:mb-2.5 group-hover:scale-105 transition-transform">
              <Globe className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <span className="font-display font-bold text-xs sm:text-base text-stone-100 group-hover:text-emerald-400 transition-colors">
              ONLINE
            </span>
            <span className="text-[10px] sm:text-[11px] text-stone-400 mt-0.5 text-center">
              Join or Create Room
            </span>
          </button>
        </div>

        {/* Secondary Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 w-full max-w-sm">
          <button
            type="button"
            onClick={onHowToPlay}
            className="flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-stone-900/70 hover:bg-stone-800 text-stone-300 hover:text-stone-100 font-semibold text-[11px] sm:text-xs tracking-wider border border-stone-800 flex items-center justify-center gap-1.5 transition-colors min-h-[40px]"
          >
            <BookOpen className="w-4 h-4" /> HOW TO PLAY
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-stone-900/70 hover:bg-stone-800 text-stone-300 hover:text-stone-100 font-semibold text-[11px] sm:text-xs tracking-wider border border-stone-800 flex items-center justify-center gap-1.5 transition-colors min-h-[40px]"
          >
            <SettingsIcon className="w-4 h-4" /> SETTINGS
          </button>
        </div>

        {/* Career Stats Footnote */}
        {stats.matchesPlayed > 0 && (
          <div className="flex items-center gap-2 text-xs text-stone-400 font-medium">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Career: <strong className="text-stone-200">{stats.matchesWon}</strong> Wins in <strong className="text-stone-200">{stats.matchesPlayed}</strong> Matches</span>
          </div>
        )}
      </div>
    </div>
  );
};
