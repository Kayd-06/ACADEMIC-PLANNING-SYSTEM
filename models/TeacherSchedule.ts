import mongoose, { Document, Schema } from 'mongoose'

export interface ITeacherSchedule extends Document {
  date: string
  time: string
  activity: string
  batch: string
  location: string
  status: 'Upcoming' | 'Pending' | 'Completed'
}

const TeacherScheduleSchema = new Schema<ITeacherSchedule>(
  {
    date: { type: String, required: true },
    time: { type: String, required: true },
    activity: { type: String, required: true },
    batch: { type: String, required: true },
    location: { type: String, required: true },
    status: { type: String, enum: ['Upcoming', 'Pending', 'Completed'], default: 'Pending' }
  },
  { timestamps: true }
)

if (mongoose.models.TeacherSchedule) {
  delete mongoose.models.TeacherSchedule
}

export default mongoose.model<ITeacherSchedule>('TeacherSchedule', TeacherScheduleSchema)
