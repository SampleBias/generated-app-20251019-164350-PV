import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/game/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
export function LobbyPage() {
  const [joinGameId, setJoinGameId] = useState('');
  const [playerName, setPlayerName] = useState('PLAYER');
  const [isLoading, setIsLoading] = useState(false);
  const createGame = useGameStore((state) => state.createGame);
  const joinGame = useGameStore((state) => state.joinGame);
  const navigate = useNavigate();
  const handleCreateGame = async () => {
    setIsLoading(true);
    await createGame(playerName || 'PLAYER 1');
    const newGameId = useGameStore.getState().gameId;
    if (newGameId) {
      navigate(`/game/${newGameId}`);
    } else {
      // Handle error
      setIsLoading(false);
    }
  };
  const handleJoinGame = async () => {
    if (!joinGameId.trim()) return;
    setIsLoading(true);
    await joinGame(joinGameId.trim(), playerName || 'PLAYER 2');
    const currentGameId = useGameStore.getState().gameId;
    if (currentGameId) {
      navigate(`/game/${currentGameId}`);
    } else {
      // Handle error
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen w-full bg-gray-900 flex flex-col items-center justify-center p-4 font-mono">
      <div className="text-center mb-12">
        <h1 className="text-5xl md:text-7xl font-mono text-pac-yellow animate-glitch" style={{ textShadow: '3px 3px #FF00FF' }}>
          PIXEL VENGEANCE
        </h1>
        <p className="text-pac-cyan mt-2">MULTIPLAYER LOBBY</p>
      </div>
      <Card className="w-full max-w-md bg-black/50 border-2 border-maze-blue text-white rounded-none">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-pac-yellow">ENTER YOUR NAME</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="PLAYER"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            maxLength={10}
            className="bg-black/50 border-2 border-pac-cyan text-pac-cyan text-center font-mono text-lg rounded-none focus:ring-pac-cyan mb-8"
            disabled={isLoading}
          />
          <div className="space-y-6">
            <div>
              <h3 className="text-xl text-center text-pac-yellow mb-4">CREATE A NEW GAME</h3>
              <Button onClick={handleCreateGame} disabled={isLoading} className="w-full font-mono text-lg bg-transparent border-2 border-pac-yellow text-pac-yellow hover:bg-pac-yellow hover:text-black rounded-none">
                {isLoading ? 'CREATING...' : 'CREATE GAME'}
              </Button>
            </div>
            <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-maze-blue"></div>
                <span className="flex-shrink mx-4 text-maze-blue">OR</span>
                <div className="flex-grow border-t border-maze-blue"></div>
            </div>
            <div>
              <h3 className="text-xl text-center text-pac-cyan mb-4">JOIN AN EXISTING GAME</h3>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter Game ID"
                  value={joinGameId}
                  onChange={(e) => setJoinGameId(e.target.value)}
                  className="bg-black/50 border-2 border-pac-cyan text-pac-cyan text-center font-mono text-lg rounded-none focus:ring-pac-cyan"
                  disabled={isLoading}
                />
                <Button onClick={handleJoinGame} disabled={isLoading || !joinGameId} className="font-mono text-lg bg-transparent border-2 border-pac-cyan text-pac-cyan hover:bg-pac-cyan hover:text-black rounded-none">
                  {isLoading ? '...' : 'JOIN'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      <footer className="text-center text-gray-500 text-xs mt-8">
          <p>Built with ❤️ by hc-bld-dev on Cloudflare</p>
      </footer>
    </div>
  );
}