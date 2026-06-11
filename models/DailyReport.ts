import mongoose, { Document, Schema } from 'mongoose'

export interface IClassHeld {
  className: string
  subject: string
  topicCovered: string
  studentsPresent: number
}

export interface IDailyReport extends Document {
  teacherName: string
  teacherEmail: string
  date: string
  classesHeld: IClassHeld[]
  activitiesConducted: string
  materialsUsed: string
  studentsAttended: string
  remarks: string
  status: 'draft' | 'submitted'
}

const ClassHeldSchema = new Schema<IClassHeld>(
  {
    className: { type: String, required: true },
    subject: { type: String, required: true },
    topicCovered: { type: String, required: true },
    studentsPresent: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const DailyReportSchema = new Schema<IDailyReport>(
  {
    teacherName: { type: String, required: true },
    teacherEmail: { type: String, required: true },
    date: { type: String, required: true },
    classesHeld: { type: [ClassHeldSchema], default: [] },
    activitiesConducted: { type: String, default: '' },
    materialsUsed: { type: String, default: '' },
    studentsAttended: { type: String, default: '' },
    remarks: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'submitted'], default: 'draft' },
  },
  { timestamps: true }
)

// Compound index: one report per teacher per date
DailyReportSchema.index({ teacherEmail: 1, date: 1 }, { unique: true })

export default mongoose.models.DailyReport ||
  mongoose.model<IDailyReport>('DailyReport', DailyReportSchema)
