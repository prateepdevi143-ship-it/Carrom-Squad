import { Coin } from '../types/game';
import { POCKETS } from './CarromBoardConstants';
import { PHYSICS_CONFIG } from './PhysicsConfig';
import { audio } from '../services/AudioService';

export interface PocketEvent {
  coin: Coin;
  pocketId: string;
}

export class PocketSystem {
  /**
   * Checks all coins against pockets and handles realistic gravitational capture & sinking
   */
  public static updatePockets(coins: Coin[], dt: number): PocketEvent[] {
    const newlyPocketed: PocketEvent[] = [];

    for (const coin of coins) {
      if (coin.pocketed) continue;

      if (coin.sinking) {
        // Progress the sink animation (smooth 3D-like dip into cavity)
        coin.sinkProgress = (coin.sinkProgress || 0) + dt * 4.2;
        if (coin.sinkTargetPocket) {
          // Smooth attraction to hole center
          coin.x += (coin.sinkTargetPocket.x - coin.x) * 0.28;
          coin.y += (coin.sinkTargetPocket.y - coin.y) * 0.28;
          coin.vx *= 0.45;
          coin.vy *= 0.45;
          if (coin.angularVelocity) coin.angularVelocity *= 0.7;
        }

        if (coin.sinkProgress >= 1) {
          coin.pocketed = true;
          coin.sinking = false;
          newlyPocketed.push({
            coin,
            pocketId: 'POCKET',
          });
        }
        continue;
      }

      // Check distance to each of 4 pockets
      for (const pocket of POCKETS) {
        const dx = coin.x - pocket.x;
        const dy = coin.y - pocket.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Pocket capture radius: subtle physical slope into the hole
        if (dist < PHYSICS_CONFIG.pocketRadius) {
          const pullFactor = PHYSICS_CONFIG.pocketGravitationalPull;
          const invDist = 1 / Math.max(1, dist);
          coin.vx -= (dx * invDist) * pullFactor;
          coin.vy -= (dy * invDist) * pullFactor;
          // Friction damping on pocket leather/felt rim
          coin.vx *= 0.91;
          coin.vy *= 0.91;

          if (dist < PHYSICS_CONFIG.pocketHoleRadius) {
            // Coin has entered dark cavity! Trigger sink
            coin.sinking = true;
            coin.sinkProgress = 0;
            coin.sinkTargetPocket = { x: pocket.x, y: pocket.y };
            audio.playPocketSink(coin.type === 'QUEEN', pocket.x);
            break;
          }
        }
      }
    }

    return newlyPocketed;
  }
}
