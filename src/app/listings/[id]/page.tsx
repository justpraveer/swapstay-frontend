'use client';

import { useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  FileCheck2,
  FileText,
  ImagePlus,
  Info,
  KeyRound,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from 'lucide-react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useAuth } from '@/components/auth/AuthProvider';
import { PropertyForm } from '@/components/property/PropertyForm';
import { PropertyImage } from '@/components/property/PropertyImage';
import { AvailabilityCalendar } from '@/components/availability/AvailabilityCalendar';
import { ListingStatusBadge, PropertyVerificationBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorState, LoadingBlock, ScoreRing, Tabs } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import {
  addPropertyPhoto,
  addPropertyVideo,
  deletePropertyPhoto,
  deletePropertyVideo,
  generatePropertyVerificationCode,
  getProperty,
  getPropertyMedia,
  getPropertyVerification,
  submitPropertyVerification,
  updateProperty,
  uploadPropertyPhoto,
  uploadPropertyVerificationDocument,
  uploadPropertyVideo,
} from '@/lib/api';
import { ApiError, errorMessage } from '@/lib/api/client';
import { formatDate } from '@/lib/dates';
import { useApiQuery } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import type {
  CreatePropertyInput,
  PropertyPhotoRow,
  PropertyVerificationState,
  PropertyVideoRow,
} from '@/lib/types';

function ManageListingContent() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const { user } = useAuth();
  const { success, error: toastError } = useToast();

  const query = useApiQuery(() => getProperty(id), [id], { enabled: Boolean(id) });
  const property = query.data;

  const [tab, setTab] = useState('details');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (query.loading) {
    return <LoadingBlock label="Loading your listing" className="py-24" />;
  }

  if (query.error || !property) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="Listing not found"
          message={query.error ?? 'This listing could not be found.'}
          code={query.errorCode}
          onRetry={query.refresh}
        />
      </div>
    );
  }

  if (user && property.owner_id !== user.id) {
    return (
      <div className="container-page py-16">
        <ErrorState
          title="You do not manage this home"
          message="Only the host who owns this listing can edit its details or calendar."
          onRetry={query.refresh}
        />
        <div className="mt-6 text-center">
          <Link href="/listings" className="text-sm font-medium text-pine link-underline">
            Back to my homes
          </Link>
        </div>
      </div>
    );
  }

  const score = property.property_scores?.[0];

  async function save(input: CreatePropertyInput) {
    setSubmitting(true);
    setServerError(null);
    setFieldErrors({});
    try {
      await updateProperty(id, input);
      success('Listing updated', 'Your changes are saved. Some fields may require re-review.');
      query.refresh();
    } catch (error) {
      const message = errorMessage(error);
      setServerError(message);
      if (error instanceof ApiError) setFieldErrors(error.fieldErrors);
      toastError('Changes not saved', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-page py-8 sm:py-12">
      <Link
        href="/listings"
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-500 transition hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> My homes
      </Link>

      <div className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <ListingStatusBadge status={property.listing_status} />
            <PropertyVerificationBadge status={property.verification_status ?? 'unverified'} />
            <span className="text-[11px] text-ink-500">
              {property.neighbourhood}, {property.city}
            </span>
          </div>
          <h1 className="mt-2.5 text-[2rem] leading-[1.12] tracking-[-0.02em] sm:text-[2.4rem]">
            {property.title}
          </h1>
          <p className="mt-2 text-[12px] text-ink-500">
            Manage the content guests see, the nights you can host, and the photos on your listing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {score && <ScoreRing score={score.total_score} grade={score.grade} size={54} />}
          <Link href={`/properties/${property.id}`}>
            <Button variant="secondary" size="sm" trailing={<ArrowUpRight className="h-3.5 w-3.5" />}>
              View public page
            </Button>
          </Link>
        </div>
      </div>

      <Tabs
        className="mt-7"
        active={tab}
        onChange={setTab}
        ariaLabel="Manage listing"
        tabs={[
          { id: 'details', label: 'Details' },
          { id: 'availability', label: 'Availability' },
          { id: 'photos', label: 'Photos & video', count: property.property_photos?.length ?? 0 },
          { id: 'verification', label: 'Verification' },
        ]}
      />

      <div className="mt-6">
        {tab === 'details' && (
          <div className="grid gap-8 lg:grid-cols-[1.65fr_0.9fr]">
            <PropertyForm
              initial={{
                title: property.title,
                description: property.description,
                city: property.city,
                state: property.state,
                neighbourhood: property.neighbourhood,
                property_type: property.property_type,
                bedrooms: property.bedrooms,
                guest_capacity: property.guest_capacity,
                amenities: property.amenities,
                house_rules: property.house_rules,
                exact_address: property.exact_address ?? '',
              }}
              submitLabel="Save changes"
              submitting={submitting}
              serverError={serverError}
              fieldErrors={fieldErrors}
              onSubmit={save}
            />

            <aside className="space-y-4 lg:sticky lg:top-[92px] lg:self-start">
              <div className="card p-5">
                <p className="eyebrow">Listing health</p>
                <dl className="mt-3 space-y-2.5 text-[12px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Status</dt>
                    <dd className="font-medium text-ink-800 capitalize">
                      {property.listing_status.replace('_', ' ')}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">SwapScore</dt>
                    <dd className="font-medium text-ink-800">
                      {score ? `${score.total_score.toFixed(1)} · ${score.grade}` : 'Not assessed'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Evidence</dt>
                    <dd className="font-medium text-ink-800 capitalize">
                      {score?.evidence_status ?? 'pending'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Photos</dt>
                    <dd className="font-medium text-ink-800">{property.property_photos?.length ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-500">Home verification</dt>
                    <dd className="font-medium text-ink-800 capitalize">
                      {(property.verification_status ?? 'unverified').replace('_', ' ')}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-3xl border border-[#e6cf9d] bg-[#fbf3df] p-5">
                <p className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#7a5a1c]">
                  <Info className="h-3.5 w-3.5" /> Moderation is separate
                </p>
                <p className="mt-1.5 text-[11px] leading-5 text-[#8a6a2a]">
                  Editing text does not change your verification or SwapScore. The server owns those
                  values, and material changes may trigger a fresh review.
                </p>
              </div>

              {property.listing_status === 'active' && (
                <Link href="/properties/new">
                  <Button variant="outline" className="w-full" leading={<Sparkles className="h-4 w-4" />}>
                    List another home
                  </Button>
                </Link>
              )}
            </aside>
          </div>
        )}

        {tab === 'availability' && (
          <div className="grid gap-6 lg:grid-cols-[1.65fr_0.9fr]">
            <AvailabilityCalendar propertyId={property.id} />
            <aside className="space-y-4">
              <div className="card p-5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-500">
                  <CalendarDays className="h-3.5 w-3.5" /> How dates work
                </p>
                <ul className="mt-2.5 space-y-2 text-[11.5px] leading-5 text-ink-600">
                  <li>Open nights appear available to members searching your city.</li>
                  <li>Confirmed bookings and reserved nights cannot be reopened here.</li>
                  <li>A request still needs your approval; availability is not a confirmation.</li>
                  <li>Direct swaps reserve both homes for the agreed legs.</li>
                </ul>
              </div>
              <div className="rounded-2xl bg-sage-50 p-4 text-[11px] leading-5 text-pine">
                Tip: keep the next 60–90 days current. Stale calendars reduce accepted requests and
                weaken the host reliability signal.
              </div>
            </aside>
          </div>
        )}

        {tab === 'photos' && (
          <PhotosPanel
            propertyId={property.id}
            ownerId={property.owner_id}
            photos={property.property_photos ?? []}
            onChanged={query.refresh}
          />
        )}

        {tab === 'verification' && (
          <VerificationPanel
            propertyId={property.id}
            ownerId={property.owner_id}
            propertyStatus={property.verification_status ?? 'unverified'}
            onChanged={query.refresh}
          />
        )}
      </div>
    </div>
  );
}

function readVideoDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const element = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    const done = (value?: number) => {
      URL.revokeObjectURL(objectUrl);
      resolve(value);
    };
    element.preload = 'metadata';
    element.onloadedmetadata = () => done(Math.round(element.duration) || undefined);
    element.onerror = () => done(undefined);
    element.src = objectUrl;
  });
}

function VerificationPanel({
  propertyId,
  ownerId,
  propertyStatus,
  onChanged,
}: {
  propertyId: string;
  ownerId: string;
  propertyStatus: string;
  onChanged: () => void;
}) {
  const { success, error: toastError } = useToast();
  const query = useApiQuery(() => getPropertyVerification(propertyId), [propertyId]);
  const state: PropertyVerificationState | undefined = query.data ?? undefined;
  const status = (state?.property.verification_status ?? propertyStatus) as
    | 'unverified'
    | 'pending'
    | 'verified'
    | 'rejected';
  const code = state?.property.verification_code ?? null;
  const submission = state?.submission ?? null;

  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ownership, setOwnership] = useState<File | null>(null);
  const [lease, setLease] = useState<File | null>(null);
  const [codePhoto, setCodePhoto] = useState<File | null>(null);

  const locked = status === 'pending' || status === 'verified';

  async function generateCode() {
    setGenerating(true);
    try {
      await generatePropertyVerificationCode(propertyId);
      success(
        'Verification code ready',
        'Place the code inside the home and upload a photo showing it in the room.',
      );
      query.refresh();
    } catch (error) {
      toastError('Code not generated', errorMessage(error));
    } finally {
      setGenerating(false);
    }
  }

  async function submit() {
    if (!code) {
      toastError('Generate a code first', 'Create the physical verification code before submitting.');
      return;
    }
    if (!ownership && !lease) {
      toastError('Add a document', 'Upload an ownership document or a lease/rental agreement.');
      return;
    }
    if (!codePhoto) {
      toastError('Add the code photo', 'Upload a photo showing the verification code inside the home.');
      return;
    }
    setSubmitting(true);
    try {
      const ownershipPath = ownership
        ? await uploadPropertyVerificationDocument(ownership, propertyId, ownerId)
        : undefined;
      const leasePath = lease
        ? await uploadPropertyVerificationDocument(lease, propertyId, ownerId)
        : undefined;
      const codePhotoPath = await uploadPropertyVerificationDocument(codePhoto, propertyId, ownerId);
      await submitPropertyVerification(propertyId, {
        ownership_document_path: ownershipPath,
        lease_document_path: leasePath,
        physical_code_photo_path: codePhotoPath,
      });
      success('Submitted for review', 'Trust & safety will review the documents and code photo.');
      setOwnership(null);
      setLease(null);
      setCodePhoto(null);
      query.refresh();
      onChanged();
    } catch (error) {
      toastError('Verification not submitted', errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  const banner =
    status === 'verified'
      ? {
          tone: 'bg-sage-50 text-pine border-sage-200',
          icon: <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />,
          title: 'This home is verified',
          body: 'Ownership evidence and the physical code photo were approved. Guests see a verified-home badge.',
        }
      : status === 'pending'
        ? {
            tone: 'bg-[#fbf3df] text-[#7a5a1c] border-[#e6cf9d]',
            icon: <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />,
            title: 'Review in progress',
            body: 'Trust & safety is checking your documents and code photo. You cannot edit this submission while it is pending.',
          }
        : status === 'rejected'
          ? {
              tone: 'bg-[#fdf4f2] text-[#8d3527] border-[#e3bdb4]',
              icon: <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />,
              title: 'Verification was declined',
              body: submission?.notes || 'Fix the issue described in the review notes, then submit again.',
            }
          : {
              tone: 'bg-[#f4efe4]/80 text-ink-600 border-sand-200',
              icon: <Info className="mt-0.5 h-4 w-4 shrink-0" />,
              title: 'Verify this home to publish it',
              body: 'Add ownership or lease evidence plus a photo of the physical code. Verified homes can go live and accept swaps.',
            };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.65fr_0.9fr]">
      <div className="space-y-5">
        <div className={cn('flex items-start gap-3 rounded-2xl border p-4 text-[12px] leading-5', banner.tone)}>
          {banner.icon}
          <div>
            <p className="font-semibold">{banner.title}</p>
            <p className="mt-0.5 opacity-90">{banner.body}</p>
          </div>
        </div>

        {!locked && (
          <>
            <section className="card p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-sage-100 text-pine">
                  <KeyRound className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-[18px] leading-tight">Physical verification code</h2>
                  <p className="text-[11.5px] text-ink-500">
                    We issue a one-time code. Write it on a card and photograph it inside the home.
                  </p>
                </div>
              </div>

              {code ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand-200 bg-sand-50/70 px-4 py-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                      Your code
                    </p>
                    <p className="mt-0.5 font-mono text-[24px] font-semibold tracking-[0.2em] text-ink-900">
                      {code}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={generateCode} loading={generating}>
                    Rotate code
                  </Button>
                </div>
              ) : (
                <Button
                  className="mt-4"
                  size="sm"
                  onClick={generateCode}
                  loading={generating}
                  leading={<KeyRound className="h-3.5 w-3.5" />}
                >
                  Generate verification code
                </Button>
              )}

              <p className="mt-3 text-[10.5px] leading-5 text-ink-500">
                The code proves someone was physically inside the property. Do not reuse a code from another
                home and do not edit the photo.
              </p>
            </section>

            <section className="card p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-sage-100 text-pine">
                  <FileCheck2 className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-[18px] leading-tight">Ownership evidence</h2>
                  <p className="text-[11.5px] text-ink-500">
                    Upload one ownership document or one lease/rental agreement. Files stay private.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <FilePicker
                  label="Ownership document"
                  hint="Sale deed, property tax receipt or utility bill in your name."
                  accept="application/pdf,image/*"
                  file={ownership}
                  onChange={setOwnership}
                  icon={<FileText className="h-4 w-4" />}
                />
                <FilePicker
                  label="Lease or rental agreement"
                  hint="Current agreement plus a hosting-authority note if you rent."
                  accept="application/pdf,image/*"
                  file={lease}
                  onChange={setLease}
                  icon={<FileText className="h-4 w-4" />}
                />
              </div>

              <div className="mt-4">
                <FilePicker
                  label="Photo of the verification code"
                  hint="Show the code card clearly in a real room, with enough context to recognise the space."
                  accept="image/*"
                  file={codePhoto}
                  onChange={setCodePhoto}
                  icon={<Camera className="h-4 w-4" />}
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-sand-200/70 pt-4">
                <p className="text-[10.5px] leading-5 text-ink-500">
                  Documents are reviewed by an admin and are never shown publicly.
                </p>
                <Button onClick={submit} loading={submitting} leading={<ShieldCheck className="h-4 w-4" />}>
                  Submit for verification
                </Button>
              </div>
            </section>
          </>
        )}

        {submission && (
          <section className="card p-5">
            <p className="eyebrow">Latest submission</p>
            <dl className="mt-3 grid gap-2 text-[11.5px] sm:grid-cols-2">
              <div>
                <dt className="text-ink-500">Submitted</dt>
                <dd className="font-medium text-ink-800">{formatDate(submission.created_at.slice(0, 10))}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Code used</dt>
                <dd className="font-mono font-medium text-ink-800">{submission.physical_code}</dd>
              </div>
              <div>
                <dt className="text-ink-500">Status</dt>
                <dd className="font-medium capitalize text-ink-800">{submission.status}</dd>
              </div>
              {submission.reviewed_at && (
                <div>
                  <dt className="text-ink-500">Reviewed</dt>
                  <dd className="font-medium text-ink-800">
                    {formatDate(submission.reviewed_at.slice(0, 10))}
                  </dd>
                </div>
              )}
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {submission.ownership_document_url && (
                <a
                  href={submission.ownership_document_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 rounded-full border border-sand-300 bg-white px-2.5 py-1 text-[10px] font-medium text-ink-600 hover:text-pine"
                >
                  Ownership doc <ArrowUpRight className="h-2.5 w-2.5" />
                </a>
              )}
              {submission.lease_document_url && (
                <a
                  href={submission.lease_document_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 rounded-full border border-sand-300 bg-white px-2.5 py-1 text-[10px] font-medium text-ink-600 hover:text-pine"
                >
                  Lease doc <ArrowUpRight className="h-2.5 w-2.5" />
                </a>
              )}
              {submission.physical_code_photo_url && (
                <a
                  href={submission.physical_code_photo_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 rounded-full border border-sand-300 bg-white px-2.5 py-1 text-[10px] font-medium text-ink-600 hover:text-pine"
                >
                  Code photo <ArrowUpRight className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
            {submission.notes && (
              <p className="mt-3 rounded-xl bg-sand-50 px-3 py-2.5 text-[10.5px] leading-5 text-ink-600">
                <span className="font-semibold text-ink-800">Reviewer notes:</span> {submission.notes}
              </p>
            )}
          </section>
        )}
      </div>

      <aside className="space-y-4">
        <div className="card p-5">
          <p className="eyebrow">Why this matters</p>
          <ul className="mt-2.5 space-y-2 text-[11.5px] leading-5 text-ink-600">
            <li>Confirmed ownership or a valid lease protects both sides of a swap.</li>
            <li>The physical code proves you can access the home you are listing.</li>
            <li>Verified homes carry a badge in search and on the property page.</li>
            <li>Only verified members can list, propose swaps and accept stays.</li>
          </ul>
        </div>
        <div className="rounded-2xl bg-[#f4efe4]/80 p-4 text-[11px] leading-5 text-ink-600">
          Never upload someone else&apos;s documents. Submissions are audit-logged, and fraudulent evidence
          leads to account suspension.
        </div>
      </aside>
    </div>
  );
}

function FilePicker({
  label,
  hint,
  accept,
  file,
  onChange,
  icon,
}: {
  label: string;
  hint: string;
  accept: string;
  file: File | null;
  onChange: (file: File | null) => void;
  icon: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer flex-col gap-1.5 rounded-2xl border border-dashed border-sand-300 bg-sand-50/50 px-4 py-3 transition hover:border-moss/50">
      <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-ink-800">
        {icon} {label}
      </span>
      <span className="text-[10.5px] leading-4 text-ink-500">{hint}</span>
      <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-pine">
        <Upload className="h-3.5 w-3.5" />
        {file ? file.name : 'Choose file'}
      </span>
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function PhotosPanel({
  propertyId,
  ownerId,
  photos,
  onChanged,
}: {
  propertyId: string;
  ownerId: string;
  photos: PropertyPhotoRow[];
  onChanged: () => void;
}) {
  const { success, error: toastError } = useToast();
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const mediaQuery = useApiQuery(() => getPropertyMedia(propertyId), [propertyId]);
  const videos = (mediaQuery.data ?? []).filter((item: PropertyVideoRow) => item.media_type === 'video');

  const sorted = [...photos].sort((a, b) => a.display_order - b.display_order);

  async function addPath(path: string) {
    await addPropertyPhoto(propertyId, path, photos.length);
    success('Photo added', 'Photos may be moderated before they appear in public search.');
    setUrl('');
    onChanged();
  }

  async function addByUrl() {
    const value = url.trim();
    if (value.length < 5) {
      toastError('Add a photo', 'Paste an image URL or storage path of at least 5 characters.');
      return;
    }
    setAdding(true);
    try {
      await addPath(value);
    } catch (error) {
      toastError('Photo not added', errorMessage(error));
    } finally {
      setAdding(false);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const path = await uploadPropertyPhoto(file, propertyId, ownerId);
      await addPath(path);
    } catch (error) {
      toastError('Upload failed', errorMessage(error));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function uploadClip(file: File) {
    setUploadingVideo(true);
    try {
      const duration = await readVideoDuration(file);
      if (duration && duration > 61) {
        throw new ApiError('VALIDATION_ERROR', 'Keep the walkthrough under 60 seconds.', 400);
      }
      const path = await uploadPropertyVideo(file, propertyId, ownerId);
      await addPropertyVideo(propertyId, path, duration, videos.length);
      success('Video added', 'Your walkthrough is now attached to this listing.');
      mediaQuery.refresh();
      onChanged();
    } catch (error) {
      toastError('Video not added', errorMessage(error));
    } finally {
      setUploadingVideo(false);
      if (videoRef.current) videoRef.current.value = '';
    }
  }

  async function removeVideo(mediaId: string) {
    setDeletingVideoId(mediaId);
    try {
      await deletePropertyVideo(propertyId, mediaId);
      success('Video removed');
      mediaQuery.refresh();
      onChanged();
    } catch (error) {
      toastError('Video not removed', errorMessage(error));
    } finally {
      setDeletingVideoId(null);
    }
  }

  async function remove(photoId: string) {
    setDeletingId(photoId);
    try {
      await deletePropertyPhoto(propertyId, photoId);
      success('Photo removed');
      onChanged();
    } catch (error) {
      toastError('Photo not removed', errorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.65fr_0.9fr]">
      <div className="card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-sage-100 text-pine">
            <Camera className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[18px] leading-tight">Photos</h2>
            <p className="text-[11.5px] text-ink-500">
              The first photo is the cover. Add bright, honest images of the actual home.
            </p>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-sand-300 bg-sand-50/60 px-5 py-10 text-center">
            <ImagePlus className="mx-auto h-6 w-6 text-ink-500/50" />
            <p className="mt-2 text-[13px] font-medium text-ink-800">No photos yet</p>
            <p className="mx-auto mt-1 max-w-sm text-[11.5px] leading-5 text-ink-500">
              Listings with a real cover photo receive more serious requests. Add a URL now, or upload to
              Supabase Storage when it is configured.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {sorted.map((photo, index) => (
              <div
                key={photo.id}
                className="group relative overflow-hidden rounded-2xl border border-sand-200"
              >
                <div className="aspect-[4/3]">
                  <PropertyImage photos={[photo.storage_path]} />
                </div>
                <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-600">
                  {index === 0 ? 'Cover' : `Photo ${index + 1}`}
                </div>
                <button
                  type="button"
                  onClick={() => void remove(photo.id)}
                  disabled={deletingId === photo.id}
                  className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-[#8d3527] shadow-sm transition hover:bg-white disabled:opacity-60"
                  aria-label={`Remove photo ${index + 1}`}
                >
                  {deletingId === photo.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 border-t border-sand-200/70 pt-5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-sage-100 text-pine">
              <Video className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[18px] leading-tight">Walkthrough video</h2>
              <p className="text-[11.5px] text-ink-500">
                One short clip (max 60 seconds) showing the entrance, main rooms and workspace.
              </p>
            </div>
          </div>

          {videos.length > 0 ? (
            <div className="mt-4 space-y-3">
              {videos.map((clip) => (
                <div key={clip.id} className="overflow-hidden rounded-2xl border border-sand-200 bg-black/90">
                  {clip.url ? (
                    <video
                      src={clip.url}
                      controls
                      playsInline
                      className="aspect-video w-full bg-black"
                    />
                  ) : (
                    <div className="grid aspect-video place-items-center text-[11px] text-sand-200">
                      Video unavailable
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 bg-white px-3 py-2">
                    <p className="truncate text-[11px] text-ink-600">
                      {clip.duration_seconds ? `${clip.duration_seconds}s walkthrough` : 'Walkthrough'}
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void removeVideo(clip.id)}
                      loading={deletingVideoId === clip.id}
                      leading={<Trash2 className="h-3.5 w-3.5" />}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl bg-sand-50 px-4 py-3 text-[11px] leading-5 text-ink-500">
              No walkthrough yet. A short, honest clip helps guests trust the home before a swap.
            </p>
          )}

          <label className="mt-3 inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-sand-300 bg-white/70 px-3 text-[12px] font-medium text-ink-700 transition hover:border-moss/40 hover:text-pine">
            {uploadingVideo ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Video className="h-3.5 w-3.5" />
            )}
            {uploadingVideo ? 'Uploading…' : videos.length > 0 ? 'Replace with new clip' : 'Upload video'}
            <input
              ref={videoRef}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadClip(file);
              }}
            />
          </label>
          <p className="mt-2 text-[10.5px] leading-5 text-ink-500">
            MP4, MOV or WebM up to 100 MB. Videos are stored privately and streamed through signed URLs.
          </p>
        </div>

        <div className="mt-6 space-y-3 border-t border-sand-200/70 pt-5">
          <Input
            label="Add by URL or storage path"
            placeholder="https://images.example.com/home.jpg"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            leading={<ImagePlus className="h-4 w-4" />}
            hint="Useful in demo mode or when the storage bucket is public."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={addByUrl} loading={adding} disabled={uploading}>
              Add photo
            </Button>
            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-sand-300 bg-white/70 px-3 text-[12px] font-medium text-ink-700 transition hover:border-moss/40 hover:text-pine">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? 'Uploading…' : 'Upload from device'}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </label>
          </div>
          <p className="text-[10.5px] leading-5 text-ink-500">
            Device uploads require Supabase Storage and a public bucket named{' '}
            <code className="rounded bg-sand-100 px-1">property-photos</code>. You can change the bucket
            with <code className="rounded bg-sand-100 px-1">NEXT_PUBLIC_SUPABASE_PHOTO_BUCKET</code>.
          </p>
        </div>
      </div>

      <aside className="space-y-4">
        <div className="card p-5">
          <p className="eyebrow">Photo guidance</p>
          <ul className="mt-2.5 space-y-2 text-[11.5px] leading-5 text-ink-600">
            <li>Use daylight and show the actual rooms, not a show-home.</li>
            <li>Include the workspace, bathroom and building entrance.</li>
            <li>Do not include people, documents or landmarks that reveal the address.</li>
            <li>Keep the cover photo horizontal; it is cropped to 4:3 in search.</li>
          </ul>
        </div>
        <div className="rounded-2xl bg-[#f4efe4]/80 p-4 text-[11px] leading-5 text-ink-600">
          Photos are moderated separately from the listing. A pending image may be visible to you before
          it appears publicly.
        </div>
      </aside>
    </div>
  );
}

export default function ManageListingPage() {
  return (
    <RequireAuth>
      <ManageListingContent />
    </RequireAuth>
  );
}
