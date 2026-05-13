import { Schema, model, InferSchemaType } from 'mongoose';

const pointsLedgerSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission' },
    amount: { type: Number, required: true },
    reason: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type IPointsLedger = InferSchemaType<typeof pointsLedgerSchema>;
export const PointsLedger = model('PointsLedger', pointsLedgerSchema);
