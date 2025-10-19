export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'STOP';
export interface Position {
  x: number;
  y: number;
}
export interface Player {
  id: number;
  name: string;
  position: Position;
  direction: Direction;
  nextDirection: Direction;
  score: number;
  lives: number;
  isStunned: number; // countdown timer
  ammo: number;
  ammoRechargeTimer?: number;
  color: string;
}
export type GhostType = 'BLINKY' | 'PINKY' | 'INKY' | 'CLYDE';
export interface Ghost {
  id: string;
  type: GhostType;
  position: Position;
  direction: Direction;
  isVulnerable: number; // countdown timer
  isEaten: boolean;
  color: string;
}
export interface Projectile {
  id: string;
  position: Position;
  direction: Direction;
  playerId: number;
}
export type Pellet = {
  position: Position;
  isPowerPellet: boolean;
};
export type GameStatus = 'LOBBY' | 'WAITING_FOR_PLAYER' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
export interface GameState {
  status: GameStatus;
  gameId: string | null;
  playerId: 1 | 2 | null;
  gameMode: '1P' | '2P' | null;
  maze: number[][];
  players: [Player, Player];
  ghosts: Ghost[];
  projectiles: Projectile[];
  pellets: Pellet[];
  highScore: number;
  winner: number | null;
}
export type PlayerAction =
  | { type: 'SET_DIRECTION'; payload: { direction: Direction } }
  | { type: 'SHOOT' }
  | { type: 'SET_NAME', payload: { name: string } };
export interface GameActions {
  createGame: (playerName: string) => Promise<void>;
  joinGame: (gameId: string, playerName: string) => Promise<void>;
  syncGameState: () => Promise<void>;
  sendPlayerAction: (action: PlayerAction) => void;
  setGameId: (gameId: string) => void;
  resetGame: () => void;
}