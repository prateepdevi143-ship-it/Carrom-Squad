import React, { useState, useEffect } from 'react';
import { multiplayer } from '../../services/MultiplayerService';
import { OnlineRoomState } from '../../types/game';
import { ArrowLeft, Copy, Check, Users, Play, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';

interface OnlineLobbyProps {
  onBack: () => void;
  onStartOnlineMatch: (roomState: OnlineRoomState) => void;
}

export const OnlineLobby: React.FC<OnlineLobbyProps> = ({ onBack, onStartOnlineMatch }) => {
  const [view, setView] = useState<'CHOICE' | 'LOBBY'>('CHOICE');
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [playerNameInput, setPlayerNameInput] = useState<string>('Player 1');
  const [playerCountSelect, setPlayerCountSelect] = useState<number>(2);
  const [rulesSelect, setRulesSelect] = useState<'standard' | 'casual'>('standard');
  const [currentRoom, setCurrentRoom] = useState<OnlineRoomState | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<{ sender: string; message: string }[]>([]);

  useEffect(() => {
    multiplayer.connect();

    const unsubCreated = multiplayer.on('ROOM_CREATED', (data) => {
      setCurrentRoom(data.room);
      setView('LOBBY');
      setErrorMsg(null);
    });

    const unsubJoined = multiplayer.on('ROOM_JOINED', (data) => {
      setCurrentRoom(data.room);
      setView('LOBBY');
      setErrorMsg(null);
    });

    const unsubUpdated = multiplayer.on('ROOM_UPDATED', (data) => {
      setCurrentRoom(data.room);
    });

    const unsubStarted = multiplayer.on('GAME_STARTED', (data) => {
      onStartOnlineMatch(data.room);
    });

    const unsubError = multiplayer.on('ERROR', (data) => {
      setErrorMsg(data.message);
    });

    const unsubChat = multiplayer.on('CHAT_MESSAGE', (data) => {
      setChatMessages((prev) => [...prev.slice(-15), { sender: data.sender, message: data.message }]);
    });

    return () => {
      unsubCreated();
      unsubJoined();
      unsubUpdated();
      unsubStarted();
      unsubError();
      unsubChat();
    };
  }, [onStartOnlineMatch]);

  const handleCreateRoom = () => {
    setErrorMsg(null);
    multiplayer.createRoom(playerNameInput, playerCountSelect, rulesSelect);
  };

  const handleJoinRoom = () => {
    if (!roomCodeInput.trim()) {
      setErrorMsg('Please enter a 6-character room code.');
      return;
    }
    setErrorMsg(null);
    multiplayer.joinRoom(roomCodeInput, playerNameInput);
  };

  const handleToggleReady = () => {
    multiplayer.toggleReady();
  };

  const handleStartGame = () => {
    if (!currentRoom) return;
    if (currentRoom.players.length < 2) {
      setErrorMsg('Need at least 2 players to start the match.');
      return;
    }
    multiplayer.startGame();
  };

  const handleCopyCode = () => {
    if (!currentRoom) return;
    navigator.clipboard.writeText(currentRoom.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    multiplayer.sendChatMessage(chatInput.trim());
    setChatInput('');
  };

  return (
    <div className="menu-screen w-full min-h-[100dvh] flex flex-col items-center justify-start sm:justify-center p-2.5 sm:p-6 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-md space-y-4 sm:space-y-5 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-2.5">
          <button
            type="button"
            onClick={() => {
              if (view === 'LOBBY') {
                multiplayer.leaveRoom();
                setView('CHOICE');
              } else {
                onBack();
              }
            }}
            className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 font-medium transition-colors min-h-[38px] px-1"
          >
            <ArrowLeft className="w-4 h-4" /> {view === 'LOBBY' ? 'Leave Room' : 'Back'}
          </button>
          <div className="text-right">
            <h2 className="font-display font-extrabold text-sm sm:text-lg text-stone-100 tracking-wide">
              ONLINE MULTIPLAYER
            </h2>
            <p className="text-[10px] sm:text-[11px] text-stone-400">Play real-time with friends</p>
          </div>
        </div>

        {/* Error Callout */}
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {view === 'CHOICE' ? (
          <div className="space-y-4">
            {/* Player Name Input */}
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-400">
                Your Player Name
              </label>
              <input
                type="text"
                maxLength={16}
                value={playerNameInput}
                onChange={(e) => setPlayerNameInput(e.target.value)}
                placeholder="Enter display name"
                className="w-full bg-stone-950/70 border border-stone-800 text-stone-100 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            {/* Split Grid: Create Room vs Join Room */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* CREATE ROOM CARD */}
              <div className="bg-stone-950/50 border border-stone-800/80 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
                <div className="space-y-2.5">
                  <div className="font-display font-bold text-stone-100 text-xs sm:text-sm flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-amber-400" /> CREATE ROOM
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-stone-400">
                    Host a new match and invite opponents using a 6-character room code.
                  </p>

                  <div>
                    <label className="text-[10px] font-semibold text-stone-400 block mb-1">
                      Player Count
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {[2, 3, 4].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setPlayerCountSelect(cnt)}
                          className={`py-1 text-xs rounded-lg border font-medium ${
                            playerCountSelect === cnt
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                              : 'bg-stone-900 border-stone-800 text-stone-400'
                          }`}
                        >
                          {cnt}P
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-stone-400 block mb-1">
                      Rule Set
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                      {['standard', 'casual'].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRulesSelect(r as any)}
                          className={`py-1 text-xs rounded-lg border font-medium capitalize ${
                            rulesSelect === r
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                              : 'bg-stone-900 border-stone-800 text-stone-400'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCreateRoom}
                  className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-display font-bold text-xs tracking-wider transition-colors shadow-md shadow-amber-950/30 min-h-[40px]"
                >
                  CREATE ROOM
                </button>
              </div>

              {/* JOIN ROOM CARD */}
              <div className="bg-stone-950/50 border border-stone-800/80 rounded-xl p-3.5 flex flex-col justify-between space-y-3">
                <div className="space-y-2.5">
                  <div className="font-display font-bold text-stone-100 text-xs sm:text-sm flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4 text-emerald-400" /> JOIN ROOM
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-stone-400">
                    Enter an existing 6-character room code shared by a friend.
                  </p>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-stone-400 block">
                      Room Code
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={roomCodeInput}
                      onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                      placeholder="e.g. ABX7K9"
                      className="w-full bg-stone-900 border border-stone-800 text-stone-100 font-mono font-bold tracking-widest text-center text-sm rounded-xl py-2 uppercase focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleJoinRoom}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-stone-100 font-display font-bold text-xs tracking-wider transition-colors shadow-md shadow-emerald-950/30 min-h-[40px]"
                >
                  JOIN MATCH
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ROOM LOBBY VIEW */
          currentRoom && (
            <div className="space-y-4">
              {/* Room Code Display Box */}
              <div className="bg-stone-950/70 border border-stone-800 rounded-xl p-3 sm:p-4 flex items-center justify-between">
                <div>
                  <div className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    Room Code
                  </div>
                  <div className="text-xl sm:text-2xl font-display font-black text-amber-400 tracking-widest mt-0.5">
                    {currentRoom.code}
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-stone-400 mt-0.5">Share this code with your friends.</p>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-200 text-xs font-semibold border border-stone-700/60 transition-colors min-h-[38px]"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              {/* Player Slots */}
              <div className="space-y-1.5">
                <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center justify-between">
                  <span>Players ({currentRoom.players.length}/{currentRoom.playerCount})</span>
                  <span className="text-stone-400 text-[10px] sm:text-[11px] font-normal capitalize">
                    {currentRoom.rules} Rules
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {Array.from({ length: currentRoom.playerCount }).map((_, slotIdx) => {
                    const player = currentRoom.players.find((p) => p.seat === slotIdx);
                    return (
                      <div
                        key={slotIdx}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                          player
                            ? 'bg-stone-950/60 border-stone-800 text-stone-200'
                            : 'bg-stone-950/20 border-dashed border-stone-800/60 text-stone-500'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[10px] font-bold text-stone-500">
                            #{slotIdx + 1}
                          </span>
                          <span className="font-medium truncate max-w-[100px] sm:max-w-[120px]">
                            {player ? player.name : 'Waiting for player...'}
                          </span>
                          {player?.isHost && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1 rounded font-semibold shrink-0">
                              HOST
                            </span>
                          )}
                        </div>

                        {player ? (
                          <span
                            className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                              player.ready
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                                : 'bg-stone-800 text-stone-400'
                            }`}
                          >
                            {player.ready ? '✓ Ready' : 'Not Ready'}
                          </span>
                        ) : (
                          <span className="text-[10px] text-stone-500 italic shrink-0">Empty</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Chat in Lobby */}
              <div className="bg-stone-950/50 border border-stone-800/80 rounded-xl p-2.5 space-y-1.5">
                <div className="text-[10px] sm:text-[11px] font-semibold text-stone-400 flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> Room Chat
                </div>
                <div className="h-16 overflow-y-auto space-y-0.5 text-[10px] sm:text-[11px] pr-1">
                  {chatMessages.length === 0 ? (
                    <div className="text-stone-500 italic text-[10px]">No messages yet. Say hi!</div>
                  ) : (
                    chatMessages.map((m, idx) => (
                      <div key={idx} className="text-stone-300">
                        <strong className="text-amber-400">{m.sender}:</strong> {m.message}
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={handleSendChat} className="flex gap-1.5">
                  <input
                    type="text"
                    maxLength={60}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type message..."
                    className="flex-1 bg-stone-900 border border-stone-800 text-stone-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="py-1 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold min-h-[32px]"
                  >
                    Send
                  </button>
                </form>
              </div>

              {/* Lobby Action Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleToggleReady}
                  className="flex-1 py-2 sm:py-2.5 px-3 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-200 font-display font-bold text-xs tracking-wider border border-stone-700/60 transition-colors min-h-[42px]"
                >
                  TOGGLE READY
                </button>

                {multiplayer.isHost && (
                  <button
                    type="button"
                    onClick={handleStartGame}
                    disabled={currentRoom.players.length < 2}
                    className="flex-[2] py-2 sm:py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-stone-950 font-display font-black text-xs sm:text-sm tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-amber-950/40 min-h-[42px]"
                  >
                    <Play className="w-4 h-4 fill-current" /> START GAME
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
