import { useState } from 'react';
import GameScreen from './GameScreen';

export default function App() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
  const [score, setScore] = useState(0);

  return (
    <div className="min-h-screen bg-[#020617] text-white flex flex-col font-sans overflow-hidden relative">
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_20%,rgba(2,6,23,0.8)_100%)]"></div>
      
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="grid grid-cols-12 h-full w-full border-l border-white/5">
          {Array.from({ length: 12 }).map((_, i) => <div key={`col-${i}`} className="border-r border-white/5 h-full"></div>)}
        </div>
        <div className="absolute inset-0 flex flex-col">
          {Array.from({ length: 12 }).map((_, i) => <div key={`row-${i}`} className="border-b border-white/5 w-full h-[64px]"></div>)}
        </div>
      </div>
      
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none z-0"></div>
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-0"></div>

      <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full h-full p-4">
      {gameState === 'menu' && (
        <div className="text-center space-y-8 p-8 max-w-2xl bg-white/5 rounded-3xl backdrop-blur-md border border-white/10 shadow-2xl w-full">
          <div className="space-y-4">
            <h1 className="text-6xl md:text-7xl font-black bg-clip-text text-transparent bg-gradient-to-br from-cyan-400 to-blue-500 pb-2 tracking-tighter">
              Body Bouncer
            </h1>
            <p className="text-xl text-slate-300 leading-relaxed font-medium">
              Utilisez les mouvements de votre corps devant la caméra pour guider les boules vers la cible verte !
            </p>
          </div>
          
          <div className="bg-black/40 p-6 rounded-2xl border border-white/10 text-left space-y-4 text-slate-300">
            <div className="flex items-center space-x-2 border-b border-white/10 pb-2">
              <div className="w-2 h-2 bg-pink-400 rounded-full animate-pulse"></div>
              <h2 className="text-sm font-mono uppercase tracking-widest text-slate-400">Comment jouer</h2>
            </div>
            <ul className="list-disc list-inside space-y-2 text-lg">
              <li>Placez-vous bien en vue de la caméra (recul nécessaire).</li>
              <li>Vous pouvez jouer de <strong>1 à 2 joueurs</strong> simultanément !</li>
              <li>Faites rebondir les boules avec vos bras, jambes et corps.</li>
              <li>La cible se déplace toutes les <strong>10 secondes</strong>.</li>
              <li>Vous avez <strong>1 minute</strong> pour accumuler un maximum de points.</li>
            </ul>
          </div>

          <button 
            onClick={() => setGameState('playing')}
            className="w-full sm:w-auto px-12 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-2xl font-black uppercase tracking-[0.2em] rounded-full shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:shadow-[0_0_40px_rgba(34,211,238,0.5)] transform transition hover:scale-105 active:scale-95"
          >
            Démarrer
          </button>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="absolute inset-0 w-full h-full">
          <GameScreen onGameOver={(finalScore) => { 
            setScore(finalScore); 
            setGameState('gameover'); 
          }} />
        </div>
      )}

      {gameState === 'gameover' && (
        <div className="text-center space-y-8 p-12 max-w-xl w-full bg-white/5 rounded-3xl backdrop-blur-md border border-white/10 shadow-2xl">
          <div className="flex items-center justify-center space-x-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-pink-500 animate-pulse"></div>
            <h1 className="text-xs uppercase tracking-[0.3em] font-mono text-pink-400">Fin de session</h1>
          </div>
          
          <div className="bg-black/40 rounded-2xl p-8 border border-white/10">
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-1 font-mono">Score Final</p>
            <div className="text-8xl font-black tabular-nums tracking-tight text-white drop-shadow-[0_0_20px_rgba(34,211,238,0.3)]">
              {score} <span className="text-3xl opacity-40 font-normal">PTS</span>
            </div>
          </div>

          <div className="flex flex-col items-center space-y-4">
            <button 
              onClick={() => setGameState('playing')}
              className="w-full sm:w-auto px-12 py-5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xl font-bold uppercase tracking-widest rounded-full shadow-[0_0_30px_rgba(34,211,238,0.3)] transform transition hover:scale-105 active:scale-95"
            >
              Rejouer
            </button>
            <button 
              onClick={() => setGameState('menu')}
              className="mt-4 text-xs font-mono uppercase tracking-[0.2em] text-slate-400 hover:text-white transition"
            >
              Retour au menu principal
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
