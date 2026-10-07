import { OnlineRoomState } from '../types/game';

type MessageHandler = (data: any) => void;

class MultiplayerService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private currentRoomCode: string | null = null;
  public playerId: string = '';
  public playerName: string = 'Player 1';
  public mySeat: number = 0;
  public isHost: boolean = false;
  public connected: boolean = false;

  constructor() {
    // Generate or retrieve persistent player ID for session
    let savedId = sessionStorage.getItem('carrom_multiplayer_player_id');
    if (!savedId) {
      savedId = `p_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      sessionStorage.setItem('carrom_multiplayer_player_id', savedId);
    }
    this.playerId = savedId;
  }

  public connect(): Promise<boolean> {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('CONNECTED', {});
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleIncoming(data);
          } catch (e) {
            console.error('Failed to parse WS message:', e);
          }
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.emit('DISCONNECTED', {});
          this.attemptReconnect();
        };

        this.ws.onerror = (err) => {
          console.warn('WebSocket connection error:', err);
          resolve(false);
        };
      } catch (err) {
        console.warn('WebSocket init exception:', err);
        resolve(false);
      }
    });
  }

  private attemptReconnect() {
    if (this.currentRoomCode && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(5000, 1000 * Math.pow(1.5, this.reconnectAttempts));
      setTimeout(() => {
        this.connect().then((ok) => {
          if (ok && this.currentRoomCode) {
            this.send({
              type: 'JOIN_ROOM',
              roomCode: this.currentRoomCode,
              playerId: this.playerId,
              playerName: this.playerName,
            });
          }
        });
      }, delay);
    }
  }

  public on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off(event: string, handler: MessageHandler) {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, data: any) {
    const list = this.handlers.get(event);
    if (list) {
      list.forEach((cb) => cb(data));
    }
  }

  private handleIncoming(data: any) {
    if (data.type === 'ROOM_CREATED' || data.type === 'ROOM_JOINED') {
      this.currentRoomCode = data.room.code;
      this.mySeat = data.seat;
      this.isHost = data.room.players.some((p: any) => p.id === this.playerId && p.isHost);
    }

    this.emit(data.type, data);
  }

  public send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      this.connect().then((ok) => {
        if (ok && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(data));
        }
      });
    }
  }

  public createRoom(
    playerName: string,
    playerCount: number = 2,
    rules: 'standard' | 'casual' = 'standard',
    turnTimer: number = 25
  ) {
    this.playerName = playerName;
    this.send({
      type: 'CREATE_ROOM',
      playerId: this.playerId,
      playerName,
      playerCount,
      rules,
      turnTimer,
    });
  }

  public joinRoom(roomCode: string, playerName: string) {
    this.playerName = playerName;
    this.currentRoomCode = roomCode.toUpperCase().trim();
    this.send({
      type: 'JOIN_ROOM',
      roomCode: this.currentRoomCode,
      playerId: this.playerId,
      playerName,
    });
  }

  public toggleReady() {
    this.send({ type: 'TOGGLE_READY' });
  }

  public updateRoomSettings(settings: Partial<OnlineRoomState>) {
    this.send({
      type: 'UPDATE_ROOM_SETTINGS',
      ...settings,
    });
  }

  public startGame(initialGameState?: any) {
    this.send({
      type: 'START_GAME',
      initialGameState,
    });
  }

  public sendAimUpdate(strikerX: number, angle: number, power: number, aiming: boolean) {
    this.send({
      type: 'AIM_UPDATE',
      seat: this.mySeat,
      strikerX,
      angle,
      power,
      aiming,
    });
  }

  public sendShootEvent(strikerX: number, angle: number, power: number, impulseX: number, impulseY: number) {
    this.send({
      type: 'SHOOT_EVENT',
      seat: this.mySeat,
      strikerX,
      angle,
      power,
      impulseX,
      impulseY,
    });
  }

  public syncGameState(gameState: any, reason?: string) {
    this.send({
      type: 'SYNC_STATE',
      gameState,
      reason,
    });
  }

  public sendChatMessage(message: string) {
    this.send({
      type: 'CHAT_MESSAGE',
      message,
    });
  }

  public leaveRoom() {
    this.currentRoomCode = null;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}

export const multiplayer = new MultiplayerService();
