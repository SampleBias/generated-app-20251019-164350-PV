import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GameCanvas from '@/components/GameCanvas';
import GameUI from '@/components/GameUI';
import GameOverlay from '@/components/GameOverlay';
import { useKeyboardInput } from '@/hooks/use-keyboard-input';
import { useGameStore } from '@/game/store';
import { useShallow } from 'zustand/react/shallow';
// Custom hook for game state synchronization
const useGameSync = (gameId: string | undefined) => {
  const { syncGameState, setGameId } = useGameStore(
    useShallow((state) => ({
      syncGameState: state.syncGameState,
      setGameId: state.setGameId,
    }))
  );
  const status = useGameStore((state) => state.status);
  useEffect(() => {
    if (!gameId) return;
    setGameId(gameId);
    // Initial sync
    syncGameState();
    // Set up polling for updates
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && (status === 'PLAYING' || status === 'WAITING_FOR_PLAYER')) {
        syncGameState();
      }
    }, 50); // Poll at ~20fps
    return () => clearInterval(interval);
  }, [gameId, syncGameState, setGameId, status]);
};
export function HomePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const playerId = useGameStore((state) => state.playerId);
  // Redirect if gameId is missing
  useEffect(() => {
    if (!gameId) {
      navigate('/');
    }
  }, [gameId, navigate]);
  useGameSync(gameId);
  useKeyboardInput();
  if (!playerId) {
    // Could show a loading or joining screen here
    return (
      <div className="min-h-screen w-full bg-gray-900 flex flex-col items-center justify-center p-4 font-mono text-white text-2xl">
        JOINING GAME...
      </div>
    );
  }
  return (
    <div className="min-h-screen w-full bg-gray-900 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 font-mono">
      <div className="relative w-full max-w-7xl mx-auto flex flex-col items-center">
        <GameUI />
        <div className="relative shadow-2xl shadow-cyan-500/20">
          <GameCanvas />
          <GameOverlay />
        </div>
        <footer className="text-center text-gray-500 text-xs mt-8">
          <p>Built with ❤️ by hc-bld-dev on Cloudflare</p>
        </footer>
      </div>
    </div>
  );
}