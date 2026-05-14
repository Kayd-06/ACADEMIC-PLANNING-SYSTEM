import mongoose, { Document, Schema } from 'mongoose'

export interface IOrientation extends Document {
  title: string
  date: string // e.g. "OCT 12"
  location: string
  time: string
  createdAt: Date
}

const OrientationSchema = new Schema<IOrientation>(
  {
    title: { type: String, required: true },
    date: { type: String, required: true },
    location: { type: String, required: true },
    time: { type: String, required: true }
  },
  { timestamps: true }
)

export default mongoose.models.Orientation || mongoose.model<IOrientation>('Orientation', OrientationSchema)
