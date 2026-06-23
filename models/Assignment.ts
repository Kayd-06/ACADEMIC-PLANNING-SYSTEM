import mongoose, { Document, Schema } from 'mongoose'

export interface IAssignment extends Document {
  title: string
  chapter: string
  batch: string
  subject: string
  type: 'Homework' | 'DPP'
  dueDate: string // YYYY-MM-DD
  dueTime: string // e.g. 11:59 PM
  submittedCount: number
  totalStudents: number
  status: 'Active' | 'Overdue Eval' | 'Evaluated'
  teacherEmail: string
  createdAt: Date
  updatedAt: Date
}

const AssignmentSchema = new Schema<IAssignment>(
  {
    title: { type: String, required: true, trim: true },
    chapter: { type: String, required: true, trim: true },
    batch: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ['Homework', 'DPP'], default: 'Homework' },
    dueDate: { type: String, required: true },
    dueTime: { type: String, required: true, default: '11:59 PM' },
    submittedCount: { type: Number, required: true, default: 0, min: 0 },
    totalStudents: { type: Number, required: true, default: 40, min: 1 },
    status: {
      type: String,
      required: true,
      enum: ['Active', 'Overdue Eval', 'Evaluated'],
      default: 'Active'
    },
    teacherEmail: { type: String, required: true, lowercase: true }
  },
  { timestamps: true }
)

export default mongoose.models.Assignment || mongoose.model<IAssignment>('Assignment', AssignmentSchema)
