export const BOARD_SIZE = 800;
export const FRAME_WIDTH = 48;
export const PLAY_AREA_MIN = FRAME_WIDTH;
export const PLAY_AREA_MAX = BOARD_SIZE - FRAME_WIDTH;

export const POCKET_RADIUS = 32;
export const POCKET_HOLE_RADIUS = 28;

export const COIN_RADIUS = 15;
export const STRIKER_RADIUS = 21;

export const COIN_MASS = 1.0;
export const STRIKER_MASS = 3.2;

export const BOARD_FRICTION = 0.984; // realistic boric powder smooth glide
export const RESTITUTION_COIN_COIN = 0.92;
export const RESTITUTION_WALL = 0.85;
export const MIN_SPEED_THRESHOLD = 0.08;

// 4 Corner Pockets
export const POCKETS = [
  { id: 'TL', x: PLAY_AREA_MIN + 30, y: PLAY_AREA_MIN + 30 },
  { id: 'TR', x: PLAY_AREA_MAX - 30, y: PLAY_AREA_MIN + 30 },
  { id: 'BL', x: PLAY_AREA_MIN + 30, y: PLAY_AREA_MAX - 30 },
  { id: 'BR', x: PLAY_AREA_MAX - 30, y: PLAY_AREA_MAX - 30 },
];

export const CENTER_POINT = { x: 400, y: 400 };
export const CENTER_CIRCLE_RADIUS = 48;
export const CENTER_OUTER_RADIUS = 88;

// Baselines configuration for up to 4 seats
export interface BaselineConfig {
  seat: number;
  // Primary axis ('x' for horizontal baselines, 'y' for vertical baselines)
  axis: 'x' | 'y';
  fixedCoordinate: number; // Y for bottom/top, X for left/right
  min: number;
  max: number;
  circleRadius: number;
  // Forward shooting direction in radians (facing center)
  shootingAngle: number;
}

export const BASELINES: Record<number, BaselineConfig> = {
  // Seat 0: Bottom player (shoots upwards, towards y=0)
  0: {
    seat: 0,
    axis: 'x',
    fixedCoordinate: 636,
    min: 236,
    max: 564,
    circleRadius: 21,
    shootingAngle: -Math.PI / 2, // -90 deg (up)
  },
  // Seat 1 (in 4-player or 3-player, Left player shoots rightwards towards x=800)
  1: {
    seat: 1,
    axis: 'y',
    fixedCoordinate: 164,
    min: 236,
    max: 564,
    circleRadius: 21,
    shootingAngle: 0, // 0 deg (right)
  },
  // Seat 2: Top player (shoots downwards towards y=800)
  2: {
    seat: 2,
    axis: 'x',
    fixedCoordinate: 164,
    min: 236,
    max: 564,
    circleRadius: 21,
    shootingAngle: Math.PI / 2, // 90 deg (down)
  },
  // Seat 3: Right player (shoots leftwards towards x=0)
  3: {
    seat: 3,
    axis: 'y',
    fixedCoordinate: 636,
    min: 236,
    max: 564,
    circleRadius: 21,
    shootingAngle: Math.PI, // 180 deg (left)
  },
};

// Helper for 2-player mode where seat 1 is directly across (Top seat)
export function getBaselineForPlayer(seat: number, totalPlayers: number): BaselineConfig {
  if (totalPlayers === 2) {
    if (seat === 0) return BASELINES[0]; // Bottom
    return BASELINES[2]; // Top
  }
  return BASELINES[seat % 4];
}
