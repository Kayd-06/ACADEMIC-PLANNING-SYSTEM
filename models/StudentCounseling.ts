import mongoose, { Document, Schema } from 'mongoose'

export interface IStudentCounseling extends Document {
  studentName: string
  category: 'Attendance' | 'Behavior' | 'Academic' | 'Personal'
  description: string
}

const StudentCounselingSchema = new Schema<IStudentCounseling>(
  {
    studentName: { type: String, required: true },
    category: { type: String, enum: ['Attendance', 'Behavior', 'Academic', 'Personal'], required: true },
    description: { type: String, required: true }
  },
  { timestamps: true }
)

export default mongoose.models.StudentCounseling || mongoose.model<IStudentCounseling>('StudentCounseling', StudentCounselingSchema)
