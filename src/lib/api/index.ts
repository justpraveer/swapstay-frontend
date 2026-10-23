import { api, ApiError } from '@/lib/api/client';
import { isDemoMode } from '@/lib/demo/store';
import {
  getSupabase,
  propertyPhotoBucket,
  propertyVerificationBucket,
  propertyVideoBucket,
  verificationBucket,
} from '@/lib/supabase';
import type {
  AvailabilityDay,
  AvailabilityStatus,
  Booking,
  CreateBookingInput,
  CreateConversationInput,
  CreatePropertyInput,
  CreateReportInput,
  CreateReviewInput,
  CreateSwapInput,
  CreditTransaction,
  AdminPropertyVerificationItem,
  Conversation,
  Profile,
  PropertyDetail,
  PropertyPhotoRow,
  PropertyVerificationState,
  PropertyVideoRow,
  PublicProfile,
  Report,
  Message,
  SearchParams,
  SearchProperty,
  SwapAgreement,
  SwapRequest,
  SwapTermsSnapshot,
  UpdatePropertyInput,
  VerificationInput,
  WalletSummary,
} from '@/lib/types';

function queryString<T extends object>(params: T) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.length > 0) {
      search.set(key, String(value));
    }
  });
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
}

/* ------------------------------ properties ------------------------------ */

export async function searchProperties(params: SearchParams) {
  const result = await api.get<SearchProperty[]>(`/properties/search${queryString(params)}`, {
    anonymous: true,
  });
  return { items: result.data ?? [], meta: result.meta };
}

export async function getProperty(id: string) {
  const result = await api.get<PropertyDetail>(`/properties/${id}`);
  return result.data;
}

export async function getMyProperties() {
  const result = await api.get<PropertyDetail[]>('/properties');
  return result.data ?? [];
}

export async function createProperty(input: CreatePropertyInput) {
  const result = await api.post<PropertyDetail>('/properties', input);
  return result.data;
}

export async function updateProperty(id: string, input: UpdatePropertyInput) {
  const result = await api.patch<PropertyDetail>(`/properties/${id}`, input);
  return result.data;
}

export async function getAvailability(id: string, startDate: string, endDate: string) {
  const result = await api.get<AvailabilityDay[]>(
    `/properties/${id}/availability${queryString({ startDate, endDate })}`,
    { anonymous: true },
  );
  return result.data ?? [];
}

export async function setAvailability(
  id: string,
  dates: { date: string; status: Extract<AvailabilityStatus, 'available' | 'unavailable'> }[],
) {
  const result = await api.post<AvailabilityDay[]>(`/properties/${id}/availability`, { dates });
  return result.data ?? [];
}

export async function getPropertyPhotos(id: string) {
  const result = await api.get<PropertyPhotoRow[]>(`/properties/${id}/photos`, { anonymous: true });
  return result.data ?? [];
}

export async function addPropertyPhoto(id: string, storagePath: string, displayOrder = 0) {
  const result = await api.post<PropertyPhotoRow>(`/properties/${id}/photos`, {
    storage_path: storagePath,
    display_order: displayOrder,
  });
  return result.data;
}

export async function uploadPropertyPhoto(
  file: File,
  propertyId: string,
  ownerId: string,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${ownerId}/${propertyId}/${Date.now()}-${safeName}`;
  if (isDemoMode()) return path;
  const supabase = getSupabase();
  if (!supabase) {
    throw new ApiError(
      'BACKEND_UNAVAILABLE',
      'Supabase Storage is not configured. Paste an image URL or storage path instead.',
      0,
    );
  }
  const { error } = await supabase.storage.from(propertyPhotoBucket()).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new ApiError('UPLOAD_FAILED', `Upload failed: ${error.message}`, 400);
  return path;
}

export async function deletePropertyPhoto(id: string, photoId: string) {
  await api.delete(`/properties/${id}/photos/${photoId}`);
}

/* ---------------------------- property media ---------------------------- */

export async function getPropertyMedia(id: string) {
  const result = await api.get<PropertyVideoRow[]>(`/properties/${id}/media`);
  return result.data ?? [];
}

export async function addPropertyVideo(
  id: string,
  storagePath: string,
  durationSeconds?: number,
  displayOrder = 0,
) {
  const result = await api.post<PropertyVideoRow>(`/properties/${id}/media`, {
    media_type: 'video',
    storage_path: storagePath,
    duration_seconds: durationSeconds,
    display_order: displayOrder,
  });
  return result.data;
}

export async function deletePropertyVideo(id: string, mediaId: string) {
  await api.delete(`/properties/${id}/media/${mediaId}`);
}

export async function uploadPropertyVideo(
  file: File,
  propertyId: string,
  ownerId: string,
): Promise<string> {
  const allowed = ['video/mp4', 'video/quicktime', 'video/webm'];
  if (!allowed.includes(file.type)) {
    throw new ApiError('VALIDATION_ERROR', 'Use an MP4, MOV or WebM video.', 400);
  }
  if (file.size > 100 * 1024 * 1024) {
    throw new ApiError('VALIDATION_ERROR', 'Keep the video under 100 MB.', 400);
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${ownerId}/${propertyId}/${Date.now()}-${safeName}`;
  if (isDemoMode()) return path;
  const supabase = getSupabase();
  if (!supabase) {
    throw new ApiError(
      'BACKEND_UNAVAILABLE',
      'Supabase Storage is not configured, so videos cannot be uploaded.',
      0,
    );
  }
  const { error } = await supabase.storage.from(propertyVideoBucket()).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new ApiError('UPLOAD_FAILED', `Upload failed: ${error.message}`, 400);
  return path;
}

