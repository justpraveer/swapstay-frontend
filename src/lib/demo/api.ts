import { ApiError } from '@/lib/api/errors';
import { calculateSwapScore } from '@/lib/score';
import { nightsBetween } from '@/lib/dates';
import { uuid } from '@/lib/utils';
import type {
  ApiMeta,
  AvailabilityDay,
  Booking,
  BookingRow,
  Conversation,
  CreateBookingInput,
  CreatePropertyInput,
  CreateReportInput,
  CreateReviewInput,
  CreateSwapInput,
  CreditTransaction,
  Message,
  Profile,
  PropertyDetail,
  PropertyPhotoRow,
  PropertyScoreRow,
  PropertyVerificationSubmission,
  PropertyVideoRow,
  PublicProfile,
  Report,
  SearchProperty,
  SwapAgreement,
  SwapRequest,
  SwapRequestRow,
  UpdatePropertyInput,
  VerificationInput,
} from '@/lib/types';
import { DEMO_USER_ID, type DemoDB, type DemoProperty } from '@/lib/demo/seed';
import { getDemoDB, saveDemoDB } from '@/lib/demo/store';

interface DemoResult<T> {
  data: T;
  meta?: ApiMeta;
}

const delay = (ms = 140) => new Promise((resolve) => setTimeout(resolve, ms));
const nowISO = () => new Date().toISOString();

function publicProfile(db: DemoDB, id: string): PublicProfile {
  const host = db.hosts.find((entry) => entry.id === id);
  return {
    id,
    display_name: host?.display_name ?? 'SwapStay member',
    verification_status: host?.verification_status ?? 'unverified',
  };
}

function scoreRow(property: DemoProperty): PropertyScoreRow {
  return {
    id: `score-${property.id}`,
    property_id: property.id,
    condition_score: property.score.breakdown.condition,
    location_score: property.score.breakdown.location,
    amenities_score: property.score.breakdown.amenities,
    space_score: property.score.breakdown.space,
    listing_quality_score: property.score.breakdown.listing_quality,
    total_score: property.score.total_score,
    grade: property.score.grade,
    method_version: '1.0',
    evidence_status: property.score.evidence_status,
    assessed_at: property.score.assessed_at,
    assessed_by: null,
  };
}

function photoRows(property: DemoProperty): PropertyPhotoRow[] {
  return property.photos.map((path, index) => ({
    id: `photo-${property.id}-${index}`,
    property_id: property.id,
    storage_path: path,
    display_order: index,
    moderation_status: 'approved',
    created_at: property.created_at,
  }));
}

function detail(property: DemoProperty, db: DemoDB): PropertyDetail {
  return {
    ...property,
    property_scores: [scoreRow(property)],
    property_photos: photoRows(property),
    videos: db.propertyVideos?.[property.id] ?? [],
    owner: publicProfile(db, property.owner_id),
  };
}

function searchItem(property: DemoProperty): SearchProperty {
  return {
    id: property.id,
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
    listing_status: property.listing_status,
    verification_status: property.verification_status ?? 'verified',
    score: {
      total_score: property.score.total_score,
      grade: property.score.grade,
      breakdown: { ...property.score.breakdown },
    },
    photos: property.photos,
  };
}

function bookingView(db: DemoDB, row: BookingRow): Booking {
  const property = db.properties.find((entry) => entry.id === row.property_id);
  return {
    ...row,
    property: property
      ? {
          id: property.id,
          title: property.title,
          city: property.city,
          neighbourhood: property.neighbourhood,
          property_type: property.property_type,
        }
      : undefined,
    guest: publicProfile(db, row.guest_id),
    host: publicProfile(db, row.host_id),
  };
}

function swapView(db: DemoDB, row: SwapRequestRow): SwapRequest {
  const requesterProperty = db.properties.find((p) => p.id === row.requester_property_id);
  const recipientProperty = db.properties.find((p) => p.id === row.recipient_property_id);
  return {
    ...row,
    requester_property: requesterProperty
      ? {
          id: requesterProperty.id,
          title: requesterProperty.title,
          city: requesterProperty.city,
          neighbourhood: requesterProperty.neighbourhood,
        }
      : undefined,
    recipient_property: recipientProperty
      ? {
          id: recipientProperty.id,
          title: recipientProperty.title,
          city: recipientProperty.city,
          neighbourhood: recipientProperty.neighbourhood,
        }
      : undefined,
    requester: publicProfile(db, row.requester_id),
    recipient: publicProfile(db, row.recipient_id),
    swap_agreements: db.agreements.filter((agreement) => agreement.swap_request_id === row.id),
  };
}

function record(db: DemoDB, tx: Omit<CreditTransaction, 'id' | 'created_at'>) {
  db.transactions.unshift({
    ...tx,
    id: uuid(),
    created_at: nowISO(),
  });
}

function findProperty(db: DemoDB, id: string): DemoProperty {
  const property = db.properties.find((entry) => entry.id === id);
  if (!property) throw new ApiError('NOT_FOUND', 'Property listing not found', 404);
  return property;
}

function assertDates(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    throw new ApiError('VALIDATION_ERROR', 'Check-out must be after check-in', 400);
  }
}

function hasOverlap(db: DemoDB, propertyId: string, checkIn: string, checkOut: string) {
  return db.bookings.some(
    (booking) =>
      booking.property_id === propertyId &&
      booking.booking_status === 'confirmed' &&
      booking.check_in < checkOut &&
      booking.check_out > checkIn,
  );
}

