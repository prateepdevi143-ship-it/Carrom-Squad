import { Coin, CoinType } from '../types/game';
import {
  BOARD_SIZE,
  PLAY_AREA_MIN,
  PLAY_AREA_MAX,
  COIN_RADIUS,
  STRIKER_RADIUS,
  CENTER_POINT,
  POCKETS,
} from './CarromBoardConstants';
import { PHYSICS_CONFIG } from './PhysicsConfig';
import { audio } from '../services/AudioService';
import { PocketSystem, PocketEvent } from './PocketSystem';

export interface ImpactEffect {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

export class PhysicsEngine {
  public static impactEffects: ImpactEffect[] = [];

  /**
   * Generates standard initial Carrom pieces:
   * 1 Queen in center,
   * 6 coins in inner circle (3 White, 3 Black alternating),
   * 12 coins in outer circle (6 White, 6 Black alternating).
   */
  public static createInitialCoins(): Coin[] {
    const coins: Coin[] = [];
    let idCounter = 1;

    // 1. Red Queen at exact center
    coins.push({
      id: `coin_queen_${idCounter++}`,
      type: 'QUEEN',
      x: CENTER_POINT.x,
      y: CENTER_POINT.y,
      vx: 0,
      vy: 0,
      radius: COIN_RADIUS,
      mass: PHYSICS_CONFIG.coinMass,
      rotation: Math.random() * Math.PI * 2,
      angularVelocity: 0,
      pocketed: false,
    });

    // 2. Inner circle: 6 coins at distance 2 * COIN_RADIUS
    const innerDist = COIN_RADIUS * 2.05;
    const innerTypes: CoinType[] = ['WHITE', 'BLACK', 'WHITE', 'BLACK', 'WHITE', 'BLACK'];
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      coins.push({
        id: `coin_${innerTypes[i].toLowerCase()}_${idCounter++}`,
        type: innerTypes[i],
        x: CENTER_POINT.x + Math.cos(angle) * innerDist,
        y: CENTER_POINT.y + Math.sin(angle) * innerDist,
        vx: 0,
        vy: 0,
        radius: COIN_RADIUS,
        mass: PHYSICS_CONFIG.coinMass,
        rotation: Math.random() * Math.PI * 2,
        angularVelocity: 0,
        pocketed: false,
      });
    }

    // 3. Outer circle: 12 coins arranged in hexagonal ring
    const outerDist1 = COIN_RADIUS * 4.08;
    const outerDist2 = COIN_RADIUS * 3.56;

    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI) / 6;
      const dist = i % 2 === 0 ? outerDist1 : outerDist2;
      const type: CoinType = i % 2 === 0 ? 'BLACK' : 'WHITE';

