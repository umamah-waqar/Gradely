'use client';
import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { io } from 'socket.io-client';

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  position: string;
  medal: string;
}

// Inner Component to safely handle useSearchParams() wrapper rules in Next.js
function LeaderboardContent() {
  const searchParams = useSearchParams();
  const quizId = searchParams.get('id');
  const [board, setBoard] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    if (!quizId) return;

    const s = io('http://localhost:5000');
    
    // Join the quiz channel room instance
    s.emit('join_room', { quizId });
    
    // Request a data compilation frame immediately on mount
    s.emit('get_leaderboard', { quizId });

    // Fallback polling loop to keep checking for entries every 1 second
    const fallbackPoll = setInterval(() => {
      s.emit('get_leaderboard', { quizId });
    }, 1000);

    s.on('leaderboard_updated', (data: LeaderboardEntry[]) => {
      // CRITICAL LOGIC CORRECTION: Setting the state to an array (even if empty `[]`)
      // explicitly breaks out of the initial `null` loading view block.
      setBoard(data || []); 
    });

    return () => { 
      clearInterval(fallbackPoll);
      s.disconnect(); 
    };
  }, [quizId]);

  // Loading Screen State
  if (board === null) {
    return (
      <div className="p-8 max-w-md mx-auto text-center min-h-screen flex flex-col justify-center items-center space-y-4">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-500 animate-pulse">Compiling live telemetry matrices...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-md mx-auto min-h-screen flex flex-col justify-center">
      <h1 className="text-3xl font-black text-center mb-8 tracking-tight text-slate-800">FINAL STANDINGS</h1>
      
      <div className="bg-white shadow-xl rounded-xl overflow-hidden border border-slate-100 divide-y divide-slate-100">
        {board.length === 0 ? (
          <div className="p-8 text-center text-sm font-medium text-slate-400">
            No student responses processed in live cache records yet.
          </div>
        ) : (
          board.map((row, idx) => {
            const isPodium = idx < 3; // True for 1st, 2nd, or 3rd position
            return (
              <div 
                key={row.id || idx} 
                className={`flex justify-between items-center p-4 transition duration-200 ${
                  idx === 0 ? 'bg-amber-50/40 hover:bg-amber-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-4">
                  {/* Dynamic Ranking Column: Renders a Medal if present, otherwise outputs the standard text number */}
                  <span className={`w-8 text-center font-bold ${
                    isPodium ? 'text-lg text-slate-800' : 'text-sm text-slate-400'
                  }`}>
                    {row.medal ? row.medal : `#${row.position}`}
                  </span>
                  
                  <span className={`font-semibold ${isPodium ? 'text-slate-900 text-base' : 'text-slate-600 text-sm'}`}>
                    {row.name}
                  </span>
                </div>

                <span className={`font-bold px-3 py-1 rounded-full text-xs ${
                  isPodium ? 'bg-indigo-100 text-indigo-700 text-sm' : 'bg-slate-100 text-slate-600'
                }`}>
                  {row.score} pts
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Global Main Export wrapped in Suspense boundary requirements for Next.js App Router rules
export default function Leaderboard() {
  return (
    <Suspense fallback={
      <div className="p-8 max-w-md mx-auto text-center min-h-screen flex flex-col justify-center items-center">
        <p className="text-sm font-semibold text-slate-400 animate-pulse">Initializing Layout...</p>
      </div>
    }>
      <LeaderboardContent />
    </Suspense>
  );
}