import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { GameState, GameActions, PlayerAction } from './types';
import { MAZE_LAYOUT, INITIAL_PLAYER_1, INITIAL_PLAYER_2, INITIAL_GHOSTS } from './constants';
const getInitialState = (): GameState => ({
  status: 'LOBBY',
  gameId: null,
  playerId: null,
  gameMode: null,
  maze: MAZE_LAYOUT,
  players: [JSON.parse(JSON.stringify(INITIAL_PLAYER_1)), JSON.parse(JSON.stringify(INITIAL_PLAYER_2))],
  ghosts: JSON.parse(JSON.stringify(INITIAL_GHOSTS)),
  projectiles: [],
  pellets: [], // Pellets will be synced from server
  highScore: 0,
  winner: null,
});
export const useGameStore = create<GameState & GameActions>()(
  immer((set, get) => ({
    ...getInitialState(),
    setGameId: (gameId) => {
      set({ gameId });
    },
    createGame: async (playerName) => {
      try {
        const response = await fetch('/api/games/create', { method: 'POST' });
        const data = await response.json();
        set({ gameId: data.gameId, playerId: data.playerId, status: 'WAITING_FOR_PLAYER' });
        get().sendPlayerAction({ type: 'SET_NAME', payload: { name: playerName } });
      } catch (error) {
        console.error('Failed to create game:', error);
      }
    },
    joinGame: async (gameId, playerName) => {
      try {
        const response = await fetch(`/api/games/${gameId}/join`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to join game');
        const data = await response.json();
        set({ gameId: data.gameId, playerId: data.playerId, status: 'PLAYING' });
        get().sendPlayerAction({ type: 'SET_NAME', payload: { name: playerName } });
      } catch (error) {
        console.error('Failed to join game:', error);
        // Optionally reset state or show an error to the user
        set({ gameId: null, playerId: null });
      }
    },
    syncGameState: async () => {
      const gameId = get().gameId;
      if (!gameId) return;
      try {
        const response = await fetch(`/api/games/${gameId}`);
        const serverState = await response.json();
        set((state) => {
          // Merge server state into local state
          Object.assign(state, serverState);
        });
      } catch (error) {
        console.error('Failed to sync game state:', error);
        // Could handle disconnects here, e.g., navigate to lobby
      }
    },
    sendPlayerAction: async (action) => {
      const { gameId, playerId } = get();
      if (!gameId || !playerId) return;
      try {
        await fetch(`/api/games/${gameId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...action, playerId }),
        });
      } catch (error) {
        console.error('Failed to send player action:', error);
      }
    },
    resetGame: () => {
      // In a networked game, reset means going back to the lobby
      set(getInitialState());
      // We can't use useNavigate here, so this will be handled in the component
    },
  })),
);