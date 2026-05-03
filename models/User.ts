import mongoose, { Document, Schema } from 'mongoose'

export interface IUser extends Document {
  name: string
  email: string
  password: string
  role: 'teacher' | 'management'
  status: 'pending_verification' | 'active'
  department?: string
  employeeId?: string
  createdAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['teacher', 'management'], required: true },
    status: {
      type: String,
      enum: ['pending_verification', 'active'],
      default: 'pending_verification',
    },
    department: { type: String, trim: true },
    employeeId: { type: String, trim: true },
  },
  { timestamps: true }
)

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema)
