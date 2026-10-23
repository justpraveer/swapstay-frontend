'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BadgeCheck,
  BedDouble,
  CalendarDays,
  Check,
  Coins,
  Flag,
  Home,
  Info,
  LockKeyhole,
  MessageCircle,
  MapPin,
  Repeat2,
  Share2,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { PropertyImage, ThumbStrip } from '@/components/property/PropertyImage';
import { ScorePanel } from '@/components/property/ScorePanel';
import { ScoreRing, Avatar, EmptyState, ErrorState, InfoRow, LoadingBlock } from '@/components/ui/Primitives';
import {
  Badge,
  ListingStatusBadge,
  PropertyVerificationBadge,
  VerificationBadge,
} from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { BookingRequestModal } from '@/components/booking/BookingRequestModal';
import { ReportModal } from '@/components/modals/ReportModal';
import { PROPERTY_TYPE_LABELS, CANCELLATION_POLICY } from '@/lib/constants';
import { addDaysISO, formatDateShort, formatRange, nightsBetween, todayISO } from '@/lib/dates';
import { createConversation, getAvailability, getProperty } from '@/lib/api';
import { errorMessage } from '@/lib/api/client';
import { useToast } from '@/components/ui/Toast';
import { useApiQuery } from '@/lib/hooks';
import type { ScoreBreakdown } from '@/lib/types';

