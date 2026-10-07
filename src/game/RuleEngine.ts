import { Coin, CoinType, Player, MatchRules, QueenState } from '../types/game';
import { CENTER_POINT, COIN_RADIUS } from './CarromBoardConstants';
import { audio } from '../services/AudioService';

export interface TurnResolution {
  nextSeat: number;
  message: string;
  isFoul: boolean;
  extraTurn: boolean;
  queenReturned: boolean;
  gameOver: boolean;
  winner: Player | null;
}

export class RuleEngine {
  /**
   * Evaluates the outcome of a completed shot after all pieces come to rest.
   */
  public static resolveShot(
    pocketedThisShot: Coin[],
    strikerPocketed: boolean,
    currentPlayer: Player,
    allPlayers: Player[],
    allCoins: Coin[],
    rules: MatchRules,
    queenState: QueenState,
    queenPendingCoverSeat: number | null
  ): {
    resolution: TurnResolution;
    newQueenState: QueenState;
    newQueenPendingCoverSeat: number | null;
    coinsToReturn: Coin[];
  } {
    let isFoul = false;
    let extraTurn = false;
    let queenReturned = false;
    let message = '';
    const coinsToReturn: Coin[] = [];

    let newQueenState = queenState;
    let newPendingSeat = queenPendingCoverSeat;

    const coinsPocketedCount = pocketedThisShot.filter(c => c.type !== 'STRIKER').length;
    const queenPocketedNow = pocketedThisShot.some(c => c.type === 'QUEEN');
    const legalCoinsPocketed = pocketedThisShot.filter(c => {
      if (c.type === 'QUEEN' || c.type === 'STRIKER') return false;
      if (rules.ruleType === 'standard' && currentPlayer.assignedCoinType && currentPlayer.assignedCoinType !== 'ANY') {
        return c.type === currentPlayer.assignedCoinType;
      }
      return true; // casual allows any coin
    });

    // 1. Check Striker Pocketed Foul
    if (strikerPocketed) {
      isFoul = true;
      currentPlayer.fouls += 1;
      audio.playFoul();

      // Penalty: deduct points or return a coin
      if (currentPlayer.score > 0) {
        currentPlayer.score = Math.max(0, currentPlayer.score - rules.strikerFoulPenalty);
      }

      // If player has previously pocketed coins on board, return 1 as foul penalty to center
      const returnCandidate = allCoins.find(
        c => c.pocketed && c.type !== 'QUEEN' && c.type !== 'STRIKER' &&
        (rules.ruleType === 'casual' || c.type === currentPlayer.assignedCoinType)
      );
      if (returnCandidate) {
        returnCandidate.pocketed = false;
        RuleEngine.placeCoinNearCenter(returnCandidate, allCoins);
        coinsToReturn.push(returnCandidate);
        if (currentPlayer.coinsPocketed > 0) currentPlayer.coinsPocketed -= 1;
      }

      // If queen was awaiting cover by this player, return queen!
      if (queenPendingCoverSeat === currentPlayer.seat) {
        const queenCoin = allCoins.find(c => c.type === 'QUEEN');
        if (queenCoin) {
          queenCoin.pocketed = false;
          RuleEngine.placeCoinNearCenter(queenCoin, allCoins);
          coinsToReturn.push(queenCoin);
        }
        newQueenState = 'CENTER';
        newPendingSeat = null;
        queenReturned = true;
      }

      message = `Foul! Striker Pocketed (-${rules.strikerFoulPenalty} pt)`;
    } 
    // 2. No striker foul: process pocketed pieces
    else {
      // Handle Queen Mechanics
      if (queenPocketedNow) {
        if (!rules.queenMustCover) {
          // Instant claim in casual
          currentPlayer.score += rules.queenPoints;
          newQueenState = 'COVERED';
          newPendingSeat = null;
          message = `Queen Pocketed! (+${rules.queenPoints} pts)`;
          extraTurn = true;
        } else {
          // Standard: must cover
          newQueenState = 'POCKETED_UNCOVERED';
          newPendingSeat = currentPlayer.seat;

          // Did player pocket a covering coin in the EXACT same shot?
          if (legalCoinsPocketed.length > 0) {
            currentPlayer.score += rules.queenPoints;
            newQueenState = 'COVERED';
            newPendingSeat = null;
            message = `Queen Pocketed and Covered! (+${rules.queenPoints} pts)`;
            extraTurn = true;
          } else {
            message = 'Queen Pocketed! Must cover with another coin.';
            extraTurn = true; // Gets another shot to cover!
          }
        }
      } else if (queenPendingCoverSeat === currentPlayer.seat) {
        // Player had previously pocketed queen and needed to cover on this shot
        if (legalCoinsPocketed.length > 0) {
          // Successfully covered!
          currentPlayer.score += rules.queenPoints;
          newQueenState = 'COVERED';
          newPendingSeat = null;
          message = `Queen Successfully Covered! (+${rules.queenPoints} pts)`;
          extraTurn = true;
        } else {
          // Failed to cover! Return Queen to center
          const queenCoin = allCoins.find(c => c.type === 'QUEEN');
          if (queenCoin) {
            queenCoin.pocketed = false;
            RuleEngine.placeCoinNearCenter(queenCoin, allCoins);
            coinsToReturn.push(queenCoin);
          }
          newQueenState = 'CENTER';
          newPendingSeat = null;
          queenReturned = true;
          message = 'Failed to cover Queen — Queen returned to center.';
          extraTurn = false;
        }
      }

      // Handle standard coins scored
      for (const coin of pocketedThisShot) {
        if (coin.type === 'QUEEN' || coin.type === 'STRIKER') continue;

        if (rules.ruleType === 'standard') {
          if (coin.type === currentPlayer.assignedCoinType || !currentPlayer.assignedCoinType || currentPlayer.assignedCoinType === 'ANY') {
            currentPlayer.score += rules.whitePoints;
            currentPlayer.coinsPocketed += 1;
            extraTurn = true;
            if (!message) message = `Pocketed ${coin.type.toLowerCase()} coin (+${rules.whitePoints} pt)`;
          } else {
            // Opponent's coin pocketed in standard
            const opponent = allPlayers.find(p => p.assignedCoinType === coin.type);
            if (opponent) {
              opponent.score += rules.whitePoints;
              opponent.coinsPocketed += 1;
            }
            if (!message) message = `Opponent's ${coin.type.toLowerCase()} coin pocketed!`;
            // Does not give extra turn
          }
        } else {
          // Casual points
          const pts = coin.type === 'WHITE' ? rules.whitePoints : rules.blackPoints;
          currentPlayer.score += pts;
          currentPlayer.coinsPocketed += 1;
          extraTurn = true;
          if (!message) message = `Pocketed ${coin.type.toLowerCase()} coin (+${pts} pts)`;
        }
      }

      if (coinsPocketedCount === 0 && !queenPocketedNow) {
        message = 'Turn Passed';
        extraTurn = false;
      }
    }

    // 3. Determine next seat
    let nextSeat = currentPlayer.seat;
    if (!extraTurn) {
      nextSeat = (currentPlayer.seat + 1) % allPlayers.length;
    }

    // 4. Check Win Condition
    const remainingBoardCoins = allCoins.filter(
      c => !c.pocketed && c.type !== 'STRIKER'
    );

    let gameOver = false;
    let winner: Player | null = null;

    // Check board points win condition
    const leadingPlayer = allPlayers.reduce((prev, curr) => (curr.score > prev.score ? curr : prev), allPlayers[0]);
    if (rules.boardPointsToWin > 0 && leadingPlayer.score >= rules.boardPointsToWin) {
      gameOver = true;
      winner = leadingPlayer;
    }

    // Or all coins cleared from board
    if (remainingBoardCoins.length === 0) {
      gameOver = true;
      // Winner is player with highest score
      winner = allPlayers.reduce((prev, curr) => (curr.score > prev.score ? curr : prev), allPlayers[0]);
    }

    return {
      resolution: {
        nextSeat,
        message,
        isFoul,
        extraTurn,
        queenReturned,
        gameOver,
        winner,
      },
      newQueenState,
      newQueenPendingCoverSeat: newPendingSeat,
      coinsToReturn,
    };
  }

  /**
   * Places a returned coin safely near the center circle without overlapping existing pieces
   */
  public static placeCoinNearCenter(coin: Coin, allCoins: Coin[]) {
    let targetX = CENTER_POINT.x;
    let targetY = CENTER_POINT.y;
    let angle = 0;
    let distance = 0;
    let attempts = 0;

    while (attempts < 50) {
      const x = targetX + Math.cos(angle) * distance;
      const y = targetY + Math.sin(angle) * distance;

      const collides = allCoins.some(other => {
        if (other === coin || other.pocketed || other.type === 'STRIKER') return false;
        const dx = other.x - x;
        const dy = other.y - y;
        return dx * dx + dy * dy < (coin.radius + other.radius + 4) * (coin.radius + other.radius + 4);
      });

      if (!collides) {
        coin.x = x;
        coin.y = y;
        coin.vx = 0;
        coin.vy = 0;
        return;
      }

      angle += 0.8;
      distance += (COIN_RADIUS * 0.4);
      attempts++;
    }

    coin.x = targetX;
    coin.y = targetY;
    coin.vx = 0;
    coin.vy = 0;
  }
}
