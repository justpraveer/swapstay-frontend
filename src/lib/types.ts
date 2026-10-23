export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type UserRole = 'member' | 'admin';
export type ListingStatus = 'draft' | 'pending_review' | 'active' | 'suspended' | 'inactive';
export type AvailabilityStatus = 'available' | 'unavailable' | 'reserved' | 'booked';
export type SwapStatus =
  | 'pending'
  | 'requester_accepted'
  | 'recipient_accepted'
  | 'confirmed'
  | 'declined'
  | 'cancelled';
export type BookingStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled';
export type BookingType = 'direct_swap' | 'credit_stay';
export type CreditTxType =
  | 'initial_grant'
  | 'reservation_hold'
  | 'reservation_release'
  | 'stay_debit'
  | 'host_reward'
  | 'compensation_adjustment'
  | 'swap_difference'
  | 'cancellation_fee';
export type TxStatus = 'pending' | 'posted' | 'voided';
export type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';
export type ReportCategory = 'safety' | 'cleanliness' | 'fraud' | 'misrepresentation' | 'other';
export type ReportTarget = 'property' | 'booking' | 'user';
export type SwapScoreGrade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
}

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INSUFFICIENT_CREDITS'
  | 'DATES_UNAVAILABLE'
  | 'OVERLAPPING_BOOKING'
  | 'INVALID_STATE_TRANSITION'
  | 'MUTUAL_CONSENT_REQUIRED'
  | 'SELF_BOOKING_NOT_ALLOWED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'NETWORK_ERROR'
  | 'BACKEND_UNAVAILABLE';

export interface PublicProfile {
  id: string;
  display_name: string;
  verification_status: VerificationStatus;
}

export type ConversationContext = 'property' | 'booking' | 'swap' | 'general';

export interface Conversation {
  id: string;
  property_id: string | null;
  booking_id: string | null;
  swap_request_id: string | null;
  context: ConversationContext;
  created_at: string;
  updated_at: string;
  other_participant?: PublicProfile;
  property?: { id: string; title: string; city?: string };
  last_message?: Message;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: PublicProfile;
}

export interface CreateConversationInput {
  recipient_id: string;
  property_id?: string;
  booking_id?: string;
  swap_request_id?: string;
  context?: ConversationContext;
  initial_message?: string;
}

