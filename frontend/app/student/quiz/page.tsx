'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

interface Question {
  _id: string;
  questionText: string;
  options: string[];
}

interface User {
  tenantId: string;
  email: string;
  id?: string;
  _id?: string;
}

export default function QuizScreen() {
  const searchParams = useSearchParams();
  const quizId = searchParams.get('id');
  const router = useRouter();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [statusMessage, setStatusMessage] = useState<string>('Waiting for teacher to launch the quiz production stream...');
  const [user, setUser] = useState<User | null>(null);
  const [selectedOpt, setSelectedOpt] = useState<string>('');
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(userData);

    const s = io('http://localhost:5000');
    setSocket(s);

    s.emit('join_room', { quizId });

    s.on('quiz_started', ({ question, index }: { question: Question; index: number }) => {
      setCurrentQuestion(question);
      setCurrentIndex(index);
      setStatusMessage('');
      setHasSubmitted(false);
      setSelectedOpt('');
    });

    s.on('next_question', ({ question, index }: { question: Question; index: number }) => {
      setCurrentQuestion(question);
      setCurrentIndex(index);
      setHasSubmitted(false);
      setSelectedOpt('');
    });

    s.on('quiz_ended', () => {
      router.push(`/student/leaderboard?id=${quizId}`);
    });

    return () => { s.disconnect(); };
  }, [quizId, router]);

  const submitChoice = (opt: string) => {
    if (hasSubmitted || !socket || !currentQuestion) return;
    
    // Parse local storage safely to grab user context identities
    const completeUser = JSON.parse(localStorage.getItem('user') || '{}');
    const studentId = completeUser.id || completeUser._id || user?.id || user?._id;
    const tenantId = completeUser.tenantId || user?.tenantId;

    if (!studentId || !tenantId) {
      console.error("Identity Matrix Sync Error: Tenant context or User tracking ID is unresolved.");
      return;
    }

    setSelectedOpt(opt);
    setHasSubmitted(true);

    socket.emit('submit_answer', {
      tenantId,
      quizId,
      studentId, 
      questionId: currentQuestion._id,
      selectedAnswer: opt
    });
  };

  return (
    <div className="p-8 max-w-xl mx-auto min-h-screen flex flex-col justify-center">
      {currentIndex === -1 ? (
        <div className="text-center font-medium text-gray-600 animate-pulse">{statusMessage}</div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-lg border">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Question #{currentIndex + 1}</span>
          <h2 className="text-2xl font-bold mt-2 mb-6">{currentQuestion?.questionText}</h2>
          
          <div className="space-y-3">
            {currentQuestion?.options.map((opt, i) => (
              <button 
                key={i} 
                disabled={hasSubmitted} 
                onClick={() => submitChoice(opt)}
                className={`w-full text-left p-3 border rounded transition font-medium ${
                  selectedOpt === opt 
                    ? 'bg-indigo-600 text-white border-indigo-600' 
                    : 'bg-gray-50 hover:bg-gray-100 border-gray-200 disabled:opacity-60'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          
          {hasSubmitted && (
            <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-md">
              <p className="text-sm text-emerald-700 font-semibold text-center">
                ✓ Answer transmitted to stream ingestion engine node.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}