/* ------------------------- property verification ------------------------ */

export async function getPropertyVerification(id: string) {
  const result = await api.get<PropertyVerificationState>(`/properties/${id}/verification`);
  return result.data;
}

export async function generatePropertyVerificationCode(id: string) {
  const result = await api.post<{ verification_code: string; instructions: string }>(
    `/properties/${id}/verification/code`,
  );
  return result.data;
}

export async function submitPropertyVerification(
  id: string,
  input: {
    ownership_document_path?: string;
    lease_document_path?: string;
    physical_code_photo_path: string;
  },
) {
  const result = await api.post(`/properties/${id}/verification`, input);
  return result.data;
}

export async function uploadPropertyVerificationDocument(
  file: File,
  propertyId: string,
  ownerId: string,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${ownerId}/${propertyId}/${Date.now()}-${safeName}`;
  if (isDemoMode()) return path;
  const supabase = getSupabase();
  if (!supabase) {
    throw new ApiError(
      'BACKEND_UNAVAILABLE',
      'Supabase Storage is not configured, so documents cannot be uploaded.',
      0,
    );
  }
  const { error } = await supabase.storage.from(propertyVerificationBucket()).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new ApiError('UPLOAD_FAILED', `Upload failed: ${error.message}`, 400);
  return path;
}

/* -------------------------------- profile ------------------------------- */

export async function getProfile() {
  const result = await api.get<Profile>('/profile');
  return result.data;
}

export async function updateProfile(input: Partial<Pick<Profile, 'display_name' | 'bio' | 'phone'>>) {
  const result = await api.patch<Profile>('/profile', input);
  return result.data;
}

export async function submitVerification(input: VerificationInput) {
  const result = await api.post<{ message: string; verification_status: string }>(
    '/verification',
    input,
  );
  return result.data;
}

export async function uploadVerificationDocument(file: File, userId: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new ApiError(
      'BACKEND_UNAVAILABLE',
      'Supabase is not configured, so documents cannot be uploaded. Add the Supabase keys or paste a storage path.',
      0,
    );
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const path = `${userId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(verificationBucket()).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    throw new ApiError('UPLOAD_FAILED', `Upload failed: ${error.message}`, 400);
  }
  return path;
}

/* --------------------------------- swaps -------------------------------- */

export async function getSwaps() {
  const result = await api.get<SwapRequest[]>('/swaps');
  return result.data ?? [];
}

export async function createSwap(input: CreateSwapInput) {
  const result = await api.post<SwapRequest>('/swaps', input);
  return result.data;
}

export async function acceptSwap(id: string) {
  const result = await api.post<{
    swap: SwapRequest;
    bookings: Booking[];
    agreement: SwapTermsSnapshot;
  }>(`/swaps/${id}/accept`);
  return result.data;
}

export async function declineSwap(id: string) {
  const result = await api.post<SwapRequest>(`/swaps/${id}/decline`);
  return result.data;
}

export async function respondToCreditTerms(id: string, input: { action: 'accept' | 'counter' | 'decline' | 'return_stay'; note?: string }) {
  const result = await api.post<SwapRequest>(`/swaps/${id}/credit-terms`, input);
  return result.data;
}