      coins.push({
        id: `coin_${type.toLowerCase()}_${idCounter++}`,
        type,
        x: CENTER_POINT.x + Math.cos(angle) * dist,
        y: CENTER_POINT.y + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        radius: COIN_RADIUS,
        mass: PHYSICS_CONFIG.coinMass,
        rotation: Math.random() * Math.PI * 2,
        angularVelocity: 0,
        pocketed: false,
      });
    }

    return coins;
  }

  /**
   * Creates the striker piece
   */
  public static createStriker(x: number, y: number): Coin {
    return {
      id: 'striker_active',
      type: 'STRIKER',
      x,
      y,
      vx: 0,
      vy: 0,
      radius: STRIKER_RADIUS,
      mass: PHYSICS_CONFIG.strikerMass,
      rotation: 0,
      angularVelocity: 0,
      pocketed: false,
    };
  }

  /**
   * Advances the simulation by 1 frame using multi-substep integration
   */
  public static step(
    coins: Coin[],
    striker: Coin | null,
    deltaTimeSeconds: number = 1 / 60
  ): { pocketedEvents: PocketEvent[]; isAtRest: boolean } {
    const subSteps = 4;
    const dt = deltaTimeSeconds / subSteps;
    const allPieces: Coin[] = striker ? [...coins, striker] : [...coins];
    const newlyPocketed: PocketEvent[] = [];

    // Decay visual impact rings
    for (let i = PhysicsEngine.impactEffects.length - 1; i >= 0; i--) {
      const eff = PhysicsEngine.impactEffects[i];
      eff.radius += dt * 48;
      eff.alpha -= dt * 3.2;
      if (eff.alpha <= 0) {
        PhysicsEngine.impactEffects.splice(i, 1);
      }
    }

    let audioClacksThisFrame = 0;

    for (let step = 0; step < subSteps; step++) {
      // 1. Pocket interactions
      const pocketed = PocketSystem.updatePockets(allPieces, dt);
      if (pocketed.length > 0) {
        newlyPocketed.push(...pocketed);
      }

      // 2. Movement & Surface Friction Integration
      for (const piece of allPieces) {
        if (piece.pocketed || piece.sinking) continue;

        piece.x += piece.vx * (dt * 60);
        piece.y += piece.vy * (dt * 60);

        // Boric powder friction
        piece.vx *= Math.pow(PHYSICS_CONFIG.friction, dt * 60);
        piece.vy *= Math.pow(PHYSICS_CONFIG.friction, dt * 60);

        // Angular rotation simulation
        if (piece.angularVelocity) {
          piece.rotation = (piece.rotation || 0) + piece.angularVelocity * dt * 4;
          piece.angularVelocity *= Math.pow(PHYSICS_CONFIG.rollingResistance, dt * 60);
        }
      }

      // 3. Cushion wall collisions
      for (const piece of allPieces) {
        if (piece.pocketed || piece.sinking) continue;
        PhysicsEngine.handleWallCollisions(piece);
      }

      // 4. Piece-to-piece elastic collisions
      for (let i = 0; i < allPieces.length; i++) {
        const p1 = allPieces[i];
        if (p1.pocketed || p1.sinking) continue;

        for (let j = i + 1; j < allPieces.length; j++) {
          const p2 = allPieces[j];
          if (p2.pocketed || p2.sinking) continue;

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const distSq = dx * dx + dy * dy;
          const minDist = p1.radius + p2.radius;

          if (distSq < minDist * minDist && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;

            // Separate overlapping pieces proportionally to inverse mass
            const overlap = minDist - dist;
            const invMass1 = 1 / p1.mass;
            const invMass2 = 1 / p2.mass;
            const totalInvMass = invMass1 + invMass2;

            p1.x -= nx * overlap * (invMass1 / totalInvMass);
            p1.y -= ny * overlap * (invMass1 / totalInvMass);
            p2.x += nx * overlap * (invMass2 / totalInvMass);
            p2.y += ny * overlap * (invMass2 / totalInvMass);

            // Relative velocity
            const rvx = p2.vx - p1.vx;
            const rvy = p2.vy - p1.vy;
            const velAlongNormal = rvx * nx + rvy * ny;

            if (velAlongNormal < 0) {
              const impulseMag = -(1 + PHYSICS_CONFIG.restitution) * velAlongNormal / totalInvMass;

              p1.vx -= (impulseMag * invMass1) * nx;
              p1.vy -= (impulseMag * invMass1) * ny;
              p2.vx += (impulseMag * invMass2) * nx;
              p2.vy += (impulseMag * invMass2) * ny;

              // Tangential friction torque (causes spin on cut shots)
              const tangentX = -ny;
              const tangentY = nx;
              const relVelTangent = rvx * tangentX + rvy * tangentY;
              p1.angularVelocity = (p1.angularVelocity || 0) + relVelTangent * 0.08;
              p2.angularVelocity = (p2.angularVelocity || 0) - relVelTangent * 0.08;

              // Spatial sound with impulse strength
              if (Math.abs(velAlongNormal) > 0.3 && audioClacksThisFrame < 3) {
                audio.playCoinClack(Math.abs(velAlongNormal), (p1.x + p2.x) / 2);
                audioClacksThisFrame++;
              }

              // Visual micro impact ring on powerful collisions
              if (Math.abs(velAlongNormal) > 4.5 && PhysicsEngine.impactEffects.length < 8) {
                PhysicsEngine.impactEffects.push({
                  x: (p1.x + p2.x) / 2,
                  y: (p1.y + p2.y) / 2,
                  radius: 5,
                  maxRadius: 18,
                  alpha: 0.65,
                });
              }
            }
          }
        }
      }
    }

    // 5. Check if all pieces have stopped moving
    let isAtRest = true;
    const stopSpeedSq = PHYSICS_CONFIG.stopVelocity * PHYSICS_CONFIG.stopVelocity;

    for (const piece of allPieces) {
      if (piece.pocketed) continue;
      if (piece.sinking) {
        isAtRest = false;
        break;
      }
      const speedSq = piece.vx * piece.vx + piece.vy * piece.vy;
      if (speedSq > stopSpeedSq) {
        isAtRest = false;
        break;
      }
    }

    if (isAtRest) {
      for (const piece of allPieces) {
        piece.vx = 0;
        piece.vy = 0;
        piece.angularVelocity = 0;
      }
    }

    return { pocketedEvents: newlyPocketed, isAtRest };
  }

  /**
   * Handles bouncing off outer wooden cushion rails (skips corner pocket openings)
   */
  private static handleWallCollisions(piece: Coin) {
    const leftBound = PLAY_AREA_MIN + piece.radius;
    const rightBound = PLAY_AREA_MAX - piece.radius;
    const topBound = PLAY_AREA_MIN + piece.radius;
    const bottomBound = PLAY_AREA_MAX - piece.radius;

    // Corner pocket lip exclusion
    const nearPocket = POCKETS.some((p) => {
      const dx = piece.x - p.x;
      const dy = piece.y - p.y;
      return dx * dx + dy * dy < (PHYSICS_CONFIG.pocketRadius + 10) * (PHYSICS_CONFIG.pocketRadius + 10);
    });

    if (nearPocket) return;

    // Left cushion
    if (piece.x < leftBound) {
      piece.x = leftBound;
      if (piece.vx < 0) {
        piece.vx = -piece.vx * PHYSICS_CONFIG.wallRestitution;
        piece.angularVelocity = (piece.angularVelocity || 0) + piece.vy * 0.05;
        audio.playWallBounce(Math.abs(piece.vx), piece.x);
      }
    }
    // Right cushion
    else if (piece.x > rightBound) {
      piece.x = rightBound;
      if (piece.vx > 0) {
        piece.vx = -piece.vx * PHYSICS_CONFIG.wallRestitution;
        piece.angularVelocity = (piece.angularVelocity || 0) - piece.vy * 0.05;
        audio.playWallBounce(Math.abs(piece.vx), piece.x);
      }
    }

    // Top cushion
    if (piece.y < topBound) {
      piece.y = topBound;
      if (piece.vy < 0) {
        piece.vy = -piece.vy * PHYSICS_CONFIG.wallRestitution;
        piece.angularVelocity = (piece.angularVelocity || 0) - piece.vx * 0.05;
        audio.playWallBounce(Math.abs(piece.vy), piece.x);
      }
    }
    // Bottom cushion
    else if (piece.y > bottomBound) {
      piece.y = bottomBound;
      if (piece.vy > 0) {
        piece.vy = -piece.vy * PHYSICS_CONFIG.wallRestitution;
        piece.angularVelocity = (piece.angularVelocity || 0) + piece.vx * 0.05;
        audio.playWallBounce(Math.abs(piece.vy), piece.x);
      }
    }
  }

  /**
   * Predicts trajectory: computes line of sight from striker, finds first coin collision,
   * deflection vectors, and optional cushion rebounds based on aimAssist level.
   */
  public static calculateTrajectory(
    strikerX: number,
    strikerY: number,
    angle: number,
    power: number,
    coins: Coin[],
    aimAssist: 'OFF' | 'LOW' | 'HIGH' = 'LOW'
  ): {
    strikerPath: { x: number; y: number }[];
    targetCoinPath: { x: number; y: number }[] | null;
    hitCoin: Coin | null;
    targetToPocketPath: { x: number; y: number }[] | null;
  } {
    if (aimAssist === 'OFF') {
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      return {
        strikerPath: [
          { x: strikerX, y: strikerY },
          { x: strikerX + dirX * 120, y: strikerY + dirY * 120 },
        ],
        targetCoinPath: null,
        hitCoin: null,
        targetToPocketPath: null,
      };
    }

    const speed = (power / 100) * PHYSICS_CONFIG.maxImpulseSpeed + PHYSICS_CONFIG.minImpulseSpeed;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    const strikerPath: { x: number; y: number }[] = [{ x: strikerX, y: strikerY }];
    let hitCoin: Coin | null = null;
    let hitPoint: { x: number; y: number } | null = null;
    let minT = Infinity;

    // Check intersection with all active coins
    for (const coin of coins) {
      if (coin.pocketed || coin.sinking) continue;

      const combinedRadius = STRIKER_RADIUS + coin.radius;
      const ocX = coin.x - strikerX;
      const ocY = coin.y - strikerY;

      const proj = ocX * dirX + ocY * dirY;
      if (proj <= 0) continue; // Behind striker

      const perpSq = (ocX * ocX + ocY * ocY) - proj * proj;
      if (perpSq >= combinedRadius * combinedRadius) continue;

      const halfChord = Math.sqrt(combinedRadius * combinedRadius - perpSq);
      const t = proj - halfChord;

      if (t > 0 && t < minT) {
        minT = t;
        hitCoin = coin;
        hitPoint = {
          x: strikerX + dirX * t,
          y: strikerY + dirY * t,
        };
      }
    }

    if (hitCoin && hitPoint) {
      strikerPath.push(hitPoint);

      const nx = hitCoin.x - hitPoint.x;
      const ny = hitCoin.y - hitPoint.y;
      const dist = Math.sqrt(nx * nx + ny * ny);

      let targetCoinPath: { x: number; y: number }[] | null = null;
      let targetToPocketPath: { x: number; y: number }[] | null = null;

      if (dist > 0.001) {
        const normX = nx / dist;
        const normY = ny / dist;
        const arrowLen = Math.min(160, speed * 6.5);
        targetCoinPath = [
          { x: hitCoin.x, y: hitCoin.y },
          { x: hitCoin.x + normX * arrowLen, y: hitCoin.y + normY * arrowLen },
        ];

        // In HIGH assist mode: check if target coin vector points toward a pocket
        if (aimAssist === 'HIGH') {
          for (const pocket of POCKETS) {
            const pdx = pocket.x - hitCoin.x;
            const pdy = pocket.y - hitCoin.y;
            const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
            const pNormX = pdx / pdist;
            const pNormY = pdy / pdist;
            const alignment = normX * pNormX + normY * pNormY;
            if (alignment > 0.88) {
              targetToPocketPath = [
                { x: hitCoin.x, y: hitCoin.y },
                { x: pocket.x, y: pocket.y },
              ];
              break;
            }
          }
        }
      }

      return { strikerPath, targetCoinPath, hitCoin, targetToPocketPath };
    }

    // No coin hit: trace to cushion wall
    const maxRange = 380;
    const targetX = strikerX + dirX * maxRange;
    const targetY = strikerY + dirY * maxRange;

    // Check cushion rebound in HIGH mode
    if (aimAssist === 'HIGH') {
      const leftBound = PLAY_AREA_MIN + STRIKER_RADIUS;
      const rightBound = PLAY_AREA_MAX - STRIKER_RADIUS;
      const topBound = PLAY_AREA_MIN + STRIKER_RADIUS;
      const bottomBound = PLAY_AREA_MAX - STRIKER_RADIUS;

      let wallT = Infinity;
      let wallNormal = { x: 0, y: 0 };

      if (dirX < 0 && (leftBound - strikerX) / dirX < wallT && (leftBound - strikerX) / dirX > 0) {
        wallT = (leftBound - strikerX) / dirX;
        wallNormal = { x: 1, y: 0 };
      } else if (dirX > 0 && (rightBound - strikerX) / dirX < wallT && (rightBound - strikerX) / dirX > 0) {
        wallT = (rightBound - strikerX) / dirX;
        wallNormal = { x: -1, y: 0 };
      }

      if (dirY < 0 && (topBound - strikerY) / dirY < wallT && (topBound - strikerY) / dirY > 0) {
        wallT = (topBound - strikerY) / dirY;
        wallNormal = { x: 0, y: 1 };
      } else if (dirY > 0 && (bottomBound - strikerY) / dirY < wallT && (bottomBound - strikerY) / dirY > 0) {
        wallT = (bottomBound - strikerY) / dirY;
        wallNormal = { x: 0, y: -1 };
      }

      if (wallT < maxRange) {
        const bouncePoint = { x: strikerX + dirX * wallT, y: strikerY + dirY * wallT };
        strikerPath.push(bouncePoint);
        // Reflected vector
        const dot = dirX * wallNormal.x + dirY * wallNormal.y;
        const refDirX = dirX - 2 * dot * wallNormal.x;
        const refDirY = dirY - 2 * dot * wallNormal.y;
        strikerPath.push({
          x: bouncePoint.x + refDirX * 120,
          y: bouncePoint.y + refDirY * 120,
        });
        return { strikerPath, targetCoinPath: null, hitCoin: null, targetToPocketPath: null };
      }
    }

    strikerPath.push({ x: targetX, y: targetY });
    return { strikerPath, targetCoinPath: null, hitCoin: null, targetToPocketPath: null };
  }
}
