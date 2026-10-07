import React, { useRef, useEffect, useCallback, useState } from 'react';
import { GameEngine } from '../../game/GameEngine';
import {
  BOARD_SIZE,
  FRAME_WIDTH,
  PLAY_AREA_MIN,
  PLAY_AREA_MAX,
  COIN_RADIUS,
  STRIKER_RADIUS,
  POCKETS,
  POCKET_RADIUS,
  POCKET_HOLE_RADIUS,
  CENTER_POINT,
  CENTER_CIRCLE_RADIUS,
  CENTER_OUTER_RADIUS,
  BASELINES,
} from '../../game/CarromBoardConstants';
import { Coin } from '../../types/game';
import { PhysicsEngine } from '../../game/PhysicsEngine';
import { audio } from '../../services/AudioService';

interface CarromBoardProps {
  engine: GameEngine;
  boardPixelSize: number;
  theme?: 'classic' | 'tournament' | 'midnight';
  showAimLine?: boolean;
  interactive?: boolean;
  onShotFired?: () => void;
  debugMode?: boolean;
}

// Slingshot Tuning Constants (Section 3, 4, 5, 20, 21, 22)
const MAX_DRAG_DISTANCE = 180;      // Board coordinate units
const MIN_DRAG_DISTANCE = 10;       // Deadzone in board units
const MIN_SHOT_POWER = 5;           // Minimum % power to trigger shot on release
const POWER_CURVE = 1.2;            // Power curve exponent: gentle at start, powerful at end
const STRIKER_HIT_RADIUS = STRIKER_RADIUS * 2.5; // ~52.5 board units generous hitbox

type InteractionPhase = 'IDLE' | 'POSITIONING' | 'HOLDING_STRIKER' | 'AIMING';

function getPowerTier(power: number): string {
  if (power < 20) return 'Soft';
  if (power < 40) return 'Light';
  if (power < 60) return 'Medium';
  if (power < 80) return 'Strong';
  return 'Powerful';
}

