import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

import { connectDB } from './config/db.js';
import redisClient from './config/redis.js';
import { initKafka, producer } from './config/kafka.js';
import { authMiddleware } from './middleware/auth.js';
import User from './models/User.js';
import Quiz from './models/Quiz.js';
import Submission from './models/Submission.js'; 

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
    res.status(201).json({ token, user: { name, email, role, tenantId, id: user._id } });
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
    res.json({ token, user: { name: user.name, email: user.email, role: user.role, tenantId: user.tenantId, id: user._id } });
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

// PURE LIVE TELEMETRY ENGINE VIA REDIS
const broadcastLeaderboard = async (quizId) => {
  try {
    console.log(`Compiling clean Redis cache live telemetry matrices for quiz: ${quizId}`);
    
    // Fetch raw sorted set data maps back out of your container memory
    const rawLeaderboard = await redisClient.zRangeWithScores(`quiz:${quizId}`, 0, -1, { REV: true });
    
    if (!rawLeaderboard || rawLeaderboard.length === 0) {
      console.log(`⚠️ Redis cache data is currently empty for room: quiz:${quizId}`);
      io.to(quizId).emit('leaderboard_updated', []);
      return;
    }

    // Hydrate user documents from the DB first without messing with index positions yet
    const rawPlayers = await Promise.all(rawLeaderboard.map(async (item) => {
      try {
        const cleanUserId = String(item.value).trim().replace(/^["']|["']$/g, '');
        
        if (!mongoose.Types.ObjectId.isValid(cleanUserId)) return null;

        const user = await User.findById(cleanUserId);
        
        // Strict Gate check: Exclude ONLY teachers from showing up in the results view
        if (!user || user.role === 'teacher') return null;

        return {
          id: cleanUserId,
          name: user.name,
          score: parseInt(item.score, 10) // Force score to be an integer
        };
      } catch (err) {
        console.error("Error processing user row entry:", err);
        return null;
      }
    }));

    // Clear out null entries so we are left with a dense array of active real participants
    const filteredPlayers = rawPlayers.filter(player => player !== null);

    // Sort players explicitly by score descending to prevent any Redis sequence issues
    filteredPlayers.sort((a, b) => b.score - a.score);

    // Map medals and positions dynamically onto the sorted array
    const cleanedLeaderboard = filteredPlayers.map((player, trueIdx) => {
      let medal = "";
      if (trueIdx === 0) medal = "🥇";
      else if (trueIdx === 1) medal = "🥈";
      else if (trueIdx === 2) medal = "🥉";

      return {
        ...player,
        position: `${trueIdx + 1}`,
        medal: medal
      };
    });
    
    console.log(`Successfully broadcasted ${cleanedLeaderboard.length} student scores from Redis.`);
    io.to(quizId).emit('leaderboard_updated', cleanedLeaderboard);

  } catch (err) {
    console.error('Redis transmission compilation failure:', err);
  }
};

// Socket.IO Orchestration Flow Framework
io.on('connection', (socket) => {
  console.log(`Socket Connected: ${socket.id}`);

  socket.on('join_room', ({ quizId }) => {
    socket.join(quizId);
  });

  // FIXED: Clears old data when the teacher starts a fresh quiz execution run
  socket.on('start_quiz', async ({ quizId, tenantId }) => {
    try {
      console.log(`🧹 FLUSHING PREVIOUS REAL-TIME RESULTS FOR QUIZ: ${quizId}`);
      
      // 1. Completely remove the old Redis sorted set data key
      await redisClient.del(`quiz:${quizId}`);

      // 2. Clear old MongoDB fallback submissions for this specific execution session
      await Submission.deleteMany({ quizId: new mongoose.Types.ObjectId(quizId) });

      // 3. Set the quiz state to active and broadcast the first question
      const quiz = await Quiz.findOneAndUpdate(
        { _id: quizId, tenantId }, 
        { status: 'active', currentQuestionIndex: 0 }, 
        { new: true }
      );

      // Force-emit an empty leaderboard array right away to clear the screens of old entries
      io.to(quizId).emit('leaderboard_updated', []);
      io.to(quizId).emit('quiz_started', { question: quiz.questions[0], index: 0 });
    } catch (err) {
      console.error("Start Quiz error:", err);
    }
  });

  socket.on('next_question', async ({ quizId, tenantId }) => {
    try {
      const quiz = await Quiz.findOne({ _id: quizId, tenantId });
      
      if (!quiz) {
        console.error(`Next Question Error: Quiz not found for ID ${quizId}`);
        return;
      }

      const nextIndex = quiz.currentQuestionIndex + 1;

      if (nextIndex < quiz.questions.length) {
        quiz.currentQuestionIndex = nextIndex;
        await quiz.save();

        console.log(`Advancing Quiz ${quizId} to Question Index ${nextIndex}`);
        io.to(quizId).emit('next_question', { 
          question: quiz.questions[nextIndex], 
          index: nextIndex 
        });
      } else {
        quiz.status = 'ended';
        await quiz.save();
        
        console.log(`Quiz ${quizId} has reached the end.`);
        io.to(quizId).emit('quiz_ended');
      }
    } catch (err) {
      console.error('Socket next_question failure:', err);
    }
  });

  socket.on('submit_answer', async (data) => {
    try {
      console.log("Inbound Answer Data Ingestion Payload:", data);

      // 1. Stream raw payload directly to Kafka broker topic log
      await producer.send({
        topic: 'quiz-submissions',
        messages: [{ value: JSON.stringify(data) }]
      }).catch(e => console.log("Kafka broker offline notification (Bypassing direct hook):", e.message));

      const { tenantId, quizId, studentId, questionId, selectedAnswer } = data;
      
      // Clean up inputs and cast them cleanly
      const cleanStudentIdStr = String(studentId).trim().replace(/^["']|["']$/g, '');
      const cleanQuizIdStr = String(quizId).trim().replace(/^["']|["']$/g, '');
      const cleanQuestionIdStr = String(questionId).trim().replace(/^["']|["']$/g, '');

      const quiz = await Quiz.findById(cleanQuizIdStr);
      if (quiz) {
        // DEFENSIVE LOOKUP: Find the question by iterating the array manually to prevent Mongoose .id() bugs
        const question = quiz.questions.find(q => q._id.toString() === cleanQuestionIdStr);
        
        if (question) {
          const isCorrect = question.correctAnswer === selectedAnswer;
          const points = isCorrect ? 10 : 0;
          
          console.log(`Evaluating Choice: Corect Answer is [${question.correctAnswer}], Selected was [${selectedAnswer}]. Points: ${points}`);

          let submission = await Submission.findOne({ quizId: cleanQuizIdStr, studentId: cleanStudentIdStr, tenantId });
          if (!submission) {
            submission = new Submission({ tenantId, quizId: cleanQuizIdStr, studentId: cleanStudentIdStr, answers: [], score: 0 });
          }

          const alreadyAnswered = submission.answers.some(a => a.questionId.toString() === cleanQuestionIdStr);
          if (!alreadyAnswered) {
            submission.answers.push({ questionId: cleanQuestionIdStr, selectedAnswer, isCorrect });
            if (isCorrect) submission.score += points;
            await submission.save();
            
            console.log(`🔥 SUCCESS: Writing to Redis Set -> quiz:${cleanQuizIdStr} | Student: ${cleanStudentIdStr} | Points added: ${points}`);
            
            // Push directly to live Redis sorted set cache
            await redisClient.zIncrBy(`quiz:${cleanQuizIdStr}`, points, cleanStudentIdStr);
          } else {
            console.log(`⚠️ Answer rejected: Student ${cleanStudentIdStr} already completed this question block.`);
          }
        } else {
          console.error(`❌ Evaluation Error: Question ID ${cleanQuestionIdStr} not found inside Quiz dataset questions array.`);
        }
      } else {
        console.error(`❌ Evaluation Error: Quiz ID ${cleanQuizIdStr} not found in MongoDB.`);
      }

      // Fire computed data down the WebSocket line room pipe
      await broadcastLeaderboard(cleanQuizIdStr);

    } catch (error) {
      console.error("Direct real-time answer ingestion crash:", error);
    }
  });
  // TARGETED LEADERBOARD ROOM DEMAND INTERCEPT HOOK
  socket.on('get_leaderboard', async ({ quizId }) => {
    await broadcastLeaderboard(quizId);
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));