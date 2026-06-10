import mongoose from 'mongoose';

const SubmissionSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, enum: ['COMSATS', 'FAST', 'NUST'] },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  answers: [{
    questionId: String,
    selectedAnswer: String,
    isCorrect: Boolean
  }],
  score: { type: Number, default: 0 }
});

export default mongoose.model('Submission', SubmissionSchema);