import mongoose, { Document, Schema } from 'mongoose'

export interface ICandidate extends Document {
  name: string
  roleApplied: string
  department: string
  status: 'Requirement Announcement' | 'Shortlisted' | 'Interview Scheduled' | 'Offer Extended' | 'Under Review' | 'Pending'
  nextStep: string
  createdAt: Date
}

const CandidateSchema = new Schema<ICandidate>(
  {
    name: { type: String, required: true, trim: true },
    roleApplied: { type: String, required: true },
    department: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['Requirement Announcement', 'Shortlisted', 'Interview Scheduled', 'Offer Extended', 'Under Review', 'Pending'],
      default: 'Under Review'
    },
    nextStep: { type: String, default: 'Initial Review' }
  },
  { timestamps: true }
)

export default mongoose.models.Candidate || mongoose.model<ICandidate>('Candidate', CandidateSchema)
