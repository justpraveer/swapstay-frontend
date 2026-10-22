'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, KeyRound, Mail, MailCheck, Sparkles } from 'lucide-react';
import { AuthShell } from '@/components/auth/AuthShell';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingBlock } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { signIn, enterDemo, status, supabaseReady } = useAuth();
  const { error: toastError } = useToast();

  const next = params.get('next') || '/search';
  const confirmed = params.get('confirmed') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, router, next]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace(next);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign in failed. Please try again.';
      setError(message);
      toastError('Could not sign in', message);
    } finally {
      setLoading(false);
    }
  }

  function openDemo() {
    enterDemo();
    router.replace(next);
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to SwapStay"
      description="Pick up your trips, listings and credit wallet where you left them."
    >
      {confirmed && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-sage-200 bg-sage-50 p-4 text-[12px] leading-5 text-pine">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Your email is confirmed. Sign in to continue to SwapStay.</p>
        </div>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          leading={<Mail className="h-4 w-4" />}
          required
        />
        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          leading={<KeyRound className="h-4 w-4" />}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="rounded p-0.5 text-ink-500/70 transition hover:text-ink-800"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          required
        />

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-ink-500">Sessions are managed securely by Supabase Auth.</span>
          <Link href="/forgot-password" className="text-[12px] font-medium text-pine link-underline">
            Forgot password?
          </Link>
        </div>

        {error && (
          <p className="rounded-xl border border-[#e3bdb4] bg-[#fdf4f2] px-3 py-2 text-[12px] leading-5 text-[#8d3527]" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>

      <p className="mt-5 text-center text-[12px] text-ink-500">
        New to SwapStay?{' '}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-pine link-underline">
          Create an account
        </Link>
      </p>

      <div className="mt-7 rounded-2xl border border-dashed border-sand-300 bg-sand-100/60 p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-clay-500 shadow-sm">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink-900">Exploring the build?</p>
            <p className="mt-1 text-[11.5px] leading-5 text-ink-500">
              Open demo mode with a verified host account, sample homes across all four cities and an
              admin console. No backend or Supabase keys needed.
            </p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={openDemo}>
              Continue with demo data
            </Button>
          </div>
        </div>
      </div>

      {!supabaseReady && (
        <p className="mt-4 rounded-xl bg-white/70 px-3 py-2 text-[11px] leading-5 text-ink-500 ring-1 ring-inset ring-sand-200">
          Supabase is not configured for this deployment. Real sign-in is disabled until
          <code className="mx-1 rounded bg-sand-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and the anon key
          are added.
        </p>
      )}
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading sign in" className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}
