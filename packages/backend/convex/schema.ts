// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    externalId: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    rating: v.optional(v.number()),
    totalRentals: v.optional(v.number()),
    memberSince: v.optional(v.string()),
    profileImage: v.optional(v.string()),
    userType: v.optional(
      v.union(v.literal('driver'), v.literal('team'), v.literal('both'))
    ),
  }).index('by_external_id', ['externalId']),

  tracks: defineTable({
    name: v.string(),
    location: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isActive: v.boolean(),
  }).index('by_active', ['isActive']),

  vehicles: defineTable({
    ownerId: v.string(),
    trackId: v.id('tracks'),
    make: v.string(),
    model: v.string(),
    year: v.number(),
    dailyRate: v.number(),
    description: v.string(),
    horsepower: v.optional(v.number()),
    transmission: v.optional(v.string()),
    drivetrain: v.optional(v.string()),
    engineType: v.optional(v.string()),
    mileage: v.optional(v.number()),
    amenities: v.array(v.string()),
    // Vehicle add-ons with pricing
    addOns: v.array(
      v.object({
        name: v.string(),
        price: v.number(),
        description: v.optional(v.string()),
        isRequired: v.optional(v.boolean()),
      })
    ),
    isActive: v.boolean(),
    isApproved: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner', ['ownerId'])
    .index('by_track', ['trackId'])
    .index('by_active', ['isActive'])
    .index('by_owner_active', ['ownerId', 'isActive'])
    .index('by_approved', ['isApproved'])
    .index('by_active_approved', ['isActive', 'isApproved']),

  vehicleImages: defineTable({
    vehicleId: v.id('vehicles'),
    storageId: v.optional(v.id('_storage')), // Primary image storage ID (optional for legacy support)
    thumbnailStorageId: v.optional(v.id('_storage')),
    cardStorageId: v.optional(v.id('_storage')),
    detailStorageId: v.optional(v.id('_storage')),
    heroStorageId: v.optional(v.id('_storage')),
    imageUrl: v.string(), // Legacy field for backward compatibility
    isPrimary: v.boolean(),
    order: v.number(),
    metadata: v.optional(
      v.object({
        fileName: v.string(),
        originalSize: v.number(),
        processedSizes: v.object({
          thumbnail: v.number(),
          card: v.number(),
          detail: v.number(),
          hero: v.number(),
        }),
      })
    ),
  })
    .index('by_vehicle', ['vehicleId'])
    .index('by_vehicle_primary', ['vehicleId', 'isPrimary']),

  availability: defineTable({
    vehicleId: v.id('vehicles'),
    date: v.string(), // YYYY-MM-DD format
    isAvailable: v.boolean(),
    reason: v.optional(v.string()), // For blocked dates
    price: v.optional(v.number()), // Override daily rate for specific dates
    createdAt: v.number(),
  })
    .index('by_vehicle_date', ['vehicleId', 'date'])
    .index('by_vehicle_available', ['vehicleId', 'isAvailable'])
    .index('by_date_available', ['date', 'isAvailable']),

  reservations: defineTable({
    vehicleId: v.id('vehicles'),
    renterId: v.string(),
    ownerId: v.string(),
    startDate: v.string(), // YYYY-MM-DD format
    endDate: v.string(), // YYYY-MM-DD format
    pickupTime: v.optional(v.string()), // HH:MM format (24-hour)
    dropoffTime: v.optional(v.string()), // HH:MM format (24-hour)
    totalDays: v.number(),
    dailyRate: v.number(),
    totalAmount: v.number(),
    status: v.union(
      v.literal('pending'),
      v.literal('confirmed'),
      v.literal('cancelled'),
      v.literal('completed'),
      v.literal('declined')
    ),
    renterMessage: v.optional(v.string()),
    ownerMessage: v.optional(v.string()),
    cancellationReason: v.optional(v.string()),
    // Payment-related fields
    paymentId: v.optional(v.id('payments')),
    paymentStatus: v.optional(
      v.union(
        v.literal('pending'),
        v.literal('paid'),
        v.literal('failed'),
        v.literal('refunded')
      )
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_vehicle', ['vehicleId'])
    .index('by_renter', ['renterId'])
    .index('by_owner', ['ownerId'])
    .index('by_status', ['status'])
    .index('by_renter_status', ['renterId', 'status'])
    .index('by_owner_status', ['ownerId', 'status'])
    .index('by_dates', ['startDate', 'endDate']),

  favorites: defineTable({
    userId: v.string(),
    vehicleId: v.id('vehicles'),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_vehicle', ['vehicleId'])
    .index('by_user_vehicle', ['userId', 'vehicleId']),

  // New tables for messaging system
  conversations: defineTable({
    vehicleId: v.id('vehicles'),
    renterId: v.string(),
    ownerId: v.string(),
    lastMessageAt: v.number(),
    lastMessageText: v.optional(v.string()),
    lastMessageSenderId: v.optional(v.string()),
    unreadCountRenter: v.number(),
    unreadCountOwner: v.number(),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_vehicle', ['vehicleId'])
    .index('by_renter', ['renterId'])
    .index('by_owner', ['ownerId'])
    .index('by_renter_active', ['renterId', 'isActive'])
    .index('by_owner_active', ['ownerId', 'isActive'])
    .index('by_participants', ['renterId', 'ownerId'])
    .index('by_last_message', ['lastMessageAt']),

  messages: defineTable({
    conversationId: v.id('conversations'),
    senderId: v.string(),
    content: v.string(),
    messageType: v.union(
      v.literal('text'),
      v.literal('image'),
      v.literal('system')
    ),
    isRead: v.boolean(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_conversation', ['conversationId'])
    .index('by_sender', ['senderId'])
    .index('by_conversation_created', ['conversationId', 'createdAt'])
    .index('by_unread', ['conversationId', 'isRead']),

  // New tables for driver-team matching system
  teams: defineTable({
    ownerId: v.string(),
    name: v.string(),
    description: v.string(),
    logoUrl: v.optional(v.string()),
    location: v.string(),
    specialties: v.array(v.string()), // e.g., ['GT3', 'Formula', 'Endurance']
    availableSeats: v.number(),
    requirements: v.array(v.string()), // e.g., ['License Required', 'Experience Level']
    contactInfo: v.object({
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
      website: v.optional(v.string()),
    }),
    socialLinks: v.optional(
      v.object({
        instagram: v.optional(v.string()),
        twitter: v.optional(v.string()),
        facebook: v.optional(v.string()),
        linkedin: v.optional(v.string()),
      })
    ),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_owner', ['ownerId'])
    .index('by_active', ['isActive'])
    .index('by_location', ['location']),

  driverProfiles: defineTable({
    userId: v.string(),
    bio: v.string(),
    achievements: v.optional(v.string()),
    experience: v.union(
      v.literal('beginner'),
      v.literal('intermediate'),
      v.literal('advanced'),
      v.literal('professional')
    ),
    licenses: v.array(v.string()), // e.g., ['FIA', 'NASA', 'SCCA']
    preferredCategories: v.array(v.string()), // e.g., ['GT3', 'Formula', 'Endurance']
    availability: v.array(v.string()), // e.g., ['weekends', 'weekdays', 'evenings']
    location: v.string(),
    contactInfo: v.object({
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
    socialLinks: v.optional(
      v.object({
        instagram: v.optional(v.string()),
        twitter: v.optional(v.string()),
        linkedin: v.optional(v.string()),
        website: v.optional(v.string()),
      })
    ),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_active', ['isActive'])
    .index('by_location', ['location'])
    .index('by_experience', ['experience']),

  teamApplications: defineTable({
    teamId: v.id('teams'),
    driverId: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('accepted'),
      v.literal('declined'),
      v.literal('withdrawn')
    ),
    message: v.string(),
    driverExperience: v.string(),
    preferredDates: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_team', ['teamId'])
    .index('by_driver', ['driverId'])
    .index('by_status', ['status'])
    .index('by_team_status', ['teamId', 'status']),

  // New tables for rental completion system
  rentalCompletions: defineTable({
    reservationId: v.id('reservations'),
    vehicleId: v.id('vehicles'),
    renterId: v.string(),
    ownerId: v.string(),
    status: v.union(
      v.literal('pending_renter'),
      v.literal('pending_owner'),
      v.literal('completed'),
      v.literal('disputed')
    ),
    // Renter's return form
    renterReturnForm: v.optional(
      v.object({
        returnDate: v.string(),
        vehicleCondition: v.union(
          v.literal('excellent'),
          v.literal('good'),
          v.literal('fair'),
          v.literal('poor'),
          v.literal('damaged')
        ),
        fuelLevel: v.union(
          v.literal('full'),
          v.literal('3/4'),
          v.literal('1/2'),
          v.literal('1/4'),
          v.literal('empty')
        ),
        mileage: v.number(),
        notes: v.optional(v.string()),
        photos: v.array(v.string()), // URLs to return photos
        submittedAt: v.number(),
      })
    ),
    // Owner's review of return
    ownerReturnReview: v.optional(
      v.object({
        vehicleReceived: v.boolean(),
        conditionMatches: v.boolean(),
        fuelLevelMatches: v.boolean(),
        mileageMatches: v.boolean(),
        damageReported: v.optional(v.string()),
        photos: v.array(v.string()), // URLs to owner photos
        notes: v.optional(v.string()),
        submittedAt: v.number(),
      })
    ),
    // Final completion details
    completionNotes: v.optional(v.string()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_reservation', ['reservationId'])
    .index('by_vehicle', ['vehicleId'])
    .index('by_renter', ['renterId'])
    .index('by_owner', ['ownerId'])
    .index('by_status', ['status']),

  vehicleVitals: defineTable({
    rentalCompletionId: v.id('rentalCompletions'),
    vehicleId: v.id('vehicles'),
    // Engine vitals
    engineTemp: v.optional(v.number()),
    oilPressure: v.optional(v.number()),
    oilLevel: v.optional(
      v.union(
        v.literal('full'),
        v.literal('3/4'),
        v.literal('1/2'),
        v.literal('1/4'),
        v.literal('low')
      )
    ),
    coolantLevel: v.optional(
      v.union(
        v.literal('full'),
        v.literal('3/4'),
        v.literal('1/2'),
        v.literal('1/4'),
        v.literal('low')
      )
    ),
    // Tire vitals
    tirePressure: v.optional(
      v.object({
        frontLeft: v.optional(v.number()),
        frontRight: v.optional(v.number()),
        rearLeft: v.optional(v.number()),
        rearRight: v.optional(v.number()),
      })
    ),
    tireCondition: v.optional(
      v.union(
        v.literal('excellent'),
        v.literal('good'),
        v.literal('fair'),
        v.literal('poor'),
        v.literal('needs_replacement')
      )
    ),
    // Brake vitals
    brakePadCondition: v.optional(
      v.union(
        v.literal('excellent'),
        v.literal('good'),
        v.literal('fair'),
        v.literal('poor'),
        v.literal('needs_replacement')
      )
    ),
    brakeFluidLevel: v.optional(
      v.union(
        v.literal('full'),
        v.literal('3/4'),
        v.literal('1/2'),
        v.literal('1/4'),
        v.literal('low')
      )
    ),
    // General condition
    bodyCondition: v.optional(
      v.union(
        v.literal('excellent'),
        v.literal('good'),
        v.literal('fair'),
        v.literal('poor'),
        v.literal('damaged')
      )
    ),
    interiorCondition: v.optional(
      v.union(
        v.literal('excellent'),
        v.literal('good'),
        v.literal('fair'),
        v.literal('poor'),
        v.literal('damaged')
      )
    ),
    notes: v.optional(v.string()),
    submittedBy: v.string(), // renterId or ownerId
    submittedAt: v.number(),
  })
    .index('by_rental_completion', ['rentalCompletionId'])
    .index('by_vehicle', ['vehicleId'])
    .index('by_submitter', ['submittedBy']),

  rentalReviews: defineTable({
    rentalCompletionId: v.id('rentalCompletions'),
    reservationId: v.id('reservations'),
    vehicleId: v.id('vehicles'),
    reviewerId: v.string(), // renterId or ownerId
    reviewedId: v.string(), // the other party's ID
    reviewType: v.union(
      v.literal('renter_to_owner'),
      v.literal('owner_to_renter')
    ),
    // Rating (1-5 stars)
    rating: v.number(),
    // Review categories
    communication: v.optional(v.number()), // 1-5
    vehicleCondition: v.optional(v.number()), // 1-5
    professionalism: v.optional(v.number()), // 1-5
    overallExperience: v.optional(v.number()), // 1-5
    // Review text
    title: v.string(),
    review: v.string(),
    // Photos (optional)
    photos: v.optional(v.array(v.string())),
    // Response from reviewed party
    response: v.optional(
      v.object({
        text: v.string(),
        respondedAt: v.number(),
      })
    ),
    // Moderation
    isPublic: v.boolean(),
    isModerated: v.boolean(),
    moderatedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_rental_completion', ['rentalCompletionId'])
    .index('by_reservation', ['reservationId'])
    .index('by_reviewer', ['reviewerId'])
    .index('by_reviewed', ['reviewedId'])
    .index('by_rating', ['rating'])
    .index('by_public', ['isPublic'])
    .index('by_vehicle', ['vehicleId']),

  // Payment system tables
  payments: defineTable({
    reservationId: v.id('reservations'),
    renterId: v.string(),
    ownerId: v.string(),
    amount: v.number(), // Total amount in cents
    platformFee: v.number(), // Platform fee in cents
    ownerAmount: v.number(), // Amount owner receives in cents
    currency: v.string(), // 'usd'
    status: v.union(
      v.literal('pending'),
      v.literal('processing'),
      v.literal('succeeded'),
      v.literal('failed'),
      v.literal('cancelled'),
      v.literal('refunded'),
      v.literal('partially_refunded')
    ),
    stripePaymentIntentId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
    stripeTransferId: v.optional(v.string()), // For Connect transfers
    refundAmount: v.optional(v.number()),
    refundReason: v.optional(v.string()),
    failureReason: v.optional(v.string()),
    metadata: v.optional(
      v.object({
        vehicleId: v.string(),
        startDate: v.string(),
        endDate: v.string(),
        totalDays: v.number(),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_reservation', ['reservationId'])
    .index('by_renter', ['renterId'])
    .index('by_owner', ['ownerId'])
    .index('by_status', ['status'])
    .index('by_stripe_payment_intent', ['stripePaymentIntentId']),

  // Platform settings for fees and configuration
  platformSettings: defineTable({
    platformFeePercentage: v.number(), // e.g., 5 for 5%
    minimumPlatformFee: v.number(), // Minimum fee in cents
    maximumPlatformFee: v.optional(v.number()), // Maximum fee in cents
    stripeAccountId: v.optional(v.string()), // Main platform account
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_active', ['isActive']),
});
