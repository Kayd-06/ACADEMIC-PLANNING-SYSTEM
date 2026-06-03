import mongoose, { Schema } from 'mongoose'

const AppraisalSchema = new Schema({
  facultyName: { type: String, required: true },
  department: { type: String, required: true },
  reviewType: { type: String, required: true }, // e.g. 'Annual Performance', 'Tenure Review'
  rating: { type: String, enum: ['Excellent', 'Satisfactory', 'Needs Improvement', 'Outstanding'], default: 'Satisfactory' },
  notes: { type: String, default: '' },
  scheduledDate: { type: String }, // for upcoming appraisals
  scheduledTime: { type: String }, // e.g. '10:00 AM'
  isCompleted: { type: Boolean, default: false },
  avatarInitials: { type: String, default: '' },
}, { timestamps: true })

export default mongoose.models.Appraisal || mongoose.model('Appraisal', AppraisalSchema)
