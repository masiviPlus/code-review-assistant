'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/contexts/theme-context';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, toggle } = useTheme();
  const Icon = theme === 'light' ? Sun : Moon;

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <button
        type="button"
        onClick={toggle}
        aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
        className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Icon className="h-4 w-4" />
      </button>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
