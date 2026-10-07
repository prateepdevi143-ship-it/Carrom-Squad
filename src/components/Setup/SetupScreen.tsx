import React, { useState } from 'react';
import { ArrowLeft, Play, Bot, Users } from 'lucide-react';
import { GameMode, AIDifficulty, MatchRules } from '../../types/game';

interface SetupScreenProps {
  mode: GameMode;
  onBack: () => void;
  onStartMatch: (
    players: { name: string; color: string; isAI: boolean; aiDifficulty?: AIDifficulty }[],
    rules: Partial<MatchRules>
  ) => void;
}

const PLAYER_COLORS = ['#f59e0b', '#06b6d4', '#ec4899', '#10b981', '#8b5cf6'];

export const SetupScreen: React.FC<SetupScreenProps> = ({ mode, onBack, onStartMatch }) => {
  const [playerCount, setPlayerCount] = useState<number>(2);
  const [playerNames, setPlayerNames] = useState<string[]>([
    'Player 1',
    mode === 'AI' ? 'Computer' : 'Player 2',
    'Player 3',
    'Player 4',
  ]);
  const [playerColors, setPlayerColors] = useState<string[]>([
    PLAYER_COLORS[0],
    PLAYER_COLORS[1],
    PLAYER_COLORS[2],
    PLAYER_COLORS[3],
  ]);
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('MEDIUM');

  // Rules
  const [ruleType, setRuleType] = useState<'standard' | 'casual'>('standard');
  const [boardPoints, setBoardPoints] = useState<number>(25);
  const [turnTimer, setTurnTimer] = useState<number>(25);

  const handleNameChange = (index: number, val: string) => {
    const updated = [...playerNames];
    updated[index] = val;
    setPlayerNames(updated);
  };

  const handleColorChange = (index: number, color: string) => {
    const updated = [...playerColors];
    updated[index] = color;
    setPlayerColors(updated);
  };

  const handleStart = () => {
    const players = [];
    for (let i = 0; i < playerCount; i++) {
      const isAI = mode === 'AI' && i > 0;
      players.push({
        name: playerNames[i]?.trim() || `Player ${i + 1}`,
        color: playerColors[i] || PLAYER_COLORS[i % PLAYER_COLORS.length],
        isAI,
        aiDifficulty: isAI ? aiDifficulty : undefined,
      });
    }

    onStartMatch(players, {
      ruleType,
      boardPointsToWin: boardPoints,
      turnTimerSeconds: turnTimer,
      queenMustCover: ruleType === 'standard',
    });
  };

  return (
    <div className="menu-screen w-full min-h-[100dvh] flex flex-col items-center justify-start sm:justify-center p-2 sm:p-6 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-stone-900/90 border border-stone-800 rounded-2xl p-3.5 sm:p-6 shadow-2xl backdrop-blur-md space-y-3.5 sm:space-y-5 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 font-medium transition-colors min-h-[38px] px-1"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="text-right">
            <h2 className="font-display font-extrabold text-sm sm:text-lg text-stone-100 tracking-wide truncate max-w-[190px] sm:max-w-none">
              {mode === 'AI' ? 'VS COMPUTER SETUP' : 'LOCAL MATCH SETUP'}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-stone-400">Configure players & rules</p>
          </div>
        </div>

        {/* 1. Choose Players Count */}
        <div className="space-y-1">
          <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Number of Players
          </label>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {[2, 3, 4].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setPlayerCount(count)}
                className={`py-2 px-1.5 rounded-xl border font-display font-bold text-xs tracking-wider transition-all min-h-[38px] ${
                  playerCount === count
                    ? 'bg-amber-500 text-stone-950 border-amber-500 shadow-md shadow-amber-950/30'
                    : 'bg-stone-950/60 border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800'
                }`}
              >
                <span>{count}</span>
                <span className="hidden xs:inline"> PLAYERS</span>
                <span className="xs:hidden">P</span>
              </button>
            ))}
          </div>
        </div>

        {/* AI Difficulty Selector if Mode is AI */}
        {mode === 'AI' && (
          <div className="space-y-1 bg-stone-950/50 border border-stone-800/80 rounded-xl p-2 sm:p-3">
            <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5" /> AI Difficulty Level
            </label>
            <div className="grid grid-cols-3 gap-1 mt-1">
              {(['EASY', 'MEDIUM', 'HARD'] as AIDifficulty[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setAiDifficulty(level)}
                  className={`py-1.5 px-1 rounded-lg text-xs font-semibold tracking-wider transition-all border min-h-[36px] ${
                    aiDifficulty === level
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500'
                      : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-stone-400 mt-1">
              {aiDifficulty === 'EASY' && 'Casual play, relaxed aiming, lower precision.'}
              {aiDifficulty === 'MEDIUM' && 'Balanced trajectory prediction with cut shot logic.'}
              {aiDifficulty === 'HARD' && 'Advanced multi-baseline search, line-of-sight checks, queen priority.'}
            </p>
          </div>
        )}

        {/* 2. Player Roster Configuration */}
        <div className="space-y-1.5">
          <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-400">
            Player Names & Colors
          </label>
          <div className="space-y-1.5">
            {Array.from({ length: playerCount }).map((_, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 sm:gap-2 bg-stone-950/60 border border-stone-800/80 rounded-xl p-1.5 sm:p-2.5"
              >
                {/* Compact Color Palette Dots */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  {PLAYER_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => handleColorChange(idx, col)}
                      className={`w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 rounded-full transition-transform shrink-0 ${
                        playerColors[idx] === col ? 'scale-125 ring-2 ring-white/70' : 'opacity-50 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>

                <input
                  type="text"
                  maxLength={18}
                  value={playerNames[idx] || ''}
                  onChange={(e) => handleNameChange(idx, e.target.value)}
                  placeholder={`Player ${idx + 1}`}
                  className="flex-1 min-w-0 bg-stone-900 border border-stone-800 text-stone-100 text-xs rounded-lg px-2 sm:px-2.5 py-1.5 focus:outline-none focus:border-amber-500"
                />

                {mode === 'AI' && idx > 0 && (
                  <span className="text-[9px] sm:text-[10px] text-cyan-400 font-mono font-medium px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50 shrink-0">
                    BOT
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 3. Game Rules Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-stone-950/50 border border-stone-800/80 rounded-xl p-2 sm:p-3">
          <div>
            <div className="text-[10px] sm:text-xs font-bold text-stone-300 mb-1">Rule Preset</div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setRuleType('standard')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all min-h-[36px] ${
                  ruleType === 'standard'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                    : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setRuleType('casual')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all min-h-[36px] ${
                  ruleType === 'casual'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                    : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                }`}
              >
                Casual
              </button>
            </div>
            <p className="text-[9px] sm:text-[10px] text-stone-400 mt-1">
              {ruleType === 'standard' ? 'Assigned colors + Queen cover' : 'Any piece scores points'}
            </p>
          </div>

          <div>
            <div className="text-[10px] sm:text-xs font-bold text-stone-300 mb-1">Target Points</div>
            <div className="flex gap-1">
              {[25, 29, 0].map((pts) => (
                <button
                  key={pts}
                  type="button"
                  onClick={() => setBoardPoints(pts)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all min-h-[36px] ${
                    boardPoints === pts
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                      : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
                  }`}
                >
                  {pts === 0 ? 'Clear' : `${pts} pts`}
                </button>
              ))}
            </div>
            <p className="text-[9px] sm:text-[10px] text-stone-400 mt-1">
              {boardPoints === 0 ? 'Clear all coins' : `First to ${boardPoints} points`}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 font-semibold text-xs tracking-wider border border-stone-700/60 transition-colors min-h-[42px]"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="flex-[2] py-2 sm:py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-display font-extrabold text-xs sm:text-sm tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-950/40 min-h-[42px]"
          >
            <Play className="w-4 h-4 fill-current" /> START MATCH
          </button>
        </div>
      </div>
    </div>
  );
};
