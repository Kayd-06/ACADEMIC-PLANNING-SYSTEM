import mongoose, { Document, Schema } from 'mongoose'

export interface IQuestion extends Document {
  subject: string
  topic: string
  difficulty: 'Easy' | 'Medium' | 'Hard'
  type: 'MCQ' | 'Numerical' | 'Integer' | 'Subjective'
  text: string
  options?: string[]
  correctAnswer?: string
  marks?: number
  source?: string
  createdAt: Date
  updatedAt: Date
}

const QuestionSchema = new Schema<IQuestion>(
  {
    subject: { type: String, required: true, trim: true },
    topic: { type: String, required: true, trim: true },
    difficulty: { type: String, required: true, enum: ['Easy', 'Medium', 'Hard'] },
    type: { type: String, required: true, enum: ['MCQ', 'Numerical', 'Integer', 'Subjective'] },
    text: { type: String, required: true, trim: true },
    options: [{ type: String, trim: true }],
    correctAnswer: { type: String, trim: true },
    marks: { type: Number, default: 4 },
    source: { type: String, default: 'Custom', trim: true }
  },
  { timestamps: true }
)

export default mongoose.models.Question || mongoose.model<IQuestion>('Question', QuestionSchema)
