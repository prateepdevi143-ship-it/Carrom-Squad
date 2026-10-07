import {
  Coin,
  CoinType,
  Player,
  MatchRules,
  MatchStatus,
  QueenState,
  GameMode,
  AIDifficulty,
} from '../types/game';
import {
  COIN_RADIUS,
  STRIKER_RADIUS,
  getBaselineForPlayer,
  BaselineConfig,
} from './CarromBoardConstants';
import { PhysicsEngine } from './PhysicsEngine';
import { RuleEngine, TurnResolution } from './RuleEngine';
import { AIEngine } from './AIEngine';
import { audio } from '../services/AudioService';
import { storage } from '../services/StorageService';

export interface GameNotification {
  id: string;
  type: 'info' | 'foul' | 'queen' | 'extra_turn' | 'win';
  title: string;
  subtitle?: string;
  timestamp: number;
}

export type StateChangeListener = () => void;

export class GameEngine {
  public mode: GameMode = 'LOCAL';
  public status: MatchStatus = 'INITIAL';
  public players: Player[] = [];
  public currentTurnIndex: number = 0;
  public coins: Coin[] = [];
  public striker: Coin | null = null;
  public strikerBaselinePos: number = 400; // coordinate along current player's baseline
  public aimAngle: number = -Math.PI / 2;
  public aimPower: number = 50; // 0 to 100
  public isAiming: boolean = false;

  public queenState: QueenState = 'CENTER';
  public queenPendingCoverSeat: number | null = null;

  public rules: MatchRules = {
    ruleType: 'standard',
    boardPointsToWin: 25,
    maxTurns: 0,
    queenPoints: 3,
    whitePoints: 1,
    blackPoints: 1,
    strikerFoulPenalty: 1,
    queenMustCover: true,
    turnTimerSeconds: 25,
    aimAssist: 'LOW',
  };

  public turnTimerRemaining: number = 25;
  private timerInterval: any = null;

  public winner: Player | null = null;
  public notifications: GameNotification[] = [];
  private pocketedThisShot: Coin[] = [];
  private strikerPocketedThisShot: boolean = false;

  private stateChangeListeners: Set<StateChangeListener> = new Set();
  private aiActionTimeout: any = null;

  // Trajectory cache
  public predictedStrikerPath: { x: number; y: number }[] = [];
  public predictedTargetCoinPath: { x: number; y: number }[] | null = null;
  public predictedHitCoin: Coin | null = null;
  public predictedTargetToPocketPath: { x: number; y: number }[] | null = null;

  constructor() {
    this.resetMatch();
  }

  public subscribe(listener: StateChangeListener): () => void {
    this.stateChangeListeners.add(listener);
    return () => this.stateChangeListeners.delete(listener);
  }

  public notifyStateChange() {
    for (const listener of this.stateChangeListeners) {
      listener();
    }
  }

  public get currentPlayer(): Player {
    return this.players[this.currentTurnIndex] || this.players[0];
  }

  public getCurrentBaseline(): BaselineConfig {
    return getBaselineForPlayer(this.currentPlayer.seat, this.players.length);
  }

  /**
   * Initializes or resets a match with chosen players, mode, and rules
   */
  public startMatch(
    playersConfig: { name: string; color: string; isAI: boolean; aiDifficulty?: AIDifficulty }[],
    mode: GameMode = 'LOCAL',
    customRules?: Partial<MatchRules>
  ) {
    if (this.aiActionTimeout) clearTimeout(this.aiActionTimeout);
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.mode = mode;
    if (customRules) {
      this.rules = { ...this.rules, ...customRules };
    }

    const playerCount = playersConfig.length;
    this.players = playersConfig.map((p, idx) => ({
      id: `p_${idx}`,
      name: p.name,
      color: p.color,
      seat: idx,
      assignedCoinType:
        this.rules.ruleType === 'standard'
          ? idx === 0 ? 'WHITE' : idx === 1 ? 'BLACK' : idx === 2 ? 'WHITE' : 'BLACK'
          : 'ANY',
      score: 0,
      coinsPocketed: 0,
      fouls: 0,
      isAI: p.isAI,
      aiDifficulty: p.aiDifficulty || 'MEDIUM',
      isReady: true,
    }));

    this.currentTurnIndex = 0;
    this.winner = null;
    this.queenState = 'CENTER';
    this.queenPendingCoverSeat = null;
    this.notifications = [];
    this.pocketedThisShot = [];
    this.strikerPocketedThisShot = false;

    // Create 19 coins
    this.coins = PhysicsEngine.createInitialCoins();

    this.setupStrikerForCurrentPlayer();
    this.status = 'POSITIONING';
    this.startTurnTimer();

    this.addNotification('info', `Match Started!`, `${this.currentPlayer.name}'s turn.`);
    audio.playTurnChange();
    this.notifyStateChange();

    this.checkAITurn();
  }

