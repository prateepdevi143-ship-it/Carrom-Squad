import { Coin, CoinType, Player, AIDifficulty } from '../types/game';
import {
  COIN_RADIUS,
  STRIKER_RADIUS,
  POCKETS,
  BaselineConfig,
  getBaselineForPlayer,
} from './CarromBoardConstants';

export interface AIShotDecision {
  strikerPos: number; // position coordinate along baseline axis
  angle: number;      // shooting angle in radians
  power: number;      // 0 to 100
  targetCoin: Coin | null;
}

export class AIEngine {
  /**
   * Calculates the best shot for an AI player according to difficulty level.
   */
  public static calculateShot(
    aiPlayer: Player,
    totalPlayers: number,
    coins: Coin[],
    difficulty: AIDifficulty = 'MEDIUM'
  ): AIShotDecision {
    const baseline = getBaselineForPlayer(aiPlayer.seat, totalPlayers);
    const activeCoins = coins.filter(c => !c.pocketed && !c.sinking && c.type !== 'STRIKER');

    if (activeCoins.length === 0) {
      // Default fallback shot straight toward board center
      const mid = (baseline.min + baseline.max) / 2;
      return {
        strikerPos: mid,
        angle: baseline.shootingAngle,
        power: 55,
        targetCoin: null,
      };
    }

    // Determine target coins prioritized for this player
    let prioritizedCoins = activeCoins;
    if (aiPlayer.assignedCoinType && aiPlayer.assignedCoinType !== 'ANY') {
      const myCoins = activeCoins.filter(c => c.type === aiPlayer.assignedCoinType || c.type === 'QUEEN');
      if (myCoins.length > 0) {
        prioritizedCoins = myCoins;
      }
    }

    if (difficulty === 'EASY') {
      return this.calculateEasyShot(baseline, prioritizedCoins);
    } else if (difficulty === 'MEDIUM') {
      return this.calculateMediumShot(baseline, prioritizedCoins, activeCoins);
    } else {
      return this.calculateHardShot(baseline, prioritizedCoins, activeCoins);
    }
  }

  private static calculateEasyShot(baseline: BaselineConfig, targetCoins: Coin[]): AIShotDecision {
    // Pick random target coin
    const target = targetCoins[Math.floor(Math.random() * targetCoins.length)];
    // Random baseline position
    const strikerPos = baseline.min + Math.random() * (baseline.max - baseline.min);

    const strikerX = baseline.axis === 'x' ? strikerPos : baseline.fixedCoordinate;
    const strikerY = baseline.axis === 'y' ? strikerPos : baseline.fixedCoordinate;

    const directAngle = Math.atan2(target.y - strikerY, target.x - strikerX);
    // Add noticeable error (+/- 14 degrees)
    const error = (Math.random() - 0.5) * 0.45;
    const power = 38 + Math.random() * 32;

    return {
      strikerPos,
      angle: directAngle + error,
      power,
      targetCoin: target,
    };
  }

  private static calculateMediumShot(
    baseline: BaselineConfig,
    targetCoins: Coin[],
    allCoins: Coin[]
  ): AIShotDecision {
    let bestScore = -Infinity;
    let bestDecision: AIShotDecision = {
      strikerPos: (baseline.min + baseline.max) / 2,
      angle: baseline.shootingAngle,
      power: 60,
      targetCoin: targetCoins[0],
    };

    // Test a sample of 5 baseline positions
    const step = (baseline.max - baseline.min) / 4;
    for (let pos = baseline.min; pos <= baseline.max; pos += step) {
      const strikerX = baseline.axis === 'x' ? pos : baseline.fixedCoordinate;
      const strikerY = baseline.axis === 'y' ? pos : baseline.fixedCoordinate;

      for (const coin of targetCoins) {
        // Find best pocket for this coin
        for (const pocket of POCKETS) {
          const coinToPocketDx = pocket.x - coin.x;
          const coinToPocketDy = pocket.y - coin.y;
          const distCoinPocket = Math.sqrt(coinToPocketDx * coinToPocketDx + coinToPocketDy * coinToPocketDy);
          const pocketDirX = coinToPocketDx / distCoinPocket;
          const pocketDirY = coinToPocketDy / distCoinPocket;

          // Ghost striker position to cut coin toward pocket
          const ghostX = coin.x - pocketDirX * (STRIKER_RADIUS + coin.radius);
          const ghostY = coin.y - pocketDirY * (STRIKER_RADIUS + coin.radius);

          const strikerToGhostDx = ghostX - strikerX;
          const strikerToGhostDy = ghostY - strikerY;
          const distStrikerGhost = Math.sqrt(strikerToGhostDx * strikerToGhostDx + strikerToGhostDy * strikerToGhostDy);

          const aimAngle = Math.atan2(strikerToGhostDy, strikerToGhostDx);

          // Calculate cut angle: dot product between shot direction and coin-to-pocket direction
          const shotDirX = strikerToGhostDx / Math.max(1, distStrikerGhost);
          const shotDirY = strikerToGhostDy / Math.max(1, distStrikerGhost);
          const alignment = shotDirX * pocketDirX + shotDirY * pocketDirY; // 1 = straight, 0 = 90 deg cut

          if (alignment > 0.25) {
            // Check if forward direction aligns with player's baseline orientation
            const forwardAlignment = Math.cos(aimAngle - baseline.shootingAngle);
            if (forwardAlignment > 0) {
              const queenBonus = coin.type === 'QUEEN' ? 1.5 : 1.0;
              const score = (alignment * 2.5 - distCoinPocket * 0.002 - distStrikerGhost * 0.001) * queenBonus;

              if (score > bestScore) {
                bestScore = score;
                // Add slight medium error (+/- 3 degrees)
                const error = (Math.random() - 0.5) * 0.08;
                const power = Math.min(95, Math.max(45, (distStrikerGhost + distCoinPocket) * 0.14));

                bestDecision = {
                  strikerPos: pos,
                  angle: aimAngle + error,
                  power,
                  targetCoin: coin,
                };
              }
            }
          }
        }
      }
    }

    return bestDecision;
  }

