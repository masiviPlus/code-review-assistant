'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useRegister } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const registerSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be 100 characters or fewer'),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
});

type RegisterValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const registerUser = useRegister();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(values: RegisterValues) {
    setServerError(null);
    try {
      const result = await registerUser(
        values.email,
        values.password,
        values.displayName,
      );
      if (result.ok) {
        router.push('/submit');
      } else {
        setServerError(result.error.message);
      }
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : 'Something went wrong',
      );
    }
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight">
          Create an account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Fill in the details below to get started.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="displayName" className="text-sm font-medium">
            Display name
          </label>
          <Input
            id="displayName"
            type="text"
            placeholder="Jane Doe"
            autoComplete="name"
            {...register('displayName')}
          />
          {errors.displayName && (
            <p className="text-xs text-destructive">
              {errors.displayName.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <Input
            id="password"
            type="password"
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        {serverError && (
          <p className="text-xs text-destructive">{serverError}</p>
        )}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account\u2026' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="text-foreground underline underline-offset-4 hover:text-primary">
          Sign in
        </Link>
      </p>
    </>
  );
}
