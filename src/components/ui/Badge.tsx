import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type {
  BookingStatus,
  ListingStatus,
  ReportStatus,
  SwapStatus,
  VerificationStatus,
} from '@/lib/types';

type Tone = 'neutral' | 'moss' | 'gold' | 'clay' | 'red' | 'ink' | 'sky' | 'outline';

const tones: Record<Tone, string> = {
  neutral: 'border-sand-300/80 bg-sand-100/80 text-ink-600',
  moss: 'border-sage-200 bg-sage-100 text-pine',
  gold: 'border-gold-300/60 bg-[#fbf2dc] text-[#8a6420]',
  clay: 'border-clay-300/60 bg-clay-100 text-clay-600',
  red: 'border-[#d9b0a8] bg-[#f8e6e1] text-[#8d3527]',
  ink: 'border-ink-700/30 bg-ink-900 text-sand-50',
  sky: 'border-[#bfd4de] bg-[#e9f2f6] text-[#2a5a70]',
  outline: 'border-sand-300 bg-transparent text-ink-600',
};

const dotTones: Record<Tone, string> = {
  neutral: 'bg-ink-500/50',
  moss: 'bg-moss',
  gold: 'bg-gold-500',
  clay: 'bg-clay-500',
  red: 'bg-[#b04435]',
  ink: 'bg-sand-50',
  sky: 'bg-[#2a5a70]',
  outline: 'bg-ink-500/50',
};

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide',
        tones[tone],
        className,
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotTones[tone])} aria-hidden />}
      {children}
    </span>
  );
}

const bookingTone: Record<BookingStatus, Tone> = {
  requested: 'gold',
  confirmed: 'moss',
  completed: 'ink',
  cancelled: 'neutral',
};

const bookingLabel: Record<BookingStatus, string> = {
  requested: 'Awaiting host',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <Badge tone={bookingTone[status]} dot>
      {bookingLabel[status]}
    </Badge>
  );
}

const swapTone: Record<SwapStatus, Tone> = {
  pending: 'gold',
  requester_accepted: 'gold',
  recipient_accepted: 'sky',
  confirmed: 'moss',
  declined: 'red',
  cancelled: 'neutral',
};

const swapLabel: Record<SwapStatus, string> = {
  pending: 'Awaiting response',
  requester_accepted: 'Awaiting response',
  recipient_accepted: 'Awaiting confirmation',
  confirmed: 'Swap confirmed',
  declined: 'Declined',
  cancelled: 'Withdrawn',
};

export function SwapStatusBadge({ status }: { status: SwapStatus }) {
  return (
    <Badge tone={swapTone[status]} dot>
      {swapLabel[status]}
    </Badge>
  );
}

const listingTone: Record<ListingStatus, Tone> = {
  draft: 'neutral',
  pending_review: 'gold',
  active: 'moss',
  suspended: 'red',
  inactive: 'neutral',
};

const listingLabel: Record<ListingStatus, string> = {
  draft: 'Draft',
  pending_review: 'In review',
  active: 'Live',
  suspended: 'Suspended',
  inactive: 'Inactive',
};

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return (
    <Badge tone={listingTone[status]} dot>
      {listingLabel[status]}
    </Badge>
  );
}

const verificationTone: Record<VerificationStatus, Tone> = {
  unverified: 'neutral',
  pending: 'gold',
  verified: 'moss',
  rejected: 'red',
};

const verificationLabel: Record<VerificationStatus, string> = {
  unverified: 'Not verified',
  pending: 'Verification pending',
  verified: 'Verified member',
  rejected: 'Verification declined',
};

export function VerificationBadge({
  status,
  className,
}: {
  status: VerificationStatus;
  className?: string;
}) {
  return (
    <Badge tone={verificationTone[status]} dot className={className}>
      {verificationLabel[status]}
    </Badge>
  );
}

const propertyVerificationLabel: Record<VerificationStatus, string> = {
  unverified: 'Property not verified',
  pending: 'Property under review',
  verified: 'Verified home',
  rejected: 'Property verification declined',
};

export function PropertyVerificationBadge({
  status,
  className,
}: {
  status: VerificationStatus;
  className?: string;
}) {
  return (
    <Badge tone={verificationTone[status]} dot className={className}>
      {propertyVerificationLabel[status]}
    </Badge>
  );
}

const reportTone: Record<ReportStatus, Tone> = {
  open: 'gold',
  under_review: 'sky',
  resolved: 'moss',
  dismissed: 'neutral',
};

const reportLabel: Record<ReportStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <Badge tone={reportTone[status]} dot>
      {reportLabel[status]}
    </Badge>
  );
}
