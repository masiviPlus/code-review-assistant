import { Schema, model, InferSchemaType } from 'mongoose';

const STATUSES = ['analysing', 'complete', 'failed'] as const;

const scoreBreakdownSchema = new Schema(
  {
    style: { type: Number, min: 0, max: 100 },
    bestPractices: { type: Number, min: 0, max: 100 },
    logic: { type: Number, min: 0, max: 100 },
    readability: { type: Number, min: 0, max: 100 },
  },
  { _id: false },
);

const submissionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    code: { type: String, required: true },
    language: { type: String, default: 'javascript' },
    status: { type: String, enum: STATUSES, default: 'analysing' },
    scoreOverall: { type: Number },
    scoreBreakdown: { type: scoreBreakdownSchema },
    summary: { type: String },
    llmRawResponse: { type: String },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type ISubmission = InferSchemaType<typeof submissionSchema>;
export const Submission = model('Submission', submissionSchema);
