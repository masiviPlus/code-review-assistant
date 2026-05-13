import { Schema, model, InferSchemaType } from 'mongoose';

const userAchievementSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  achievementId: {
    type: Schema.Types.ObjectId,
    ref: 'Achievement',
    required: true,
  },
  unlockedAt: { type: Date, default: Date.now },
});

userAchievementSchema.index({ userId: 1, achievementId: 1 }, { unique: true });

export type IUserAchievement = InferSchemaType<typeof userAchievementSchema>;
export const UserAchievement = model('UserAchievement', userAchievementSchema);
