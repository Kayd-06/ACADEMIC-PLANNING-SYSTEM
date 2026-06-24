import mongoose, { Document, Schema } from 'mongoose'

export interface IFaculty extends Document {
  name: string
  subject: string
  specialization: string
  batches: number
  experience: string
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE'
}

const FacultySchema = new Schema<IFaculty>(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    specialization: { type: String, required: true, trim: true },
    batches: { type: Number, required: true, default: 0 },
    experience: { type: String, required: true, trim: true },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'ON_LEAVE'], default: 'ACTIVE' },
  },
  { timestamps: true }
)

export default mongoose.models.Faculty ||
  mongoose.model<IFaculty>('Faculty', FacultySchema)
