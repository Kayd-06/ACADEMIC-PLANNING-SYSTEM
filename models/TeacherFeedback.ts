import mongoose, { Document, Schema } from 'mongoose'

export interface ITeacherFeedback extends Document {
  from: string
  context: string
  content: string
  type: 'student' | 'coordinator'
}

const TeacherFeedbackSchema = new Schema<ITeacherFeedback>(
  {
    from: { type: String, required: true },
    context: { type: String, required: true },
    content: { type: String, required: true },
    type: { type: String, enum: ['student', 'coordinator'], required: true }
  },
  { timestamps: true }
)

export default mongoose.models.TeacherFeedback || mongoose.model<ITeacherFeedback>('TeacherFeedback', TeacherFeedbackSchema)
