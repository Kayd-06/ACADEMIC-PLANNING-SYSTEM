import mongoose from 'mongoose'

const ProgramSchema = new mongoose.Schema({
  title: { type: String, required: true },
  target: { type: String, required: true },
  batches: { type: Number, required: true },
  students: { type: Number, required: true },
  subjects: { type: Number, required: true },
  colorTheme: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
})

export default mongoose.models.Program || mongoose.model('Program', ProgramSchema)
