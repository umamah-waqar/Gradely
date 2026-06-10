import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: String, required: true }
});

const QuizSchema = new mongoose.Schema({
  tenantId: { type: String, required: true, enum: ['COMSATS', 'FAST', 'NUST'] },
  title: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  questions: [QuestionSchema],
  status: { type: String, default: 'draft', enum: ['draft', 'active', 'ended'] },
  currentQuestionIndex: { type: Number, default: -1 }
});

export default mongoose.model('Quiz', QuizSchema);