export const CarromBoard: React.FC<CarromBoardProps> = ({
  engine,
  boardPixelSize,
  theme = 'classic',
  showAimLine = true,
  interactive = true,
  onShotFired,
  debugMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Interaction tracking state
  const phaseRef = useRef<InteractionPhase>('IDLE');
  const activePointerIdRef = useRef<number | null>(null);
  const currentPointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastPowerMilestoneRef = useRef<number>(0);

  const [activeAimFeedback, setActiveAimFeedback] = useState<{
    power: number;
    angleDeg: number;
    tier: string;
    visible: boolean;
  }>({ power: 0, angleDeg: 0, tier: 'Soft', visible: false });

  // Transform screen client coordinates to board 800x800 coordinate space
  const screenToBoard = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scale = BOARD_SIZE / rect.width;
    return {
      x: (clientX - rect.left) * scale,
      y: (clientY - rect.top) * scale,
    };
  }, []);

  // 1. Pointer Down Handler — Select & Hold Striker or Baseline
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || engine.currentPlayer.isAI || (engine.status !== 'POSITIONING' && engine.status !== 'AIMING')) {
      return;
    }

    // Ignore secondary pointers (multi-touch protection)
    if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) {
      return;
    }

    const pos = screenToBoard(e.clientX, e.clientY);
    if (!pos || !engine.striker) return;

    const striker = engine.striker;
    const baseline = engine.getCurrentBaseline();

    // Distance to striker center
    const dx = pos.x - striker.x;
    const dy = pos.y - striker.y;
    const distSq = dx * dx + dy * dy;
    const isStrikerHit = distSq <= STRIKER_HIT_RADIUS * STRIKER_HIT_RADIUS;

    // Check if touching along the baseline track
    let isBaselineHit = false;
    if (baseline.axis === 'x') {
      isBaselineHit = Math.abs(pos.y - baseline.fixedCoordinate) < 38 &&
        pos.x >= baseline.min - 30 && pos.x <= baseline.max + 30;
    } else {
      isBaselineHit = Math.abs(pos.x - baseline.fixedCoordinate) < 38 &&
        pos.y >= baseline.min - 30 && pos.y <= baseline.max + 30;
    }

    if (isStrikerHit) {
      // Primary Interaction: Grab Striker
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch (err) {}

      activePointerIdRef.current = e.pointerId;
      phaseRef.current = 'HOLDING_STRIKER';
      currentPointerPosRef.current = { x: pos.x, y: pos.y };
      lastPowerMilestoneRef.current = 0;
      audio.triggerHaptic('light');
    } else if (isBaselineHit) {
      // Stage 1: Tap on baseline track to slide striker into position
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch (err) {}

      activePointerIdRef.current = e.pointerId;
      phaseRef.current = 'POSITIONING';
      currentPointerPosRef.current = { x: pos.x, y: pos.y };
      engine.setStrikerPosition(baseline.axis === 'x' ? pos.x : pos.y);
      audio.triggerHaptic('light');
    }
  };

  // 2. Pointer Move Handler — Slingshot Pull, Power & Angle Calculation
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive || engine.currentPlayer.isAI || (engine.status !== 'POSITIONING' && engine.status !== 'AIMING')) {
      return;
    }

    if (activePointerIdRef.current !== e.pointerId) return;

    const pos = screenToBoard(e.clientX, e.clientY);
    if (!pos || !engine.striker) return;

    const baseline = engine.getCurrentBaseline();
    const striker = engine.striker;
    currentPointerPosRef.current = pos;

    // Case A: Sliding along baseline track
    if (phaseRef.current === 'POSITIONING') {
      const targetCoord = baseline.axis === 'x' ? pos.x : pos.y;
      engine.setStrikerPosition(targetCoord);
      return;
    }

    // Case B: Holding striker — determine if repositioning or pulling slingshot
    if (phaseRef.current === 'HOLDING_STRIKER') {
      const dx = pos.x - striker.x;
      const dy = pos.y - striker.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < MIN_DRAG_DISTANCE) {
        // Micro movement: allow sliding along baseline
        const targetCoord = baseline.axis === 'x' ? pos.x : pos.y;
        engine.setStrikerPosition(targetCoord);
        return;
      } else {
        // Pulled past deadzone: LOCK STRIKER POSITION and enter AIMING
        phaseRef.current = 'AIMING';
        audio.triggerHaptic('light');
      }
    }

    // Case C: Active Slingshot Aiming (Striker position strictly LOCKED)
    if (phaseRef.current === 'AIMING') {
      const dx = pos.x - striker.x;
      const dy = pos.y - striker.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < MIN_DRAG_DISTANCE) {
        // Cursor pulled back into deadzone
        engine.setAim(engine.aimAngle, 0, true);
        setActiveAimFeedback((prev) => ({
          ...prev,
          power: 0,
          tier: 'Soft',
          visible: true,
        }));
        return;
      }

      // 1. Power Calculation with Smooth Curve (Section 3, 4, 5)
      const normalizedDist = Math.min(Math.max(0, (dist - MIN_DRAG_DISTANCE) / (MAX_DRAG_DISTANCE - MIN_DRAG_DISTANCE)), 1);
      const calculatedPower = Math.pow(normalizedDist, POWER_CURVE) * 100;

      // 2. Slingshot Angle: exact opposite of drag vector (Section 2, 7, 8)
      const dragAngle = Math.atan2(dy, dx);
      let shotAngle = dragAngle + Math.PI;

      // Normalize angle to [-PI, PI]
      while (shotAngle > Math.PI) shotAngle -= 2 * Math.PI;
      while (shotAngle < -Math.PI) shotAngle += 2 * Math.PI;

      // 3. Optional subtle angle snapping in HIGH assist mode (Section 24 & 25)
      if (engine.rules.aimAssist === 'HIGH') {
        const snapThreshold = 0.035; // ~2.0 degrees
        const forwardAngle = baseline.shootingAngle;
        if (Math.abs(shotAngle - forwardAngle) < snapThreshold) {
          shotAngle = forwardAngle;
        }
      }

      engine.setAim(shotAngle, calculatedPower, true);

      // Haptic feedback tick on milestones (25%, 50%, 75%, 100%)
      const milestone = Math.floor(calculatedPower / 25) * 25;
      if (milestone > lastPowerMilestoneRef.current && milestone > 0) {
        lastPowerMilestoneRef.current = milestone;
        audio.playPowerHapticTick(milestone);
      }

      const angleDeg = Math.round((shotAngle * 180) / Math.PI);
      const tier = getPowerTier(calculatedPower);

      setActiveAimFeedback({
        power: Math.round(calculatedPower),
        angleDeg,
        tier,
        visible: true,
      });
    }
  };

  // 3. Pointer Up Handler — Release & Shoot (or Cancel if too weak)
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;

    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (phaseRef.current === 'AIMING' && interactive && !engine.currentPlayer.isAI) {
      if (engine.aimPower >= MIN_SHOT_POWER && (engine.status === 'POSITIONING' || engine.status === 'AIMING')) {
        const fired = engine.shoot();
        if (fired && onShotFired) {
          onShotFired();
        }
      } else {
        // Safe cancellation if released in deadzone
        engine.cancelAim();
      }
    }

    phaseRef.current = 'IDLE';
    activePointerIdRef.current = null;
    setActiveAimFeedback((prev) => ({ ...prev, visible: false }));
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current === e.pointerId) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (err) {}
      if (phaseRef.current === 'AIMING') {
        engine.cancelAim();
      }
      phaseRef.current = 'IDLE';
      activePointerIdRef.current = null;
      setActiveAimFeedback((prev) => ({ ...prev, visible: false }));
    }
  };

  // Main Canvas 60 FPS Render Loop with High-DPI support
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const pixelWidth = Math.round(boardPixelSize * dpr);
    const pixelHeight = Math.round(boardPixelSize * dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const render = (currentTime: number) => {
      const dt = Math.min(0.045, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      // 1. Advance physics simulation if running
      if (engine.status === 'PHYSICS_RUNNING') {
        engine.updatePhysics(dt);
      }

      // 2. High-DPI Context Scaling
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = (boardPixelSize / BOARD_SIZE) * dpr;
      ctx.scale(scale, scale);

      // 3. Wooden Frame & Bevel Layers
      drawBoardFrame(ctx, theme);

      // 4. Playing Surface & Ambient Lamp Illumination
      drawPlayingSurface(ctx, theme);

      // 5. Four Corner Pockets with Woven Net Depth
      drawCornerPockets(ctx);

      // 6. Traditional Silk-Screen Markings
      drawBoardMarkings(ctx, engine);

      // 7. Micro Impact Shockwave Rings
      drawImpactEffects(ctx);

      // 8. Coins with Target Highlight (Section 27)
      drawCoins(ctx, engine.coins, engine.predictedHitCoin);

      // 9. Target Pocket Glow Indicator (Section 28)
      if (engine.predictedTargetToPocketPath && engine.predictedTargetToPocketPath.length > 1) {
        drawTargetPocketGlow(ctx, engine.predictedTargetToPocketPath[1]);
      }

      // 10. Aiming Guide & Forward Trajectory Line (Section 10, 26)
      if (showAimLine && (engine.status === 'POSITIONING' || engine.status === 'AIMING') && engine.striker) {
        drawAimGuide(ctx, engine);
      }

      // 11. Slingshot Elastic Pull Cord & Grip Puck (Section 12, 13)
      if (phaseRef.current === 'AIMING' && engine.striker) {
        drawSlingshotPull(ctx, engine.striker, currentPointerPosRef.current, engine.aimPower);
      }

      // 12. Heavy Striker with Tactile Halo
      if (engine.striker && !engine.striker.pocketed) {
        drawStriker(ctx, engine.striker, engine, phaseRef.current === 'AIMING' || phaseRef.current === 'HOLDING_STRIKER');
      }

      // 13. Optional Developer Debug Overlay (Section 39)
      if (debugMode && engine.striker) {
        drawDebugAimOverlay(ctx, currentPointerPosRef.current, engine.striker, engine.aimAngle, engine.aimPower);
      }

      ctx.restore();

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine, boardPixelSize, theme, showAimLine, debugMode]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center justify-center mx-auto select-none carrom-canvas-container"
      style={{
        width: `${boardPixelSize}px`,
        height: `${boardPixelSize}px`,
      }}
    >
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="rounded-2xl shadow-2xl cursor-crosshair touch-none select-none"
        style={{
          width: `${boardPixelSize}px`,
          height: `${boardPixelSize}px`,
          boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.06)',
        }}
      />

      {/* Dynamic Slingshot Live Power & Angle Badge (Section 6, 9, 34) */}
      {activeAimFeedback.visible && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none z-20 flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl bg-stone-900/95 border border-amber-500/70 backdrop-blur-md shadow-2xl text-xs select-none animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-2 font-mono text-[11px] sm:text-xs">
            <span className="font-bold text-amber-400">
              {activeAimFeedback.power}% POWER
            </span>
            <span className="text-stone-500">·</span>
            <span className="text-stone-200 font-semibold">
              {activeAimFeedback.tier}
            </span>
            <span className="text-stone-500">·</span>
            <span className="text-stone-400">
              {activeAimFeedback.angleDeg}°
            </span>
          </div>
          {/* Visual Power Bar Meter (Section 6) */}
          <div className="w-32 h-1.5 bg-stone-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-75 ${
                activeAimFeedback.power > 75
                  ? 'bg-red-500'
                  : activeAimFeedback.power > 40
                  ? 'bg-amber-400'
                  : 'bg-cyan-400'
              }`}
              style={{ width: `${activeAimFeedback.power}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

/* ---------------- High-Fidelity Canvas Drawing Routines ---------------- */

function drawBoardFrame(ctx: CanvasRenderingContext2D, theme: string) {
  let outerDark = '#2a1a0f';
  let innerDark = '#1a0f08';
  let highlight = '#4a2f1b';

  if (theme === 'tournament') {
    outerDark = '#3d2516';
    innerDark = '#2b180d';
    highlight = '#5a3822';
  } else if (theme === 'midnight') {
    outerDark = '#18181b';
    innerDark = '#09090b';
    highlight = '#27272a';
  }

  // Outer bevel
  ctx.fillStyle = outerDark;
  ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

  // Top/left illumination
  const gradHighlight = ctx.createLinearGradient(0, 0, 0, FRAME_WIDTH);
  gradHighlight.addColorStop(0, highlight);
  gradHighlight.addColorStop(1, innerDark);
  ctx.fillStyle = gradHighlight;
  ctx.fillRect(0, 0, BOARD_SIZE, FRAME_WIDTH);

  // Bottom/right shadow
  const gradShadow = ctx.createLinearGradient(0, PLAY_AREA_MAX, 0, BOARD_SIZE);
  gradShadow.addColorStop(0, innerDark);
  gradShadow.addColorStop(1, '#0c0704');
  ctx.fillStyle = gradShadow;
  ctx.fillRect(0, PLAY_AREA_MAX, BOARD_SIZE, FRAME_WIDTH);

  // Four corner brass brackets
  const brass = '#d97706';
  ctx.fillStyle = brass;
  ctx.fillRect(8, 8, 24, 6);
  ctx.fillRect(8, 8, 6, 24);
  ctx.fillRect(BOARD_SIZE - 32, 8, 24, 6);
  ctx.fillRect(BOARD_SIZE - 14, 8, 6, 24);
  ctx.fillRect(8, BOARD_SIZE - 14, 24, 6);
  ctx.fillRect(8, BOARD_SIZE - 32, 6, 24);
  ctx.fillRect(BOARD_SIZE - 32, BOARD_SIZE - 14, 24, 6);
  ctx.fillRect(BOARD_SIZE - 14, BOARD_SIZE - 32, 6, 24);
}

function drawPlayingSurface(ctx: CanvasRenderingContext2D, theme: string) {
  let bgGrad1 = '#fef3c7';
  let bgGrad2 = '#fde68a';
  let innerShadow = 'rgba(78, 53, 36, 0.45)';

  if (theme === 'tournament') {
    bgGrad1 = '#f5eedb';
    bgGrad2 = '#eadebe';
    innerShadow = 'rgba(60, 45, 30, 0.5)';
  } else if (theme === 'midnight') {
    bgGrad1 = '#27272a';
    bgGrad2 = '#18181b';
    innerShadow = 'rgba(0, 0, 0, 0.7)';
  }

  const surfaceGrad = ctx.createRadialGradient(
    CENTER_POINT.x,
    CENTER_POINT.y,
    60,
    CENTER_POINT.x,
    CENTER_POINT.y,
    PLAY_AREA_MAX - PLAY_AREA_MIN
  );
  surfaceGrad.addColorStop(0, bgGrad1);
  surfaceGrad.addColorStop(1, bgGrad2);

  ctx.fillStyle = surfaceGrad;
  ctx.fillRect(
    PLAY_AREA_MIN,
    PLAY_AREA_MIN,
    PLAY_AREA_MAX - PLAY_AREA_MIN,
    PLAY_AREA_MAX - PLAY_AREA_MIN
  );

  // Frame inner drop-shadow
  ctx.fillStyle = innerShadow;
  ctx.fillRect(PLAY_AREA_MIN, PLAY_AREA_MIN, PLAY_AREA_MAX - PLAY_AREA_MIN, 10);
  ctx.fillRect(PLAY_AREA_MIN, PLAY_AREA_MIN, 10, PLAY_AREA_MAX - PLAY_AREA_MIN);
}

function drawCornerPockets(ctx: CanvasRenderingContext2D) {
  POCKETS.forEach((pocket) => {
    // 1. Cast shadow
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, POCKET_RADIUS + 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();

    // 2. Brass rim
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, POCKET_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#b45309';
    ctx.fill();

    // 3. Deep inner cavity
    const holeGrad = ctx.createRadialGradient(
      pocket.x,
      pocket.y,
      2,
      pocket.x,
      pocket.y,
      POCKET_HOLE_RADIUS
    );
    holeGrad.addColorStop(0, '#000000');
    holeGrad.addColorStop(0.75, '#171717');
    holeGrad.addColorStop(1, '#292524');

    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, POCKET_HOLE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = holeGrad;
    ctx.fill();

    // 4. Pocket woven net texture
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    for (let i = -16; i <= 16; i += 8) {
      ctx.beginPath();
      ctx.moveTo(pocket.x - 18, pocket.y + i);
      ctx.lineTo(pocket.x + 18, pocket.y + i);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pocket.x + i, pocket.y - 18);
      ctx.lineTo(pocket.x + i, pocket.y + 18);
      ctx.stroke();
    }
  });
}

