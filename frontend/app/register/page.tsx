'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
const api = process.env.NEXT_PUBLIC_API_URL;

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student', tenantId: 'COMSATS' });
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${api}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push(data.user.role === 'teacher' ? '/teacher' : '/student');
    } else {
      alert('Registration Failed');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
      <h1 className="text-5xl font-black mb-4 tracking-tight">GRADELY</h1>
      <p className="text-xl text-slate-400 mb-8">Create your account</p>
      
      <form onSubmit={handleRegister} className="bg-slate-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-white">Register</h2>
        <select value={form.tenantId} onChange={e => setForm({...form, tenantId: e.target.value})} className="w-full p-3 mb-4 rounded bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-blue-500">
          <option value="COMSATS">COMSATS</option>
          <option value="FAST">FAST</option>
          <option value="NUST">NUST</option>
        </select>
        <input 
          type="text" 
          placeholder="Full Name" 
          value={form.name} 
          onChange={e => setForm({...form, name: e.target.value})} 
          className="w-full p-3 mb-4 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:outline-none focus:border-blue-500" 
          required 
        />
        <input 
          type="email" 
          placeholder="Email" 
          value={form.email} 
          onChange={e => setForm({...form, email: e.target.value})} 
          className="w-full p-3 mb-4 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:outline-none focus:border-blue-500" 
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          value={form.password} 
          onChange={e => setForm({...form, password: e.target.value})} 
          className="w-full p-3 mb-4 rounded bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:outline-none focus:border-blue-500" 
          required 
        />
        <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="w-full p-3 mb-6 rounded bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-blue-500">
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
        </select>
        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded font-medium transition">Register</button>
      </form>
    </div>
  );
}