export async function demoRequest<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<DemoResult<T>> {
  await delay();
  const db = getDemoDB();
  const [rawPath, rawQuery = ''] = path.split('?');
  const pathname = rawPath.replace(/^\/+|\/+$/g, '');
  const query = new URLSearchParams(rawQuery);
  const verb = method.toUpperCase();

  /* ------------------------------- search ------------------------------- */
  if (pathname === 'properties/search' && verb === 'GET') {
    const city = query.get('city') ?? undefined;
    const guests = Number(query.get('guests')) || undefined;
    const minScore = query.get('minScore') ? Number(query.get('minScore')) : undefined;
    const page = Math.max(1, Number(query.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.get('limit')) || 20));

    let items = db.properties.filter((property) => property.listing_status === 'active');
    if (city) items = items.filter((property) => property.city === city);
    if (guests) items = items.filter((property) => property.guest_capacity >= guests);
    if (minScore !== undefined) {
      items = items.filter((property) => property.score.total_score >= minScore);
    }
    const checkIn = query.get('checkIn');
    const checkOut = query.get('checkOut');
    if (checkIn && checkOut) {
      items = items.filter((property) => !hasOverlap(db, property.id, checkIn, checkOut));
    }

    items = [...items].sort((a, b) => {
      if (b.score.total_score !== a.score.total_score) {
        return b.score.total_score - a.score.total_score;
      }
      return a.guest_capacity - b.guest_capacity;
    });

    const total = items.length;
    const paginated = items.slice((page - 1) * limit, (page - 1) * limit + limit);
    return {
      data: paginated.map(searchItem) as unknown as T,
      meta: { total, page, limit },
    };
  }

  /* ------------------------------ properties ---------------------------- */
  if (pathname === 'properties' && verb === 'GET') {
    return {
      data: db.properties
        .filter((property) => property.owner_id === DEMO_USER_ID)
        .map((property) => detail(property, db)) as unknown as T,
    };
  }

  if (pathname === 'properties' && verb === 'POST') {
    const input = body as CreatePropertyInput;
    if (!input?.title || !input?.description) {
      throw new ApiError('VALIDATION_ERROR', 'Title and description are required', 400);
    }
    const breakdown = {
      condition: 75,
      location: 80,
      amenities: Math.min(100, (input.amenities?.length ?? 0) * 15),
      space: Math.min(100, input.bedrooms * 25 + input.guest_capacity * 10),
      listing_quality: 70,
    };
    const { total, grade } = calculateSwapScore(breakdown);
    const property: DemoProperty = {
      ...input,
      id: uuid(),
      owner_id: DEMO_USER_ID,
      listing_status: 'pending_review',
      verification_status: 'unverified',
      amenities: input.amenities ?? [],
      house_rules: input.house_rules ?? [],
      created_at: nowISO(),
      updated_at: nowISO(),
      photos: [],
      score: {
        breakdown,
        total_score: total,
        grade,
        evidence_status: 'unverified',
        assessed_at: nowISO(),
      },
    };
    db.properties.unshift(property);
    saveDemoDB(db);
    return { data: property as unknown as T };
  }

  const propertyMatch = pathname.match(/^properties\/([^/]+)$/);
  if (propertyMatch) {
    const property = findProperty(db, propertyMatch[1]);

    if (verb === 'GET') {
      return { data: detail(property, db) as unknown as T };
    }

    if (verb === 'PATCH') {
      if (property.owner_id !== DEMO_USER_ID) {
        throw new ApiError('FORBIDDEN', 'You do not own this property listing', 403);
      }
      Object.assign(property, body as UpdatePropertyInput, { updated_at: nowISO() });
      saveDemoDB(db);
      return { data: property as unknown as T };
    }
  }

  const availabilityMatch = pathname.match(/^properties\/([^/]+)\/availability$/);
  if (availabilityMatch) {
    const property = findProperty(db, availabilityMatch[1]);
    const storeForProperty = (db.availability[property.id] = db.availability[property.id] ?? {});

    if (verb === 'GET') {
      const startDate = query.get('startDate') ?? '0000-01-01';
      const endDate = query.get('endDate') ?? '9999-12-31';
      const days: AvailabilityDay[] = Object.entries(storeForProperty)
        .filter(([date]) => date >= startDate && date <= endDate)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, status]) => ({ date, availability_status: status }));
      return { data: days as unknown as T };
    }

    if (verb === 'POST') {
      if (property.owner_id !== DEMO_USER_ID) {
        throw new ApiError('FORBIDDEN', 'You do not have permission to manage this property calendar', 403);
      }
      const input = body as { dates: { date: string; status: 'available' | 'unavailable' }[] };
      if (!input?.dates?.length) {
        throw new ApiError('VALIDATION_ERROR', 'At least one date is required', 400);
      }
      input.dates.forEach((entry) => {
        storeForProperty[entry.date] = entry.status;
      });
      saveDemoDB(db);
      return {
        data: input.dates.map((entry) => ({
          property_id: property.id,
          date: entry.date,
          availability_status: entry.status,
        })) as unknown as T,
      };
    }
  }

  const photosMatch = pathname.match(/^properties\/([^/]+)\/photos$/);
  if (photosMatch) {
    const property = findProperty(db, photosMatch[1]);
    if (verb === 'GET') {
      return { data: photoRows(property) as unknown as T };
    }
    if (verb === 'POST') {
      if (property.owner_id !== DEMO_USER_ID) {
        throw new ApiError('FORBIDDEN', 'You do not own this listing', 403);
      }
      const input = body as { storage_path: string; display_order?: number };
      if (!input?.storage_path) {
        throw new ApiError('VALIDATION_ERROR', 'A storage path is required', 400);
      }
      property.photos.push(input.storage_path);
      saveDemoDB(db);
      const rows = photoRows(property);
      return { data: rows[rows.length - 1] as unknown as T };
    }
  }

  const photoDeleteMatch = pathname.match(/^properties\/([^/]+)\/photos\/([^/]+)$/);
  if (photoDeleteMatch && verb === 'DELETE') {
    const property = findProperty(db, photoDeleteMatch[1]);
    if (property.owner_id !== DEMO_USER_ID) {
      throw new ApiError('FORBIDDEN', 'You do not own this property listing', 403);
    }
    const index = Number(photoDeleteMatch[2].split('-').pop());
    if (Number.isFinite(index)) property.photos.splice(index, 1);
    saveDemoDB(db);
    return { data: { deleted: true } as unknown as T };
  }

  /* ------------------------- property verification ---------------------- */
  const verificationMatch = pathname.match(/^properties\/([^/]+)\/verification$/);
  if (verificationMatch) {
    const property = findProperty(db, verificationMatch[1]);
    if (property.owner_id !== DEMO_USER_ID && db.profile.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Only the property owner can manage verification', 403);
    }

    if (verb === 'GET') {
      return {
        data: {
          property: {
            id: property.id,
            verification_status: property.verification_status ?? 'unverified',
            verification_code: property.verification_code ?? null,
            verification_notes: property.verification_notes ?? null,
            verified_at: property.verified_at ?? null,
          },
          submission: db.propertyVerification[property.id] ?? null,
        } as unknown as T,
      };
    }

    if (verb === 'POST') {
      const input = body as {
        ownership_document_path?: string;
        lease_document_path?: string;
        physical_code_photo_path?: string;
      };
      if (!input?.ownership_document_path && !input?.lease_document_path) {
        throw new ApiError('VALIDATION_ERROR', 'Add an ownership or lease document', 400);
      }
      if (!input?.physical_code_photo_path) {
        throw new ApiError('VALIDATION_ERROR', 'Upload a photo of the verification code', 400);
      }
      const code = property.verification_code ?? 'A1B2C3';
      const submission: PropertyVerificationSubmission = {
        id: uuid(),
        property_id: property.id,
        owner_id: DEMO_USER_ID,
        ownership_document_path: input.ownership_document_path ?? null,
        lease_document_path: input.lease_document_path ?? null,
        physical_code: code,
        physical_code_photo_path: input.physical_code_photo_path,
        status: 'pending',
        notes: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: nowISO(),
        updated_at: nowISO(),
      };
      property.verification_status = 'pending';
      property.verification_code = code;
      property.verification_notes = null;
      property.verified_at = null;
      db.propertyVerification[property.id] = submission;
      saveDemoDB(db);
      return { data: submission as unknown as T };
    }
  }

  const verificationCodeMatch = pathname.match(/^properties\/([^/]+)\/verification\/code$/);
  if (verificationCodeMatch && verb === 'POST') {
    const property = findProperty(db, verificationCodeMatch[1]);
    if (property.owner_id !== DEMO_USER_ID) {
      throw new ApiError('FORBIDDEN', 'Only the property owner can request a verification code', 403);
    }
    if (property.verification_status === 'verified') {
      throw new ApiError('INVALID_STATE_TRANSITION', 'This property is already verified', 400);
    }
    property.verification_code = uuid().replace(/-/g, '').slice(0, 6).toUpperCase();
    saveDemoDB(db);
    return {
      data: {
        verification_code: property.verification_code,
        instructions:
          'Write this code on a card, place it inside the home, and upload a clear photo showing the card in the room.',
      } as unknown as T,
    };
  }

  const mediaMatch = pathname.match(/^properties\/([^/]+)\/media$/);
  if (mediaMatch) {
    const property = findProperty(db, mediaMatch[1]);
    const store = (db.propertyVideos[property.id] = db.propertyVideos[property.id] ?? []);

    if (verb === 'GET') {
      if (property.owner_id !== DEMO_USER_ID && db.profile.role !== 'admin') {
        throw new ApiError('FORBIDDEN', 'Only the property owner can view private media', 403);
      }
      return { data: store as unknown as T };
    }

    if (verb === 'POST') {
      if (property.owner_id !== DEMO_USER_ID) {
        throw new ApiError('FORBIDDEN', 'Only the property owner can add media', 403);
      }
      const input = body as {
        storage_path?: string;
        duration_seconds?: number;
        display_order?: number;
      };
      if (!input?.storage_path) throw new ApiError('VALIDATION_ERROR', 'A storage path is required', 400);
      const video: PropertyVideoRow = {
        id: uuid(),
        property_id: property.id,
        owner_id: DEMO_USER_ID,
        media_type: 'video',
        storage_path: input.storage_path,
        display_order: input.display_order ?? store.length,
        moderation_status: 'approved',
        duration_seconds: input.duration_seconds ?? null,
        created_at: nowISO(),
        url: null,
      };
      store.push(video);
      saveDemoDB(db);
      return { data: video as unknown as T };
    }
  }

  const mediaDeleteMatch = pathname.match(/^properties\/([^/]+)\/media\/([^/]+)$/);
  if (mediaDeleteMatch && verb === 'DELETE') {
    const property = findProperty(db, mediaDeleteMatch[1]);
    if (property.owner_id !== DEMO_USER_ID && db.profile.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'You do not own this listing', 403);
    }
    const store = db.propertyVideos[property.id] ?? [];
    db.propertyVideos[property.id] = store.filter((item) => item.id !== mediaDeleteMatch[2]);
    saveDemoDB(db);
    return { data: { deleted: true } as unknown as T };
  }

  /* -------------------------------- profile ------------------------------ */
  if (pathname === 'profile' && verb === 'GET') {
    return { data: db.profile as unknown as T };
  }

  if (pathname === 'profile' && verb === 'PATCH') {
    const patch = body as Partial<Profile>;
    db.profile = { ...db.profile, ...patch, updated_at: nowISO() };
    const self = db.hosts.find((host) => host.id === DEMO_USER_ID);
    if (self && patch.display_name) self.display_name = patch.display_name;
    saveDemoDB(db);
    return { data: db.profile as unknown as T };
  }

  if (pathname === 'verification' && verb === 'POST') {
    const input = body as VerificationInput;
    if (!input?.id_document_path) {
      throw new ApiError('VALIDATION_ERROR', 'A valid ID document path is required', 400);
    }
    db.profile = { ...db.profile, verification_status: 'pending', updated_at: nowISO() };
    const self = db.hosts.find((host) => host.id === DEMO_USER_ID);
    if (self) self.verification_status = 'pending';
    saveDemoDB(db);
    return {
      data: {
        message: 'Verification documents submitted for review',
        verification_status: 'pending',
      } as unknown as T,
    };
  }

  /* --------------------------------- swaps ------------------------------- */
  if (pathname === 'swaps' && verb === 'GET') {
    return {
      data: db.swaps
        .filter((swap) => swap.requester_id === DEMO_USER_ID || swap.recipient_id === DEMO_USER_ID)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((swap) => swapView(db, swap)) as unknown as T,
    };
  }

  if (pathname === 'swaps' && verb === 'POST') {
    const input = body as CreateSwapInput;
    const requesterProperty = findProperty(db, input.requester_property_id);
    const recipientProperty = findProperty(db, input.recipient_property_id);

    if (requesterProperty.owner_id !== DEMO_USER_ID) {
      throw new ApiError('VALIDATION_ERROR', 'You can only propose swaps using your own property', 400);
    }
    if (requesterProperty.listing_status !== 'active') {
      throw new ApiError('VALIDATION_ERROR', 'Your property must be active to propose swaps', 400);
    }
    if (recipientProperty.owner_id === DEMO_USER_ID) {
      throw new ApiError('SELF_BOOKING_NOT_ALLOWED', 'Cannot swap with your own property', 400);
    }
    if (recipientProperty.listing_status !== 'active') {
      throw new ApiError('VALIDATION_ERROR', 'Target property is not currently active', 400);
    }
    if (input.requester_property_id === input.recipient_property_id) {
      throw new ApiError('VALIDATION_ERROR', 'Cannot create a swap between the same property', 400);
    }
    assertDates(input.requester_check_in, input.requester_check_out);
    assertDates(input.recipient_check_in, input.recipient_check_out);

    const row: SwapRequestRow = {
      id: uuid(),
      requester_id: DEMO_USER_ID,
      recipient_id: recipientProperty.owner_id,
      ...input,
      request_status: 'pending',
      requester_accepted_at: nowISO(),
      recipient_accepted_at: null,
      created_at: nowISO(),
      updated_at: nowISO(),
      credit_difference: Math.abs(
        nightsBetween(input.requester_check_in, input.requester_check_out) -
          nightsBetween(input.recipient_check_in, input.recipient_check_out),
      ),
      credit_payer_id:
        nightsBetween(input.requester_check_in, input.requester_check_out) >
        nightsBetween(input.recipient_check_in, input.recipient_check_out)
          ? DEMO_USER_ID
          : recipientProperty.owner_id,
      credit_recipient_id:
        nightsBetween(input.requester_check_in, input.requester_check_out) >
        nightsBetween(input.recipient_check_in, input.recipient_check_out)
          ? recipientProperty.owner_id
          : DEMO_USER_ID,
      credit_terms_status:
        nightsBetween(input.requester_check_in, input.requester_check_out) ===
        nightsBetween(input.recipient_check_in, input.recipient_check_out)
          ? 'equal'
          : 'pending',
      credit_terms_note: null,
    };
    db.swaps.push(row);
    saveDemoDB(db);
    return { data: row as unknown as T };
  }

  const creditTermsMatch = pathname.match(/^swaps\/([^/]+)\/credit-terms$/);
  if (creditTermsMatch && verb === 'POST') {
    const swap = db.swaps.find((entry) => entry.id === creditTermsMatch[1]);
    if (!swap) throw new ApiError('NOT_FOUND', 'Swap request not found', 404);
    if (swap.credit_recipient_id !== DEMO_USER_ID) {
      throw new ApiError('FORBIDDEN', 'Only the member earning the difference can respond to these terms', 403);
    }
    const input = body as { action?: 'accept' | 'counter' | 'decline' | 'return_stay'; note?: string };
    if (!input?.action || !['accept', 'counter', 'decline', 'return_stay'].includes(input.action)) {
      throw new ApiError('VALIDATION_ERROR', 'Choose accept, counter, decline or return stay', 400);
    }
    if ((input.action === 'counter' || input.action === 'return_stay') && !input.note?.trim()) {
      throw new ApiError('VALIDATION_ERROR', 'Please explain the alternative terms', 400);
    }
    swap.credit_terms_status = input.action === 'accept'
      ? 'accepted'
      : input.action === 'counter'
        ? 'countered'
        : input.action === 'return_stay'
          ? 'return_stay'
          : 'declined';
    swap.credit_terms_note = input.note?.trim() || null;
    swap.updated_at = nowISO();
    saveDemoDB(db);
    return { data: swap as unknown as T };
  }

  const swapActionMatch = pathname.match(/^swaps\/([^/]+)\/(accept|decline)$/);
  if (swapActionMatch) {
    const swap = db.swaps.find((entry) => entry.id === swapActionMatch[1]);
    if (!swap) throw new ApiError('NOT_FOUND', 'Swap request not found', 404);

    if (swapActionMatch[2] === 'accept') {
      if (swap.recipient_id !== DEMO_USER_ID) {
        throw new ApiError('FORBIDDEN', 'Only the recipient of this swap request can accept it', 403);
      }
      if (swap.request_status === 'confirmed' || swap.request_status === 'declined' || swap.request_status === 'cancelled') {
        throw new ApiError('INVALID_STATE_TRANSITION', `Cannot accept swap with status: ${swap.request_status}`, 400);
      }
      if (hasOverlap(db, swap.recipient_property_id, swap.requester_check_in, swap.requester_check_out)) {
        throw new ApiError('OVERLAPPING_BOOKING', 'Recipient property already has a confirmed booking for these dates', 409);
      }
      if (hasOverlap(db, swap.requester_property_id, swap.recipient_check_in, swap.recipient_check_out)) {
        throw new ApiError('OVERLAPPING_BOOKING', 'Requester property already has a confirmed booking for these dates', 409);
      }

      const confirmedAt = nowISO();
      const requesterNights = nightsBetween(swap.requester_check_in, swap.requester_check_out);
      const recipientNights = nightsBetween(swap.recipient_check_in, swap.recipient_check_out);
      const creditDifference = Math.abs(requesterNights - recipientNights);
      const payerIsDemo = swap.credit_payer_id === DEMO_USER_ID;
      if (creditDifference > 0 && swap.credit_terms_status !== 'pending' && swap.credit_terms_status !== 'accepted') {
        throw new ApiError('MUTUAL_CONSENT_REQUIRED', 'The unequal-swap credit terms must be accepted first', 400);
      }
      if (creditDifference > 0 && payerIsDemo && db.wallet.available_balance < creditDifference) {
        throw new ApiError('INSUFFICIENT_CREDITS', `This unequal swap requires ${creditDifference} credits. Earn credits by hosting first.`, 400);
      }
      const terms = {
        swap_request_id: swap.id,
        requester_id: swap.requester_id,
        recipient_id: swap.recipient_id,
        requester_stay: {
          property_id: swap.recipient_property_id,
          check_in: swap.requester_check_in,
          check_out: swap.requester_check_out,
        },
        recipient_stay: {
          property_id: swap.requester_property_id,
          check_in: swap.recipient_check_in,
          check_out: swap.recipient_check_out,
        },
        version: '1.0',
        confirmed_at: confirmedAt,
        credit_difference: creditDifference,
        credit_payer_id: creditDifference > 0 ? swap.credit_payer_id : null,
        credit_recipient_id: creditDifference > 0 ? swap.credit_recipient_id : null,
      };
      const agreement: SwapAgreement = {
        id: uuid(),
        swap_request_id: swap.id,
        agreement_version: '1.0',
        terms_snapshot: terms,
        requester_accepted_at: swap.requester_accepted_at ?? confirmedAt,
        recipient_accepted_at: confirmedAt,
        confirmed_at: confirmedAt,
        created_at: confirmedAt,
      };
      db.agreements.push(agreement);

      const legOne: BookingRow = {
        id: uuid(),
        property_id: swap.recipient_property_id,
        guest_id: swap.requester_id,
        host_id: swap.recipient_id,
        check_in: swap.requester_check_in,
        check_out: swap.requester_check_out,
        booking_status: 'confirmed',
        booking_type: 'direct_swap',
        credit_price: creditDifference > 0 && requesterNights > recipientNights ? creditDifference : 0,
        swap_request_id: swap.id,
        created_at: confirmedAt,
        updated_at: confirmedAt,
      };
      const legTwo: BookingRow = {
        id: uuid(),
        property_id: swap.requester_property_id,
        guest_id: swap.recipient_id,
        host_id: swap.requester_id,
        check_in: swap.recipient_check_in,
        check_out: swap.recipient_check_out,
        booking_status: 'confirmed',
        booking_type: 'direct_swap',
        credit_price: creditDifference > 0 && recipientNights > requesterNights ? creditDifference : 0,
        swap_request_id: swap.id,
        created_at: confirmedAt,
        updated_at: confirmedAt,
      };
      db.bookings.push(legOne, legTwo);
      if (creditDifference > 0 && payerIsDemo) {
        db.wallet.available_balance -= creditDifference;
        db.wallet.reserved_balance += creditDifference;
        record(db, {
          user_id: DEMO_USER_ID,
          booking_id: requesterNights > recipientNights ? legOne.id : legTwo.id,
          transaction_type: 'reservation_hold',
          amount: -creditDifference,
          status: 'posted',
          idempotency_key: `swap-reservation:${swap.id}`,
          description: `Reserve ${creditDifference} credits for unequal swap`,
        });
      }
      swap.request_status = 'confirmed';
      swap.recipient_accepted_at = confirmedAt;
      swap.credit_terms_status = creditDifference > 0 ? 'accepted' : 'equal';
      swap.updated_at = confirmedAt;
      saveDemoDB(db);
      return {
        data: { swap, bookings: [legOne, legTwo], agreement: terms } as unknown as T,
      };
    }

    if (swap.requester_id !== DEMO_USER_ID && swap.recipient_id !== DEMO_USER_ID) {
      throw new ApiError('FORBIDDEN', 'You are not a participant in this swap proposal', 403);
    }
    if (swap.request_status === 'confirmed') {
      throw new ApiError('INVALID_STATE_TRANSITION', 'Cannot decline an already confirmed swap', 400);
    }
    swap.request_status = swap.requester_id === DEMO_USER_ID ? 'cancelled' : 'declined';
    swap.updated_at = nowISO();
    saveDemoDB(db);
    return { data: swap as unknown as T };
  }

  /* ------------------------------- bookings ------------------------------ */
  if (pathname === 'bookings' && verb === 'GET') {
    return {
      data: db.bookings
        .filter((booking) => booking.guest_id === DEMO_USER_ID || booking.host_id === DEMO_USER_ID)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((booking) => bookingView(db, booking)) as unknown as T,
    };
  }

  if (pathname === 'bookings' && verb === 'POST') {
    const input = body as CreateBookingInput;
    const property = findProperty(db, input.property_id);
    if (property.owner_id === DEMO_USER_ID) {
      throw new ApiError('SELF_BOOKING_NOT_ALLOWED', 'Hosts cannot book their own property', 400);
    }
    if (property.listing_status !== 'active') {
      throw new ApiError('VALIDATION_ERROR', 'Property is not active for booking', 400);
    }
    assertDates(input.check_in, input.check_out);
    const nights = nightsBetween(input.check_in, input.check_out);
    const creditCost = nights;
    if (hasOverlap(db, property.id, input.check_in, input.check_out)) {
      throw new ApiError('OVERLAPPING_BOOKING', 'These dates conflict with an existing confirmed booking', 409);
    }
    if (db.wallet.available_balance < creditCost) {
      throw new ApiError(
        'INSUFFICIENT_CREDITS',
        `Insufficient credit balance. This ${nights}-night stay requires ${creditCost} credits, but you have ${db.wallet.available_balance} credits available.`,
        400,
        { required: creditCost, available: db.wallet.available_balance },
      );
    }

    const booking: BookingRow = {
      id: uuid(),
      property_id: property.id,
      guest_id: DEMO_USER_ID,
      host_id: property.owner_id,
      check_in: input.check_in,
      check_out: input.check_out,
      booking_status: 'requested',
      booking_type: 'credit_stay',
      credit_price: creditCost,
      swap_request_id: null,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    db.bookings.unshift(booking);
    db.wallet.available_balance -= creditCost;
    db.wallet.reserved_balance += creditCost;
    record(db, {
      user_id: DEMO_USER_ID,
      booking_id: booking.id,
      transaction_type: 'reservation_hold',
      amount: -creditCost,
      status: 'posted',
      idempotency_key: input.idempotency_key ?? null,
      description: `Hold ${creditCost} credits for stay at ${property.title} (${nights} nights)`,
    });
    saveDemoDB(db);
    return {
      data: {
        booking,
        creditCost,
        balances: {
          available_balance: db.wallet.available_balance,
          reserved_balance: db.wallet.reserved_balance,
        },
      } as unknown as T,
    };
  }

  const bookingActionMatch = pathname.match(/^bookings\/([^/]+)\/(confirm|complete|cancel)$/);
  if (bookingActionMatch) {
    const booking = db.bookings.find((entry) => entry.id === bookingActionMatch[1]);
    if (!booking) throw new ApiError('NOT_FOUND', 'Booking not found', 404);
    const action = bookingActionMatch[2];
    const property = db.properties.find((entry) => entry.id === booking.property_id);

    if (action === 'confirm') {
      if (booking.host_id !== DEMO_USER_ID) {
        throw new ApiError('FORBIDDEN', 'Only the host of this property can confirm the booking', 403);
      }
      if (booking.booking_status !== 'requested') {
        throw new ApiError('INVALID_STATE_TRANSITION', `Cannot confirm a booking with status: ${booking.booking_status}`, 400);
      }
      if (hasOverlap(db, booking.property_id, booking.check_in, booking.check_out)) {
        throw new ApiError('OVERLAPPING_BOOKING', 'Property already has an active confirmed booking for these dates', 409);
      }
      booking.booking_status = 'confirmed';
      booking.updated_at = nowISO();
      saveDemoDB(db);
      return { data: booking as unknown as T };
    }

    if (action === 'complete') {
      if (booking.host_id !== DEMO_USER_ID) {
        throw new ApiError('FORBIDDEN', 'Only the host can mark the stay as completed', 403);
      }
      if (booking.booking_status !== 'confirmed') {
        throw new ApiError('INVALID_STATE_TRANSITION', `Cannot complete a booking with status: ${booking.booking_status}`, 400);
      }
      if (booking.check_out > new Date().toISOString().slice(0, 10)) {
        throw new ApiError('INVALID_STATE_TRANSITION', 'A stay can only be completed after check-out', 400);
      }
      booking.booking_status = 'completed';
      booking.updated_at = nowISO();
      if (booking.booking_type === 'credit_stay' && booking.credit_price > 0 && !booking.credits_settled_at) {
        if (booking.guest_id === DEMO_USER_ID) {
          db.wallet.reserved_balance = Math.max(0, db.wallet.reserved_balance - booking.credit_price);
          record(db, {
            user_id: DEMO_USER_ID,
            booking_id: booking.id,
            transaction_type: 'stay_debit',
            amount: -booking.credit_price,
            status: 'posted',
            idempotency_key: null,
            description: `Settle ${booking.credit_price} credits for completed stay at ${property?.title ?? 'the property'}`,
          });
        }
        if (booking.host_id === DEMO_USER_ID) {
          db.wallet.available_balance += booking.credit_price;
          record(db, {
            user_id: DEMO_USER_ID,
            booking_id: booking.id,
            transaction_type: 'host_reward',
            amount: booking.credit_price,
            status: 'posted',
            idempotency_key: null,
            description: `Host reward for completed stay at ${property?.title ?? 'your property'}`,
          });
        }
        booking.credits_settled_at = nowISO();
      }
      saveDemoDB(db);
      return {
        data: {
          booking,
          settled: booking.booking_type === 'credit_stay',
          creditsTransferred: booking.credit_price,
        } as unknown as T,
      };
    }

    if (booking.guest_id !== DEMO_USER_ID && booking.host_id !== DEMO_USER_ID) {
      throw new ApiError('FORBIDDEN', 'You are not authorized to cancel this booking', 403);
    }
    if (booking.booking_status === 'cancelled' || booking.booking_status === 'completed') {
      throw new ApiError('INVALID_STATE_TRANSITION', `Cannot cancel booking with status: ${booking.booking_status}`, 400);
    }
    if (booking.booking_type === 'credit_stay' && booking.credit_price > 0 && booking.guest_id === DEMO_USER_ID) {
      const daysUntilCheckIn = Math.floor((new Date(`${booking.check_in}T00:00:00`).getTime() - Date.now()) / 86_400_000);
      const fee = daysUntilCheckIn >= 7 ? 0 : Math.min(1, booking.credit_price);
      const releaseAmount = booking.credit_price - fee;
      db.wallet.available_balance += releaseAmount;
      db.wallet.reserved_balance = Math.max(0, db.wallet.reserved_balance - booking.credit_price);
      record(db, {
        user_id: DEMO_USER_ID,
        booking_id: booking.id,
        transaction_type: 'reservation_release',
        amount: releaseAmount,
        status: 'posted',
        idempotency_key: null,
        description: `Release ${releaseAmount} credits for cancelled booking at ${property?.title ?? 'the property'}`,
      });
      if (fee > 0) {
        record(db, {
          user_id: DEMO_USER_ID,
          booking_id: booking.id,
          transaction_type: 'cancellation_fee',
          amount: -fee,
          status: 'posted',
          idempotency_key: `cancellation-fee:${booking.id}`,
          description: `Late cancellation fee for booking at ${property?.title ?? 'the property'}`,
        });
      }
      booking.cancellation_fee_nights = fee;
      booking.credits_released_at = nowISO();
    }
    booking.booking_status = 'cancelled';
    booking.updated_at = nowISO();
    saveDemoDB(db);
    return { data: booking as unknown as T };
  }

  /* -------------------------------- wallet ------------------------------- */
  if (pathname === 'wallet' && verb === 'GET') {
    return {
      data: {
        available_balance: db.wallet.available_balance,
        reserved_balance: db.wallet.reserved_balance,
        total_balance: db.wallet.available_balance + db.wallet.reserved_balance,
      } as unknown as T,
    };
  }

  if (pathname === 'wallet/transactions' && verb === 'GET') {
    const page = Math.max(1, Number(query.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.get('limit')) || 20));
    const sorted = [...db.transactions].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return {
      data: sorted.slice((page - 1) * limit, (page - 1) * limit + limit) as unknown as T,
      meta: { total: sorted.length, page, limit },
    };
  }

  /* ------------------------------- reviews ------------------------------- */
  if (pathname === 'reviews' && verb === 'POST') {
    const input = body as CreateReviewInput;
    const booking = db.bookings.find((entry) => entry.id === input?.booking_id);
    if (!booking) throw new ApiError('NOT_FOUND', 'Booking not found', 404);
    if (booking.guest_id !== DEMO_USER_ID && booking.host_id !== DEMO_USER_ID) {
      throw new ApiError('FORBIDDEN', 'Only guests or hosts of this stay can leave a review', 403);
    }
    if (booking.booking_status !== 'completed') {
      throw new ApiError('INVALID_STATE_TRANSITION', 'Reviews can only be submitted for completed stays', 400);
    }
    if (!input.rating || input.rating < 1 || input.rating > 5) {
      throw new ApiError('VALIDATION_ERROR', 'Rating must be between 1 and 5', 400);
    }
    if (!input.comment || input.comment.length < 10) {
      throw new ApiError('VALIDATION_ERROR', 'Review comment must be at least 10 characters', 400);
    }
    const review = {
      id: uuid(),
      booking_id: input.booking_id,
      reviewer_id: DEMO_USER_ID,
      reviewed_user_id: booking.guest_id === DEMO_USER_ID ? booking.host_id : booking.guest_id,
      rating: input.rating,
      comment: input.comment,
      created_at: nowISO(),
    };
    db.reviews.push(review);
    saveDemoDB(db);
    return { data: review as unknown as T };
  }

  /* ------------------------------- reports ------------------------------- */
  if (pathname === 'reports' && verb === 'POST') {
    const input = body as CreateReportInput;
    if (!input?.description || input.description.length < 20) {
      throw new ApiError('VALIDATION_ERROR', 'Please provide details for the report (min 20 characters)', 400);
    }
    const report: Report = {
      id: uuid(),
      reporter_id: DEMO_USER_ID,
      target_type: input.target_type,
      target_id: input.target_id,
      category: input.category,
      description: input.description,
      evidence_urls: input.evidence_urls ?? [],
      status: 'open',
      resolution_notes: null,
      resolved_by: null,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    db.reports.unshift(report);
    saveDemoDB(db);
    return { data: report as unknown as T };
  }

  if (pathname === 'reports' && verb === 'GET') {
    return {
      data: db.reports.filter((report) => report.reporter_id === DEMO_USER_ID) as unknown as T,
    };
  }

  /* ----------------------------- messages ------------------------------ */
  if (pathname === 'conversations' && verb === 'GET') {
    const conversations = db.conversations.map((conversation) => ({
      ...conversation,
      last_message: db.messages
        .filter((message) => message.conversation_id === conversation.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0],
    }));
    return { data: conversations as T };
  }

  if (pathname === 'conversations' && verb === 'POST') {
    const input = (body ?? {}) as {
      recipient_id?: string;
      property_id?: string;
      booking_id?: string;
      swap_request_id?: string;
      context?: Conversation['context'];
      initial_message?: string;
    };
    if (!input.recipient_id) {
      throw new ApiError('VALIDATION_ERROR', 'A message recipient is required.', 400);
    }
    const initial = input.initial_message?.trim();
    if (initial && initial.length > 2000) {
      throw new ApiError('VALIDATION_ERROR', 'Messages must be 2,000 characters or fewer.', 400);
    }
    const existing = db.conversations.find(
      (conversation) =>
        conversation.property_id === (input.property_id ?? null) &&
        conversation.booking_id === (input.booking_id ?? null) &&
        conversation.swap_request_id === (input.swap_request_id ?? null) &&
        conversation.other_participant?.id === input.recipient_id,
    );
    const property = input.property_id ? db.properties.find((entry) => entry.id === input.property_id) : undefined;
    const conversation =
      existing ??
      ({
        id: uuid(),
        property_id: input.property_id ?? null,
        booking_id: input.booking_id ?? null,
        swap_request_id: input.swap_request_id ?? null,
        context: input.context ?? 'general',
        created_at: nowISO(),
        updated_at: nowISO(),
        other_participant: publicProfile(db, input.recipient_id),
        property: property
          ? { id: property.id, title: property.title, city: property.city }
          : undefined,
        unread_count: 0,
      } satisfies Conversation);
    if (!existing) db.conversations.unshift(conversation);
    if (initial) {
      db.messages.push({
        id: uuid(),
        conversation_id: conversation.id,
        sender_id: DEMO_USER_ID,
        body: initial,
        created_at: nowISO(),
        sender: publicProfile(db, DEMO_USER_ID),
      });
      conversation.updated_at = nowISO();
    }
    saveDemoDB(db);
    return { data: conversation as T };
  }

  const messagesMatch = pathname.match(/^conversations\/([^/]+)\/messages$/);
  if (messagesMatch && verb === 'GET') {
    const conversation = db.conversations.find((entry) => entry.id === messagesMatch[1]);
    if (!conversation) throw new ApiError('NOT_FOUND', 'Conversation not found.', 404);
    return {
      data: db.messages
        .filter((message) => message.conversation_id === conversation.id)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)) as T,
    };
  }

  if (messagesMatch && verb === 'POST') {
    const conversation = db.conversations.find((entry) => entry.id === messagesMatch[1]);
    if (!conversation) throw new ApiError('NOT_FOUND', 'Conversation not found.', 404);
    const messageBody = (body as { body?: string } | undefined)?.body?.trim() ?? '';
    if (!messageBody || messageBody.length > 2000) {
      throw new ApiError('VALIDATION_ERROR', 'Write a message between 1 and 2,000 characters.', 400);
    }
    const message: Message = {
      id: uuid(),
      conversation_id: conversation.id,
      sender_id: DEMO_USER_ID,
      body: messageBody,
      created_at: nowISO(),
      sender: publicProfile(db, DEMO_USER_ID),
    };
    db.messages.push(message);
    conversation.updated_at = message.created_at;
    saveDemoDB(db);
    return { data: message as T };
  }

  /* -------------------------------- admin -------------------------------- */
  if (pathname === 'admin/reports' && verb === 'GET') {
    if (db.profile.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Admin privilege required to view moderation reports', 403);
    }
    const status = query.get('status') ?? 'open';
    const page = Math.max(1, Number(query.get('page')) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.get('limit')) || 20));
    const filtered = db.reports
      .filter((report) => (status === 'all' ? true : report.status === status))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((report) => ({ ...report, reporter: publicProfile(db, report.reporter_id) }));
    return {
      data: filtered.slice((page - 1) * limit, (page - 1) * limit + limit) as unknown as T,
      meta: { total: filtered.length, page, limit },
    };
  }

  if (pathname === 'admin/verification' && verb === 'GET') {
    if (db.profile.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Admin privilege required', 403);
    }
    return {
      data: db.hosts
        .filter((host) => host.verification_status === 'pending')
        .map((host) => ({
          id: host.id,
          display_name: host.display_name,
          verification_status: host.verification_status,
        })) as unknown as T,
    };
  }

  const adminVerificationMatch = pathname.match(/^admin\/verification\/([^/]+)$/);
  if (adminVerificationMatch && verb === 'POST') {
    if (db.profile.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Admin privilege required', 403);
    }
    const targetId = adminVerificationMatch[1];
    const input = body as { decision: 'verified' | 'rejected'; notes?: string };
    if (input?.decision !== 'verified' && input?.decision !== 'rejected') {
      throw new ApiError('VALIDATION_ERROR', 'Decision must be verified or rejected', 400);
    }
    const host = db.hosts.find((entry) => entry.id === targetId);
    if (!host) throw new ApiError('NOT_FOUND', 'Target user profile not found', 404);
    host.verification_status = input.decision;
    if (targetId === DEMO_USER_ID) {
      db.profile.verification_status = input.decision;
    }
    saveDemoDB(db);
    return {
      data: {
        user_id: targetId,
        verification_status: input.decision,
        notes: input.notes ?? null,
      } as unknown as T,
    };
  }

  if (pathname === 'admin/property-verification' && verb === 'GET') {
    if (db.profile.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Admin privilege required', 403);
    }
    const status = query.get('status') ?? 'pending';
    const items = Object.values(db.propertyVerification)
      .filter((submission) => submission.status === status)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((submission) => {
        const property = db.properties.find((entry) => entry.id === submission.property_id);
        return {
          ...submission,
          property: property
            ? {
                id: property.id,
                title: property.title,
                city: property.city,
                neighbourhood: property.neighbourhood,
                owner_id: property.owner_id,
                listing_status: property.listing_status,
                verification_status: property.verification_status ?? 'unverified',
              }
            : null,
          owner: publicProfile(db, submission.owner_id),
        };
      });
    return { data: items as unknown as T };
  }

  const adminPropertyVerificationMatch = pathname.match(/^admin\/property-verification\/([^/]+)$/);
  if (adminPropertyVerificationMatch && verb === 'POST') {
    if (db.profile.role !== 'admin') {
      throw new ApiError('FORBIDDEN', 'Admin privilege required', 403);
    }
    const submission = Object.values(db.propertyVerification).find(
      (entry) => entry.id === adminPropertyVerificationMatch[1],
    );
    if (!submission) throw new ApiError('NOT_FOUND', 'Verification submission not found', 404);
    if (submission.status !== 'pending') {
      throw new ApiError('INVALID_STATE_TRANSITION', 'This submission has already been reviewed', 400);
    }
    const input = body as { decision: 'verified' | 'rejected'; notes?: string };
    if (input?.decision !== 'verified' && input?.decision !== 'rejected') {
      throw new ApiError('VALIDATION_ERROR', 'Decision must be verified or rejected', 400);
    }
    if (input.decision === 'rejected' && (input.notes?.trim().length ?? 0) < 10) {
      throw new ApiError('VALIDATION_ERROR', 'Add at least 10 characters of notes when rejecting', 400);
    }
    const property = db.properties.find((entry) => entry.id === submission.property_id);
    submission.status = input.decision;
    submission.notes = input.notes ?? null;
    submission.reviewed_by = DEMO_USER_ID;
    submission.reviewed_at = nowISO();
    submission.updated_at = nowISO();
    if (property) {
      property.verification_status = input.decision;
      property.verification_notes = input.notes ?? null;
      property.verified_at = input.decision === 'verified' ? nowISO() : null;
      if (input.decision === 'verified') property.listing_status = 'active';
    }
    saveDemoDB(db);
    return {
      data: {
        submission_id: submission.id,
        property_id: submission.property_id,
        verification_status: input.decision,
        notes: input.notes ?? null,
      } as unknown as T,
    };
  }

  throw new ApiError(
    'NOT_FOUND',
    `Demo mode has no handler for ${verb} /${pathname}. Configure the real backend to use this action.`,
    404,
  );
}
