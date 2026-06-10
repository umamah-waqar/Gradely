'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function StudentDashboard() {
  const [code, setCode] = useState<string>('');
  const router = useRouter();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const res = await fetch(`http://localhost:5000/api/quizzes/join/${code.toUpperCase()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const quiz = await res.json();
      router.push(`/student/quiz?id=${quiz._id}`);
    } else {
      alert('Quiz dynamic entry room not found for your Institute tenant.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <form onSubmit={handleJoin} className="bg-white p-8 rounded shadow-md w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold mb-2">Join Dynamic Room</h1>
        <p className="text-gray-500 text-sm mb-6">Enter code shared by your enterprise instructor.</p>
        <input type="text" placeholder="ROOM CODE" value={code} onChange={e => setCode(e.target.value)} className="w-full p-3 border rounded text-center text-xl font-mono tracking-widest uppercase mb-4" required />
        <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-bold tracking-wide hover:bg-indigo-700">Enter Arena</button>
      </form>
    </div>
  );
}