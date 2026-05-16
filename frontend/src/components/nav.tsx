'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser, useLogout } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const AUTH_PATHS = ['/login', '/register'];

export function Nav() {
  const pathname = usePathname();
  const { user, loading } = useUser();
  const logout = useLogout();

  // Hide nav on auth pages
  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
      <div className="flex items-center gap-4">
        <Link
          href={user ? '/dashboard' : '/'}
          className="text-sm font-semibold tracking-tight"
        >
          Code Review Assistant
        </Link>
        {user && (
          <div className="flex items-center gap-1">
            <NavLink href="/dashboard" current={pathname}>
              Dashboard
            </NavLink>
            <NavLink href="/submit" current={pathname}>
              Submit
            </NavLink>
          </div>
        )}
      </div>

      {!loading && (
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-xs text-muted-foreground sm:block">
                {user.displayName}
              </span>
              <Button variant="ghost" size="sm" onClick={logout}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Create account</Link>
              </Button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: string;
  children: React.ReactNode;
}) {
  const active = current.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  );
}
