import mongoose, { Document, Schema } from 'mongoose'

export interface IStudentResult {
  studentId?: mongoose.Types.ObjectId
  studentName: string
  rollNo: string
  marksObtained?: number
  correct?: number
  incorrect?: number
  unattempted?: number
  rank?: number
  percentage?: number
  absent: boolean
}

export interface ITestResult extends Document {
  testId: mongoose.Types.ObjectId
  studentResults: IStudentResult[]
  createdAt: Date
  updatedAt: Date
}

const StudentResultSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: false },
  studentName: { type: String, required: true },
  rollNo: { type: String, default: '' },
  marksObtained: { type: Number },
  correct: { type: Number },
  incorrect: { type: Number },
  unattempted: { type: Number },
  rank: { type: Number },
  percentage: { type: Number },
  absent: { type: Boolean, default: false }
})

const TestResultSchema = new Schema<ITestResult>(
  {
    testId: { type: Schema.Types.ObjectId, ref: 'Test', required: true, unique: true },
    studentResults: [StudentResultSchema]
  },
  { timestamps: true }
)

export default mongoose.models.TestResult || mongoose.model<ITestResult>('TestResult', TestResultSchema)
