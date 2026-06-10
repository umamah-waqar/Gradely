import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

import { connectDB } from './config/db.js';
import redisClient from './config/redis.js';
import { initKafka, producer } from './config/kafka.js';
import { authMiddleware } from './middleware/auth.js';
import User from './models/User.js';
import Quiz from './models/Quiz.js';

dotenv.config();
connectDB();
initKafka();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// Auth Endpoints
app.post('/api/auth/register', async (req, res) => {
  try {
    const { tenantId, name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ tenantId, name, email, password: hashedPassword, role });
    const token = jwt.sign({ id: user._id, tenantId, role }, process.env.JWT_SECRET);
    res.status(201).json({ token, user: { name, email, role, tenantId } });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, tenantId: user.tenantId, role: user.role }, process.env.JWT_SECRET);
    res.json({ token, user: { name: user.name, email: user.email, role: user.role, tenantId: user.tenantId } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Quiz Endpoints
app.post('/api/quizzes', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') return res.status(403).json({ message: 'Forbidden' });
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const quiz = await Quiz.create({ ...req.body, code, teacherId: req.user.id, tenantId: req.user.tenantId });
    res.status(201).json(quiz);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get('/api/quizzes/teacher', authMiddleware, async (req, res) => {
  const quizzes = await Quiz.find({ teacherId: req.user.id, tenantId: req.user.tenantId });
  res.json(quizzes);
});

app.get('/api/quizzes/join/:code', authMiddleware, async (req, res) => {
  const quiz = await Quiz.findOne({ code: req.params.code, tenantId: req.user.tenantId });
  if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
  res.json(quiz);
});

// Socket.IO Logic
io.on('connection', (socket) => {
  socket.on('join_room', ({ quizId }) => {
    socket.join(quizId);
  });

  socket.on('start_quiz', async ({ quizId, tenantId }) => {
    const quiz = await Quiz.findOneAndUpdate({ _id: quizId, tenantId }, { status: 'active', currentQuestionIndex: 0 }, { new: true });
    io.to(quizId).emit('quiz_started', { question: quiz.questions[0], index: 0 });
  });

  socket.on('next_question', async ({ quizId, tenantId }) => {
    const quiz = await Quiz.findOne({ _id: quizId, tenantId });
    const nextIndex = quiz.currentQuestionIndex + 1;
    if (nextIndex < quiz.questions.length) {
      quiz.currentQuestionIndex = nextIndex;
      await quiz.save();
      io.to(quizId).emit('next_question', { question: quiz.questions[nextIndex], index: nextIndex });
    } else {
      quiz.status = 'ended';
      await quiz.save();
      io.to(quizId).emit('quiz_ended');
    }
  });

  socket.on('submit_answer', async (data) => {
    await producer.send({
      topic: 'quiz-submissions',
      messages: [{ value: JSON.stringify(data) }]
    });

    setTimeout(async () => {
      const rawLeaderboard = await redisClient.zRangeWithScores(`quiz:${data.quizId}`, 0, -1, { REV: true });
      const leaderboard = await Promise.all(rawLeaderboard.map(async (item) => {
        const user = await User.findById(item.value);
        return { name: user ? user.name : 'Unknown', score: item.score };
      }));
      io.to(data.quizId).emit('leaderboard_updated', leaderboard);
    }, 500); 
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));