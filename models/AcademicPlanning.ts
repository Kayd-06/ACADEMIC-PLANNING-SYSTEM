import mongoose from 'mongoose'

const MilestoneSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  date: { type: String, required: true },
  subject: { type: String, required: true },
  status: { type: String, required: true },
  role: { type: String, enum: ['management', 'teacher'], required: true },
  createdAt: { type: Date, default: Date.now }
})

const Milestone = mongoose.models.Milestone || mongoose.model('Milestone', MilestoneSchema)

const PlanningLogSchema = new mongoose.Schema({
  title: { type: String, required: true },
  focus: { type: String, required: true },
  type: { type: String, required: true },
  measure: { type: String, required: true },
  measureLabel: { type: String, required: true },
  role: { type: String, enum: ['management', 'teacher'], required: true },
  createdAt: { type: Date, default: Date.now }
})

const PlanningLog = mongoose.models.PlanningLog || mongoose.model('PlanningLog', PlanningLogSchema)

const AcademicMetricSchema = new mongoose.Schema({
  label: { type: String, required: true },
  value: { type: String, required: true },
  trend: { type: String, required: true },
  role: { type: String, enum: ['management', 'teacher'], required: true },
  category: { type: String, required: true }, // 'header_stat' or 'quality_stat'
  chartData: { type: [Number], default: [] },
  createdAt: { type: Date, default: Date.now }
})

const AcademicMetric = mongoose.models.AcademicMetric || mongoose.model('AcademicMetric', AcademicMetricSchema)

export { Milestone, PlanningLog, AcademicMetric }
