import mongoose, { Document, Schema } from 'mongoose'

export interface ITest extends Document {
  title: string
  batch: string
  subject: string
  date: string // YYYY-MM-DD
  time: string // e.g. 10:00 AM
  duration: number // in minutes
  totalMarks: number
  averageScore?: number // average percentage scored by students
  status: 'Upcoming' | 'Pending Grading' | 'Graded'
  testType?: 'Unit Test' | 'Mock' | 'DPP'
  createdAt: Date
  updatedAt: Date
}

const TestSchema = new Schema<ITest>(
  {
    title: { type: String, required: true, trim: true },
    batch: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    time: { type: String, required: true },
    duration: { type: Number, required: true, min: 1 },
    totalMarks: { type: Number, required: true, min: 0 },
    averageScore: { type: Number, min: 0, max: 100 },
    status: { 
      type: String, 
      required: true, 
      enum: ['Upcoming', 'Pending Grading', 'Graded'], 
      default: 'Upcoming' 
    },
    testType: {
      type: String,
      enum: ['Unit Test', 'Mock', 'DPP'],
      default: 'Unit Test'
    }
  },
  { timestamps: true }
)

export default mongoose.models.Test || mongoose.model<ITest>('Test', TestSchema)
