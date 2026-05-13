import { Schema, model, InferSchemaType } from 'mongoose';

const SEVERITIES = ['info', 'warning', 'error'] as const;
const CATEGORIES = ['style', 'best_practice', 'logic', 'readability'] as const;

const issueSchema = new Schema({
  submissionId: {
    type: Schema.Types.ObjectId,
    ref: 'Submission',
    required: true,
    index: true,
  },
  severity: { type: String, enum: SEVERITIES, required: true },
  category: { type: String, enum: CATEGORIES, required: true },
  lineNumber: { type: Number },
  message: { type: String },
  suggestion: { type: String },
});

export type IIssue = InferSchemaType<typeof issueSchema>;
export const Issue = model('Issue', issueSchema);
