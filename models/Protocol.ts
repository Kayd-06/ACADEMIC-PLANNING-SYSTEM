import mongoose, { Schema } from 'mongoose'

const ProtocolSchema = new Schema({
  label: { type: String, required: true },
  sub: { type: String, required: true },
  status: { type: String, enum: ['completed', 'pending', 'overdue'], default: 'pending' },
  reviewedAt: { type: String },
  overdueDays: { type: Number, default: 0 },
}, { timestamps: true })

export default mongoose.models.Protocol || mongoose.model('Protocol', ProtocolSchema)
