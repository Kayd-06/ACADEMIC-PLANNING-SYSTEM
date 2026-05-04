import mongoose from 'mongoose'

const ProtocolSchema = new mongoose.Schema({
  label: { type: String, required: true },
  sub: { type: String, required: true },
  done: { type: Boolean, default: false },
  urgent: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
})

export default mongoose.models.Protocol || mongoose.model('Protocol', ProtocolSchema)
