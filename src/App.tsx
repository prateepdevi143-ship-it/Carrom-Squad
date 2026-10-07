/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useReducer, useRef } from 'react';
import { GameEngine } from './game/GameEngine';
import { GameMode, AIDifficulty, MatchRules, OnlineRoomState } from './types/game';
import { multiplayer } from './services/MultiplayerService';
import { audio } from './services/AudioService';
import { storage } from './services/StorageService';

import { MainMenu } from './components/MainMenu/MainMenu';
import { SetupScreen } from './components/Setup/SetupScreen';
import { OnlineLobby } from './components/Lobby/OnlineLobby';
import { CarromBoard } from './components/Board/CarromBoard';
import { GameHUD } from './components/HUD/GameHUD';
import { StrikerControls } from './components/HUD/StrikerControls';
import { FoulBanner } from './components/HUD/FoulBanner';
import { PauseModal } from './components/Modals/PauseModal';
import { GameOverModal } from './components/Modals/GameOverModal';
import { HowToPlayModal } from './components/Modals/HowToPlayModal';
import { SettingsModal } from './components/Modals/SettingsModal';

type AppScreen = 'MENU' | 'SETUP' | 'GAME' | 'ONLINE_LOBBY';

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('MENU');
  const [setupMode, setSetupMode] = useState<GameMode>('LOCAL');

  // Dynamic viewport, orientation, and board sizing
  const [boardPixelSize, setBoardPixelSize] = useState<number>(540);
  const [isLandscapeCompact, setIsLandscapeCompact] = useState<boolean>(false);

  // Engine instance held in ref
  const engineRef = useRef<GameEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new GameEngine();
  }
  const engine = engineRef.current;

  // Force re-render hook on game state updates
  const [, forceUpdate] = useReducer((x) => x + 1, 0);

  // Modals & Settings
  const [isPauseOpen, setIsPauseOpen] = useState<boolean>(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(audio.isSoundEnabled());
  const [theme, setTheme] = useState<'classic' | 'tournament' | 'midnight'>('classic');
  const [showAimLine, setShowAimLine] = useState<boolean>(true);
  const [turnTimerSetting, setTurnTimerSetting] = useState<number>(25);

  // Subscribe to engine state mutations
  useEffect(() => {
    const unsub = engine.subscribe(() => {
      forceUpdate();
    });
    return unsub;
  }, [engine]);

  // Load saved preferences on mount
  useEffect(() => {
    const prefs = storage.getPreferences();
    setTheme(prefs.theme || 'classic');
    setShowAimLine(prefs.showAimLine !== false);
  }, []);

  // Responsive Dynamic Viewport Sizing — strictly guarantees ZERO SCROLLING in gameplay
  useEffect(() => {
    const calculateLayout = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Mobile / Compact Landscape detection: wide aspect with limited vertical space
      const isShortLandscape = w > h && h < 560;
      setIsLandscapeCompact(isShortLandscape);

      if (isShortLandscape) {
        // Landscape 3-Column Docked Layout
        // Left HUD (~110-130px) | Center Board | Right Controls (~125-145px)
        const leftW = w < 620 ? 110 : 130;
        const rightW = w < 620 ? 125 : 145;
        const reservedW = leftW + rightW + 16;
        const availableW = Math.max(160, w - reservedW);
        const availableH = Math.max(160, h - 14);

        const calculatedSize = Math.floor(Math.min(availableW, availableH, 740));
        setBoardPixelSize(calculatedSize);
      } else {
        // Standard Vertical Stack Layout (Mobile Portrait, Tablets, Laptops, Desktops, Ultrawide)
        // Heights: HUD ~40-44px, Controls ~74-78px, Margins & paddings ~14px
        const verticalReserved = 130;
        const horizontalReserved = 16;

        const maxAvailableH = Math.max(180, h - verticalReserved);
        const maxAvailableW = Math.max(180, w - horizontalReserved);

        const calculatedSize = Math.floor(Math.min(maxAvailableW, maxAvailableH, 740));
        setBoardPixelSize(calculatedSize);
      }
    };

    calculateLayout();
    window.addEventListener('resize', calculateLayout);
    window.addEventListener('orientationchange', calculateLayout);
    return () => {
      window.removeEventListener('resize', calculateLayout);
      window.removeEventListener('orientationchange', calculateLayout);
    };
  }, []);

  // Online Multiplayer Network Sync Listeners
  useEffect(() => {
    if (engine.mode !== 'ONLINE') return;

    const unsubAim = multiplayer.on('AIM_UPDATE', (data) => {
      if (data.seat !== multiplayer.mySeat) {
        engine.setStrikerPosition(data.strikerX);
        engine.setAim(data.angle, data.power, data.aiming);
      }
    });

    const unsubShoot = multiplayer.on('SHOOT_EVENT', (data) => {
      if (data.seat !== multiplayer.mySeat) {
        engine.setStrikerPosition(data.strikerX);
        engine.setAim(data.angle, data.power, true);
        engine.shoot();
      }
    });

    const unsubSync = multiplayer.on('STATE_SYNCED', (data) => {
      if (!multiplayer.isHost) {
        engine.applySnapshot(data.gameState);
      }
    });

    const unsubDisconnect = multiplayer.on('PLAYER_DISCONNECTED', (data) => {
      engine.addNotification('info', 'Player Disconnected', `${data.name} disconnected. Reconnect grace active.`);
    });

    return () => {
      unsubAim();
      unsubShoot();
      unsubSync();
      unsubDisconnect();
    };
  }, [engine, engine.mode]);

  // Keyboard Shortcuts for desktop play
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (screen !== 'GAME' || isPauseOpen || isSettingsOpen || isHowToPlayOpen) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (!engine.currentPlayer.isAI && engine.status !== 'PHYSICS_RUNNING') {
          handleShotFired();
        }
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        engine.setStrikerPosition(engine.strikerBaselinePos - 10);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        engine.setStrikerPosition(engine.strikerBaselinePos + 10);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        engine.setAim(engine.aimAngle, Math.min(100, engine.aimPower + 5), true);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        engine.setAim(engine.aimAngle, Math.max(10, engine.aimPower - 5), true);
      } else if (e.code === 'Escape' || e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        if (engine.isAiming && engine.status === 'AIMING') {
          engine.cancelAim();
        } else {
          setIsPauseOpen(true);
          engine.pause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [screen, isPauseOpen, isSettingsOpen, isHowToPlayOpen, engine]);

  // Match setup handlers
  const handleStartLocalMatch = (
    players: { name: string; color: string; isAI: boolean; aiDifficulty?: AIDifficulty }[],
    rules: Partial<MatchRules>
  ) => {
    engine.startMatch(players, 'LOCAL', rules);
    setScreen('GAME');
  };

  const handleStartAIMatch = (
    players: { name: string; color: string; isAI: boolean; aiDifficulty?: AIDifficulty }[],
    rules: Partial<MatchRules>
  ) => {
    engine.startMatch(players, 'AI', rules);
    setScreen('GAME');
  };

  const handleStartOnlineMatch = (roomState: OnlineRoomState) => {
    const colors = ['#f59e0b', '#06b6d4', '#ec4899', '#10b981'];
    const playerConfigs = roomState.players.map((p) => ({
      name: p.name,
      color: colors[p.seat % colors.length],
      isAI: false,
    }));

    engine.startMatch(playerConfigs, 'ONLINE', {
      ruleType: roomState.rules,
      boardPointsToWin: roomState.boardPoints,
      turnTimerSeconds: roomState.turnTimer,
    });
    setScreen('GAME');
  };

  const handleShotFired = () => {
    const fired = engine.status === 'PHYSICS_RUNNING' ? true : engine.shoot();
    if (fired && engine.mode === 'ONLINE') {
      multiplayer.sendShootEvent(
        engine.strikerBaselinePos,
        engine.aimAngle,
        engine.aimPower,
        engine.striker?.vx || 0,
        engine.striker?.vy || 0
      );
    }
  };

  const handleToggleSound = () => {
    const next = !soundEnabled;
    audio.setSoundEnabled(next);
    setSoundEnabled(next);
  };

  const handleThemeChange = (newTheme: 'classic' | 'tournament' | 'midnight') => {
    setTheme(newTheme);
    storage.savePreferences({ theme: newTheme });
  };

  const handleToggleAimLine = () => {
    const next = !showAimLine;
    setShowAimLine(next);
    storage.savePreferences({ showAimLine: next });
  };

  const handleTurnTimerChange = (sec: number) => {
    setTurnTimerSetting(sec);
    engine.rules.turnTimerSeconds = sec;
  };

  const isGameOverOpen = engine.status === 'GAME_OVER' && engine.winner !== null;

  return (
    <div
      className={`w-full h-full bg-stone-950 text-stone-100 flex flex-col font-sans select-none antialiased ${
        screen === 'GAME' ? 'game-screen' : 'overflow-y-auto overflow-x-hidden'
      }`}
    >
      {/* SCREEN 1: MAIN MENU */}
      {screen === 'MENU' && (
        <MainMenu
          onStartLocal={() => {
            setSetupMode('LOCAL');
            setScreen('SETUP');
          }}
          onStartAI={() => {
            setSetupMode('AI');
            setScreen('SETUP');
          }}
          onStartOnline={() => {
            setScreen('ONLINE_LOBBY');
          }}
          onHowToPlay={() => setIsHowToPlayOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}

      {/* SCREEN 2: GAME SETUP */}
      {screen === 'SETUP' && (
        <SetupScreen
          mode={setupMode}
          onBack={() => setScreen('MENU')}
          onStartMatch={setupMode === 'AI' ? handleStartAIMatch : handleStartLocalMatch}
        />
      )}

      {/* SCREEN 3: ONLINE MULTIPLAYER LOBBY */}
      {screen === 'ONLINE_LOBBY' && (
        <OnlineLobby
          onBack={() => setScreen('MENU')}
          onStartOnlineMatch={handleStartOnlineMatch}
        />
      )}

      {/* SCREEN 4: ACTIVE CARROM MATCH VIEW */}
      {screen === 'GAME' && (
        <>
          {isLandscapeCompact ? (
            /* DOCKED 3-COLUMN LANDSCAPE LAYOUT (For Mobile Landscape: e.g. 568x320, 640x360, 844x390, 932x430) */
            <div className="relative w-full h-full flex items-center justify-between p-1.5 sm:p-2 overflow-hidden gap-1.5 sm:gap-2">
              {/* Left Column: Sidebar HUD */}
              <div className="w-[110px] sm:w-[130px] h-full shrink-0">
                <GameHUD
                  engine={engine}
                  layout="sidebar"
                  onPause={() => {
                    engine.pause();
                    setIsPauseOpen(true);
                  }}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  soundEnabled={soundEnabled}
                  onToggleSound={handleToggleSound}
                />
              </div>

              {/* Center Column: Notification Banner & Carrom Board Canvas */}
              <div className="flex-1 h-full flex flex-col items-center justify-center min-w-0 min-h-0 relative overflow-hidden">
                <FoulBanner notifications={engine.notifications} />
                <CarromBoard
                  engine={engine}
                  boardPixelSize={boardPixelSize}
                  theme={theme}
                  showAimLine={showAimLine}
                  interactive={
                    engine.mode !== 'ONLINE' || engine.currentPlayer.seat === multiplayer.mySeat
                  }
                  onShotFired={handleShotFired}
                />
              </div>

              {/* Right Column: Sidebar Striker Controls */}
              <div className="w-[125px] sm:w-[145px] h-full shrink-0">
                <StrikerControls
                  engine={engine}
                  layout="sidebar"
                  onShotFired={handleShotFired}
                />
              </div>
            </div>
          ) : (
            /* STANDARD VERTICAL STACK LAYOUT (Portrait Mobile, Tablets, Laptops, Desktops, Ultrawide) */
            <div className="relative w-full h-full flex flex-col justify-between p-1 sm:p-2.5 max-w-5xl mx-auto overflow-hidden">
              {/* Top HUD */}
              <div className="w-full shrink-0">
                <GameHUD
                  engine={engine}
                  layout="standard"
                  onPause={() => {
                    engine.pause();
                    setIsPauseOpen(true);
                  }}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  soundEnabled={soundEnabled}
                  onToggleSound={handleToggleSound}
                />
              </div>

              {/* Floating Foul / Event Notification */}
              <FoulBanner notifications={engine.notifications} />

              {/* Center Carrom Board Canvas */}
              <div className="flex-1 flex items-center justify-center my-auto min-h-0 min-w-0 overflow-hidden">
                <CarromBoard
                  engine={engine}
                  boardPixelSize={boardPixelSize}
                  theme={theme}
                  showAimLine={showAimLine}
                  interactive={
                    engine.mode !== 'ONLINE' || engine.currentPlayer.seat === multiplayer.mySeat
                  }
                  onShotFired={handleShotFired}
                />
              </div>

              {/* Bottom Shooting & Striker Control Bar */}
              <div className="w-full shrink-0 pt-0.5">
                <StrikerControls
                  engine={engine}
                  layout="standard"
                  onShotFired={handleShotFired}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* MODALS */}
      <PauseModal
        isOpen={isPauseOpen}
        onResume={() => {
          setIsPauseOpen(false);
          engine.resume();
        }}
        onRestart={() => {
          setIsPauseOpen(false);
          engine.resetMatch();
        }}
        onOpenSettings={() => {
          setIsSettingsOpen(true);
        }}
        onQuit={() => {
          setIsPauseOpen(false);
          setScreen('MENU');
        }}
      />

      <GameOverModal
        isOpen={isGameOverOpen}
        winner={engine.winner}
        players={engine.players}
        queenState={engine.queenState}
        onRematch={() => {
          engine.startMatch(
            engine.players.map((p) => ({
              name: p.name,
              color: p.color,
              isAI: p.isAI,
              aiDifficulty: p.aiDifficulty,
            })),
            engine.mode,
            engine.rules
          );
        }}
        onNewGame={() => {
          setScreen('SETUP');
        }}
        onMainMenu={() => {
          setScreen('MENU');
        }}
      />

      <HowToPlayModal
        isOpen={isHowToPlayOpen}
        onClose={() => setIsHowToPlayOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onThemeChange={handleThemeChange}
        showAimLine={showAimLine}
        onToggleAimLine={handleToggleAimLine}
        turnTimer={turnTimerSetting}
        onTurnTimerChange={handleTurnTimerChange}
      />
    </div>
  );
}
