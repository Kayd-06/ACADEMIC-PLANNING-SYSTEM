import mongoose, { Document, Schema } from 'mongoose'

export interface IStudent extends Document {
  name: string
  rollNo: string
  class: string
  section: string
  parentContact?: string
  isActive: boolean
}

const StudentSchema = new Schema<IStudent>(
  {
    name: { type: String, required: true, trim: true },
    rollNo: { type: String, required: true, trim: true },
    class: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true },
    parentContact: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

// One roll number per class+section
StudentSchema.index({ rollNo: 1, class: 1, section: 1 }, { unique: true })

export default mongoose.models.Student ||
  mongoose.model<IStudent>('Student', StudentSchema)