export interface Profile {
  id: string;
  display_name: string;
  bio: string | null;
  phone: string | null;
  verification_status: VerificationStatus;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface PropertyRow {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  city: string;
  state: string;
  neighbourhood: string;
  property_type: string;
  bedrooms: number;
  guest_capacity: number;
  amenities: string[];
  house_rules: string[];
  listing_status: ListingStatus;
  verification_status?: VerificationStatus;
  verification_notes?: string | null;
  verification_code?: string | null;
  verified_at?: string | null;
  exact_address?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyVideoRow {
  id: string;
  property_id: string;
  owner_id: string;
  media_type: 'video';
  storage_path: string;
  display_order: number;
  moderation_status: string;
  duration_seconds: number | null;
  created_at: string;
  url?: string | null;
}

export interface PropertyVerificationSubmission {
  id: string;
  property_id: string;
  owner_id: string;
  ownership_document_path: string | null;
  lease_document_path: string | null;
  physical_code: string;
  physical_code_photo_path: string;
  status: VerificationStatus;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  ownership_document_url?: string | null;
  lease_document_url?: string | null;
  physical_code_photo_url?: string | null;
}

export interface PropertyVerificationState {
  property: {
    id: string;
    verification_status: VerificationStatus;
    verification_code: string | null;
    verification_notes: string | null;
    verified_at: string | null;
  };
  submission: PropertyVerificationSubmission | null;
}

export interface AdminPropertyVerificationItem extends PropertyVerificationSubmission {
  property?: {
    id: string;
    title: string;
    city: string;
    neighbourhood: string;
    owner_id: string;
    listing_status: ListingStatus;
    verification_status: VerificationStatus;
  } | null;
  owner?: PublicProfile | null;
}

export interface PropertyScoreRow {
  id: string;
  property_id: string;
  condition_score: number;
  location_score: number;
  amenities_score: number;
  space_score: number;
  listing_quality_score: number;
  total_score: number;
  grade: SwapScoreGrade;
  method_version: string;
  evidence_status: string;
  assessed_at: string;
  assessed_by: string | null;
}

export interface PropertyPhotoRow {
  id: string;
  property_id: string;
  storage_path: string;
  display_order: number;
  moderation_status: string;
  created_at: string;
}

export interface ScoreBreakdown {
  condition: number;
  location: number;
  amenities: number;
  space: number;
  listing_quality: number;
}

export interface SearchScore {
  total_score: number;
  grade: SwapScoreGrade;
  breakdown: ScoreBreakdown;
}

export interface SearchProperty {
  id: string;
  title: string;
  description: string;
  city: string;
  state: string;
  neighbourhood: string;
  property_type: string;
  bedrooms: number;
  guest_capacity: number;
  amenities: string[];
  house_rules: string[];
  listing_status: ListingStatus;
  verification_status?: VerificationStatus;
  score?: SearchScore;
  photos: string[];
}

export interface PropertyDetail extends PropertyRow {
  property_scores?: PropertyScoreRow[];
  property_photos?: PropertyPhotoRow[];
  videos?: PropertyVideoRow[];
  owner?: PublicProfile;
}

export interface AvailabilityDay {
  date: string;
  availability_status: AvailabilityStatus;
}

export interface WalletSummary {
  available_balance: number;
  reserved_balance: number;
  total_balance: number;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  booking_id: string | null;
  transaction_type: CreditTxType;
  amount: number;
  status: TxStatus;
  idempotency_key: string | null;
  description: string;
  created_at: string;
}

export interface SwapTermsSnapshot {
  swap_request_id: string;
  requester_id: string;
  recipient_id: string;
  requester_stay: { property_id: string; check_in: string; check_out: string };
  recipient_stay: { property_id: string; check_in: string; check_out: string };
  version: string;
  confirmed_at: string;
  credit_difference?: number;
  credit_payer_id?: string | null;
  credit_recipient_id?: string | null;
}

export interface SwapAgreement {
  id: string;
  swap_request_id: string;
  agreement_version: string;
  terms_snapshot: SwapTermsSnapshot;
  requester_accepted_at: string;
  recipient_accepted_at: string;
  confirmed_at: string;
  created_at?: string;
}

export interface SwapPropertyRef {
  id: string;
  title: string;
  city: string;
  neighbourhood?: string;
}

export interface SwapRequestRow {
  id: string;
  requester_id: string;
  recipient_id: string;
  requester_property_id: string;
  recipient_property_id: string;
  requester_check_in: string;
  requester_check_out: string;
  recipient_check_in: string;
  recipient_check_out: string;
  request_status: SwapStatus;
  requester_accepted_at: string | null;
  recipient_accepted_at: string | null;
  created_at: string;
  updated_at: string;
  credit_difference?: number;
  credit_payer_id?: string | null;
  credit_recipient_id?: string | null;
  credit_terms_note?: string | null;
  credit_terms_status?: 'equal' | 'pending' | 'accepted' | 'countered' | 'declined' | 'return_stay';
}

export interface SwapRequest extends SwapRequestRow {
  requester_property?: SwapPropertyRef;
  recipient_property?: SwapPropertyRef;
  requester?: PublicProfile;
  recipient?: PublicProfile;
  swap_agreements?: SwapAgreement[];
}

export interface BookingRow {
  id: string;
  property_id: string;
  guest_id: string;
  host_id: string;
  check_in: string;
  check_out: string;
  booking_status: BookingStatus;
  booking_type: BookingType;
  credit_price: number;
  swap_request_id: string | null;
  created_at: string;
  updated_at: string;
  credit_reservation_amount?: number;
  cancellation_fee_nights?: number;
  credits_settled_at?: string | null;
  credits_released_at?: string | null;
}

export interface Booking extends BookingRow {
  property?: { id: string; title: string; city: string; neighbourhood?: string; property_type?: string };
  guest?: PublicProfile;
  host?: PublicProfile;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTarget;
  target_id: string;
  category: ReportCategory;
  description: string;
  evidence_urls: string[];
  status: ReportStatus;
  resolution_notes: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  reporter?: PublicProfile;
}

/* ------------------------------- inputs -------------------------------- */

export interface SearchParams {
  city?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  minScore?: number;
  page?: number;
  limit?: number;
}

export interface CreatePropertyInput {
  title: string;
  description: string;
  city: string;
  state: string;
  neighbourhood: string;
  property_type: string;
  bedrooms: number;
  guest_capacity: number;
  amenities: string[];
  house_rules: string[];
  exact_address: string;
}

export type UpdatePropertyInput = Partial<CreatePropertyInput> & {
  listing_status?: ListingStatus;
};

export interface CreateSwapInput {
  requester_property_id: string;
  recipient_property_id: string;
  requester_check_in: string;
  requester_check_out: string;
  recipient_check_in: string;
  recipient_check_out: string;
}

export interface CreateBookingInput {
  property_id: string;
  check_in: string;
  check_out: string;
  idempotency_key: string;
}

export interface CreateReviewInput {
  booking_id: string;
  rating: number;
  comment: string;
}

export interface CreateReportInput {
  target_type: ReportTarget;
  target_id: string;
  category: ReportCategory;
  description: string;
  evidence_urls: string[];
}

export interface VerificationInput {
  id_document_path: string;
  property_proof_path?: string;
}
