import React from 'react';
import { GameEngine } from '../../game/GameEngine';
import { Play, RotateCcw, ChevronLeft, ChevronRight, Zap, Eye } from 'lucide-react';
import { audio } from '../../services/AudioService';

interface StrikerControlsProps {
  engine: GameEngine;
  onShotFired?: () => void;
  layout?: 'standard' | 'sidebar';
}

export const StrikerControls: React.FC<StrikerControlsProps> = ({
  engine,
  onShotFired,
  layout = 'standard',
}) => {
  const isAITurn = engine.currentPlayer.isAI;
  const isPhysicsRunning = engine.status === 'PHYSICS_RUNNING';
  const baseline = engine.getCurrentBaseline();

  const handleShoot = () => {
    if (isAITurn || isPhysicsRunning) return;
    const fired = engine.shoot();
    if (fired && onShotFired) {
      onShotFired();
    }
  };

  const handlePositionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    engine.setStrikerPosition(val);
  };

  const nudgePosition = (delta: number) => {
    engine.setStrikerPosition(engine.strikerBaselinePos + delta);
    audio.triggerHaptic('light');
  };

  const handlePowerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const p = parseFloat(e.target.value);
    engine.setAim(engine.aimAngle, p, true);
  };

  const setPowerPreset = (power: number) => {
    engine.setAim(engine.aimAngle, power, true);
    audio.playPowerHapticTick(power);
  };

  const resetAimToCenter = () => {
    engine.setAim(baseline.shootingAngle, engine.aimPower, true);
    audio.triggerHaptic('light');
  };

  const toggleAimAssist = () => {
    const current = engine.rules.aimAssist || 'LOW';
    const next = current === 'LOW' ? 'HIGH' : current === 'HIGH' ? 'OFF' : 'LOW';
    engine.rules.aimAssist = next;
    engine.updateTrajectoryPrediction();
    engine.notifyStateChange();
    audio.triggerHaptic('light');
  };

  const currentAngleDeg = Math.round((engine.aimAngle * 180) / Math.PI);

  // SIDEBAR LAYOUT (For Mobile Landscape Right Column)
  if (layout === 'sidebar') {
    return (
      <div className="w-full h-full flex flex-col justify-between p-2 bg-stone-900/90 border border-stone-800/80 rounded-2xl backdrop-blur-md select-none text-xs">
        {isAITurn ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center text-amber-400 p-2 animate-pulse">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></div>
            <span className="text-[11px] font-medium leading-tight">
              {engine.currentPlayer.name} (AI) calculating shot...
            </span>
          </div>
        ) : (
          <>
            {/* Top: Position Slider & Nudge Buttons */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-bold text-stone-400 uppercase">
                <span>STRIKER POS</span>
                <button
                  type="button"
                  onClick={resetAimToCenter}
                  disabled={isPhysicsRunning}
                  className="text-amber-400 hover:text-amber-300 flex items-center gap-0.5 text-[10px]"
                  title="Reset Angle"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> {currentAngleDeg}°
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => nudgePosition(-10)}
                  disabled={isPhysicsRunning}
                  className="p-1 rounded bg-stone-800 hover:bg-stone-750 text-stone-300 disabled:opacity-40 min-h-[30px] min-w-[28px] flex items-center justify-center"
                  title="Left"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <input
                  type="range"
                  min={baseline.min}
                  max={baseline.max}
                  step={2}
                  value={engine.strikerBaselinePos}
                  onChange={handlePositionChange}
                  disabled={isPhysicsRunning}
                  className="flex-1 accent-amber-500 cursor-pointer h-2 bg-stone-800 rounded-lg disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => nudgePosition(10)}
                  disabled={isPhysicsRunning}
                  className="p-1 rounded bg-stone-800 hover:bg-stone-750 text-stone-300 disabled:opacity-40 min-h-[30px] min-w-[28px] flex items-center justify-center"
                  title="Right"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Middle: Aim Assist & Power Slider */}
            <div className="space-y-1.5 my-auto py-1">
              <div className="flex items-center justify-between text-[10px]">
                <button
                  type="button"
                  onClick={toggleAimAssist}
                  className="px-1.5 py-0.5 rounded bg-stone-800 text-[10px] text-stone-300 flex items-center gap-1"
                >
                  <Eye className="w-2.5 h-2.5 text-emerald-400" /> {engine.rules.aimAssist || 'LOW'}
                </button>
                <span className="font-mono font-bold text-amber-400 flex items-center gap-0.5 text-[10px]">
                  <Zap className="w-2.5 h-2.5" /> {Math.round(engine.aimPower)}%
                </span>
              </div>

              <input
                type="range"
                min={10}
                max={100}
                step={2}
                value={engine.aimPower}
                onChange={handlePowerChange}
                disabled={isPhysicsRunning}
                className="w-full accent-amber-500 cursor-pointer h-2 bg-stone-800 rounded-lg disabled:opacity-40"
              />

              <div className="flex justify-between gap-1">
                {[
                  { label: 'Soft', val: 30 },
                  { label: 'Med', val: 60 },
                  { label: 'Max', val: 95 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setPowerPreset(item.val)}
                    disabled={isPhysicsRunning}
                    className="flex-1 py-0.5 text-[9px] bg-stone-800/80 hover:bg-stone-750 text-stone-300 rounded font-medium"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Bottom: Tactile STRIKE Button */}
            <button
              type="button"
              onClick={handleShoot}
              disabled={isPhysicsRunning}
              className={`w-full py-2.5 rounded-xl font-display font-black text-xs tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 min-h-[42px] ${
                isPhysicsRunning
                  ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-amber-950/40'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isPhysicsRunning ? 'MOVING...' : 'STRIKE'}
            </button>
          </>
        )}
      </div>
    );
  }

  // STANDARD HORIZONTAL LAYOUT (For Portrait Mobile, Tablets, Desktops)
  return (
    <div className="w-full max-w-xl mx-auto bg-stone-900/90 border border-stone-800/80 rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 shadow-xl backdrop-blur-md select-none">
      {isAITurn ? (
        <div className="flex items-center justify-center gap-2 py-1 text-amber-400 text-xs font-medium animate-pulse">
          <div className="w-2 h-2 rounded-full bg-amber-400"></div>
          <span>{engine.currentPlayer.name} (AI) calculating shot...</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1 sm:gap-1.5">
          {/* Row 1: Striker Position Slider & Nudge Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-[11px] font-semibold text-stone-400 whitespace-nowrap shrink-0">
              Pos
            </span>

            <button
              type="button"
              onClick={() => nudgePosition(-10)}
              disabled={isPhysicsRunning}
              className="p-1 rounded bg-stone-800 hover:bg-stone-750 text-stone-300 disabled:opacity-40 transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center shrink-0"
              title="Nudge Left"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min={baseline.min}
              max={baseline.max}
              step={2}
              value={engine.strikerBaselinePos}
              onChange={handlePositionChange}
              disabled={isPhysicsRunning}
              className="flex-1 accent-amber-500 cursor-pointer h-2 bg-stone-800 rounded-lg disabled:opacity-40 min-w-[60px]"
            />

            <button
              type="button"
              onClick={() => nudgePosition(10)}
              disabled={isPhysicsRunning}
              className="p-1 rounded bg-stone-800 hover:bg-stone-750 text-stone-300 disabled:opacity-40 transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center shrink-0"
              title="Nudge Right"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Quick Aim Center Button */}
            <button
              type="button"
              onClick={resetAimToCenter}
              disabled={isPhysicsRunning}
              className="px-1.5 sm:px-2 py-1 rounded bg-stone-800 hover:bg-stone-750 text-[9px] sm:text-[10px] font-medium text-stone-300 flex items-center gap-1 shrink-0"
              title="Reset Aim to Center"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span>{currentAngleDeg}°</span>
            </button>

            {/* Aim Assist Toggle */}
            <button
              type="button"
              onClick={toggleAimAssist}
              className="px-1.5 sm:px-2 py-1 rounded bg-stone-800 hover:bg-stone-750 text-[9px] sm:text-[10px] font-semibold text-stone-300 flex items-center gap-1 shrink-0"
              title="Toggle Aim Assist"
            >
              <Eye className="w-3 h-3 text-emerald-400" />
              <span className="hidden xs:inline">{engine.rules.aimAssist || 'LOW'}</span>
            </button>
          </div>

          {/* Row 2: Power Controls & Tactile Shoot Button */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-[10px] sm:text-[11px] font-semibold text-stone-400 whitespace-nowrap shrink-0 flex items-center gap-0.5">
                <Zap className="w-3 h-3 text-amber-400" />
                <span className="font-mono">{Math.round(engine.aimPower)}%</span>
              </span>

              <input
                type="range"
                min={10}
                max={100}
                step={2}
                value={engine.aimPower}
                onChange={handlePowerChange}
                disabled={isPhysicsRunning}
                className="flex-1 accent-amber-500 cursor-pointer h-2 bg-stone-800 rounded-lg disabled:opacity-40 min-w-[50px]"
              />

              {/* Quick Power Presets (on larger screens) */}
              <div className="hidden sm:flex items-center gap-1 shrink-0">
                {[
                  { label: 'Soft', val: 28 },
                  { label: 'Med', val: 55 },
                  { label: 'Max', val: 95 },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setPowerPreset(item.val)}
                    disabled={isPhysicsRunning}
                    className="px-2 py-0.5 text-[10px] bg-stone-800 hover:bg-stone-750 text-stone-300 rounded font-medium transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* STRIKE BUTTON (Touch target >= 40px) */}
            <button
              type="button"
              onClick={handleShoot}
              disabled={isPhysicsRunning}
              className={`min-w-[85px] sm:min-w-[110px] h-8 sm:h-9 px-3 sm:px-4 rounded-xl font-display font-black text-xs tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 shrink-0 ${
                isPhysicsRunning
                  ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-amber-950/40'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isPhysicsRunning ? 'MOVING...' : 'STRIKE'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