  public resetMatch() {
    this.startMatch([
      { name: 'Player 1', color: '#f59e0b', isAI: false },
      { name: 'Player 2', color: '#06b6d4', isAI: false },
    ]);
  }

  /**
   * Places the striker on the current player's baseline
   */
  public setupStrikerForCurrentPlayer() {
    const baseline = this.getCurrentBaseline();
    const defaultPos = (baseline.min + baseline.max) / 2;
    this.strikerBaselinePos = defaultPos;

    const x = baseline.axis === 'x' ? defaultPos : baseline.fixedCoordinate;
    const y = baseline.axis === 'y' ? defaultPos : baseline.fixedCoordinate;

    this.striker = PhysicsEngine.createStriker(x, y);
    this.aimAngle = baseline.shootingAngle;
    this.aimPower = 55;
    this.isAiming = false;
    this.updateTrajectoryPrediction();
  }

  /**
   * Updates position of striker along baseline (clamped to legal limits & non-overlapping)
   */
  public setStrikerPosition(pos: number) {
    if (this.status !== 'POSITIONING' && this.status !== 'AIMING') return;
    const baseline = this.getCurrentBaseline();
    const clamped = Math.max(baseline.min, Math.min(baseline.max, pos));
    this.strikerBaselinePos = clamped;

    if (this.striker) {
      this.striker.x = baseline.axis === 'x' ? clamped : baseline.fixedCoordinate;
      this.striker.y = baseline.axis === 'y' ? clamped : baseline.fixedCoordinate;
      this.updateTrajectoryPrediction();
      this.notifyStateChange();
    }
  }

  /**
   * Updates aiming direction and shot power
   */
  public setAim(angle: number, power: number, isAiming: boolean = true) {
    if (this.status !== 'POSITIONING' && this.status !== 'AIMING') return;
    this.status = isAiming ? 'AIMING' : 'POSITIONING';
    this.aimAngle = angle;
    this.aimPower = Math.max(0, Math.min(100, power));
    this.isAiming = isAiming;
    this.updateTrajectoryPrediction();
    this.notifyStateChange();
  }

  /**
   * Cancels active aiming and returns striker to positioning state
   */
  public cancelAim() {
    if (this.status !== 'AIMING') return;
    this.status = 'POSITIONING';
    this.isAiming = false;
    this.aimPower = 0;
    this.updateTrajectoryPrediction();
    this.notifyStateChange();
  }

  public updateTrajectoryPrediction() {
    if (!this.striker) {
      this.predictedStrikerPath = [];
      this.predictedTargetCoinPath = null;
      this.predictedHitCoin = null;
      this.predictedTargetToPocketPath = null;
      return;
    }

    const { strikerPath, targetCoinPath, hitCoin, targetToPocketPath } = PhysicsEngine.calculateTrajectory(
      this.striker.x,
      this.striker.y,
      this.aimAngle,
      this.aimPower,
      this.coins,
      this.rules.aimAssist || 'LOW'
    );

    this.predictedStrikerPath = strikerPath;
    this.predictedTargetCoinPath = targetCoinPath;
    this.predictedHitCoin = hitCoin;
    this.predictedTargetToPocketPath = targetToPocketPath;
  }

