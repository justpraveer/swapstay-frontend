import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return cached;
}

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function supabasePhotoUrl(storagePath: string): string | null {
  if (!storagePath) return null;
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_PHOTO_BUCKET || 'property-photos';
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${bucket}/${storagePath.replace(/^\/+/, '')}`;
}

export function verificationBucket() {
  return process.env.NEXT_PUBLIC_SUPABASE_VERIFICATION_BUCKET || 'verification';
}

export function propertyPhotoBucket() {
  return process.env.NEXT_PUBLIC_SUPABASE_PHOTO_BUCKET || 'property-photos';
}

export function propertyVideoBucket() {
  return process.env.NEXT_PUBLIC_SUPABASE_VIDEO_BUCKET || 'property-videos';
}

export function propertyVerificationBucket() {
  return process.env.NEXT_PUBLIC_SUPABASE_PROPERTY_VERIFICATION_BUCKET || 'property-verification';
}
