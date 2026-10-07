import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

app.use(express.json());

interface ConnectedPlayer {
  id: string;
  name: string;
  seat: number;
  ready: boolean;
  isHost: boolean;
  ws: WebSocket;
  lastPing: number;
}

interface Room {
  code: string;
  playerCount: number; // 2, 3, or 4
  rules: 'standard' | 'casual';
  boardPoints: number;
  queenRule: 'standard' | 'casual';
  turnTimer: number; // seconds, 0 = none
  status: 'LOBBY' | 'PLAYING' | 'FINISHED';
  players: ConnectedPlayer[];
  gameState?: any;
  createdAt: number;
}

const rooms = new Map<string, Room>();

// Helper to generate a 6-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Clean up stale rooms (older than 2 hours)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > 2 * 60 * 60 * 1000 && room.players.length === 0) {
      rooms.delete(code);
    }
  }
}, 60000);

// API route for health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeRooms: rooms.size });
});

// API route for room query
app.get('/api/rooms/:code', (req, res) => {
  const room = rooms.get(req.params.code.toUpperCase());
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  res.json({
    code: room.code,
    playerCount: room.playerCount,
    status: room.status,
    rules: room.rules,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      ready: p.ready,
      isHost: p.isHost
    }))
  });
});

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcastToRoom(room: Room, message: any, excludeWs?: WebSocket) {
  const payload = JSON.stringify(message);
  for (const p of room.players) {
    if (p.ws !== excludeWs && p.ws.readyState === WebSocket.OPEN) {
      p.ws.send(payload);
    }
  }
}

function getSanitizedRoom(room: Room) {
  return {
    code: room.code,
    playerCount: room.playerCount,
    rules: room.rules,
    boardPoints: room.boardPoints,
    queenRule: room.queenRule,
    turnTimer: room.turnTimer,
    status: room.status,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      seat: p.seat,
      ready: p.ready,
      isHost: p.isHost
    })),
    gameState: room.gameState
  };
}