  /**
   * Executes the shot: applies impulse to the striker and starts physics
   */
  public shoot(): boolean {
    if ((this.status !== 'POSITIONING' && this.status !== 'AIMING') || !this.striker) {
      return false;
    }

    // Micro-shot prevention: do not shoot if power is below 5%
    if (this.aimPower < 5) {
      this.cancelAim();
      return false;
    }

    // Check if striker placement overlaps an existing coin on the board
    const overlaps = this.coins.some(c => {
      if (c.pocketed || c.type === 'STRIKER') return false;
      const dx = c.x - this.striker!.x;
      const dy = c.y - this.striker!.y;
      return dx * dx + dy * dy < (STRIKER_RADIUS + c.radius) * (STRIKER_RADIUS + c.radius);
    });

    if (overlaps) {
      this.addNotification('foul', 'Invalid Placement', 'Striker cannot overlap other coins.');
      audio.playFoul();
      return false;
    }

    if (this.timerInterval) clearInterval(this.timerInterval);

    this.status = 'PHYSICS_RUNNING';
    this.pocketedThisShot = [];
    this.strikerPocketedThisShot = false;

    // Convert power (0..100) to calibrated impulse speed
    const minSpeed = 2.8;
    const maxSpeed = 28.5;
    const powerFrac = Math.max(0, Math.min(1, this.aimPower / 100));
    const speed = powerFrac * (maxSpeed - minSpeed) + minSpeed;

    this.striker.vx = Math.cos(this.aimAngle) * speed;
    this.striker.vy = Math.sin(this.aimAngle) * speed;

    audio.playStrikerHit(powerFrac, this.striker.x);
    this.notifyStateChange();
    return true;
  }

  /**
   * Physics frame step: called every animation frame from the canvas loop
   */
  public updatePhysics(dt: number) {
    if (this.status !== 'PHYSICS_RUNNING') return;

    const { pocketedEvents, isAtRest } = PhysicsEngine.step(this.coins, this.striker, dt);

    for (const evt of pocketedEvents) {
      if (evt.coin.type === 'STRIKER') {
        this.strikerPocketedThisShot = true;
      } else {
        this.pocketedThisShot.push(evt.coin);
      }
    }

    if (isAtRest) {
      this.resolveTurnOutcome();
    }
  }

  /**
   * Processes the completed shot outcome using RuleEngine
   */
  private resolveTurnOutcome() {
    this.status = 'RESOLVING_TURN';

    const resolutionResult = RuleEngine.resolveShot(
      this.pocketedThisShot,
      this.strikerPocketedThisShot,
      this.currentPlayer,
      this.players,
      this.coins,
      this.rules,
      this.queenState,
      this.queenPendingCoverSeat
    );

    this.queenState = resolutionResult.newQueenState;
    this.queenPendingCoverSeat = resolutionResult.newQueenPendingCoverSeat;

    const res = resolutionResult.resolution;

    // Display appropriate notification
    if (res.isFoul) {
      this.addNotification('foul', 'Foul!', res.message);
    } else if (res.extraTurn) {
      this.addNotification('extra_turn', 'Extra Turn!', res.message);
      audio.playTurnChange();
    } else if (res.queenReturned) {
      this.addNotification('queen', 'Queen Returned', res.message);
    } else if (res.message && res.message !== 'Turn Passed') {
      this.addNotification('info', res.message);
    }

    if (res.gameOver && res.winner) {
      this.winner = res.winner;
      this.status = 'GAME_OVER';
      this.addNotification('win', `${res.winner.name} Wins!`, `Score: ${res.winner.score} pts`);
      audio.playVictory();

      // Record stats
      const isHumanWin = !res.winner.isAI;
      storage.recordMatchResult(
        isHumanWin,
        res.winner.coinsPocketed,
        this.queenState === 'COVERED' ? 1 : 0,
        res.winner.fouls
      );

      this.notifyStateChange();
      return;
    }

    // Set next player
    this.currentTurnIndex = res.nextSeat;
    this.setupStrikerForCurrentPlayer();
    this.status = 'POSITIONING';
    this.startTurnTimer();
    this.notifyStateChange();

    this.checkAITurn();
  }

  /**
   * Handles AI automated turn execution with natural timing
   */
  private checkAITurn() {
    if (this.status !== 'POSITIONING' && this.status !== 'AIMING') return;
    if (!this.currentPlayer.isAI) return;

    if (this.aiActionTimeout) clearTimeout(this.aiActionTimeout);

    // AI "thinking" delay
    this.aiActionTimeout = setTimeout(() => {
      if (this.status !== 'POSITIONING' && this.status !== 'AIMING') return;

      const decision = AIEngine.calculateShot(
        this.currentPlayer,
        this.players.length,
        this.coins,
        this.currentPlayer.aiDifficulty
      );

      // 1. Move striker along baseline
      this.setStrikerPosition(decision.strikerPos);

      // 2. Aim toward target
      setTimeout(() => {
        if (this.status !== 'POSITIONING' && this.status !== 'AIMING') return;
        this.setAim(decision.angle, decision.power, true);

        // 3. Shoot!
        setTimeout(() => {
          if (this.status !== 'POSITIONING' && this.status !== 'AIMING') return;
          this.shoot();
        }, 550);
      }, 450);
    }, 700);
  }

