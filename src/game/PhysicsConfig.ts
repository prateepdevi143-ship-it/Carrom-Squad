/**
 * Centralized Physics Configuration for Carrom Clash
 * Configurable parameters for simulation accuracy and feel
 */

export interface PhysicsParameters {
  friction: number;            // Surface glide deceleration factor per frame (0.985 realistic boric powder)
  restitution: number;         // Coin-to-coin elasticity (0.92 = realistic wood/acrylic bounce)
  coinMass: number;            // Normalized mass of carrom coin
  strikerMass: number;         // Heavier striker mass (~3.2x coin mass for momentum transfer)
  wallRestitution: number;     // Cushion wooden rail rebound factor
  rollingResistance: number;   // Angular/micro drag factor
  pocketRadius: number;        // Pocket entrance trigger zone
  pocketHoleRadius: number;    // Dark inner cavity radius where coin drops
  pocketGravitationalPull: number; // Subtle pull once inside pocket threshold
  stopVelocity: number;        // Velocity below which pieces come to rest
  maxImpulseSpeed: number;     // Striker maximum launch speed (calibrated)
  minImpulseSpeed: number;     // Minimum tap speed
}

export const PHYSICS_CONFIG: PhysicsParameters = {
  friction: 0.985,
  restitution: 0.92,
  coinMass: 1.0,
  strikerMass: 3.2,
  wallRestitution: 0.86,
  rollingResistance: 0.992,
  pocketRadius: 34,
  pocketHoleRadius: 28,
  pocketGravitationalPull: 0.45,
  stopVelocity: 0.075,
  maxImpulseSpeed: 28.0,
  minImpulseSpeed: 4.5,
};
