import mongoose, { Document, Schema } from 'mongoose'

export interface IStudent extends Document {
  name: string
  rollNo?: string
  class?: string
  section?: string
  parentContact?: string
  isActive: boolean
}

const StudentSchema = new Schema<IStudent>(
  {
    name: { type: String, required: true, trim: true },
    rollNo: { type: String, trim: true, default: '' },
    class: { type: String, trim: true, default: '' },
    section: { type: String, trim: true, default: '' },
    parentContact: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

// Dedup only when rollNo+class+section are all non-empty (sparse prevents blank collisions)
StudentSchema.index(
  { rollNo: 1, class: 1, section: 1 },
  {
    unique: true,
    partialFilterExpression: {
      rollNo: { $gt: '' },
      class: { $gt: '' },
      section: { $gt: '' },
    },
  }
)

export default mongoose.models.Student ||
  mongoose.model<IStudent>('Student', StudentSchema)
