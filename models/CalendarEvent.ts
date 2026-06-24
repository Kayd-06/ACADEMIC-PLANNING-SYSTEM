import mongoose, { Document, Schema } from 'mongoose'

export interface ICalendarEvent extends Document {
  title: string
  date: string // YYYY-MM-DD
  endDate?: string // YYYY-MM-DD
  type: 'Holiday' | 'Exam/Test' | 'Event' | 'Parent Meeting'
  scope: string
  description?: string
  createdAt: Date
  updatedAt: Date
}

const CalendarEventSchema = new Schema<ICalendarEvent>(
  {
    title: { type: String, required: true, trim: true },
    date: { type: String, required: true },
    endDate: { type: String },
    type: {
      type: String,
      required: true,
      enum: ['Holiday', 'Exam/Test', 'Event', 'Parent Meeting']
    },
    scope: { type: String, required: true, trim: true },
    description: { type: String, default: '' }
  },
  { timestamps: true }
)

export default mongoose.models.CalendarEvent || mongoose.model<ICalendarEvent>('CalendarEvent', CalendarEventSchema)
