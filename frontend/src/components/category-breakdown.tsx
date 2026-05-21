'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { ScoreBreakdown } from '@/lib/types';
import { barFill } from '@/lib/score-utils';

const CATEGORY_LABELS: Record<string, string> = {
  style: 'Style',
  bestPractices: 'Best Practices',
  logic: 'Logic',
  readability: 'Readability',
};

export function CategoryBreakdown({ averages }: { averages: ScoreBreakdown }) {
  const data = Object.entries(averages).map(([key, value]) => ({
    category: CATEGORY_LABELS[key] ?? key,
    score: value,
  }));

  return (
    <div className="h-36">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            type="category"
            dataKey="category"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={90}
            stroke="hsl(var(--muted-foreground))"
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid hsl(var(--border))',
              boxShadow: 'none',
            }}
            formatter={(value) => [`${value}`, 'Avg']}
          />
          <Bar dataKey="score" radius={[0, 3, 3, 0]} barSize={14}>
            {data.map((entry, i) => (
              <Cell key={i} fill={barFill(entry.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
