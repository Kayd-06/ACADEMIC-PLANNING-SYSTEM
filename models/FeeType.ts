import mongoose, { Document, Schema } from 'mongoose'

export interface IFeeType extends Document {
  name: string
  description?: string
  programBatch: string
  amount: number
  frequency: 'One-time' | 'Monthly' | 'Quarterly' | 'Yearly'
  academicYear: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const FeeTypeSchema = new Schema<IFeeType>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    programBatch: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    frequency: { type: String, required: true, enum: ['One-time', 'Monthly', 'Quarterly', 'Yearly'] },
    academicYear: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
)

export default mongoose.models.FeeType || mongoose.model<IFeeType>('FeeType', FeeTypeSchema)
