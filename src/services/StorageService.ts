import { GameStats } from '../types/game';

const STATS_KEY = 'carrom_user_stats';
const PREFS_KEY = 'carrom_user_preferences';

export interface UserPreferences {
  playerName: string;
  theme: 'classic' | 'tournament' | 'midnight';
  showAimLine: boolean;
  showTrajectoryPrediction: boolean;
  dragSensitivity: number;
}

const defaultStats: GameStats = {
  matchesPlayed: 0,
  matchesWon: 0,
  coinsPocketed: 0,
  queensCovered: 0,
  foulsCommitted: 0,
};

const defaultPrefs: UserPreferences = {
  playerName: 'Player 1',
  theme: 'classic',
  showAimLine: true,
  showTrajectoryPrediction: true,
  dragSensitivity: 1.0,
};

class StorageService {
  public getStats(): GameStats {
    try {
      const data = localStorage.getItem(STATS_KEY);
      if (data) return { ...defaultStats, ...JSON.parse(data) };
    } catch (e) {}
    return defaultStats;
  }

  public recordMatchResult(won: boolean, coins: number, queens: number, fouls: number) {
    const stats = this.getStats();
    stats.matchesPlayed += 1;
    if (won) stats.matchesWon += 1;
    stats.coinsPocketed += coins;
    stats.queensCovered += queens;
    stats.foulsCommitted += fouls;

    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) {}
  }

  public getPreferences(): UserPreferences {
    try {
      const data = localStorage.getItem(PREFS_KEY);
      if (data) return { ...defaultPrefs, ...JSON.parse(data) };
    } catch (e) {}
    return defaultPrefs;
  }

  public savePreferences(prefs: Partial<UserPreferences>) {
    const current = this.getPreferences();
    const updated = { ...current, ...prefs };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(updated));
    } catch (e) {}
  }
}

export const storage = new StorageService();
