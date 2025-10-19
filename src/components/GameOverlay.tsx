import React from 'react';
import { useGameStore } from '@/game/store';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { Input } from '@/components/ui/input';
const overlayVariants = {
  hidden: { opacity: 0, backdropFilter: 'blur(0px)' },
  visible: { opacity: 1, backdropFilter: 'blur(4px)' },
  exit: { opacity: 0, backdropFilter: 'blur(0px)' },
};
const contentVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { delay: 0.2 } },
  exit: { opacity: 0, y: -20 },
};
const GameOverlay: React.FC = () => {
  const navigate = useNavigate();
  const { status, winner, p1Name, p2Name, p1Score, p2Score, resetGame, gameId } = useGameStore(
    useShallow((state) => ({
      status: state.status,
      winner: state.winner,
      p1Name: state.players[0].name,
      p2Name: state.players[1].name,
      p1Score: state.players[0].score,
      p2Score: state.players[1].score,
      resetGame: state.resetGame,
      gameId: state.gameId,
    }))
  );
  const isVisible = status === 'WAITING_FOR_PLAYER' || status === 'GAME_OVER' || status === 'PAUSED';
  const handleRestart = () => {
    resetGame();
    navigate('/');
  };
  const renderContent = () => {
    switch (status) {
      case 'WAITING_FOR_PLAYER':
        return (
          <>
            <h1 className="text-4xl md:text-5xl font-mono text-pac-cyan animate-pulse">
              WAITING FOR PLAYER 2...
            </h1>
            <p className="text-white text-xl mt-6">SHARE THIS GAME ID:</p>
            <div className="mt-4">
              <Input
                readOnly
                value={gameId || ''}
                className="text-2xl font-bold text-pac-yellow bg-black/70 border-2 border-pac-yellow text-center tracking-widest rounded-none w-full max-w-sm"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
            </div>
             <Button onClick={() => navigator.clipboard.writeText(gameId || '')} className="mt-4 font-mono text-lg bg-transparent border-2 border-white text-white hover:bg-white hover:text-black rounded-none">
              COPY ID
            </Button>
          </>
        );
      case 'GAME_OVER':
        return (
          <>
            <h1 className="text-6xl font-mono text-red-500 animate-glitch">GAME OVER</h1>
            {winner !== null ? (
              <h2 className={`text-4xl mt-4 ${winner === 1 ? 'text-pac-yellow' : 'text-pac-cyan'}`}>
                {winner === 1 ? p1Name : p2Name} WINS!
              </h2>
            ) : (
              <h2 className="text-4xl mt-4 text-white">IT'S A DRAW!</h2>
            )}
            <div className="text-2xl text-white mt-8">
              <p>{p1Name} Score: {p1Score}</p>
              <p>{p2Name} Score: {p2Score}</p>
            </div>
            <Button onClick={handleRestart} className="mt-8 font-mono text-2xl bg-transparent border-2 border-white text-white hover:bg-white hover:text-black rounded-none">
              BACK TO LOBBY
            </Button>
          </>
        );
      case 'PAUSED':
        return <h1 className="text-6xl font-mono text-pac-cyan animate-pulse">PAUSED</h1>;
      default:
        return null;
    }
  };
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/60"
        >
          <motion.div variants={contentVariants} className="text-center p-8">
            {renderContent()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
export default GameOverlay;