export async function getSwapAgreement(swap: SwapRequest): Promise<SwapAgreement | undefined> {
  return swap.swap_agreements?.[0];
}

/* -------------------------------- bookings ------------------------------ */

export async function getBookings() {
  const result = await api.get<Booking[]>('/bookings');
  return result.data ?? [];
}

export async function createBooking(input: CreateBookingInput) {
  const result = await api.post<{
    booking: Booking;
    creditCost: number;
    balances: { available_balance: number; reserved_balance: number };
  }>('/bookings', input);
  return result.data;
}

export async function confirmBooking(id: string) {
  const result = await api.post<Booking>(`/bookings/${id}/confirm`);
  return result.data;
}

export async function completeBooking(id: string) {
  const result = await api.post<{
    booking: Booking;
    settled: boolean;
    creditsTransferred: number;
  }>(`/bookings/${id}/complete`);
  return result.data;
}

export async function cancelBooking(id: string, reason: string) {
  const result = await api.post<Booking>(`/bookings/${id}/cancel`, { reason });
  return result.data;
}

/* --------------------------------- wallet ------------------------------- */

export async function getWallet() {
  const result = await api.get<WalletSummary>('/wallet');
  return result.data;
}

export async function getTransactions(page = 1, limit = 20) {
  const result = await api.get<CreditTransaction[]>(
    `/wallet/transactions${queryString({ page, limit })}`,
  );
  return { items: result.data ?? [], meta: result.meta };
}

/* ------------------------------ reviews/reports ------------------------- */

export async function createReview(input: CreateReviewInput) {
  const result = await api.post<{ id: string }>('/reviews', input);
  return result.data;
}

export async function createReport(input: CreateReportInput) {
  const result = await api.post<Report>('/reports', input);
  return result.data;
}

export async function getMyReports() {
  const result = await api.get<Report[]>('/reports');
  return result.data ?? [];
}

/* ------------------------------ messages ------------------------------- */

export async function getConversations() {
  const result = await api.get<Conversation[]>('/conversations');
  return result.data ?? [];
}

export async function getConversationMessages(id: string) {
  const result = await api.get<Message[]>(`/conversations/${id}/messages`);
  return result.data ?? [];
}

export async function createConversation(input: CreateConversationInput) {
  const result = await api.post<Conversation>('/conversations', input);
  return result.data;
}

export async function sendMessage(conversationId: string, body: string) {
  const result = await api.post<Message>(`/conversations/${conversationId}/messages`, { body });
  return result.data;
}

/* --------------------------------- admin -------------------------------- */

export async function getAdminReports(status = 'open', page = 1, limit = 20) {
  const result = await api.get<Report[]>(
    `/admin/reports${queryString({ status, page, limit })}`,
  );
  return { items: result.data ?? [], meta: result.meta };
}

export async function decideVerification(
  userId: string,
  decision: 'verified' | 'rejected',
  notes?: string,
) {
  const result = await api.post<{
    user_id: string;
    verification_status: string;
    notes?: string;
  }>(`/admin/verification/${userId}`, { decision, notes });
  return result.data;
}

export interface VerificationQueueItem {
  id: string;
  display_name: string;
  verification_status: string;
}

export async function getAdminVerificationQueue(): Promise<VerificationQueueItem[]> {
  const result = await api.get<
    Array<{
      id: string;
      user_id?: string;
      display_name?: string;
      verification_status?: string;
      profiles?: { id: string; display_name: string; verification_status: string };
    }>
  >('/admin/verification');
  return (result.data ?? []).map((row) => ({
    id: row.user_id ?? row.profiles?.id ?? row.id,
    display_name: row.display_name ?? row.profiles?.display_name ?? 'Member',
    verification_status: row.verification_status ?? row.profiles?.verification_status ?? 'pending',
  }));
}

export async function getAdminPropertyVerificationQueue(status = 'pending') {
  const result = await api.get<AdminPropertyVerificationItem[]>(
    `/admin/property-verification${queryString({ status })}`,
  );
  return result.data ?? [];
}

export async function decidePropertyVerification(
  submissionId: string,
  decision: 'verified' | 'rejected',
  notes?: string,
) {
  const result = await api.post<{
    submission_id: string;
    property_id: string;
    verification_status: string;
    notes?: string;
  }>(`/admin/property-verification/${submissionId}`, { decision, notes });
  return result.data;
}

export type { PublicProfile };
