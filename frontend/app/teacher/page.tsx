'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';

interface Quiz {
  _id: string;
  title: string;
  code: string;
}

interface User {
  tenantId: string;
}

export default function TeacherDashboard() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(userData);
    const token = localStorage.getItem('token');
    
    fetch('http://localhost:5000/api/quizzes/teacher', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setQuizzes(data));

    const s = io('http://localhost:5000');
    setSocket(s);
    return () => { s.disconnect(); };
  }, []);

  const startQuiz = (quizId: string) => {
    if (socket && user) {
      socket.emit('start_quiz', { quizId, tenantId: user.tenantId });
      alert('Quiz Active!');
    }
  };

  const nextQuestion = (quizId: string) => {
    if (socket && user) {
      socket.emit('next_question', { quizId, tenantId: user.tenantId });
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
          <p className="text-sm text-gray-500">Tenant: {user?.tenantId}</p>
        </div>
        <Link href="/teacher/create" className="bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700">Create Quiz</Link>
      </div>
      <div className="grid gap-4">
        {quizzes.map(quiz => (
          <div key={quiz._id} className="border p-4 rounded flex justify-between items-center bg-white shadow-sm">
            <div>
              <h3 className="text-lg font-bold">{quiz.title}</h3>
              <p className="text-sm text-gray-600">Code: <span className="font-mono bg-gray-100 px-1 rounded font-bold">{quiz.code}</span></p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => startQuiz(quiz._id)} className="bg-green-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-green-700">Start</button>
              <button onClick={() => nextQuestion(quiz._id)} className="bg-amber-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-amber-700">Next Question</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}