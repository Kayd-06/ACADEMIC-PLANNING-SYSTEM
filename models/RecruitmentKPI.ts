import mongoose from 'mongoose'

const RecruitmentKPISchema = new mongoose.Schema({
  label: { type: String, required: true },
  value: { type: String, required: true },
  subtext: { type: String, required: true },
  iconName: { type: String, required: true },
  subcolor: { type: String, required: true },
  subbg: { type: String, required: true },
  order: { type: Number, default: 0 }
}, { timestamps: true })

export default mongoose.models.RecruitmentKPI || mongoose.model('RecruitmentKPI', RecruitmentKPISchema)
