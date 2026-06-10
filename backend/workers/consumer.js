import { connectDB } from '../config/db.js';
import { consumer } from '../config/kafka.js';
import redisClient from '../config/redis.js';
import Quiz from '../models/Quiz.js';
import Submission from '../models/Submission.js';
import dotenv from 'dotenv';

dotenv.config();
await connectDB();
await consumer.connect();
await consumer.subscribe({ topic: 'quiz-submissions', fromBeginning: true });

await consumer.run({
  eachMessage: async ({ message }) => {
    const { tenantId, quizId, studentId, questionId, selectedAnswer } = JSON.parse(message.value.toString());
    
    const quiz = await Quiz.findOne({ _index: quizId, tenantId });
    if (!quiz) return;

    const question = quiz.questions.id(questionId);
    if (!question) return;

    const isCorrect = question.correctAnswer === selectedAnswer;
    const points = isCorrect ? 10 : 0;

    let submission = await Submission.findOne({ quizId, studentId, tenantId });
    if (!submission) {
      submission = new Submission({ tenantId, quizId, studentId, answers: [], score: 0 });
    }

    const existingAnswerIndex = submission.answers.findIndex(a => a.questionId === questionId);
    if (existingAnswerIndex > -1) return; 

    submission.answers.push({ questionId, selectedAnswer, isCorrect });
    if (isCorrect) submission.score += points;
    await submission.save();

    await redisClient.zIncrBy(`quiz:${quizId}`, points, studentId);
  }
});