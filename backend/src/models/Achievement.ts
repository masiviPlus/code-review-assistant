import { Schema, model, InferSchemaType } from 'mongoose';

const achievementSchema = new Schema({
  code: { type: String, required: true, unique: true },
  name: { type: String },
  description: { type: String },
  criteria: { type: String },
  iconRef: { type: String },
});

export type IAchievement = InferSchemaType<typeof achievementSchema>;
export const Achievement = model('Achievement', achievementSchema);
