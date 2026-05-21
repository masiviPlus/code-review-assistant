'use client';

import { useTheme } from '@/contexts/theme-context';

/** Returns the Monaco editor theme name matching the current app theme. */
export function useMonacoTheme(): string {
  const { theme } = useTheme();
  return theme === 'dark' ? 'vs-dark' : 'vs-light';
}