wss.on('connection', (ws: WebSocket) => {
  let playerRoom: Room | null = null;
  let playerId: string | null = null;

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      switch (data.type) {
        case 'CREATE_ROOM': {
          const code = generateRoomCode();
          const pId = data.playerId || `p_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
          playerId = pId;

          const newRoom: Room = {
            code,
            playerCount: data.playerCount || 2,
            rules: data.rules || 'standard',
            boardPoints: data.boardPoints || 25,
            queenRule: data.queenRule || 'standard',
            turnTimer: data.turnTimer ?? 25,
            status: 'LOBBY',
            players: [],
            createdAt: Date.now()
          };

          const hostPlayer: ConnectedPlayer = {
            id: pId,
            name: data.playerName || 'Player 1',
            seat: 0,
            ready: true,
            isHost: true,
            ws,
            lastPing: Date.now()
          };

          newRoom.players.push(hostPlayer);
          rooms.set(code, newRoom);
          playerRoom = newRoom;

          ws.send(JSON.stringify({
            type: 'ROOM_CREATED',
            room: getSanitizedRoom(newRoom),
            playerId: pId,
            seat: 0
          }));
          break;
        }

        case 'JOIN_ROOM': {
          const targetCode = (data.roomCode || '').toUpperCase().trim();
          const room = rooms.get(targetCode);

          if (!room) {
            ws.send(JSON.stringify({ type: 'ERROR', message: `Room "${targetCode}" not found.` }));
            return;
          }

          if (room.status === 'PLAYING') {
            // Check if player is reconnecting
            const existing = room.players.find(p => p.id === data.playerId);
            if (existing) {
              existing.ws = ws;
              existing.lastPing = Date.now();
              playerRoom = room;
              playerId = existing.id;
              ws.send(JSON.stringify({
                type: 'RECONNECTED',
                room: getSanitizedRoom(room),
                playerId: existing.id,
                seat: existing.seat
              }));
              broadcastToRoom(room, {
                type: 'PLAYER_RECONNECTED',
                player: { id: existing.id, name: existing.name, seat: existing.seat }
              }, ws);
              return;
            }
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Match is already in progress.' }));
            return;
          }

          if (room.players.length >= room.playerCount) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Room is full.' }));
            return;
          }

          const pId = data.playerId || `p_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
          playerId = pId;

          // Find available seat index
          const takenSeats = new Set(room.players.map(p => p.seat));
          let seat = 0;
          while (takenSeats.has(seat) && seat < room.playerCount) {
            seat++;
          }

          const newPlayer: ConnectedPlayer = {
            id: pId,
            name: data.playerName || `Player ${room.players.length + 1}`,
            seat,
            ready: false,
            isHost: false,
            ws,
            lastPing: Date.now()
          };

          room.players.push(newPlayer);
          playerRoom = room;

          ws.send(JSON.stringify({
            type: 'ROOM_JOINED',
            room: getSanitizedRoom(room),
            playerId: pId,
            seat
          }));

          broadcastToRoom(room, {
            type: 'ROOM_UPDATED',
            room: getSanitizedRoom(room)
          }, ws);
          break;
        }

        case 'TOGGLE_READY': {
          if (!playerRoom || !playerId) return;
          const p = playerRoom.players.find(pl => pl.id === playerId);
          if (p) {
            p.ready = !p.ready;
            broadcastToRoom(playerRoom, {
              type: 'ROOM_UPDATED',
              room: getSanitizedRoom(playerRoom)
            });
          }
          break;
        }

        case 'UPDATE_ROOM_SETTINGS': {
          if (!playerRoom || !playerId) return;
          const host = playerRoom.players.find(pl => pl.id === playerId && pl.isHost);
          if (!host) return;

          if (data.playerCount) playerRoom.playerCount = data.playerCount;
          if (data.rules) playerRoom.rules = data.rules;
          if (data.boardPoints !== undefined) playerRoom.boardPoints = data.boardPoints;
          if (data.turnTimer !== undefined) playerRoom.turnTimer = data.turnTimer;

          broadcastToRoom(playerRoom, {
            type: 'ROOM_UPDATED',
            room: getSanitizedRoom(playerRoom)
          });
          break;
        }

        case 'START_GAME': {
          if (!playerRoom || !playerId) return;
          const host = playerRoom.players.find(pl => pl.id === playerId && pl.isHost);
          if (!host) return;

          if (playerRoom.players.length < 2) {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Need at least 2 players to start.' }));
            return;
          }

          playerRoom.status = 'PLAYING';
          playerRoom.gameState = data.initialGameState || null;

          broadcastToRoom(playerRoom, {
            type: 'GAME_STARTED',
            room: getSanitizedRoom(playerRoom),
            initialGameState: data.initialGameState
          });
          break;
        }

        case 'AIM_UPDATE': {
          if (!playerRoom) return;
          broadcastToRoom(playerRoom, {
            type: 'AIM_UPDATE',
            playerId,
            seat: data.seat,
            strikerX: data.strikerX,
            angle: data.angle,
            power: data.power,
            aiming: data.aiming
          }, ws);
          break;
        }

        case 'SHOOT_EVENT': {
          if (!playerRoom) return;
          broadcastToRoom(playerRoom, {
            type: 'SHOOT_EVENT',
            playerId,
            seat: data.seat,
            strikerX: data.strikerX,
            angle: data.angle,
            power: data.power,
            impulseX: data.impulseX,
            impulseY: data.impulseY
          }, ws);
          break;
        }

        case 'SYNC_STATE': {
          if (!playerRoom) return;
          playerRoom.gameState = data.gameState;
          broadcastToRoom(playerRoom, {
            type: 'STATE_SYNCED',
            gameState: data.gameState,
            reason: data.reason
          }, ws);
          break;
        }

        case 'CHAT_MESSAGE': {
          if (!playerRoom) return;
          const sender = playerRoom.players.find(p => p.id === playerId);
          broadcastToRoom(playerRoom, {
            type: 'CHAT_MESSAGE',
            sender: sender?.name || 'Player',
            seat: sender?.seat ?? 0,
            message: String(data.message).slice(0, 80)
          });
          break;
        }

        case 'REMATCH_VOTE': {
          if (!playerRoom) return;
          broadcastToRoom(playerRoom, {
            type: 'REMATCH_VOTE',
            playerId
          });
          break;
        }

        case 'PING': {
          ws.send(JSON.stringify({ type: 'PONG' }));
          break;
        }
      }
    } catch (err) {
      console.error('WebSocket message parsing error:', err);
    }
  });

  ws.on('close', () => {
    if (playerRoom && playerId) {
      const idx = playerRoom.players.findIndex(p => p.id === playerId);
      if (idx !== -1) {
        const leaving = playerRoom.players[idx];
        if (playerRoom.status === 'LOBBY') {
          playerRoom.players.splice(idx, 1);
          if (playerRoom.players.length === 0) {
            rooms.delete(playerRoom.code);
          } else {
            // Reassign host if host left
            if (leaving.isHost && playerRoom.players.length > 0) {
              playerRoom.players[0].isHost = true;
            }
            broadcastToRoom(playerRoom, {
              type: 'ROOM_UPDATED',
              room: getSanitizedRoom(playerRoom),
              message: `${leaving.name} left the room.`
            });
          }
        } else {
          // In game: notify disconnect
          broadcastToRoom(playerRoom, {
            type: 'PLAYER_DISCONNECTED',
            playerId,
            name: leaving.name,
            seat: leaving.seat
          });
        }
      }
    }
  });
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  server.listen(port, () => {
    console.log(`Carrom game server running on port ${port}`);
  });
}

startServer();
