import mongoose from 'mongoose'

// Delete the cached model in development to force Mongoose to compile with the new schema if changed
if (mongoose.models && mongoose.models.Announcement) {
  delete mongoose.models.Announcement
}

const AnnouncementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  label: { type: String }, // Backwards compatibility: matches title
  sub: { type: String },   // Backwards compatibility: matches content
  type: {
    type: String,
    enum: ['General', 'Academic', 'Exam', 'Holiday', 'Urgent', 'Fee'],
    default: 'General'
  },
  scope: { type: String, default: 'All' },
  pinned: { type: Boolean, default: false },
  urgent: { type: Boolean, default: false }, // Backwards compatibility: set true if type === 'Urgent'
  authorName: { type: String, default: 'Admin' },
  authorRole: { type: String, default: 'Staff' },
  expiryDate: { type: String }, // YYYY-MM-DD
  done: { type: Boolean, default: false }, // For read tracking backwards-compatibility
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
})

// Pre-save middleware to synchronize backwards-compatible fields
AnnouncementSchema.pre('save', function(this: any) {
  if (this.title) this.label = this.title;
  if (this.content) this.sub = this.content.slice(0, 100); // Truncate sub for compatibility
  if (this.type === 'Urgent') this.urgent = true;
})

export default mongoose.models.Announcement || mongoose.model('Announcement', AnnouncementSchema)
