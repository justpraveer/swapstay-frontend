import type {
  BookingRow,
  Conversation,
  CreditTransaction,
  Message,
  Profile,
  PropertyRow,
  PropertyVerificationSubmission,
  PropertyVideoRow,
  Report,
  ScoreBreakdown,
  SwapAgreement,
  SwapRequestRow,
  VerificationStatus,
} from '@/lib/types';
import { calculateSwapScore } from '@/lib/score';
import { addDaysISO, toISODate } from '@/lib/dates';

export const DEMO_DB_VERSION = 5;

export interface DemoHost {
  id: string;
  display_name: string;
  verification_status: VerificationStatus;
  bio?: string;
}

export interface DemoProperty extends PropertyRow {
  photos: string[];
  score: {
    breakdown: ScoreBreakdown;
    total_score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'E';
    evidence_status: string;
    assessed_at: string;
  };
}

export interface DemoReview {
  id: string;
  booking_id: string;
  reviewer_id: string;
  reviewed_user_id: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface DemoDB {
  version: number;
  profile: Profile;
  hosts: DemoHost[];
  properties: DemoProperty[];
  availability: Record<string, Record<string, 'available' | 'unavailable'>>;
  swaps: SwapRequestRow[];
  agreements: SwapAgreement[];
  bookings: BookingRow[];
  wallet: { available_balance: number; reserved_balance: number };
  transactions: CreditTransaction[];
  reports: Report[];
  reviews: DemoReview[];
  conversations: Conversation[];
  messages: Message[];
  propertyVerification: Record<string, PropertyVerificationSubmission>;
  propertyVideos: Record<string, PropertyVideoRow[]>;
}

export const DEMO_USER_ID = '11111111-1111-4111-8111-111111111111';
const PRIYA = '22222222-2222-4222-8222-222222222222';
const ROHAN = '33333333-3333-4333-8333-333333333333';
const MEERA = '44444444-4444-4444-8444-444444444444';
const KABIR = '55555555-5555-4555-8555-555555555555';
const ANANYA = '66666666-6666-4666-8666-666666666666';
const DEV = '77777777-7777-4777-8777-777777777777';
const SARA = '88888888-8888-4888-8888-888888888888';

const P_BANDRA = 'a1000000-0000-4000-8000-000000000001';
const P_KORAMANGALA = 'a1000000-0000-4000-8000-000000000002';
const P_HAUZ = 'a1000000-0000-4000-8000-000000000003';
const P_CYBER = 'a1000000-0000-4000-8000-000000000004';
const P_JUBILEE = 'a1000000-0000-4000-8000-000000000005';
const P_POWAI = 'a1000000-0000-4000-8000-000000000006';
const P_INDIRANAGAR = 'a1000000-0000-4000-8000-000000000007';
const P_NOIDA = 'a1000000-0000-4000-8000-000000000008';

const photo = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1400&q=80`;

const now = () => new Date().toISOString();
const day = (offset: number) => addDaysISO(toISODate(new Date()), offset);
const stamp = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString();

function scored(
  breakdown: ScoreBreakdown,
  assessedDaysAgo = 12,
): DemoProperty['score'] {
  const { total, grade } = calculateSwapScore(breakdown);
  return {
    breakdown,
    total_score: total,
    grade,
    evidence_status: 'verified',
    assessed_at: stamp(assessedDaysAgo),
  };
}

function property(
  input: Omit<DemoProperty, 'created_at' | 'updated_at' | 'score'> & {
    score: DemoProperty['score'];
    createdDaysAgo?: number;
  },
): DemoProperty {
  return {
    verification_status: 'verified',
    ...input,
    created_at: stamp(input.createdDaysAgo ?? 90),
    updated_at: stamp(3),
  };
}

export function buildSeed(): DemoDB {
  const properties: DemoProperty[] = [
    property({
      id: P_BANDRA,
      owner_id: DEMO_USER_ID,
      title: 'Bandra balcony with a sea-facing study',
      description:
        'A calm two-bedroom apartment tucked behind the Bandra cafe strip, with a deep balcony that catches the evening sea breeze. The second bedroom doubles as a study with a proper desk, fast fibre and blackout curtains.\n\nThe building has a lift, covered parking and a resident caretaker. Carter Road promenade is a seven-minute walk, and Bandra station is a short rickshaw ride away. We leave a local guide with our favourite bakeries, bookshops and coastal walks.',
      city: 'Mumbai',
      state: 'Maharashtra',
      neighbourhood: 'Bandra West',
      property_type: 'apartment',
      bedrooms: 2,
      guest_capacity: 4,
      amenities: [
        'Wi-Fi',
        'Air conditioning',
        'Kitchen',
        'Washing machine',
        'Dedicated workspace',
        'Free parking',
        'Balcony',
        'Lift',
        'Power backup',
        'Hot water',
      ],
      house_rules: ['No smoking indoors', 'No parties or events', 'Quiet hours after 10 pm', 'Remove shoes at the door'],
      listing_status: 'active',
      exact_address: '14 Carter Road, Bandra West, Mumbai 400050',
      photos: [photo('1502672260266-1c1ef2d93688'), photo('1522708323590-d24dbb6b0267'), photo('1493809842364-78817add7ffb')],
      score: scored({ condition: 92, location: 94, amenities: 88, space: 86, listing_quality: 92 }),
      createdDaysAgo: 210,
    }),
    property({
      id: P_KORAMANGALA,
      owner_id: PRIYA,
      title: 'Koramangala loft above the cafe strip',
      description:
        'A light-filled one-bedroom loft on the third floor of a quiet lane, five minutes from the Koramangala social scene. Exposed brick, a compact reading nook, and a kitchen stocked with filter coffee.\n\nIdeal for a solo traveller or a couple. The host works nearby and can hand over keys in person, with a detailed neighbourhood map of breakfast spots and co-working cafes.',
      city: 'Bengaluru',
      state: 'Karnataka',
      neighbourhood: 'Koramangala',
      property_type: 'apartment',
      bedrooms: 1,
      guest_capacity: 2,
      amenities: ['Wi-Fi', 'Kitchen', 'Washing machine', 'Dedicated workspace', 'Balcony', 'Hot water', 'Power backup'],
      house_rules: ['No smoking indoors', 'No unregistered guests', 'Quiet hours after 10 pm'],
      listing_status: 'active',
      exact_address: '5th Block, Koramangala, Bengaluru 560095',
      photos: [photo('1560448204-e02f11c3d0e2'), photo('1484154218962-a197022b5858')],
      score: scored({ condition: 82, location: 88, amenities: 80, space: 72, listing_quality: 86 }),
      createdDaysAgo: 160,
    }),
    property({
      id: P_HAUZ,
      owner_id: ROHAN,
      title: 'Hauz Khas terrace with tomb views',
      description:
        'A three-bedroom top-floor home with a wraparound terrace looking over the Hauz Khas monument and deer park. The living room opens fully onto the terrace, which is perfect for winter breakfasts.\n\nTwo bathrooms, a large kitchen, and a quiet study. Deer Park is at the gate; the village cafes and metro are a ten-minute walk. Best suited to families or a small group of friends.',
      city: 'Delhi',
      state: 'Delhi',
      neighbourhood: 'Hauz Khas',
      property_type: 'penthouse',
      bedrooms: 3,
      guest_capacity: 6,
      amenities: [
        'Wi-Fi',
        'Air conditioning',
        'Kitchen',
        'Washing machine',
        'Dedicated workspace',
        'Free parking',
        'Balcony',
        'Lift',
        'Power backup',
        'Hot water',
      ],
      house_rules: ['No smoking indoors', 'No parties or events', 'No unregistered guests', 'Lock the main door when leaving'],
      listing_status: 'active',
      exact_address: 'Hauz Khas Enclave, New Delhi 110016',
      photos: [photo('1600585154340-be6161a56a0c'), photo('1600607687939-ce8a6c25118c'), photo('1600566753086-00f18fb6b3ea')],
      score: scored({ condition: 86, location: 90, amenities: 84, space: 90, listing_quality: 88 }),
      createdDaysAgo: 140,
    }),
    property({
      id: P_CYBER,
      owner_id: MEERA,
      title: 'Cyber City skyline apartment',
      description:
        'A compact, spotless two-bedroom with floor-to-ceiling windows facing the Gurugram skyline. Walk to Cyber Hub in twelve minutes; the metro is closer still.\n\nThe apartment has a shared gym and rooftop deck, plus a dedicated parking bay. A practical base for work trips, with a proper desk and reliable power backup.',
      city: 'Gurugram',
      state: 'Haryana',
      neighbourhood: 'Cyber City',
      property_type: 'apartment',
      bedrooms: 2,
      guest_capacity: 4,
      amenities: ['Wi-Fi', 'Air conditioning', 'Kitchen', 'Washing machine', 'Dedicated workspace', 'Free parking', 'Lift', 'Gym', 'Power backup', 'Hot water'],
      house_rules: ['No smoking indoors', 'No parties or events', 'Quiet hours after 10 pm'],
      listing_status: 'active',
      exact_address: 'DLF Phase 2, Gurugram, Haryana 122002',
      photos: [photo('1616486338812-3dadae4b4ace'), photo('1505691938895-1758d7feb511')],
      score: scored({ condition: 78, location: 82, amenities: 86, space: 74, listing_quality: 78 }),
      createdDaysAgo: 75,
    }),
    property({
      id: P_JUBILEE,
      owner_id: KABIR,
      title: 'Jubilee Hills courtyard villa',
      description:
        'A four-bedroom villa built around a shaded central courtyard, with a small plunge pool and a mango tree that the whole street is jealous of. Interiors are cool and quiet, with terrazzo floors and generous seating.\n\nThe house suits two families travelling together. Breakfast can be arranged with the caretaker, and the host shares a list of biryani spots worth the detour.',
      city: 'Hyderabad',
      state: 'Telangana',
      neighbourhood: 'Jubilee Hills',
      property_type: 'villa',
      bedrooms: 4,
      guest_capacity: 8,
      amenities: [
        'Wi-Fi',
        'Air conditioning',
        'Kitchen',
        'Washing machine',
        'Free parking',
        'Balcony',
        'Swimming pool',
        'Power backup',
        'Hot water',
        'Pet friendly',
      ],
      house_rules: ['No smoking indoors', 'No parties or events', 'Pets allowed with notice', 'No unregistered guests'],
      listing_status: 'active',
      exact_address: 'Road No. 45, Jubilee Hills, Hyderabad 500033',
      photos: [photo('1586023492125-27b2c045efd7'), photo('1598928506311-c55ded91a20c'), photo('1567767292278-a4f21aa2d36e')],
      score: scored({ condition: 93, location: 88, amenities: 94, space: 92, listing_quality: 90 }),
      createdDaysAgo: 120,
    }),
    property({
      id: P_POWAI,
      owner_id: ANANYA,
      title: 'Powai lake-view studio',
      description:
        'A neat studio overlooking Powai lake, with a Murphy bed, a two-seater dining nook and a balcony just big enough for morning chai. The IIT campus and Hiranandani gardens are nearby.\n\nSimple, secure and well connected. Great for a short solo stay or a couple visiting family in the area.',
      city: 'Mumbai',
      state: 'Maharashtra',
      neighbourhood: 'Powai',
      property_type: 'studio',
      bedrooms: 1,
      guest_capacity: 2,
      amenities: ['Wi-Fi', 'Air conditioning', 'Kitchen', 'Lift', 'Balcony', 'Hot water', 'Power backup'],
      house_rules: ['No smoking indoors', 'No unregistered guests', 'Quiet hours after 10 pm'],
      listing_status: 'active',
      exact_address: 'Hiranandani Gardens, Powai, Mumbai 400076',
      photos: [photo('1554995207-c18c203602cb'), photo('1536376072261-38c75010e6c9')],
      score: scored({ condition: 74, location: 80, amenities: 68, space: 62, listing_quality: 76 }),
      createdDaysAgo: 55,
    }),
    property({
      id: P_INDIRANAGAR,
      owner_id: DEV,
      title: 'Indiranagar garden cottage',
      description:
        'A three-bedroom independent house set back from the road behind a jacaranda tree. High ceilings, a real dining table, and a small garden with a swing that children gravitate to.\n\nTwo bathrooms, a full kitchen, and a washing machine. 100 Feet Road is a five-minute walk, with bakeries, bookshops and the metro within easy reach.',
      city: 'Bengaluru',
      state: 'Karnataka',
      neighbourhood: 'Indiranagar',
      property_type: 'independent_house',
      bedrooms: 3,
      guest_capacity: 5,
      amenities: ['Wi-Fi', 'Kitchen', 'Washing machine', 'Dedicated workspace', 'Free parking', 'Balcony', 'Hot water', 'Pet friendly'],
      house_rules: ['No smoking indoors', 'No parties or events', 'Pets allowed with notice', 'Remove shoes at the door'],
      listing_status: 'active',
      exact_address: '12th Main, Indiranagar, Bengaluru 560038',
      photos: [photo('1560185007-cde436f6a4d0'), photo('1502672260266-1c1ef2d93688')],
      score: scored({ condition: 88, location: 86, amenities: 82, space: 88, listing_quality: 84 }),
      createdDaysAgo: 95,
    }),
    property({
      id: P_NOIDA,
      owner_id: SARA,
      title: 'Sector 150 quiet corner home',
      description:
        'A two-bedroom apartment in a low-rise block beside the Sector 150 green belt. Wide balconies, a cross-ventilated living room and a park at the doorstep.\n\nThe expressway is minutes away, making this a restful alternative to central Noida. Ideal for a small family or a longer work stay.',
      city: 'Noida',
      state: 'Uttar Pradesh',
      neighbourhood: 'Sector 150',
      property_type: 'apartment',
      bedrooms: 2,
      guest_capacity: 4,
      amenities: ['Wi-Fi', 'Air conditioning', 'Kitchen', 'Washing machine', 'Free parking', 'Balcony', 'Lift', 'Hot water'],
      house_rules: ['No smoking indoors', 'No parties or events', 'No unregistered guests'],
      listing_status: 'active',
      exact_address: 'Sector 150, Noida, Uttar Pradesh 201310',
      photos: [photo('1600607687939-ce8a6c25118c'), photo('1560448204-e02f11c3d0e2')],
      score: scored({ condition: 72, location: 74, amenities: 70, space: 80, listing_quality: 72 }),
      createdDaysAgo: 40,
    }),
  ];

  const availability: DemoDB['availability'] = { [P_BANDRA]: {} };
  for (let offset = -10; offset <= 120; offset += 1) {
    const date = day(offset);
    availability[P_BANDRA][date] = 'available';
  }
  [4, 5, 6, 19, 20, 34, 35, 36, 58, 59].forEach((offset) => {
    availability[P_BANDRA][day(offset)] = 'unavailable';
  });

  const bookings: BookingRow[] = [
    {
      id: 'b1000000-0000-4000-8000-000000000001',
      property_id: P_KORAMANGALA,
      guest_id: DEMO_USER_ID,
      host_id: PRIYA,
      check_in: day(20),
      check_out: day(23),
      booking_status: 'requested',
      booking_type: 'credit_stay',
      credit_price: 3,
      swap_request_id: null,
      created_at: stamp(1),
      updated_at: stamp(1),
    },
    {
      id: 'b1000000-0000-4000-8000-000000000002',
      property_id: P_BANDRA,
      guest_id: KABIR,
      host_id: DEMO_USER_ID,
      check_in: day(35),
      check_out: day(37),
      booking_status: 'confirmed',
      booking_type: 'credit_stay',
      credit_price: 2,
      swap_request_id: null,
      created_at: stamp(9),
      updated_at: stamp(8),
    },
    {
      id: 'b1000000-0000-4000-8000-000000000003',
      property_id: P_JUBILEE,
      guest_id: DEMO_USER_ID,
      host_id: KABIR,
      check_in: day(-40),
      check_out: day(-37),
      booking_status: 'completed',
      booking_type: 'credit_stay',
      credit_price: 3,
      swap_request_id: null,
      created_at: stamp(55),
      updated_at: stamp(36),
    },
    {
      id: 'b1000000-0000-4000-8000-000000000004',
      property_id: P_BANDRA,
      guest_id: ANANYA,
      host_id: DEMO_USER_ID,
      check_in: day(10),
      check_out: day(12),
      booking_status: 'confirmed',
      booking_type: 'credit_stay',
      credit_price: 2,
      swap_request_id: null,
      created_at: stamp(14),
      updated_at: stamp(13),
    },
  ];

  const requesterCheckIn = day(48);
  const requesterCheckOut = day(51);
  const recipientCheckIn = day(62);
  const recipientCheckOut = day(65);

  const swaps: SwapRequestRow[] = [
    {
      id: 'c1000000-0000-4000-8000-000000000001',
      requester_id: PRIYA,
      recipient_id: DEMO_USER_ID,
      requester_property_id: P_KORAMANGALA,
      recipient_property_id: P_BANDRA,
      requester_check_in: requesterCheckIn,
      requester_check_out: requesterCheckOut,
      recipient_check_in: recipientCheckIn,
      recipient_check_out: recipientCheckOut,
      request_status: 'pending',
      requester_accepted_at: stamp(2),
      recipient_accepted_at: null,
      created_at: stamp(2),
      updated_at: stamp(2),
    },
    {
      id: 'c1000000-0000-4000-8000-000000000002',
      requester_id: DEMO_USER_ID,
      recipient_id: KABIR,
      requester_property_id: P_BANDRA,
      recipient_property_id: P_JUBILEE,
      requester_check_in: day(72),
      requester_check_out: day(75),
      recipient_check_in: day(84),
      recipient_check_out: day(87),
      request_status: 'confirmed',
      requester_accepted_at: stamp(20),
      recipient_accepted_at: stamp(19),
      created_at: stamp(21),
      updated_at: stamp(19),
    },
  ];

  const agreements: SwapAgreement[] = [
    {
      id: 'd1000000-0000-4000-8000-000000000001',
      swap_request_id: swaps[1].id,
      agreement_version: '1.0',
      terms_snapshot: {
        swap_request_id: swaps[1].id,
        requester_id: DEMO_USER_ID,
        recipient_id: KABIR,
        requester_stay: { property_id: P_JUBILEE, check_in: day(72), check_out: day(75) },
        recipient_stay: { property_id: P_BANDRA, check_in: day(84), check_out: day(87) },
        version: '1.0',
        confirmed_at: stamp(19),
      },
      requester_accepted_at: stamp(20),
      recipient_accepted_at: stamp(19),
      confirmed_at: stamp(19),
      created_at: stamp(19),
    },
  ];

  const transactions: CreditTransaction[] = [
    {
      id: 'e1000000-0000-4000-8000-000000000001',
      user_id: DEMO_USER_ID,
      booking_id: null,
      transaction_type: 'initial_grant',
      amount: 5,
      status: 'posted',
      idempotency_key: null,
      description: 'Pilot starter credit allocation',
      created_at: stamp(120),
    },
    {
      id: 'e1000000-0000-4000-8000-000000000002',
      user_id: DEMO_USER_ID,
      booking_id: bookings[2].id,
      transaction_type: 'reservation_hold',
      amount: -3,
      status: 'posted',
      idempotency_key: null,
      description: 'Hold 3 credits for stay at Jubilee Hills courtyard villa (3 nights)',
      created_at: stamp(55),
    },
    {
      id: 'e1000000-0000-4000-8000-000000000003',
      user_id: DEMO_USER_ID,
      booking_id: bookings[2].id,
      transaction_type: 'stay_debit',
      amount: -3,
      status: 'posted',
      idempotency_key: null,
      description: 'Settle 3 credits for completed stay at Jubilee Hills courtyard villa',
      created_at: stamp(36),
    },
    {
      id: 'e1000000-0000-4000-8000-000000000004',
      user_id: DEMO_USER_ID,
      booking_id: bookings[1].id,
      transaction_type: 'host_reward',
      amount: 2,
      status: 'posted',
      idempotency_key: null,
      description: 'Host reward for completed stay at Bandra balcony with a sea-facing study',
      created_at: stamp(21),
    },
    {
      id: 'e1000000-0000-4000-8000-000000000005',
      user_id: DEMO_USER_ID,
      booking_id: bookings[0].id,
      transaction_type: 'reservation_hold',
      amount: -3,
      status: 'posted',
      idempotency_key: null,
      description: 'Hold 3 credits for stay at Koramangala loft above the cafe strip (3 nights)',
      created_at: stamp(1),
    },
  ];

  const reports: Report[] = [
    {
      id: 'f1000000-0000-4000-8000-000000000001',
      reporter_id: ANANYA,
      target_type: 'property',
      target_id: P_CYBER,
      category: 'misrepresentation',
      description:
        'The listing photos appear to show a different unit than the one described. Please verify the gallery before this stays live.',
      evidence_urls: [],
      status: 'open',
      resolution_notes: null,
      resolved_by: null,
      created_at: stamp(3),
      updated_at: stamp(3),
    },
    {
      id: 'f1000000-0000-4000-8000-000000000002',
      reporter_id: PRIYA,
      target_type: 'booking',
      target_id: bookings[0].id,
      category: 'safety',
      description:
        'The building gate was left unlocked during my stay and the caretaker was unreachable for two hours. Sharing so the host can fix it.',
      evidence_urls: [],
      status: 'under_review',
      resolution_notes: null,
      resolved_by: null,
      created_at: stamp(6),
      updated_at: stamp(5),
    },
  ];

  const conversations: Conversation[] = [
    {
      id: 'c1000000-0000-4000-8000-000000000001',
      property_id: P_KORAMANGALA,
      booking_id: bookings[0].id,
      swap_request_id: null,
      context: 'booking',
      created_at: stamp(2),
      updated_at: stamp(1),
      other_participant: { id: PRIYA, display_name: 'Priya Nair', verification_status: 'verified' },
      property: { id: P_KORAMANGALA, title: 'Koramangala loft above the cafe strip', city: 'Bengaluru' },
      unread_count: 1,
    },
  ];
  const messages: Message[] = [
    {
      id: 'm1000000-0000-4000-8000-000000000001',
      conversation_id: conversations[0].id,
      sender_id: PRIYA,
      body: 'Hi Aarav, the loft has a quiet workspace and the caretaker can help with check-in. Let me know if you have any questions.',
      created_at: stamp(1),
      sender: { id: PRIYA, display_name: 'Priya Nair', verification_status: 'verified' },
    },
  ];

  return {
    version: DEMO_DB_VERSION,
    profile: {
      id: DEMO_USER_ID,
      display_name: 'Aarav Sharma',
      bio: 'Product designer who splits the year between Mumbai and Bengaluru. I travel light, water the plants and always leave a list of the best local bakeries.',
      phone: '+919820011223',
      verification_status: 'verified',
      role: 'admin',
      created_at: stamp(220),
      updated_at: stamp(4),
    },
    hosts: [
      { id: DEMO_USER_ID, display_name: 'Aarav Sharma', verification_status: 'verified' },
      { id: PRIYA, display_name: 'Priya Nair', verification_status: 'verified', bio: 'Architect and avid reader based in Koramangala.' },
      { id: ROHAN, display_name: 'Rohan Mehta', verification_status: 'verified', bio: 'Consultant living in Cyber City, Gurugram.' },
      { id: MEERA, display_name: 'Meera Iyer', verification_status: 'pending' },
      { id: KABIR, display_name: 'Kabir Rao', verification_status: 'verified', bio: 'Restaurateur in Jubilee Hills.' },
      { id: ANANYA, display_name: 'Ananya Deshmukh', verification_status: 'unverified' },
      { id: DEV, display_name: 'Dev Malhotra', verification_status: 'verified' },
      { id: SARA, display_name: 'Sara Qureshi', verification_status: 'pending' },
    ],
    properties,
    availability,
    swaps,
    agreements,
    bookings,
    wallet: { available_balance: 6, reserved_balance: 2 },
    transactions,
    reports,
    reviews: [
      {
        id: 'aa000000-0000-4000-8000-000000000001',
        booking_id: bookings[2].id,
        reviewer_id: DEMO_USER_ID,
        reviewed_user_id: KABIR,
        rating: 5,
        comment: 'The courtyard is even better than the photos. Kabir was quick to respond and the caretaker was lovely.',
        created_at: stamp(35),
      },
    ],
    conversations,
    messages,
    propertyVerification: {},
    propertyVideos: {},
  };
}
