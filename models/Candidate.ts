import mongoose, { Document, Schema } from 'mongoose'

export interface ICandidate extends Document {
  name: string
  roleApplied: string
  department: string
  status: 'Requirement' | 'Shortlisted' | 'Interview Scheduled' | 'Under Review'
  nextStep: string
  theme: string
  avatarInitials: string
  schedule: string
  createdAt: Date
}

const CandidateSchema = new Schema<ICandidate>(
  {
    name: { type: String, required: true, trim: true },
    roleApplied: { type: String, required: true },
    department: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['Requirement', 'Shortlisted', 'Interview Scheduled', 'Under Review'],
      default: 'Under Review'
    },
    nextStep: { type: String, default: 'Initial Review' },
    theme: { type: String, default: 'blue' },
    avatarInitials: { type: String, default: '' },
    schedule: { type: String, default: '' }
  },
  { timestamps: true }
)

export default mongoose.models.Candidate || mongoose.model<ICandidate>('Candidate', CandidateSchema)
