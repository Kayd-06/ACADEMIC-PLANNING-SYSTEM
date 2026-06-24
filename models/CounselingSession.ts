import mongoose, { Document, Schema } from 'mongoose'

export interface ICounselingSession extends Document {
  studentName: string
  studentInitials: string
  counselor: string
  type: 'Academic' | 'Career' | 'Personal' | 'Disciplinary'
  date: string        // YYYY-MM-DD
  time: string        // e.g. "10:30 AM"
  status: 'Scheduled' | 'Completed' | 'No-Show' | 'Cancelled'
  notes?: string
  flagged: boolean
  createdAt: Date
  updatedAt: Date
}

const CounselingSessionSchema = new Schema<ICounselingSession>(
  {
    studentName: { type: String, required: true, trim: true },
    studentInitials: { type: String, required: true, trim: true },
    counselor: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ['Academic', 'Career', 'Personal', 'Disciplinary'],
      default: 'Academic'
    },
    date: { type: String, required: true },
    time: { type: String, required: true },
    status: {
      type: String,
      required: true,
      enum: ['Scheduled', 'Completed', 'No-Show', 'Cancelled'],
      default: 'Scheduled'
    },
    notes: { type: String, default: '' },
    flagged: { type: Boolean, default: false }
  },
  { timestamps: true }
)

export default mongoose.models.CounselingSession ||
  mongoose.model<ICounselingSession>('CounselingSession', CounselingSessionSchema)