export default function PropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const router = useRouter();
  const { status, user } = useAuth();
  const { error: toastError } = useToast();

  const propertyQuery = useApiQuery(() => getProperty(id), [id], { enabled: Boolean(id) });
  const property = propertyQuery.data;

  const today = todayISO();
  const [checkIn, setCheckIn] = useState(addDaysISO(today, 14));
  const [checkOut, setCheckOut] = useState(addDaysISO(today, 17));
  const [photoIndex, setPhotoIndex] = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [messaging, setMessaging] = useState(false);

  const availabilityQuery = useApiQuery(
    () => getAvailability(id, today, addDaysISO(today, 14)),
    [id, today],
    { enabled: Boolean(id) },
  );

  const photos = useMemo(() => {
    const sorted = [...(property?.property_photos ?? [])].sort(
      (a, b) => a.display_order - b.display_order,
    );
    return sorted.map((photo) => photo.storage_path);
  }, [property?.property_photos]);

  const scoreRow = property?.property_scores?.[0];
  const breakdown: ScoreBreakdown | null = scoreRow
    ? {
        condition: scoreRow.condition_score,
        location: scoreRow.location_score,
        amenities: scoreRow.amenities_score,
        space: scoreRow.space_score,
        listing_quality: scoreRow.listing_quality_score,
      }
    : null;

  const nights = nightsBetween(checkIn, checkOut);
  const cost = nights;
  const isOwner = Boolean(user && property && property.owner_id === user.id);
  const isActive = property?.listing_status === 'active';
  const datesValid = nights > 0 && checkIn >= today;

  const availabilityByDate = useMemo(() => {
    const map = new Map<string, string>();
    (availabilityQuery.data ?? []).forEach((day) => {
      map.set(day.date, day.availability_status);
    });
    return map;
  }, [availabilityQuery.data]);

  function share() {
    if (typeof window === 'undefined') return;
    const url = window.location.href;
    if (navigator.share) {
      void navigator.share({ title: property?.title, url }).catch(() => undefined);
      return;
    }
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  }

  async function messageHost() {
    const currentProperty = property;
    if (!currentProperty?.owner?.id) return;
    setMessaging(true);
    try {
      const conversation = await createConversation({
        recipient_id: currentProperty.owner.id,
        property_id: currentProperty.id,
        context: 'property',
      });
      router.push(`/messages?conversation=${conversation.id}`);
    } catch (error) {
      toastError('Could not open messages', errorMessage(error));
    } finally {
      setMessaging(false);
    }
  }

  if (propertyQuery.loading) {
    return (
      <div className="container-page py-10">
        <div className="mb-6 skeleton h-4 w-32" />
        <div className="grid gap-8 lg:grid-cols-[1.55fr_1fr]">
          <div className="space-y-5">
            <div className="skeleton aspect-[16/10] rounded-3xl" />
            <div className="skeleton h-8 w-2/3" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-28 w-full rounded-2xl" />
          </div>
          <div className="skeleton h-[420px] rounded-3xl" />
        </div>
      </div>
    );
  }

  if (propertyQuery.error || !property) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="This home is not available"
          message={propertyQuery.error ?? 'The listing could not be found. It may have been removed or suspended.'}
          code={propertyQuery.errorCode}
          onRetry={propertyQuery.refresh}
        />
        <div className="mt-6 text-center">
          <Link href="/search" className="text-sm font-medium text-pine link-underline">
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  const verified = property.owner?.verification_status === 'verified';

  return (
    <div className="container-page pb-24 pt-6 sm:pt-8 lg:pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-medium text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={share} leading={<Share2 className="h-3.5 w-3.5" />}>
            {copied ? 'Link copied' : 'Share'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setReportOpen(true)}
            leading={<Flag className="h-3.5 w-3.5" />}
          >
            Report
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-9 lg:grid-cols-[1.6fr_1fr] lg:gap-12">
        <div className="min-w-0">
          {/* gallery */}
          <div className="overflow-hidden rounded-[2rem] border border-sand-200/80 bg-sand-200 shadow-soft">
            <div className="relative aspect-[16/10]">
              <PropertyImage
                photos={photos.length ? [photos[photoIndex] ?? photos[0]] : []}
                city={property.city}
                title={property.title}
              />
              {scoreRow && (
                <div className="absolute bottom-4 right-4 rounded-2xl bg-white/95 p-2 shadow-lift backdrop-blur">
                  <ScoreRing score={scoreRow.total_score} grade={scoreRow.grade} size={56} />
                </div>
              )}
              <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
                <Badge tone="ink">{PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type}</Badge>
                {verified && (
                  <Badge tone="moss" dot>
                    Verified host
                  </Badge>
                )}
                {property.verification_status === 'verified' && (
                  <Badge tone="moss" dot>
                    Verified home
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {photos.length > 1 && (
            <div className="mt-2.5">
              <ThumbStrip
                photos={photos}
                city={property.city}
                title={property.title}
                onSelect={setPhotoIndex}
              />
            </div>
          )}

          {/* title */}
          <div className="mt-7">
            <div className="flex flex-wrap items-center gap-2">
              <ListingStatusBadge status={property.listing_status} />
              <PropertyVerificationBadge status={property.verification_status ?? 'unverified'} />
              <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-500">
                <MapPin className="h-3.5 w-3.5" />
                {property.neighbourhood}, {property.city}
              </span>
            </div>
            <h1 className="mt-3 text-[2.1rem] leading-[1.12] tracking-[-0.02em] sm:text-[2.6rem]">
              {property.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-ink-600">
              <span className="inline-flex items-center gap-1.5">
                <BedDouble className="h-4 w-4 text-ink-500" /> {property.bedrooms}{' '}
                {property.bedrooms === 1 ? 'bedroom' : 'bedrooms'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-4 w-4 text-ink-500" /> Up to {property.guest_capacity} guests
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Home className="h-4 w-4 text-ink-500" />{' '}
                {PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-ink-500" /> {property.state}
              </span>
            </div>
          </div>

          {!isActive && (
            <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-[#e6cf9d] bg-[#fbf3df] p-4 text-[12px] leading-6 text-[#7a5a1c]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              This listing is {property.listing_status.replace('_', ' ')}. It cannot accept new requests
              until it is active and verified.
            </div>
          )}

          <div className="my-7 h-px bg-sand-200/80" />

          {/* about */}
          <section>
            <h2 className="text-[24px] leading-tight">About this home</h2>
            <div className="prose-copy mt-3 space-y-3">
              {property.description.split('\n').filter(Boolean).map((paragraph) => (
                <p key={paragraph.slice(0, 24)}>{paragraph}</p>
              ))}
            </div>
          </section>

          {property.videos && property.videos.length > 0 && (
            <section className="mt-8">
              <h2 className="text-[24px] leading-tight">Walkthrough</h2>
              <p className="mt-1.5 text-[12px] leading-6 text-ink-500">
                A short clip recorded by the host inside the actual home.
              </p>
              <div className="mt-3 overflow-hidden rounded-3xl border border-sand-200 bg-black">
                <video
                  src={property.videos[0].url ?? undefined}
                  controls
                  playsInline
                  className="aspect-video w-full bg-black"
                />
              </div>
            </section>
          )}

          {/* host */}
          <section className="mt-8 rounded-3xl border border-sand-200/90 bg-white/80 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar name={property.owner?.display_name} size="lg" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">Hosted by</p>
                  <p className="mt-0.5 text-[16px] font-medium text-ink-900">
                    {property.owner?.display_name ?? 'SwapStay member'}
                  </p>
                  {property.owner && <VerificationBadge status={property.owner.verification_status} className="mt-1.5" />}
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-2xl bg-sage-50 px-3.5 py-2.5 text-[11.5px] text-pine">
                <ShieldCheck className="h-4 w-4" />
                {verified ? 'Identity and hosting authority checked' : 'Verification still in progress'}
              </div>
            </div>
            <p className="mt-4 text-[12px] leading-6 text-ink-500">
              The host sets the house rules and approves each request. SwapStay keeps exact addresses
              private until a stay is confirmed.
            </p>
          </section>

          {/* amenities */}
          <section className="mt-9">
            <h2 className="text-[24px] leading-tight">What this place offers</h2>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {property.amenities.map((amenity) => (
                <div key={amenity} className="flex items-center gap-2 text-[13px] text-ink-700">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sage-100 text-pine">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  {amenity}
                </div>
              ))}
              {property.amenities.length === 0 && (
                <p className="text-[13px] text-ink-500">The host has not listed amenities yet.</p>
              )}
            </div>
          </section>

          {/* house rules */}
          <section className="mt-9 rounded-3xl border border-sand-200/90 bg-white/70 p-5">
            <h2 className="text-[20px] leading-tight">House rules</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {property.house_rules.map((rule) => (
                <li key={rule} className="flex items-start gap-2 text-[12.5px] leading-5 text-ink-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-clay-400" />
                  {rule}
                </li>
              ))}
              {property.house_rules.length === 0 && (
                <li className="text-[12.5px] text-ink-500">No additional rules listed.</li>
              )}
            </ul>
          </section>

          {/* score */}
          {breakdown && scoreRow && (
            <section className="mt-9">
              <h2 className="text-[24px] leading-tight">Why this home scores {scoreRow.total_score.toFixed(1)}</h2>
              <p className="mt-1.5 text-[12.5px] leading-6 text-ink-500">
                Factor scores are server-assessed. A higher score is not a guarantee, and a lower score is
                not a rejection.
              </p>
              <ScorePanel
                className="mt-4"
                breakdown={breakdown}
                total={scoreRow.total_score}
                grade={scoreRow.grade}
                evidenceStatus={scoreRow.evidence_status}
                methodVersion={scoreRow.method_version}
                assessedAt={scoreRow.assessed_at}
              />
            </section>
          )}

          {/* location */}
          <section className="mt-9">
            <h2 className="text-[24px] leading-tight">Where you will be</h2>
            <div className="mt-4 overflow-hidden rounded-3xl border border-sand-200/90">
              <div className="relative h-40 bg-[#e9efe9]">
                <svg viewBox="0 0 600 220" className="absolute inset-0 h-full w-full text-[#c3d4c6]" fill="none" aria-hidden>
                  <path d="M0 60h600M0 130h600M120 0v220M260 0v220M430 0v220" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M0 170c110-40 180 20 300-10s190-40 300 0" stroke="currentColor" strokeWidth="2" />
                  <circle cx="318" cy="104" r="34" fill="#dfe9df" />
                  <circle cx="318" cy="104" r="7" fill="#1f6f5c" />
                  <circle cx="318" cy="104" r="16" stroke="#1f6f5c" strokeWidth="1.5" />
                  <circle cx="318" cy="104" r="26" stroke="#1f6f5c" strokeWidth="1" opacity="0.5" />
                </svg>
                <div className="absolute bottom-3 left-3 rounded-xl bg-white/95 px-3 py-2 text-[11.5px] shadow-sm">
                  <p className="font-semibold text-ink-900">
                    {property.neighbourhood}, {property.city}
                  </p>
                  <p className="text-[10.5px] text-ink-500">Approximate area shown for privacy</p>
                </div>
              </div>
              <div className="bg-white/80 px-4 py-3.5">
                {property.exact_address ? (
                  <p className="flex items-start gap-2 text-[12px] leading-6 text-ink-600">
                    <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-moss" />
                    <span>
                      <span className="font-medium text-ink-800">Exact address: </span>
                      {property.exact_address}
                      <span className="block text-[10.5px] text-ink-500">
                        Visible to you because of your relationship to this stay.
                      </span>
                    </span>
                  </p>
                ) : (
                  <p className="flex items-start gap-2 text-[12px] leading-6 text-ink-500">
                    <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500" />
                    Exact address and access notes are shared only after a stay is confirmed. The
                    neighbourhood above is public.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* availability strip */}
          <section className="mt-9">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-[24px] leading-tight">Next 14 nights</h2>
              <span className="text-[10.5px] text-ink-500">Host-published calendar</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Array.from({ length: 14 }).map((_, index) => {
                const date = addDaysISO(today, index);
                const status = availabilityByDate.get(date);
                const tone =
                  status === 'available'
                    ? 'border-sage-200 bg-sage-50 text-pine'
                    : status === 'unavailable'
                      ? 'border-[#e5cbc4] bg-[#fdf4f2] text-[#8d3527]'
                      : status === 'booked' || status === 'reserved'
                        ? 'border-ink-700 bg-ink-900 text-sand-50'
                        : 'border-sand-200 bg-white/60 text-ink-500';
                return (
                  <div
                    key={date}
                    className={`flex min-w-[52px] flex-col items-center rounded-xl border px-2 py-1.5 ${tone}`}
                    title={`${formatDateShort(date)} · ${status ?? 'not published'}`}
                  >
                    <span className="text-[9px] uppercase tracking-[0.08em] opacity-70">
                      {new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}
                    </span>
                    <span className="text-[13px] font-semibold tabular-nums">{date.slice(8)}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10.5px] leading-5 text-ink-500">
              A published day is not a confirmed booking. The server rechecks availability and confirmed
              bookings when you request.
            </p>
          </section>

          <div className="mt-10 flex items-center justify-between border-t border-sand-200/80 pt-5">
            <p className="text-[11px] text-ink-500">
              Listing updated {formatDateShort(property.updated_at.slice(0, 10))}
            </p>
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-500 transition hover:text-[#8d3527]"
            >
              <Flag className="h-3.5 w-3.5" /> Report this listing
            </button>
          </div>
        </div>

        {/* ---------------------------- booking card --------------------------- */}
        <aside className="lg:sticky lg:top-[92px] lg:self-start">
          <div className="rounded-3xl border border-sand-200/90 bg-white/95 p-5 shadow-lift">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-[25px] leading-none text-ink-900">
                  1 <span className="text-[13px] font-sans font-medium text-ink-500">credit / night</span>
                </p>
                <p className="mt-1.5 text-[11px] text-ink-500">1 credit per eligible night in the pilot</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone="moss" dot>
                  Active
                </Badge>
                {scoreRow && (
                  <span className="text-[10px] text-ink-500">Score {scoreRow.total_score.toFixed(1)}</span>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="rounded-xl border border-sand-300 bg-white px-3 py-2">
                <span className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                  <CalendarDays className="h-3 w-3" /> Check in
                </span>
                <input
                  type="date"
                  value={checkIn}
                  min={today}
                  onChange={(event) => {
                    setCheckIn(event.target.value);
                    if (checkOut <= event.target.value) setCheckOut(addDaysISO(event.target.value, 1));
                  }}
                  className="mt-0.5 w-full bg-transparent text-[12.5px] font-medium text-ink-900 outline-none"
                />
              </label>
              <label className="rounded-xl border border-sand-300 bg-white px-3 py-2">
                <span className="flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                  <CalendarDays className="h-3 w-3" /> Check out
                </span>
                <input
                  type="date"
                  value={checkOut}
                  min={addDaysISO(checkIn || today, 1)}
                  onChange={(event) => setCheckOut(event.target.value)}
                  className="mt-0.5 w-full bg-transparent text-[12.5px] font-medium text-ink-900 outline-none"
                />
              </label>
            </div>

            <dl className="mt-3 divide-y divide-sand-200/70 rounded-2xl bg-sand-50/70 px-3.5 py-1">
              <InfoRow label="Dates" value={datesValid ? formatRange(checkIn, checkOut) : 'Choose valid dates'} />
              <InfoRow label="Nights" value={nights > 0 ? `${nights}` : '—'} />
              <InfoRow
                label="Credit cost"
                value={
                  <span className="inline-flex items-center gap-1 text-pine">
                    <Coins className="h-3.5 w-3.5 text-gold-500" />
                    {cost > 0 ? `${cost} ${cost === 1 ? 'credit' : 'credits'}` : '—'}
                  </span>
                }
              />
            </dl>

            {isOwner ? (
              <div className="mt-4 space-y-2">
                <div className="rounded-xl bg-sage-50 px-3 py-2.5 text-[11.5px] leading-5 text-pine">
                  This is your listing. Manage dates and details from your host dashboard.
                </div>
                <Link href={`/listings/${property.id}`} className="block">
                  <Button variant="secondary" className="w-full">
                    Manage this home
                  </Button>
                </Link>
              </div>
            ) : status === 'authenticated' ? (
              <Button
                className="mt-4 w-full"
                size="lg"
                onClick={() => setBookingOpen(true)}
                disabled={!isActive || !datesValid}
              >
                Request this stay
              </Button>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(`/properties/${property.id}`)}`} className="mt-4 block">
                <Button className="w-full" size="lg">
                  Sign in to request
                </Button>
              </Link>
            )}

            {status === 'authenticated' && !isOwner && isActive && (
              <Link
                href={`/swaps/new?recipient=${property.id}`}
                className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-sand-300 bg-white/70 text-[13px] font-medium text-ink-700 transition hover:border-moss/40 hover:text-pine"
              >
                <Repeat2 className="h-4 w-4" /> Propose a direct swap
              </Link>
            )}
            {status === 'authenticated' && !isOwner && property.owner && (
              <Button
                variant="ghost"
                className="mt-2 w-full"
                onClick={messageHost}
                loading={messaging}
                leading={<MessageCircle className="h-4 w-4" />}
              >
                Message host
              </Button>
            )}

            {!datesValid && !isOwner && (
              <p className="mt-2 text-center text-[10.5px] text-[#8d3527]">
                Check-out must be after check-in and check-in cannot be in the past.
              </p>
            )}

            <div className="mt-4 space-y-2 border-t border-sand-200/70 pt-3.5 text-[10.5px] text-ink-500">
              <p className="flex items-start gap-1.5">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-moss" />
                Host approval required. Credits are reserved, not spent, until the stay completes.
              </p>
              <p className="flex items-start gap-1.5">
                <LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500" />
                Exact address stays private until confirmation.
              </p>
            </div>

            <details className="mt-3 rounded-xl bg-sand-50/80 px-3 py-2 text-[11px] text-ink-600">
              <summary className="cursor-pointer font-medium text-ink-700">Cancellation terms</summary>
              <ul className="mt-2 space-y-1.5">
                {CANCELLATION_POLICY.map((line) => (
                  <li key={line} className="leading-5">
                    {line}
                  </li>
                ))}
              </ul>
            </details>
          </div>

          <div className="mt-3 flex items-center justify-center gap-2 text-[10.5px] text-ink-500">
            <Sparkles className="h-3.5 w-3.5 text-clay-400" />
            Part of a pilot. Availability is verified, not guaranteed until confirmed.
          </div>
        </aside>
      </div>

      {/* mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sand-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-ink-900">
              1 credit <span className="font-normal text-ink-500">/ night</span>
            </p>
            <p className="text-[10.5px] text-ink-500">
              {datesValid ? `${nights} nights · ${cost} credits` : 'Choose dates'}
            </p>
          </div>
          {isOwner ? (
            <Link href={`/listings/${property.id}`}>
              <Button variant="secondary" size="sm">
                Manage home
              </Button>
            </Link>
          ) : status === 'authenticated' ? (
            <Button size="sm" onClick={() => setBookingOpen(true)} disabled={!isActive || !datesValid}>
              Request stay
            </Button>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(`/properties/${property.id}`)}`}>
              <Button size="sm">Sign in</Button>
            </Link>
          )}
        </div>
      </div>

      <BookingRequestModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        property={property}
        checkIn={checkIn}
        checkOut={checkOut}
      />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="property"
        targetId={property.id}
        targetLabel={property.title}
      />
    </div>
  );
}
