'use client';
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { io } from 'socket.io-client';

interface LeaderboardEntry {
  name: string;
  score: number;
}

export default function Leaderboard() {
  const searchParams = useSearchParams();
  const quizId = searchParams.get('id');
  const [board, setBoard] = useState<LeaderboardEntry[]>([]);

//   useEffect(() => {
//     const s = io('http://localhost:5000');
//     s.emit('join_room', { quizId });

//     s.on('leaderboard_updated', (data: LeaderboardEntry[]) => {
//       setBoard(data);
//     });

//     return () => { s.disconnect(); };
//   }, [quizId]);

  useEffect(() => {
  if (!quizId) return;

  const s = io('http://localhost:5000');
  
  // Join the channel room
  s.emit('join_room', { quizId });

  // CRITICAL: Ask the backend server to compute and send current scores immediately
  s.emit('get_leaderboard', { quizId });

  s.on('leaderboard_updated', (data: LeaderboardEntry[]) => {
    setBoard(data);
  });

  return () => { s.disconnect(); };
}, [quizId]);

  return (
    <div className="p-8 max-w-md mx-auto">
      <h1 className="text-3xl font-black text-center mb-8 tracking-tight text-slate-800">FINAL STANDINGS</h1>
      <div className="bg-white shadow rounded-lg overflow-hidden border">
        {board.length === 0 ? (
          <p className="p-4 text-center text-gray-500">Compiling Redis telemetry cache matrices...</p>
        ) : (
          <div className="divide-y">
            {board.map((row, idx) => (
              <div key={idx} className="flex justify-between items-center p-4">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-400 w-6">#{idx + 1}</span>
                  <span className="font-semibold text-slate-800">{row.name}</span>
                </div>
                <span className="bg-indigo-50 text-indigo-700 font-bold px-3 py-1 rounded-full text-sm">{row.score} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}