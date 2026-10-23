'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  FileWarning,
  Flag,
  Home,
  Info,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { useAuth } from '@/components/auth/AuthProvider';
import { PageHeader } from '@/components/layout/PageHeader';
import { Badge, ReportStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { EmptyState, ErrorState, LoadingBlock, Tabs } from '@/components/ui/Primitives';
import { useToast } from '@/components/ui/Toast';
import {
  decidePropertyVerification,
  decideVerification,
  getAdminPropertyVerificationQueue,
  getAdminReports,
  getAdminVerificationQueue,
} from '@/lib/api';
import { errorMessage } from '@/lib/api/client';
import { formatDate, relativeTime } from '@/lib/dates';
import { useApiQuery } from '@/lib/hooks';
import type {
  AdminPropertyVerificationItem,
  Report,
  ReportCategory,
  VerificationStatus,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 8;

const REPORT_TABS = [
  { id: 'open', label: 'Open' },
  { id: 'under_review', label: 'Under review' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'dismissed', label: 'Dismissed' },
  { id: 'all', label: 'All' },
];

const categoryTone: Record<ReportCategory, 'red' | 'gold' | 'neutral' | 'outline' | 'sky'> = {
  safety: 'red',
  cleanliness: 'neutral',
  fraud: 'red',
  misrepresentation: 'gold',
  other: 'outline',
};

const targetIcon: Record<string, typeof Home> = {
  property: Home,
  booking: CalendarDays,
  user: UserRound,
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function AdminContent() {
  const { isDemo, user, refreshProfile } = useAuth();
  const { success, error: toastError } = useToast();

  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const reports = useApiQuery(() => getAdminReports(status, page, PAGE_SIZE), [status, page]);
  const queue = useApiQuery(() => getAdminVerificationQueue(), [], { enabled: isDemo });

  const items = reports.data?.items ?? [];
  const total = reports.data?.meta?.total ?? items.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [targetUser, setTargetUser] = useState('');
  const [decision, setDecision] = useState<'verified' | 'rejected'>('verified');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastDecision, setLastDecision] = useState<{
    userId: string;
    status: VerificationStatus;
  } | null>(null);

  const pendingQueue = queue.data ?? [];
  const propertyQueue = useApiQuery(() => getAdminPropertyVerificationQueue('pending'), []);
  const [propertyNotes, setPropertyNotes] = useState<Record<string, string>>({});
  const [decidingPropertyId, setDecidingPropertyId] = useState<string | null>(null);

  async function decideProperty(item: AdminPropertyVerificationItem, decision: 'verified' | 'rejected') {
    const notes = propertyNotes[item.id]?.trim() ?? '';
    if (decision === 'rejected' && notes.length < 10) {
      toastError('Add review notes', 'Explain what is missing or unclear before rejecting the home.');
      return;
    }
    setDecidingPropertyId(item.id);
    try {
      await decidePropertyVerification(item.id, decision, notes || undefined);
      success(
        decision === 'verified' ? 'Home verified' : 'Home verification rejected',
        decision === 'verified'
          ? 'The listing is now active and carries the verified-home badge.'
          : 'The host can resubmit with better evidence.',
      );
      propertyQueue.refresh();
    } catch (error) {
      toastError('Decision not recorded', errorMessage(error));
    } finally {
      setDecidingPropertyId(null);
    }
  }

  function changeStatus(next: string) {
    setStatus(next);
    setPage(1);
  }

  function pickMember(id: string, name: string) {
    setTargetUser(id);
    setNotes('');
    setFormError(null);
    success('Member selected', `${name} is ready for a verification decision.`);
  }

  async function submitDecision() {
    const trimmed = targetUser.trim();
    if (!uuidPattern.test(trimmed)) {
      setFormError('Enter the member’s full UUID (for example 11111111-1111-4111-8111-111111111111).');
      return;
    }
    if (decision === 'rejected' && notes.trim().length < 10) {
      setFormError('Add at least 10 characters of notes so the member understands the decision.');
      return;
    }
    if (notes.trim().length > 500) {
      setFormError('Keep notes under 500 characters.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await decideVerification(
        trimmed,
        decision,
        notes.trim() || undefined,
      );
      success(
        decision === 'verified' ? 'Member verified' : 'Verification rejected',
        `The badge is now recorded as ${result.verification_status}. The member is notified by the platform.`,
      );
      setLastDecision({ userId: trimmed, status: decision });
      setTargetUser('');
      setNotes('');
      setDecision('verified');
      queue.refresh();
      if (trimmed === user?.id) void refreshProfile();
    } catch (error) {
      const message = errorMessage(error);
      setFormError(message);
      toastError('Decision not recorded', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container-page py-8 sm:py-12">
      <PageHeader
        eyebrow="Trust & safety"
        title={
          <>
            Moderation <span className="italic text-moss">console</span>
          </>
        }
        description="Triage member reports and record identity decisions. This console never overrides the server: every badge and queue state is read back from the API."
        actions={
          <Badge tone="ink" dot>
            <ShieldCheck className="h-3 w-3" /> Admin
          </Badge>
        }
      />

      {isDemo && (
        <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-[#e6cf9d] bg-[#fbf3df] px-4 py-3 text-[11px] leading-5 text-[#7a5a1c]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Demo console: the queue below comes from seeded members. Decisions update the demo store
          instantly, including your own badge if you select your account.
        </div>
      )}

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[20px] leading-tight">Home verification</h2>
            <p className="mt-0.5 text-[11.5px] text-ink-500">
              Review ownership evidence and the physical code photo before a listing goes live.
            </p>
          </div>
          <Badge tone="gold" dot>
            {propertyQueue.loading ? 'Loading…' : `${propertyQueue.data?.length ?? 0} pending`}
          </Badge>
        </div>

        {propertyQueue.loading && <LoadingBlock label="Loading home verification queue" className="py-14" />}

        {!propertyQueue.loading && propertyQueue.error && (
          <ErrorState
            className="mt-4"
            title="Home verification queue could not load"
            message={propertyQueue.error}
            code={propertyQueue.errorCode}
            onRetry={propertyQueue.refresh}
          />
        )}

        {!propertyQueue.loading && !propertyQueue.error && (propertyQueue.data?.length ?? 0) === 0 && (
          <div className="mt-4">
            <EmptyState
              icon={<Building2 className="h-5 w-5" />}
              title="No homes awaiting verification"
              description="New ownership submissions will appear here with their documents and code photo."
            />
          </div>
        )}

        {!propertyQueue.loading && !propertyQueue.error && (propertyQueue.data?.length ?? 0) > 0 && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {(propertyQueue.data ?? []).map((item) => (
              <article key={item.id} className="rounded-3xl border border-sand-200/90 bg-white/90 p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink-900">
                      {item.property?.title ?? 'Listing'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-500">
                      {item.property?.neighbourhood}, {item.property?.city} ·{' '}
                      {item.owner?.display_name ?? 'Host'} · {relativeTime(item.created_at)}
                    </p>
                  </div>
                  <Badge tone="gold" dot>
                    Pending
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-600">
                  <span className="rounded-full border border-sand-300 bg-sand-50 px-2.5 py-1">
                    Code <span className="font-mono font-semibold text-ink-900">{item.physical_code}</span>
                  </span>
                  {item.ownership_document_url && (
                    <a
                      href={item.ownership_document_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 rounded-full border border-sand-300 bg-white px-2.5 py-1 font-medium hover:text-pine"
                    >
                      Ownership doc <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                  {item.lease_document_url && (
                    <a
                      href={item.lease_document_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 rounded-full border border-sand-300 bg-white px-2.5 py-1 font-medium hover:text-pine"
                    >
                      Lease doc <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                  {item.physical_code_photo_url && (
                    <a
                      href={item.physical_code_photo_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 rounded-full border border-sand-300 bg-white px-2.5 py-1 font-medium hover:text-pine"
                    >
                      Code photo <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )}
                </div>

                <Textarea
                  className="mt-3"
                  rows={2}
                  maxLength={500}
                  placeholder="Review notes (required when rejecting)"
                  value={propertyNotes[item.id] ?? ''}
                  onChange={(event) =>
                    setPropertyNotes((current) => ({ ...current, [item.id]: event.target.value }))
                  }
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => void decideProperty(item, 'verified')}
                    loading={decidingPropertyId === item.id}
                    leading={<ShieldCheck className="h-3.5 w-3.5" />}
                  >
                    Verify home
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => void decideProperty(item, 'rejected')}
                    disabled={decidingPropertyId === item.id}
                    leading={<ShieldAlert className="h-3.5 w-3.5" />}
                  >
                    Reject
                  </Button>
                  {item.property?.id && (
                    <Link href={`/properties/${item.property.id}`}>
                      <Button size="sm" variant="ghost" trailing={<ExternalLink className="h-3 w-3" />}>
                        Open listing
                      </Button>
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[20px] leading-tight">Reports</h2>
              <p className="mt-0.5 text-[11.5px] text-ink-500">
                {reports.loading
                  ? 'Loading the queue…'
                  : `${total} ${total === 1 ? 'report' : 'reports'} in “${
                      REPORT_TABS.find((tab) => tab.id === status)?.label ?? status
                    }”`}
              </p>
            </div>
            <Link href="/bookings">
              <Button variant="ghost" size="sm" leading={<Flag className="h-3.5 w-3.5" />}>
                How members report
              </Button>
            </Link>
          </div>

          <Tabs
            className="mt-4"
            active={status}
            onChange={changeStatus}
            tabs={REPORT_TABS}
            ariaLabel="Filter reports by status"
          />

          {reports.loading && <LoadingBlock label="Loading reports" className="py-20" />}

          {!reports.loading && reports.error && (
            <ErrorState
              className="mt-5"
              title="Reports could not load"
              message={reports.error}
              code={reports.errorCode}
              onRetry={reports.refresh}
            />
          )}

          {!reports.loading && !reports.error && items.length === 0 && (
            <div className="mt-5">
              <EmptyState
                icon={<ShieldCheck className="h-5 w-5" />}
                title={status === 'open' ? 'The open queue is clear' : 'Nothing in this bucket'}
                description={
                  status === 'open'
                    ? 'New member reports will appear here for triage. Check back after the next stay cycle.'
                    : 'Switch tabs to see reports in other states.'
                }
              />
            </div>
          )}

          {!reports.loading && !reports.error && items.length > 0 && (
            <div className="mt-5 space-y-4">
              {items.map((report) => (
                <ReportCard key={report.id} report={report} />
              ))}
            </div>
          )}

          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-2">
              <p className="text-[10.5px] text-ink-500">
                Page {page} of {pages}
              </p>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  leading={<ChevronLeft className="h-3.5 w-3.5" />}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= pages}
                  onClick={() => setPage((value) => Math.min(pages, value + 1))}
                  trailing={<ChevronRight className="h-3.5 w-3.5" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}

          <p className="mt-5 flex items-start gap-2 rounded-2xl border border-sand-200 bg-white/60 px-4 py-3 text-[10.5px] leading-5 text-ink-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Report status transitions and resolution notes are applied by the moderation service. This
            console shows the live queue and its server-recorded state; it does not edit reports locally.
          </p>
        </section>

        <aside className="space-y-5 lg:sticky lg:top-[92px] lg:self-start">
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-sage-100 text-pine">
                <ClipboardCheck className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-[17px] leading-tight">Verification decision</h2>
                <p className="text-[11px] text-ink-500">Recorded against the member&apos;s profile.</p>
              </div>
            </div>

            {isDemo && (
              <div className="mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">
                  Pending in demo ({pendingQueue.length})
                </p>
                {pendingQueue.length === 0 ? (
                  <p className="mt-2 rounded-xl bg-sage-50 px-3 py-2.5 text-[11px] text-pine">
                    No pending members. Decisions you record are reflected immediately.
                  </p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {pendingQueue.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => pickMember(member.id, member.display_name)}
                        className="flex w-full items-center justify-between gap-2 rounded-xl border border-sand-200 bg-white/70 px-3 py-2 text-left transition hover:border-moss/40"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sage-100 text-[10px] font-semibold text-pine">
                            {member.display_name
                              .split(' ')
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] font-medium text-ink-800">
                              {member.display_name}
                            </span>
                            <span className="block truncate font-mono text-[9px] text-ink-500">
                              {member.id}
                            </span>
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] font-semibold text-pine">Use</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <Input
                label="Member user ID"
                placeholder="00000000-0000-4000-8000-000000000000"
                value={targetUser}
                onChange={(event) => setTargetUser(event.target.value)}
                hint={
                  isDemo
                    ? 'Use a pending member above, or paste any seeded UUID.'
                    : 'The production API has no queue listing; paste the user ID from the verification request.'
                }
                spellCheck={false}
                autoComplete="off"
              />

              <Select
                label="Decision"
                value={decision}
                onChange={(event) => setDecision(event.target.value as 'verified' | 'rejected')}
                options={[
                  { value: 'verified', label: 'Verified — grant the badge' },
                  { value: 'rejected', label: 'Rejected — decline the badge' },
                ]}
              />

              <Textarea
                label={decision === 'rejected' ? 'Notes (required)' : 'Notes (optional)'}
                placeholder={
                  decision === 'rejected'
                    ? 'Explain what was unclear or missing so the member can resubmit correctly.'
                    : 'Optional internal context for this decision.'
                }
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={500}
                showCount
                rows={3}
              />

              {lastDecision && (
                <p
                  className={cn(
                    'rounded-xl px-3 py-2.5 text-[11px] leading-5',
                    lastDecision.status === 'verified'
                      ? 'bg-sage-50 text-pine'
                      : 'bg-[#fdf4f2] text-[#8d3527]',
                  )}
                >
                  Last decision: {lastDecision.status} for{' '}
                  <code className="break-all font-mono text-[10px]">{lastDecision.userId}</code>
                </p>
              )}

              {formError && (
                <p className="rounded-xl border border-[#e3bdb4] bg-[#fdf4f2] px-3 py-2.5 text-[11px] leading-5 text-[#8d3527]" role="alert">
                  {formError}
                </p>
              )}

              <Button
                className="w-full"
                variant={decision === 'rejected' ? 'danger' : 'primary'}
                onClick={submitDecision}
                loading={submitting}
                leading={
                  decision === 'verified' ? (
                    <ShieldCheck className="h-4 w-4" />
                  ) : (
                    <ShieldAlert className="h-4 w-4" />
                  )
                }
              >
                {decision === 'verified' ? 'Record verification' : 'Reject verification'}
              </Button>
              <p className="text-[10px] leading-4 text-ink-500">
                Decisions are final until a new submission is reviewed. Never share documents outside the
                approved review process.
              </p>
            </div>
          </section>

          <div className="card p-5">
            <p className="eyebrow">Triage checklist</p>
            <ul className="mt-2.5 space-y-2 text-[11px] leading-5 text-ink-600">
              <li className="flex gap-2">
                <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-clay-500" />
                Read the report and compare it with the target listing or booking.
              </li>
              <li className="flex gap-2">
                <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-moss" />
                Check the property page for photo and description mismatches.
              </li>
              <li className="flex gap-2">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a8402f]" />
                Escalate safety issues immediately; do not wait for a stay to end.
              </li>
              <li className="flex gap-2">
                <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-500" />
                Verification decisions require a legible ID and a matching profile name.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl bg-sage-50 p-4 text-[10.5px] leading-5 text-pine">
            <p className="font-semibold">Least-privilege review</p>
            <p className="mt-1 text-pine/80">
              Idempotent server actions and role checks protect this console. If a request returns 403,
              sign in with an authorised admin account rather than retrying.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: Report }) {
  const TargetIcon = targetIcon[report.target_type] ?? Flag;
  const created = report.created_at.slice(0, 10);

  return (
    <article className="rounded-3xl border border-sand-200/90 bg-white/90 p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <ReportStatusBadge status={report.status} />
          <Badge tone={categoryTone[report.category]}>{report.category}</Badge>
          <Badge tone="outline">
            <TargetIcon className="h-3 w-3" /> {report.target_type}
          </Badge>
        </div>
        <span className="text-[10.5px] text-ink-500">
          {relativeTime(report.created_at)} · {formatDate(created)}
        </span>
      </div>

      <p className="mt-3 text-[12.5px] leading-6 text-ink-700">{report.description}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-sand-200/70 pt-3 text-[10.5px] text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <UserRound className="h-3 w-3" />
          {report.reporter?.display_name ?? 'Member'}
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[9.5px]">
          {report.target_type}: {report.target_id}
        </span>
        {report.target_type === 'property' && (
          <Link
            href={`/properties/${report.target_id}`}
            className="inline-flex items-center gap-1 font-medium text-pine underline decoration-moss/40 underline-offset-2"
          >
            Open listing <ExternalLink className="h-3 w-3" />
          </Link>
        )}
        {report.target_type === 'booking' && (
          <Link
            href="/bookings"
            className="inline-flex items-center gap-1 font-medium text-pine underline decoration-moss/40 underline-offset-2"
          >
            Open trips <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>

      {report.evidence_urls.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {report.evidence_urls.map((url, index) => (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 rounded-full border border-sand-300 bg-white px-2.5 py-1 text-[10px] font-medium text-ink-600 transition hover:border-moss/40 hover:text-pine"
            >
              Evidence {index + 1} <ExternalLink className="h-2.5 w-2.5" />
            </a>
          ))}
        </div>
      )}

      {report.resolution_notes && (
        <p className="mt-3 rounded-xl bg-sand-50 px-3 py-2.5 text-[10.5px] leading-5 text-ink-600">
          <span className="font-semibold text-ink-800">Resolution:</span> {report.resolution_notes}
        </p>
      )}
    </article>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth adminOnly>
      <AdminContent />
    </RequireAuth>
  );
}
