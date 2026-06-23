import mongoose, { Document, Schema } from 'mongoose'

export interface IFeedback extends Document {
  senderName: string
  isAnonymous: boolean
  rating: number
  content: string
  type: 'Student -> Teacher' | 'Parent -> School' | 'Teacher -> Management'
  status: 'Submitted' | 'In Progress' | 'Resolved' | 'Dismissed'
  subject?: string
  batch?: string
  category?: string
  date: string // YYYY-MM-DD
  createdAt: Date
  updatedAt: Date
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    senderName: { type: String, required: true, trim: true },
    isAnonymous: { type: Boolean, required: true, default: false },
    rating: { type: Number, required: true, min: 1, max: 5 },
    content: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: ['Student -> Teacher', 'Parent -> School', 'Teacher -> Management']
    },
    status: {
      type: String,
      required: true,
      enum: ['Submitted', 'In Progress', 'Resolved', 'Dismissed'],
      default: 'Submitted'
    },
    subject: { type: String, trim: true },
    batch: { type: String, trim: true },
    category: { type: String, trim: true },
    date: { type: String, required: true }
  },
  { timestamps: true }
)

export default mongoose.models.Feedback || mongoose.model<IFeedback>('Feedback', FeedbackSchema)
