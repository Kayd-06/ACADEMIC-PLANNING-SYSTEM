import mongoose, { Document, Schema } from 'mongoose'

export interface IPaymentRecord extends Document {
  studentId: mongoose.Types.ObjectId
  studentName: string
  rollNo?: string
  class?: string
  section?: string
  feeTypeId: mongoose.Types.ObjectId
  feeName: string
  amountPaid: number
  totalAmount: number
  status: 'Paid' | 'Pending' | 'Overdue'
  dueDate: Date
  paidDate?: Date
  transactionId?: string
  paymentMethod?: 'Cash' | 'Card' | 'UPI' | 'Net Banking'
  createdAt: Date
  updatedAt: Date
}

const PaymentRecordSchema = new Schema<IPaymentRecord>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    studentName: { type: String, required: true },
    rollNo: { type: String, default: '' },
    class: { type: String, default: '' },
    section: { type: String, default: '' },
    feeTypeId: { type: Schema.Types.ObjectId, ref: 'FeeType', required: true },
    feeName: { type: String, required: true },
    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    status: { type: String, required: true, enum: ['Paid', 'Pending', 'Overdue'], default: 'Pending' },
    dueDate: { type: Date, required: true },
    paidDate: { type: Date },
    transactionId: { type: String, default: '' },
    paymentMethod: { type: String, enum: ['Cash', 'Card', 'UPI', 'Net Banking'] },
  },
  { timestamps: true }
)

export default mongoose.models.PaymentRecord || mongoose.model<IPaymentRecord>('PaymentRecord', PaymentRecordSchema)
