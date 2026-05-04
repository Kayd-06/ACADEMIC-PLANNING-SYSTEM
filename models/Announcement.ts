import mongoose from 'mongoose'

const AnnouncementSchema = new mongoose.Schema({
  label: { type: String, required: true },
  sub: { type: String, required: true },
  done: { type: Boolean, default: false }, // Using this as 'read' or 'active'
  urgent: { type: Boolean, default: false }, // Using this as 'important'
  updatedAt: { type: Date, default: Date.now }
})

export default mongoose.models.Announcement || mongoose.model('Announcement', AnnouncementSchema)
