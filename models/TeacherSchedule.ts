import mongoose, { Document, Schema } from 'mongoose'

export interface ITeacherSchedule extends Document {
  time: string
  activity: string
  batch: string
  location: string
  status: 'Upcoming' | 'Pending' | 'Completed'
}

const TeacherScheduleSchema = new Schema<ITeacherSchedule>(
  {
    time: { type: String, required: true },
    activity: { type: String, required: true },
    batch: { type: String, required: true },
    location: { type: String, required: true },
    status: { type: String, enum: ['Upcoming', 'Pending', 'Completed'], default: 'Pending' }
  },
  { timestamps: true }
)

export default mongoose.models.TeacherSchedule || mongoose.model<ITeacherSchedule>('TeacherSchedule', TeacherScheduleSchema)
