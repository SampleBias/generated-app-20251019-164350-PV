import { GameState, Player, Direction, Position, Ghost, PlayerAction } from '../../src/game/types';
import {
  MAZE_LAYOUT,
  INITIAL_PLAYER_1,
  INITIAL_PLAYER_2,
  INITIAL_GHOSTS,
  PLAYER_SPEED,
  PROJECTILE_SPEED,
  STUN_DURATION,
  VULNERABLE_DURATION,
  MAX_AMMO,
  AMMO_RECHARGE_RATE,
  GHOST_SPEED,
} from '../../src/game/constants';
import { v4 as uuidv4 } from 'uuid';
type Pellet = {
  position: { x: number; y: number };
  isPowerPellet: boolean;
};
const isWall = (x: number, y: number, maze: number[][]) => {
  const gridX = Math.floor(x);
  const gridY = Math.floor(y);
  if (gridX < 0 || gridX >= maze[0].length || gridY < 0 || gridY >= maze.length) return true;
  return maze[gridY][gridX] === 1;
};
const oppositeDirection: Record<Direction, Direction> = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT', STOP: 'STOP' };
export class GameRoom {
  state: DurableObjectState;
  gameState: GameState | null = null;
  players: (number | null)[] = [null, null];
  interval: number | null = null;
  lastUpdateTime: number = 0;
  constructor(state: DurableObjectState) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      this.gameState = await this.state.storage.get('gameState') || null;
    });
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/create') {
      return this.handleCreate();
    }
    if (path === '/join') {
      return this.handleJoin();
    }
    if (path === '/state') {
      return this.handleGetState();
    }
    if (path === '/action') {
      const action = await request.json() as PlayerAction & { playerId: number };
      return this.handlePlayerAction(action);
    }
    return new Response('Not found', { status: 404 });
  }
  handleCreate(): Response {
    if (this.gameState) {
      return new Response('Game already exists', { status: 400 });
    }
    this.gameState = this.getInitialState();
    this.players[0] = 1;
    this.gameState.status = 'WAITING_FOR_PLAYER';
    this.state.storage.put('gameState', this.gameState);
    return new Response(JSON.stringify({ gameId: this.state.id.toString(), playerId: 1 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  handleJoin(): Response {
    if (!this.gameState) {
      return new Response('Game not found', { status: 404 });
    }
    if (this.players[1]) {
      return new Response('Game is full', { status: 400 });
    }
    this.players[1] = 2;
    this.gameState.status = 'PLAYING';
    this.gameState.gameMode = '2P';
    this.startGameLoop();
    this.state.storage.put('gameState', this.gameState);
    return new Response(JSON.stringify({ gameId: this.state.id.toString(), playerId: 2 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  handleGetState(): Response {
    if (!this.gameState) {
      return new Response('Game not found', { status: 404 });
    }
    return new Response(JSON.stringify(this.gameState), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  handlePlayerAction(action: PlayerAction & { playerId: number }): Response {
    if (!this.gameState || this.gameState.status !== 'PLAYING') {
      return new Response('Game not active', { status: 400 });
    }
    const player = this.gameState.players.find(p => p.id === action.playerId);
    if (!player) {
      return new Response('Player not found', { status: 404 });
    }
    switch (action.type) {
      case 'SET_DIRECTION':
        player.nextDirection = action.payload.direction;
        break;
      case 'SHOOT':
        if (player.ammo > 0 && player.direction !== 'STOP' && player.isStunned <= 0) {
          player.ammo--;
          this.gameState.projectiles.push({
            id: uuidv4(),
            position: { ...player.position },
            direction: player.direction,
            playerId: player.id,
          });
        }
        break;
      case 'SET_NAME':
        player.name = action.payload.name;
        break;
    }
    return new Response('Action received', { status: 200 });
  }
  startGameLoop() {
    if (this.interval) return;
    this.lastUpdateTime = Date.now();
    this.interval = setInterval(() => {
      const now = Date.now();
      const delta = now - this.lastUpdateTime;
      this.lastUpdateTime = now;
      this.update(delta);
      this.state.storage.put('gameState', this.gameState);
    }, 1000 / 60); // ~60 FPS
  }
  respawnGhost(ghostId: string) {
    if (!this.gameState) return;
    const ghost = this.gameState.ghosts.find((g) => g.id === ghostId);
    if (ghost) {
      ghost.position = { x: 9, y: 10 };
      ghost.isEaten = false;
    }
  }
  update(delta: number) {
    if (!this.gameState || this.gameState.status !== 'PLAYING') {
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
      return;
    }
    const state = this.gameState;
    const deltaSeconds = delta / 1000;
    // Update timers and ammo
    state.players.forEach(p => {
      if (p.isStunned > 0) p.isStunned = Math.max(0, p.isStunned - delta);
      if (p.ammo < MAX_AMMO) {
        p.ammoRechargeTimer = (p.ammoRechargeTimer || 0) + delta;
        if (p.ammoRechargeTimer >= AMMO_RECHARGE_RATE) {
          p.ammo++;
          p.ammoRechargeTimer = 0;
        }
      }
    });
    state.ghosts.forEach(g => {
      if (g.isVulnerable > 0) g.isVulnerable = Math.max(0, g.isVulnerable - delta);
    });
    // Move Players
    state.players.forEach(player => {
      if (player.isStunned > 0) return;
      const speed = PLAYER_SPEED * deltaSeconds;
      const tolerance = speed > 0 ? speed * 0.51 : 0.05;
      const { x, y } = player.position;
      const isAtIntersection = Math.abs(x - Math.round(x)) < tolerance && Math.abs(y - Math.round(y)) < tolerance;
      if (isAtIntersection) {
        player.position.x = Math.round(x);
        player.position.y = Math.round(y);
        const canMove = (dir: Direction) => {
          switch (dir) {
            case 'UP': return !isWall(player.position.x, player.position.y - 1, state.maze);
            case 'DOWN': return !isWall(player.position.x, player.position.y + 1, state.maze);
            case 'LEFT': return !isWall(player.position.x - 1, player.position.y, state.maze);
            case 'RIGHT': return !isWall(player.position.x + 1, player.position.y, state.maze);
            default: return false;
          }
        };
        if (player.nextDirection !== player.direction && player.nextDirection !== oppositeDirection[player.direction] && canMove(player.nextDirection)) {
          player.direction = player.nextDirection;
        }
      }
      let nextX = player.position.x;
      let nextY = player.position.y;
      switch (player.direction) {
        case 'UP': nextY -= speed; break;
        case 'DOWN': nextY += speed; break;
        case 'LEFT': nextX -= speed; break;
        case 'RIGHT': nextX += speed; break;
      }
      const currentTileX = Math.round(player.position.x);
      const currentTileY = Math.round(player.position.y);
      let collision = false;
      switch (player.direction) {
        case 'UP': if (isWall(currentTileX, Math.floor(nextY), state.maze) && nextY < currentTileY) { player.position.y = currentTileY; collision = true; } break;
        case 'DOWN': if (isWall(currentTileX, Math.ceil(nextY), state.maze) && nextY > currentTileY) { player.position.y = currentTileY; collision = true; } break;
        case 'LEFT': if (isWall(Math.floor(nextX), currentTileY, state.maze) && nextX < currentTileX) { player.position.x = currentTileX; collision = true; } break;
        case 'RIGHT': if (isWall(Math.ceil(nextX), currentTileY, state.maze) && nextX > currentTileX) { player.position.x = currentTileX; collision = true; } break;
      }
      if (collision) { player.direction = 'STOP'; } else { player.position.x = nextX; player.position.y = nextY; }
      if (player.position.x < -0.5) player.position.x = state.maze[0].length - 0.51;
      if (player.position.x > state.maze[0].length - 0.5) player.position.x = -0.49;
    });
    // Move Ghosts with AI
    state.ghosts.forEach(ghost => {
      const { x, y } = ghost.position;
      const speed = (ghost.isVulnerable > 0 ? GHOST_SPEED * 0.75 : GHOST_SPEED) * deltaSeconds;
      const tolerance = speed > 0 ? speed * 0.51 : 0.05;
      const isAtIntersection = Math.abs(x - Math.round(x)) < tolerance && Math.abs(y - Math.round(y)) < tolerance;
      if (isAtIntersection) {
        ghost.position.x = Math.round(x);
        ghost.position.y = Math.round(y);
        let target: Position = { x: 0, y: 0 };
        const p1 = state.players[0];
        const blinkyPos = state.ghosts.find(g => g.type === 'BLINKY')?.position;
        switch (ghost.type) {
          case 'BLINKY': target = p1.position; break;
          case 'PINKY':
            target = { ...p1.position };
            switch (p1.direction) {
              case 'UP': target.y -= 4; break;
              case 'DOWN': target.y += 4; break;
              case 'LEFT': target.x -= 4; break;
              case 'RIGHT': target.x += 4; break;
            }
            break;
          case 'INKY':
            if (blinkyPos) {
              const vectorX = (p1.position.x - blinkyPos.x) * 2;
              const vectorY = (p1.position.y - blinkyPos.y) * 2;
              target = { x: blinkyPos.x + vectorX, y: blinkyPos.y + vectorY };
            } else {
              target = p1.position;
            }
            break;
          case 'CLYDE': {
            const distance = Math.hypot(ghost.position.x - p1.position.x, ghost.position.y - p1.position.y);
            if (distance < 8) {
              target = { x: 0, y: state.maze.length - 1 };
            } else {
              target = p1.position;
            }
            break;
          }
        }
        if (ghost.isVulnerable > 0) {
          target = { x: Math.random() * 20, y: Math.random() * 20 };
        }
        const possibleDirections: Direction[] = [];
        if (!isWall(ghost.position.x, ghost.position.y - 1, state.maze)) possibleDirections.push('UP');
        if (!isWall(ghost.position.x, ghost.position.y + 1, state.maze)) possibleDirections.push('DOWN');
        if (!isWall(ghost.position.x - 1, ghost.position.y, state.maze)) possibleDirections.push('LEFT');
        if (!isWall(ghost.position.x + 1, ghost.position.y, state.maze)) possibleDirections.push('RIGHT');
        const filteredDirections = possibleDirections.filter(d => d !== oppositeDirection[ghost.direction]);
        let bestDirection = ghost.direction;
        let minDistance = Infinity;
        const directionsToEvaluate = filteredDirections.length > 0 ? filteredDirections : possibleDirections;
        for (const dir of directionsToEvaluate) {
          let nextPos = { ...ghost.position };
          if (dir === 'UP') nextPos.y--;
          if (dir === 'DOWN') nextPos.y++;
          if (dir === 'LEFT') nextPos.x--;
          if (dir === 'RIGHT') nextPos.x++;
          const distance = Math.hypot(nextPos.x - target.x, nextPos.y - target.y);
          if (distance < minDistance) {
            minDistance = distance;
            bestDirection = dir;
          }
        }
        ghost.direction = bestDirection;
      }
      let nextX = ghost.position.x;
      let nextY = ghost.position.y;
      switch (ghost.direction) {
        case 'UP': nextY -= speed; break;
        case 'DOWN': nextY += speed; break;
        case 'LEFT': nextX -= speed; break;
        case 'RIGHT': nextX += speed; break;
      }
      ghost.position.x = nextX;
      ghost.position.y = nextY;
      if (ghost.position.x < -0.5) ghost.position.x = state.maze[0].length - 0.51;
      if (ghost.position.x > state.maze[0].length - 0.5) ghost.position.x = -0.49;
    });
    // Move Projectiles & handle collisions
    state.projectiles = state.projectiles.filter(proj => {
      const speed = PROJECTILE_SPEED * deltaSeconds;
      let hit = false;
      const prevX = proj.position.x;
      const prevY = proj.position.y;
      switch (proj.direction) {
        case 'UP': proj.position.y -= speed; break;
        case 'DOWN': proj.position.y += speed; break;
        case 'LEFT': proj.position.x -= speed; break;
        case 'RIGHT': proj.position.x += speed; break;
      }
      if (isWall(proj.position.x, proj.position.y, state.maze)) {
        const wallOnX = isWall(proj.position.x, prevY, state.maze);
        const wallOnY = isWall(prevX, proj.position.y, state.maze);
        if (wallOnX && wallOnY) { proj.direction = oppositeDirection[proj.direction]; }
        else if (wallOnX) { proj.direction = proj.direction === 'LEFT' ? 'RIGHT' : 'LEFT'; }
        else if (wallOnY) { proj.direction = proj.direction === 'UP' ? 'DOWN' : 'UP'; }
        proj.position = { x: prevX, y: prevY };
      }
      for (const player of state.players) {
        if (player.id !== proj.playerId && Math.abs(player.position.x - proj.position.x) < 0.5 && Math.abs(player.position.y - proj.position.y) < 0.5) {
          player.isStunned = STUN_DURATION;
          hit = true;
          break;
        }
      }
      if (hit) return false;
      for (const ghost of state.ghosts) {
        if (Math.abs(ghost.position.x - proj.position.x) < 0.5 && Math.abs(ghost.position.y - proj.position.y) < 0.5) {
          if (ghost.isVulnerable > 0 && !ghost.isEaten) {
            const shooter = state.players.find(p => p.id === proj.playerId);
            if (shooter) shooter.score += 200;
            ghost.isEaten = true;
            ghost.isVulnerable = 0;
            setTimeout(() => this.respawnGhost(ghost.id), 5000);
          }
          hit = true;
          break;
        }
      }
      if (hit) return false;
      return proj.position.x > -1 && proj.position.x < state.maze[0].length && proj.position.y > -1 && proj.position.y < state.maze.length;
    });
    // Player / Pellet collision
    state.players.forEach(player => {
      const gridX = Math.round(player.position.x);
      const gridY = Math.round(player.position.y);
      const pelletIndex = state.pellets.findIndex(p => p.position.x === gridX && p.position.y === gridY);
      if (pelletIndex !== -1) {
        const pellet = state.pellets[pelletIndex];
        player.score += pellet.isPowerPellet ? 50 : 10;
        if (pellet.isPowerPellet) {
          state.ghosts.forEach(g => { g.isVulnerable = VULNERABLE_DURATION; g.isEaten = false; });
        }
        state.pellets.splice(pelletIndex, 1);
      }
    });
    // Player / Ghost collision
    state.players.forEach(player => {
      if (player.isStunned > 0) return;
      state.ghosts.forEach(ghost => {
        if (!ghost.isEaten && Math.abs(player.position.x - ghost.position.x) < 0.7 && Math.abs(player.position.y - ghost.position.y) < 0.7) {
          if (ghost.isVulnerable > 0) {
            player.score += 200;
            ghost.isEaten = true;
            ghost.isVulnerable = 0;
            setTimeout(() => this.respawnGhost(ghost.id), 5000);
          } else {
            player.lives--;
            player.position = player.id === 1 ? { ...INITIAL_PLAYER_1.position } : { ...INITIAL_PLAYER_2.position };
            player.direction = 'STOP';
            player.nextDirection = 'STOP';
          }
        }
      });
    });
    // Check for game over
    const isGameOver = state.pellets.length === 0 || state.players[0].lives <= 0 || state.players[1].lives <= 0;
    if (isGameOver) {
      state.status = 'GAME_OVER';
      const p1Score = state.players[0].score;
      const p2Score = state.players[1].score;
      state.winner = p1Score > p2Score ? 1 : (p2Score > p1Score ? 2 : null);
      const finalHighScore = Math.max(p1Score, p2Score, state.highScore);
      state.highScore = finalHighScore;
      if (this.interval) clearInterval(this.interval);
      this.interval = null;
    }
  }
  getInitialState(): GameState {
    const createInitialPellets = (): Pellet[] => {
      const pellets: Pellet[] = [];
      MAZE_LAYOUT.forEach((row, y) => {
        row.forEach((tile, x) => {
          if (tile === 2 || tile === 3) {
            pellets.push({ position: { x, y }, isPowerPellet: tile === 3 });
          }
        });
      });
      return pellets;
    };
    return {
      status: 'LOBBY',
      gameId: this.state.id.toString(),
      playerId: null,
      gameMode: null,
      maze: MAZE_LAYOUT,
      players: [JSON.parse(JSON.stringify(INITIAL_PLAYER_1)), JSON.parse(JSON.stringify(INITIAL_PLAYER_2))],
      ghosts: JSON.parse(JSON.stringify(INITIAL_GHOSTS)),
      projectiles: [],
      pellets: createInitialPellets(),
      highScore: 0,
      winner: null,
    };
  }
}