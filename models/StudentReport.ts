import mongoose, { Document, Schema } from 'mongoose'

export interface IStudentEntry {
  name: string
  rollNo: string
  marks: number
  maxMarks: number
  grade: string
  attendance: number
  remarks?: string
}

export interface IStudentReport extends Document {
  teacherId: mongoose.Types.ObjectId
  teacherName: string
  className: string
  subject: string
  term: string
  uploadedAt: Date
  students: IStudentEntry[]
}

const StudentEntrySchema = new Schema<IStudentEntry>(
  {
    name: { type: String, required: true, trim: true },
    rollNo: { type: String, required: true, trim: true },
    marks: { type: Number, required: true, min: 0 },
    maxMarks: { type: Number, required: true, min: 1, default: 100 },
    grade: { type: String, required: true, trim: true },
    attendance: { type: Number, required: true, min: 0, max: 100 },
    remarks: { type: String, trim: true },
  },
  { _id: false }
)

const StudentReportSchema = new Schema<IStudentReport>(
  {
    teacherId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    teacherName: { type: String, required: true, trim: true },
    className: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    term: { type: String, required: true, trim: true },
    uploadedAt: { type: Date, default: Date.now },
    students: { type: [StudentEntrySchema], required: true },
  },
  { timestamps: true }
)

export default mongoose.models.StudentReport ||
  mongoose.model<IStudentReport>('StudentReport', StudentReportSchema)
