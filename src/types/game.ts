export type GameMode = 'LOCAL' | 'AI' | 'ONLINE';

export type AIDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type CoinType = 'WHITE' | 'BLACK' | 'QUEEN' | 'STRIKER';

export type PlayerColor = string;

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  seat: number; // 0: Bottom, 1: Top (or Left in 3/4P), 2: Top, 3: Right
  assignedCoinType?: 'WHITE' | 'BLACK' | 'ANY'; // in standard 2-player or points
  score: number;
  coinsPocketed: number;
  fouls: number;
  isAI: boolean;
  aiDifficulty?: AIDifficulty;
  isReady: boolean;
  isHost?: boolean;
}

export interface Coin {
  id: string;
  type: CoinType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  rotation?: number;
  angularVelocity?: number;
  pocketed: boolean;
  sinking?: boolean;
  sinkProgress?: number; // 0 to 1 for drop animation
  sinkTargetPocket?: { x: number; y: number };
}

export type QueenState = 
  | 'CENTER'          // In the center or playing field
  | 'POCKETED_UNCOVERED' // Pocketed by a player, awaiting cover coin
  | 'COVERED'         // Successfully covered and claimed
  | 'RETURNED';       // Returned to center after failed cover

export interface MatchRules {
  ruleType: 'standard' | 'casual'; // standard: white/black assignment; casual: points-based
  boardPointsToWin: number;       // default 25
  maxTurns: number;              // 0 for unlimited
  queenPoints: number;           // 3 in standard, 25 in casual/points
  whitePoints: number;           // 1 in standard, 10 in casual
  blackPoints: number;           // 1 in standard, 5 in casual
  strikerFoulPenalty: number;    // -1 pt or return 1 pocketed coin
  queenMustCover: boolean;       // true in standard
  turnTimerSeconds: number;      // 0 = off, 15, 25, 45
  aimAssist?: 'OFF' | 'LOW' | 'HIGH';
}

export type MatchStatus = 
  | 'INITIAL'
  | 'POSITIONING'
  | 'AIMING'
  | 'SHOOTING'
  | 'PHYSICS_RUNNING'
  | 'RESOLVING_TURN'
  | 'GAME_OVER'
  | 'PAUSED';

export interface ShotEvent {
  strikerX: number;
  strikerY: number;
  impulseX: number;
  impulseY: number;
  power: number;
  angle: number;
}

export interface GameStats {
  matchesPlayed: number;
  matchesWon: number;
  coinsPocketed: number;
  queensCovered: number;
  foulsCommitted: number;
}

export interface OnlineRoomState {
  code: string;
  playerCount: number;
  rules: 'standard' | 'casual';
  boardPoints: number;
  queenRule: 'standard' | 'casual';
  turnTimer: number;
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  players: {
    id: string;
    name: string;
    seat: number;
    ready: boolean;
    isHost: boolean;
  }[];
}
