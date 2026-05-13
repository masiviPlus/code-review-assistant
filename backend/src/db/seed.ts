import mongoose from 'mongoose';
import { Achievement } from '../models/Achievement';
import { connectDB } from './connection';
import { env } from '../config/env';

const ACHIEVEMENTS = [
  {
    code: 'first_steps',
    name: 'First Steps',
    description: '1st submission ever',
    criteria: 'Submit your first code review',
  },
  {
    code: 'style_master',
    name: 'Style Master',
    description: '5 submissions with style score >= 90',
    criteria: 'Achieve a style score of 90 or above on 5 submissions',
  },
  {
    code: 'bug_hunter',
    name: 'Bug Hunter',
    description: 'Submission caught 5+ error-level issues',
    criteria: 'Have a single submission that surfaces 5 or more error-level issues',
  },
  {
    code: 'consistent',
    name: 'Consistent',
    description: '7-day submission streak',
    criteria: 'Submit code for review on 7 consecutive days',
  },
  {
    code: 'marathoner',
    name: 'Marathoner',
    description: '30-day submission streak',
    criteria: 'Submit code for review on 30 consecutive days',
  },
  {
    code: 'perfectionist',
    name: 'Perfectionist',
    description: 'scoreOverall = 100 on submission > 30 lines',
    criteria: 'Receive a perfect 100 overall score on a submission longer than 30 lines',
  },
  {
    code: 'reformed',
    name: 'Reformed',
    description: 'Improved score by 30+ points on a re-submission',
    criteria: 'Improve your overall score by 30 or more points on a re-submission',
  },
  {
    code: 'polyglot',
    name: 'Polyglot',
    description: 'Submit code in 3 different languages (stretch goal)',
    criteria: 'Submit code for review in 3 different programming languages',
  },
];

export async function seedAchievements(): Promise<void> {
  const ops = ACHIEVEMENTS.map((a) => ({
    updateOne: {
      filter: { code: a.code },
      update: { $setOnInsert: a },
      upsert: true,
    },
  }));

  await Achievement.bulkWrite(ops);
}

async function main(): Promise<void> {
  console.log('Seed: connecting to MongoDB...');
  await connectDB(env.MONGODB_URI);
  console.log(`Seed: connected. Upserting ${ACHIEVEMENTS.length} achievements...`);

  await seedAchievements();

  const count = await Achievement.countDocuments();
  console.log(`Seed: complete. Total achievements in DB: ${count}`);

  await mongoose.disconnect();
  console.log('Seed: done. Exiting.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}