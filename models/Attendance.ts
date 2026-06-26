import mongoose, { Document, Schema } from 'mongoose'

export interface IAttendanceRecord {
  studentId: string
  studentName: string
  rollNo?: string
  status: 'Present' | 'Absent' | 'Late' | ''
  notes?: string
}

export interface IAttendance extends Document {
  date: string
  batch: string
  subject: string
  classTime: string
  records: IAttendanceRecord[]
  createdAt: Date
  updatedAt: Date
}

const AttendanceRecordSchema = new Schema<IAttendanceRecord>({
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  rollNo: { type: String, default: '' },
  status: { type: String, enum: ['Present', 'Absent', 'Late', ''], default: '' },
  notes: { type: String, default: '' }
})

const AttendanceSchema = new Schema<IAttendance>(
  {
    date: { type: String, required: true },
    batch: { type: String, required: true },
    subject: { type: String, required: true },
    classTime: { type: String, required: true },
    records: [AttendanceRecordSchema]
  },
  { timestamps: true }
)

// Index to prevent double marking of attendance on same day for same subject and batch
AttendanceSchema.index({ date: 1, batch: 1, subject: 1 }, { unique: true })

export default mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema)