  private startTurnTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (!this.rules.turnTimerSeconds || this.rules.turnTimerSeconds <= 0) {
      this.turnTimerRemaining = 0;
      return;
    }

    this.turnTimerRemaining = this.rules.turnTimerSeconds;
    this.timerInterval = setInterval(() => {
      if (this.status === 'POSITIONING' || this.status === 'AIMING') {
        this.turnTimerRemaining -= 1;
        if (this.turnTimerRemaining <= 0) {
          clearInterval(this.timerInterval);
          this.handleTurnTimeout();
        }
        this.notifyStateChange();
      }
    }, 1000);
  }

  private handleTurnTimeout() {
    this.addNotification('foul', 'Time Out!', `${this.currentPlayer.name} ran out of time.`);
    audio.playFoul();
    this.currentTurnIndex = (this.currentTurnIndex + 1) % this.players.length;
    this.setupStrikerForCurrentPlayer();
    this.status = 'POSITIONING';
    this.startTurnTimer();
    this.notifyStateChange();
    this.checkAITurn();
  }

  public addNotification(type: GameNotification['type'], title: string, subtitle?: string) {
    const notif: GameNotification = {
      id: `notif_${Date.now()}_${Math.random()}`,
      type,
      title,
      subtitle,
      timestamp: Date.now(),
    };
    this.notifications = [notif, ...this.notifications.slice(0, 3)];
    this.notifyStateChange();

    setTimeout(() => {
      this.notifications = this.notifications.filter(n => n.id !== notif.id);
      this.notifyStateChange();
    }, 3500);
  }

  public pause() {
    if (this.status !== 'GAME_OVER') {
      this.status = 'PAUSED';
      this.notifyStateChange();
    }
  }

  public resume() {
    if (this.status === 'PAUSED') {
      this.status = 'POSITIONING';
      this.notifyStateChange();
      this.checkAITurn();
    }
  }

  /**
   * Serialize game state for online multiplayer synchronization
   */
  public getSnapshot(): any {
    return {
      currentTurnIndex: this.currentTurnIndex,
      status: this.status,
      queenState: this.queenState,
      queenPendingCoverSeat: this.queenPendingCoverSeat,
      coins: this.coins.map(c => ({
        id: c.id,
        type: c.type,
        x: c.x,
        y: c.y,
        vx: c.vx,
        vy: c.vy,
        pocketed: c.pocketed,
      })),
      players: this.players.map(p => ({
        id: p.id,
        score: p.score,
        coinsPocketed: p.coinsPocketed,
        fouls: p.fouls,
      })),
    };
  }

  /**
   * Apply synchronized snapshot from server or peer
   */
  public applySnapshot(snapshot: any) {
    if (!snapshot) return;
    this.currentTurnIndex = snapshot.currentTurnIndex;
    this.queenState = snapshot.queenState;
    this.queenPendingCoverSeat = snapshot.queenPendingCoverSeat;

    if (snapshot.coins && Array.isArray(snapshot.coins)) {
      for (const coinData of snapshot.coins) {
        const existing = this.coins.find(c => c.id === coinData.id);
        if (existing) {
          existing.x = coinData.x;
          existing.y = coinData.y;
          existing.vx = coinData.vx;
          existing.vy = coinData.vy;
          existing.pocketed = coinData.pocketed;
        }
      }
    }

    if (snapshot.players && Array.isArray(snapshot.players)) {
      for (let i = 0; i < snapshot.players.length && i < this.players.length; i++) {
        this.players[i].score = snapshot.players[i].score;
        this.players[i].coinsPocketed = snapshot.players[i].coinsPocketed;
        this.players[i].fouls = snapshot.players[i].fouls;
      }
    }

    this.setupStrikerForCurrentPlayer();
    this.status = 'POSITIONING';
    this.notifyStateChange();
  }

  public cleanup() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.aiActionTimeout) clearTimeout(this.aiActionTimeout);
    this.stateChangeListeners.clear();
  }
}