  private static calculateHardShot(
    baseline: BaselineConfig,
    targetCoins: Coin[],
    allCoins: Coin[]
  ): AIShotDecision {
    let bestScore = -Infinity;
    let bestDecision: AIShotDecision = {
      strikerPos: (baseline.min + baseline.max) / 2,
      angle: baseline.shootingAngle,
      power: 65,
      targetCoin: targetCoins[0],
    };

    // Test 11 dense candidate positions along baseline
    const testCount = 11;
    const step = (baseline.max - baseline.min) / (testCount - 1);

    for (let i = 0; i < testCount; i++) {
      const pos = baseline.min + i * step;
      const strikerX = baseline.axis === 'x' ? pos : baseline.fixedCoordinate;
      const strikerY = baseline.axis === 'y' ? pos : baseline.fixedCoordinate;

      // Verify striker placement does not overlap existing coins on board
      const overlapsCoin = allCoins.some(c => {
        if (c.pocketed || c.type === 'STRIKER') return false;
        const dx = c.x - strikerX;
        const dy = c.y - strikerY;
        return dx * dx + dy * dy < (STRIKER_RADIUS + c.radius + 2) * (STRIKER_RADIUS + c.radius + 2);
      });
      if (overlapsCoin) continue;

      for (const coin of targetCoins) {
        for (const pocket of POCKETS) {
          const coinToPocketDx = pocket.x - coin.x;
          const coinToPocketDy = pocket.y - coin.y;
          const distCoinPocket = Math.sqrt(coinToPocketDx * coinToPocketDx + coinToPocketDy * coinToPocketDy);
          const pocketDirX = coinToPocketDx / distCoinPocket;
          const pocketDirY = coinToPocketDy / distCoinPocket;

          const ghostX = coin.x - pocketDirX * (STRIKER_RADIUS + coin.radius);
          const ghostY = coin.y - pocketDirY * (STRIKER_RADIUS + coin.radius);

          const strikerToGhostDx = ghostX - strikerX;
          const strikerToGhostDy = ghostY - strikerY;
          const distStrikerGhost = Math.sqrt(strikerToGhostDx * strikerToGhostDx + strikerToGhostDy * strikerToGhostDy);

          const aimAngle = Math.atan2(strikerToGhostDy, strikerToGhostDx);

          const shotDirX = strikerToGhostDx / Math.max(1, distStrikerGhost);
          const shotDirY = strikerToGhostDy / Math.max(1, distStrikerGhost);
          const alignment = shotDirX * pocketDirX + shotDirY * pocketDirY;

          // Forward angle check
          const forwardAlignment = Math.cos(aimAngle - baseline.shootingAngle);
          if (forwardAlignment < 0.2) continue; // Shooting backwards into cushion is low priority

          if (alignment > 0.45) {
            // Check line of sight obstruction from striker to ghost
            const isObstructed = allCoins.some(other => {
              if (other === coin || other.pocketed || other.type === 'STRIKER') return false;
              // Ray from striker to ghost
              const ocX = other.x - strikerX;
              const ocY = other.y - strikerY;
              const proj = ocX * shotDirX + ocY * shotDirY;
              if (proj <= 0 || proj >= distStrikerGhost) return false;
              const perpSq = ocX * ocX + ocY * ocY - proj * proj;
              return perpSq < (STRIKER_RADIUS + other.radius) * (STRIKER_RADIUS + other.radius);
            });

            if (!isObstructed) {
              const queenBonus = coin.type === 'QUEEN' ? 2.2 : 1.0;
              const score = (alignment * 4.0 - (distCoinPocket + distStrikerGhost) * 0.0015) * queenBonus;

              if (score > bestScore) {
                bestScore = score;
                // High precision: minimal natural jitter (+/- 0.8 degrees)
                const error = (Math.random() - 0.5) * 0.025;
                const power = Math.min(92, Math.max(48, (distStrikerGhost + distCoinPocket * 1.2) * 0.12));

                bestDecision = {
                  strikerPos: pos,
                  angle: aimAngle + error,
                  power,
                  targetCoin: coin,
                };
              }
            }
          }
        }
      }
    }

    return bestDecision;
  }
}
