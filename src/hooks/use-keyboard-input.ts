import { useEffect } from 'react';
import { useGameStore } from '@/game/store';
import { useShallow } from 'zustand/react/shallow';
export const useKeyboardInput = () => {
  const { sendPlayerAction, status, playerId } = useGameStore(
    useShallow((state) => ({
      sendPlayerAction: state.sendPlayerAction,
      status: state.status,
      playerId: state.playerId,
    }))
  );
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== 'PLAYING' || !playerId) return;
      // Universal controls
      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          e.preventDefault();
          sendPlayerAction({ type: 'SET_DIRECTION', payload: { direction: 'UP' } });
          break;
        case 's':
        case 'arrowdown':
          e.preventDefault();
          sendPlayerAction({ type: 'SET_DIRECTION', payload: { direction: 'DOWN' } });
          break;
        case 'a':
        case 'arrowleft':
          e.preventDefault();
          sendPlayerAction({ type: 'SET_DIRECTION', payload: { direction: 'LEFT' } });
          break;
        case 'd':
        case 'arrowright':
          e.preventDefault();
          sendPlayerAction({ type: 'SET_DIRECTION', payload: { direction: 'RIGHT' } });
          break;
        case ' ':
        case 'enter':
          e.preventDefault();
          sendPlayerAction({ type: 'SHOOT' });
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [status, playerId, sendPlayerAction]);
};