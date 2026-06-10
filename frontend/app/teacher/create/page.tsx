'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Question {
  questionText: string;
  options: string[];
  correctAnswer: string;
}

export default function CreateQuiz() {
  const [title, setTitle] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([{ questionText: '', options: ['', '', '', ''], correctAnswer: '' }]);
  const router = useRouter();

  const addQuestion = () => {
    setQuestions([...questions, { questionText: '', options: ['', '', '', ''], correctAnswer: '' }]);
  };

  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:5000/api/quizzes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ title, questions })
    });
    if (res.ok) router.push('/teacher');
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Create Fresh Quiz</h1>
      <form onSubmit={handleQuizSubmit} className="space-y-6">
        <input type="text" placeholder="Quiz Title" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 border rounded text-lg font-semibold" required />
        {questions.map((q, idx) => (
          <div key={idx} className="p-4 border rounded bg-gray-50 space-y-3">
            <input type="text" placeholder={`Question ${idx + 1}`} value={q.questionText} onChange={e => {
              const updated = [...questions]; updated[idx].questionText = e.target.value; setQuestions(updated);
            }} className="w-full p-2 border rounded" required />
            <div className="grid grid-cols-2 gap-2">
              {q.options.map((opt, oIdx) => (
                <input key={oIdx} type="text" placeholder={`Option ${oIdx + 1}`} value={opt} onChange={e => {
                  const updated = [...questions]; updated[idx].options[oIdx] = e.target.value; setQuestions(updated);
                }} className="p-2 border rounded text-sm" required />
              ))}
            </div>
            <input type="text" placeholder="Correct Answer (Exact Option Text)" value={q.correctAnswer} onChange={e => {
              const updated = [...questions]; updated[idx].correctAnswer = e.target.value; setQuestions(updated);
            }} className="w-full p-2 border rounded text-sm bg-green-50" required />
          </div>
        ))}
        <div className="flex gap-4">
          <button type="button" onClick={addQuestion} className="bg-slate-700 text-white px-4 py-2 rounded font-semibold">Add Question</button>
          <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700">Save Quiz</button>
        </div>
      </form>
    </div>
  );
}