import mongoose from 'mongoose'

const SchoolSchema = new mongoose.Schema({
  name: { type: String, required: true, default: 'Academic Planning System' },
  board: { type: String, required: true, default: 'CBSE Affiliated' },
  classes: { type: String, required: true, default: 'Nursery – XII' },
  programs: { type: String, required: true, default: 'STEM, Humanities, Arts' },
  mouStatus: { type: String, required: true, default: 'Active (2025)' },
  updatedAt: { type: Date, default: Date.now }
})

export default mongoose.models.School || mongoose.model('School', SchoolSchema)
