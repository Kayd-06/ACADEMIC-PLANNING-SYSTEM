import mongoose from 'mongoose'

const RequirementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  department: { type: String, required: true },
  openPositions: { type: Number, required: true, default: 1 },
  status: { type: String, default: 'Open' },
  createdAt: { type: Date, default: Date.now }
})

export default mongoose.models.Requirement || mongoose.model('Requirement', RequirementSchema)
