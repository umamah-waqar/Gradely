'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const api = process.env.NEXT_PUBLIC_API_URL;

export default function Login() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${api}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push(data.user.role === 'teacher' ? '/teacher' : '/student');
    } else {
      alert('Login Failed');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <h1 className="text-5xl font-black mb-4 tracking-tight">GRADELY</h1>
      <p className="text-xl text-slate-400 mb-8">Sign in to your account</p>
      
      <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-white">Login</h2>
        <input 
          type="email" 
          placeholder="Email" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          className="w-full p-3 mb-4 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:outline-none focus:border-blue-500" 
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          className="w-full p-3 mb-6 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:outline-none focus:border-blue-500" 
          required 
        />
        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded font-medium transition">Log In</button>
      </form>
    </div>
  );
}