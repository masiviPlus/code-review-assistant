'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ApiStatus } from '@/components/api-status';
import { useUser } from '@/contexts/auth-context';

export default function Home() {
  const { user, loading } = useUser();
  const router = useRouter();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  if (loading || user) {
    return null;
  }

  return (
    <div className="flex min-h-[calc(100vh-2.75rem)] flex-col">
      <main className="mx-auto max-w-2xl flex-1 px-6 py-24">
        <h1 className="text-2xl font-semibold tracking-tight">
          Code Review Assistant
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Submit JavaScript code for automated review. Get structured feedback on
          quality, maintainability, and common pitfalls — with a score and
          actionable suggestions for every submission.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/register">Create account</Link>
          </Button>
        </div>
      </main>
      <footer className="border-t border-border px-6 py-4">
        <div className="mx-auto max-w-2xl">
          <ApiStatus />
        </div>
      </footer>
    </div>
  );
}
