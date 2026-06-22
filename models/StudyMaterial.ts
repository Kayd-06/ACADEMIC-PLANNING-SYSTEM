import mongoose, { Document, Schema } from 'mongoose'

export interface IStudyMaterial extends Document {
  provider: string
  count: number
  type: string // e.g. "PDFs", "Tests"
  subject: string
  initials: string
  fileName?: string
  fileSize?: string
  fileUrl?: string
}

const StudyMaterialSchema = new Schema<IStudyMaterial>(
  {
    provider: { type: String, required: true },
    count: { type: Number, required: true },
    type: { type: String, required: true },
    subject: { type: String, required: true },
    initials: { type: String, required: true },
    fileName: { type: String },
    fileSize: { type: String },
    fileUrl: { type: String }
  },
  { timestamps: true }
)

delete mongoose.models.StudyMaterial
export default mongoose.model<IStudyMaterial>('StudyMaterial', StudyMaterialSchema)
