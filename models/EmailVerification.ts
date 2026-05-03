import mongoose, { Document, Schema } from 'mongoose'

export interface IEmailVerification extends Document {
  userId: mongoose.Types.ObjectId
  token: string
  expiresAt: Date
}

const EmailVerificationSchema = new Schema<IEmailVerification>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
})

EmailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default mongoose.models.EmailVerification ||
  mongoose.model<IEmailVerification>('EmailVerification', EmailVerificationSchema)
