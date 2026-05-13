import { Schema, model, InferSchemaType } from 'mongoose';

const ROLES = ['user', 'admin'] as const;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, default: 'user' },
    totalPoints: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type IUser = InferSchemaType<typeof userSchema>;
export const User = model('User', userSchema);
