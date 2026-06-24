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

const SyllabusChapterSchema = new mongoose.Schema({
  className: { type: String, required: true },
  subject: { type: String, required: true },
  title: { type: String, required: true },
  estHours: { type: String, required: true },
  dates: { type: String, required: true },
  status: { type: String, enum: ['NOT STARTED', 'IN PROGRESS', 'COMPLETED'], default: 'NOT STARTED' },
  notes: { type: String, default: '' },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
})

const SyllabusChapter = mongoose.models.SyllabusChapter || mongoose.model('SyllabusChapter', SyllabusChapterSchema)

export { Milestone, PlanningLog, AcademicMetric, SyllabusChapter }