function drawBoardMarkings(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  ctx.save();
  ctx.strokeStyle = 'rgba(30, 20, 15, 0.82)';
  ctx.fillStyle = 'rgba(30, 20, 15, 0.82)';
  ctx.lineWidth = 2.0;

  // 1. Center Red Queen Circle
  ctx.beginPath();
  ctx.arc(CENTER_POINT.x, CENTER_POINT.y, 16, 0, Math.PI * 2);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Center Inner Circle
  ctx.beginPath();
  ctx.arc(CENTER_POINT.x, CENTER_POINT.y, CENTER_CIRCLE_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(30, 20, 15, 0.75)';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Center Outer Circle
  ctx.beginPath();
  ctx.arc(CENTER_POINT.x, CENTER_POINT.y, CENTER_OUTER_RADIUS, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(30, 20, 15, 0.65)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // 2. Center Decorative Rosette (12 petals)
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI * 2) / 12;
    const px = CENTER_POINT.x + Math.cos(angle) * CENTER_CIRCLE_RADIUS;
    const py = CENTER_POINT.y + Math.sin(angle) * CENTER_CIRCLE_RADIUS;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? '#dc2626' : 'rgba(30, 20, 15, 0.75)';
    ctx.fill();
  }

  // 3. Four Baselines with Red End Circles
  Object.values(BASELINES).forEach((b) => {
    ctx.strokeStyle = 'rgba(30, 20, 15, 0.8)';
    ctx.lineWidth = 2.2;

    const offset = 14;
    if (b.axis === 'x') {
      // Primary baseline
      ctx.beginPath();
      ctx.moveTo(b.min, b.fixedCoordinate - offset);
      ctx.lineTo(b.max, b.fixedCoordinate - offset);
      ctx.moveTo(b.min, b.fixedCoordinate + offset);
      ctx.lineTo(b.max, b.fixedCoordinate + offset);
      ctx.stroke();

      // End circles with red center
      [b.min, b.max].forEach((cx) => {
        ctx.beginPath();
        ctx.arc(cx, b.fixedCoordinate, b.circleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(30, 20, 15, 0.8)';
        ctx.lineWidth = 2.0;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, b.fixedCoordinate, 9.5, 0, Math.PI * 2);
        ctx.fillStyle = '#dc2626';
        ctx.fill();
      });
    } else {
      // Vertical baseline
      ctx.beginPath();
      ctx.moveTo(b.fixedCoordinate - offset, b.min);
      ctx.lineTo(b.fixedCoordinate - offset, b.max);
      ctx.moveTo(b.fixedCoordinate + offset, b.min);
      ctx.lineTo(b.fixedCoordinate + offset, b.max);
      ctx.stroke();

      [b.min, b.max].forEach((cy) => {
        ctx.beginPath();
        ctx.arc(b.fixedCoordinate, cy, b.circleRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(30, 20, 15, 0.8)';
        ctx.lineWidth = 2.0;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(b.fixedCoordinate, cy, 9.5, 0, Math.PI * 2);
        ctx.fillStyle = '#dc2626';
        ctx.fill();
      });
    }
  });

  // 4. Four Corner Diagonal Aiming Arrows pointing toward pockets
  POCKETS.forEach((p) => {
    const angle = Math.atan2(CENTER_POINT.y - p.y, CENTER_POINT.x - p.x);
    const startX = p.x + Math.cos(angle) * (POCKET_RADIUS + 12);
    const startY = p.y + Math.sin(angle) * (POCKET_RADIUS + 12);
    const endX = p.x + Math.cos(angle) * 155;
    const endY = p.y + Math.sin(angle) * 155;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'rgba(30, 20, 15, 0.7)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Arrow circle tip
    ctx.beginPath();
    ctx.arc(endX, endY, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#dc2626';
    ctx.fill();
  });

  ctx.restore();
}

function drawImpactEffects(ctx: CanvasRenderingContext2D) {
  for (let i = PhysicsEngine.impactEffects.length - 1; i >= 0; i--) {
    const eff = PhysicsEngine.impactEffects[i];
    eff.radius += 1.4;
    eff.alpha -= 0.055;

    if (eff.alpha <= 0 || eff.radius >= eff.maxRadius) {
      PhysicsEngine.impactEffects.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(eff.x, eff.y, eff.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 230, 160, ${eff.alpha})`;
    ctx.lineWidth = 2.0;
    ctx.stroke();
    ctx.restore();
  }
}

function drawCoins(ctx: CanvasRenderingContext2D, coins: Coin[], hitCoin: Coin | null = null) {
  coins.forEach((coin) => {
    if (coin.pocketed) return;

    ctx.save();
    ctx.translate(coin.x, coin.y);

    if (coin.sinking) {
      const scale = Math.max(0.05, 1 - (coin.sinkProgress || 0) * 0.9);
      ctx.scale(scale, scale);
      ctx.globalAlpha = Math.max(0, 1 - (coin.sinkProgress || 0));
    }

    // Directional drop shadow
    if (!coin.sinking) {
      ctx.shadowColor = 'rgba(0, 0, 0, 0.42)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 3.5;
      ctx.shadowOffsetY = 4.5;
    }

    if (coin.rotation) {
      ctx.rotate(coin.rotation);
    }

    if (coin.type === 'QUEEN') {
      drawQueenCoin(ctx);
    } else if (coin.type === 'WHITE') {
      drawWhiteCoin(ctx);
    } else {
      drawBlackCoin(ctx);
    }

    ctx.restore();

    // Section 27: Highlight likely target coin with an elegant pulsing reticle
    if (hitCoin && coin.id === hitCoin.id && !coin.sinking) {
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, coin.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Subtle center pip
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}

function drawTargetPocketGlow(ctx: CanvasRenderingContext2D, pocketPoint: { x: number; y: number }) {
  ctx.save();
  ctx.strokeStyle = 'rgba(16, 185, 129, 0.85)';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = 'rgba(16, 185, 129, 0.6)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(pocketPoint.x, pocketPoint.y, POCKET_RADIUS + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawQueenCoin(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, COIN_RADIUS);
  grad.addColorStop(0, '#f87171');
  grad.addColorStop(0.4, '#dc2626');
  grad.addColorStop(0.85, '#991b1b');
  grad.addColorStop(1, '#450a0a');

  ctx.beginPath();
  ctx.arc(0, 0, COIN_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowColor = 'transparent';

  // Gold concentric ring
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, COIN_RADIUS * 0.65, 0, Math.PI * 2);
  ctx.stroke();

  // Center gold star
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Specular rim
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.arc(0, 0, COIN_RADIUS - 1, -Math.PI * 0.8, -Math.PI * 0.2);
  ctx.stroke();
}

function drawWhiteCoin(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, COIN_RADIUS);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.48, '#f5f0e6');
  grad.addColorStop(0.85, '#dfd3bc');
  grad.addColorStop(1, '#9e8f77');

  ctx.beginPath();
  ctx.arc(0, 0, COIN_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowColor = 'transparent';

  // Engraved lathe rings
  ctx.strokeStyle = 'rgba(150, 130, 110, 0.35)';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.arc(0, 0, COIN_RADIUS * 0.65, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(120, 100, 80, 0.38)';
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.arc(0, 0, COIN_RADIUS - 1, -Math.PI * 0.8, -Math.PI * 0.2);
  ctx.stroke();
}

function drawBlackCoin(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, COIN_RADIUS);
  grad.addColorStop(0, '#44403c');
  grad.addColorStop(0.4, '#292524');
  grad.addColorStop(0.85, '#1c1917');
  grad.addColorStop(1, '#0c0a09');

  ctx.beginPath();
  ctx.arc(0, 0, COIN_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowColor = 'transparent';

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.arc(0, 0, COIN_RADIUS * 0.6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.arc(0, 0, COIN_RADIUS - 1, -Math.PI * 0.8, -Math.PI * 0.2);
  ctx.stroke();
}

function drawStriker(ctx: CanvasRenderingContext2D, striker: Coin, engine: GameEngine, isAiming: boolean = false) {
  ctx.save();
  ctx.translate(striker.x, striker.y);

  // Drop shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 3.5;
  ctx.shadowOffsetY = 5.5;

  // Acrylic ivory heavy striker body
  const grad = ctx.createRadialGradient(-4, -4, 3, 0, 0, STRIKER_RADIUS);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.42, '#f8fafc');
  grad.addColorStop(0.82, '#cbd5e1');
  grad.addColorStop(1, '#64748b');

  ctx.beginPath();
  ctx.arc(0, 0, STRIKER_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowColor = 'transparent';

  // Colored player accent ring
  ctx.strokeStyle = engine.currentPlayer.color || '#f59e0b';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.arc(0, 0, STRIKER_RADIUS * 0.68, 0, Math.PI * 2);
  ctx.stroke();

  // Inner emblem
  ctx.fillStyle = engine.currentPlayer.color || '#f59e0b';
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();

  // Glossy reflection rim
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, STRIKER_RADIUS - 1.5, -Math.PI * 0.75, -Math.PI * 0.15);
  ctx.stroke();

  // Section 33: Active tactile halo & glow when held or aiming
  if (isAiming) {
    const tensionColor = engine.aimPower > 75 ? 'rgba(239, 68, 68, 0.8)' : engine.aimPower > 40 ? 'rgba(245, 158, 11, 0.8)' : 'rgba(6, 182, 212, 0.8)';
    ctx.strokeStyle = tensionColor;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, 0, STRIKER_RADIUS + 4.5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (engine.status === 'POSITIONING') {
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(0, 0, STRIKER_RADIUS + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

// Section 13: Slingshot Elastic Pull Cord & Grip Puck Visualization
function drawSlingshotPull(
  ctx: CanvasRenderingContext2D,
  striker: Coin,
  pointerPos: { x: number; y: number },
  power: number
) {
  const dx = pointerPos.x - striker.x;
  const dy = pointerPos.y - striker.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 8) return;

  const dragAngle = Math.atan2(dy, dx);
  const perpAngle = dragAngle + Math.PI / 2;
  const shoulderOffset = STRIKER_RADIUS * 0.72;

  const s1x = striker.x + Math.cos(perpAngle) * shoulderOffset;
  const s1y = striker.y + Math.sin(perpAngle) * shoulderOffset;
  const s2x = striker.x - Math.cos(perpAngle) * shoulderOffset;
  const s2y = striker.y - Math.sin(perpAngle) * shoulderOffset;

  // Tension color
  let bandColor = '#06b6d4'; // Soft cyan
  if (power > 75) {
    bandColor = '#ef4444'; // Red powerful
  } else if (power > 40) {
    bandColor = '#f59e0b'; // Amber medium
  }

  ctx.save();

  // Dual elastic cords from striker shoulders to pointer grip
  ctx.strokeStyle = bandColor;
  ctx.lineWidth = Math.max(1.6, 3.2 - (power / 100) * 1.2); // Stretches thinner with force
  ctx.lineCap = 'round';
  ctx.shadowColor = bandColor;
  ctx.shadowBlur = 6;

  ctx.beginPath();
  ctx.moveTo(s1x, s1y);
  ctx.lineTo(pointerPos.x, pointerPos.y);
  ctx.moveTo(s2x, s2y);
  ctx.lineTo(pointerPos.x, pointerPos.y);
  ctx.stroke();

  // Center pull spine (subtle dotted line)
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(striker.x, striker.y);
  ctx.lineTo(pointerPos.x, pointerPos.y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Tactile grip puck at pointer position
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.arc(pointerPos.x, pointerPos.y, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = bandColor;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Inner grip pip
  ctx.fillStyle = bandColor;
  ctx.beginPath();
  ctx.arc(pointerPos.x, pointerPos.y, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// Section 10 & 26: Forward Aiming Guide & Predictive Assists
function drawAimGuide(ctx: CanvasRenderingContext2D, engine: GameEngine) {
  if (!engine.striker) return;

  const {
    predictedStrikerPath,
    predictedTargetCoinPath,
    predictedHitCoin,
    predictedTargetToPocketPath,
    aimAngle,
    aimPower,
  } = engine;

  ctx.save();

  // 1. Primary Striker Direction / Trajectory Line
  if (predictedStrikerPath && predictedStrikerPath.length > 1) {
    const endPoint = predictedStrikerPath[1];

    ctx.beginPath();
    ctx.moveTo(predictedStrikerPath[0].x, predictedStrikerPath[0].y);
    for (let i = 1; i < predictedStrikerPath.length; i++) {
      ctx.lineTo(predictedStrikerPath[i].x, predictedStrikerPath[i].y);
    }

    const color = aimPower > 75 ? 'rgba(239, 68, 68, 0.9)' : aimPower > 40 ? 'rgba(245, 158, 11, 0.9)' : 'rgba(6, 182, 212, 0.9)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.4;
    ctx.setLineDash([7, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Impact ghost circle at target collision point
    if (predictedHitCoin) {
      ctx.beginPath();
      ctx.arc(endPoint.x, endPoint.y, STRIKER_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }
  }

  // 2. Secondary Target Coin Deflection Arrow
  if (predictedTargetCoinPath && predictedTargetCoinPath.length > 1) {
    ctx.beginPath();
    ctx.moveTo(predictedTargetCoinPath[0].x, predictedTargetCoinPath[0].y);
    ctx.lineTo(predictedTargetCoinPath[1].x, predictedTargetCoinPath[1].y);

    ctx.strokeStyle = 'rgba(239, 68, 68, 0.95)';
    ctx.lineWidth = 3.2;
    ctx.stroke();

    const end = predictedTargetCoinPath[1];
    const angle = Math.atan2(end.y - predictedTargetCoinPath[0].y, end.x - predictedTargetCoinPath[0].x);
    const arrowLen = 13;

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - arrowLen * Math.cos(angle - Math.PI / 6), end.y - arrowLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(end.x - arrowLen * Math.cos(angle + Math.PI / 6), end.y - arrowLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = '#ef4444';
    ctx.fill();
  }

  // 3. High Assist: Pocket alignment guideline
  if (predictedTargetToPocketPath && predictedTargetToPocketPath.length > 1) {
    ctx.beginPath();
    ctx.moveTo(predictedTargetToPocketPath[0].x, predictedTargetToPocketPath[0].y);
    ctx.lineTo(predictedTargetToPocketPath[1].x, predictedTargetToPocketPath[1].y);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.85)'; // green pocket path
    ctx.lineWidth = 2.4;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 4. Power Arc Ring around striker
  const powerRadius = STRIKER_RADIUS + 9;
  const startAngle = aimAngle - Math.PI * 0.45;
  const endAngle = startAngle + (Math.PI * 0.9) * (aimPower / 100);

  ctx.beginPath();
  ctx.arc(engine.striker.x, engine.striker.y, powerRadius, startAngle, endAngle);
  ctx.strokeStyle = aimPower > 75 ? '#ef4444' : aimPower > 40 ? '#f59e0b' : '#06b6d4';
  ctx.lineWidth = 4.0;
  ctx.stroke();

  ctx.restore();
}

// Section 39: Optional Developer Debug Overlay
function drawDebugAimOverlay(
  ctx: CanvasRenderingContext2D,
  pointerPos: { x: number; y: number },
  striker: Coin,
  aimAngle: number,
  aimPower: number
) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  ctx.fillRect(PLAY_AREA_MIN + 8, PLAY_AREA_MIN + 8, 204, 118);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(PLAY_AREA_MIN + 8, PLAY_AREA_MIN + 8, 204, 118);

  ctx.fillStyle = '#f59e0b';
  ctx.font = '10px monospace';
  const angleDeg = ((aimAngle * 180) / Math.PI).toFixed(1);
  const minSpeed = 2.8;
  const maxSpeed = 28.5;
  const speed = (aimPower / 100) * (maxSpeed - minSpeed) + minSpeed;
  const vx = (Math.cos(aimAngle) * speed).toFixed(2);
  const vy = (Math.sin(aimAngle) * speed).toFixed(2);

  ctx.fillText(`AIM DEBUG MODE`, PLAY_AREA_MIN + 16, PLAY_AREA_MIN + 22);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(`POINTER:  X:${pointerPos.x.toFixed(0)} Y:${pointerPos.y.toFixed(0)}`, PLAY_AREA_MIN + 16, PLAY_AREA_MIN + 38);
  ctx.fillText(`STRIKER:  X:${striker.x.toFixed(0)} Y:${striker.y.toFixed(0)}`, PLAY_AREA_MIN + 16, PLAY_AREA_MIN + 52);
  ctx.fillText(`ANGLE:    ${angleDeg}°`, PLAY_AREA_MIN + 16, PLAY_AREA_MIN + 66);
  ctx.fillText(`POWER:    ${aimPower.toFixed(0)}% (${getPowerTier(aimPower)})`, PLAY_AREA_MIN + 16, PLAY_AREA_MIN + 80);
  ctx.fillText(`VELOCITY: VX:${vx} VY:${vy}`, PLAY_AREA_MIN + 16, PLAY_AREA_MIN + 94);
  ctx.fillText(`SPEED:    ${speed.toFixed(1)} u/f`, PLAY_AREA_MIN + 16, PLAY_AREA_MIN + 108);
  ctx.restore();
}
