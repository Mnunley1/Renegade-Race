import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

// Get all active and approved vehicles with optimized images
export const getAllWithOptimizedImages = query({
  args: {
    trackId: v.optional(v.id('tracks')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { trackId, limit = 50 } = args;

    let vehicles;
    if (trackId) {
      vehicles = await ctx.db
        .query('vehicles')
        .withIndex('by_track', q => q.eq('trackId', trackId))
        .filter(q =>
          q.and(
            q.eq(q.field('isActive'), true),
            q.eq(q.field('isApproved'), true)
          )
        )
        .order('desc')
        .take(limit);
    } else {
      vehicles = await ctx.db
        .query('vehicles')
        .withIndex('by_active_approved', q =>
          q.eq('isActive', true).eq('isApproved', true)
        )
        .order('desc')
        .take(limit);
    }

    // Get vehicle images and owner details
    const vehiclesWithDetails = await Promise.all(
      vehicles.map(async vehicle => {
        const [images, owner, track] = await Promise.all([
          ctx.db
            .query('vehicleImages')
            .withIndex('by_vehicle', q => q.eq('vehicleId', vehicle._id))
            .order('asc')
            .collect(),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', vehicle.ownerId)
            )
            .first(),
          ctx.db.get(vehicle.trackId),
        ]);

        // Add optimized URLs for each image
        const optimizedImages = await Promise.all(
          images.map(async image => {
            const [thumbnailUrl, cardUrl, detailUrl, heroUrl] =
              await Promise.all([
                image.thumbnailStorageId
                  ? ctx.storage.getUrl(image.thumbnailStorageId)
                  : image.imageUrl,
                image.cardStorageId
                  ? ctx.storage.getUrl(image.cardStorageId)
                  : image.imageUrl,
                image.detailStorageId
                  ? ctx.storage.getUrl(image.detailStorageId)
                  : image.imageUrl,
                image.heroStorageId
                  ? ctx.storage.getUrl(image.heroStorageId)
                  : image.imageUrl,
              ]);

            return {
              ...image,
              thumbnailUrl,
              cardUrl,
              detailUrl,
              heroUrl,
            };
          })
        );

        return {
          ...vehicle,
          images: optimizedImages,
          owner,
          track,
        };
      })
    );

    return vehiclesWithDetails;
  },
});

// Get all active and approved vehicles (legacy function for backward compatibility)
export const getAll = query({
  args: {
    trackId: v.optional(v.id('tracks')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { trackId, limit = 50 } = args;

    let vehicles;
    if (trackId) {
      vehicles = await ctx.db
        .query('vehicles')
        .withIndex('by_track', q => q.eq('trackId', trackId))
        .filter(q =>
          q.and(
            q.eq(q.field('isActive'), true),
            q.eq(q.field('isApproved'), true)
          )
        )
        .order('desc')
        .take(limit);
    } else {
      vehicles = await ctx.db
        .query('vehicles')
        .withIndex('by_active_approved', q =>
          q.eq('isActive', true).eq('isApproved', true)
        )
        .order('desc')
        .take(limit);
    }

    // Get vehicle images and owner details
    const vehiclesWithDetails = await Promise.all(
      vehicles.map(async vehicle => {
        const [images, owner, track] = await Promise.all([
          ctx.db
            .query('vehicleImages')
            .withIndex('by_vehicle', q => q.eq('vehicleId', vehicle._id))
            .order('asc')
            .collect(),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', vehicle.ownerId)
            )
            .first(),
          ctx.db.get(vehicle.trackId),
        ]);

        return {
          ...vehicle,
          images,
          owner,
          track,
        };
      })
    );

    return vehiclesWithDetails;
  },
});

// Get vehicle by ID with all details
export const getById = query({
  args: { id: v.id('vehicles') },
  handler: async (ctx, args) => {
    const vehicle = await ctx.db.get(args.id);
    if (vehicle === null) {
      throw new Error('NOT_FOUND');
    }

    const [images, owner, track, availability] = await Promise.all([
      ctx.db
        .query('vehicleImages')
        .withIndex('by_vehicle', q => q.eq('vehicleId', args.id))
        .order('asc')
        .collect(),
      ctx.db
        .query('users')
        .withIndex('by_external_id', q => q.eq('externalId', vehicle.ownerId))
        .first(),
      ctx.db.get(vehicle.trackId),
      ctx.db
        .query('availability')
        .withIndex('by_vehicle_date', q => q.eq('vehicleId', args.id))
        .order('asc')
        .collect(),
    ]);

    return {
      ...vehicle,
      images,
      owner,
      track,
      availability,
    };
  },
});

// Get vehicle image by ID
export const getVehicleImageById = query({
  args: { id: v.id('vehicleImages') },
  handler: async (ctx, args) => {
    const image = await ctx.db.get(args.id);
    if (!image) return null;

    // Get optimized URLs
    const [thumbnailUrl, cardUrl, detailUrl, heroUrl] = await Promise.all([
      image.thumbnailStorageId
        ? ctx.storage.getUrl(image.thumbnailStorageId)
        : image.imageUrl,
      image.cardStorageId
        ? ctx.storage.getUrl(image.cardStorageId)
        : image.imageUrl,
      image.detailStorageId
        ? ctx.storage.getUrl(image.detailStorageId)
        : image.imageUrl,
      image.heroStorageId
        ? ctx.storage.getUrl(image.heroStorageId)
        : image.imageUrl,
    ]);

    return {
      ...image,
      thumbnailUrl,
      cardUrl,
      detailUrl,
      heroUrl,
    };
  },
});

// Get vehicles by owner
export const getByOwner = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const vehicles = await ctx.db
      .query('vehicles')
      .withIndex('by_owner_active', q =>
        q.eq('ownerId', args.ownerId).eq('isActive', true)
      )
      .order('desc')
      .collect();

    const vehiclesWithDetails = await Promise.all(
      vehicles.map(async vehicle => {
        const [images, track] = await Promise.all([
          ctx.db
            .query('vehicleImages')
            .withIndex('by_vehicle', q => q.eq('vehicleId', vehicle._id))
            .order('asc')
            .collect(),
          ctx.db.get(vehicle.trackId),
        ]);

        return {
          ...vehicle,
          images,
          track,
        };
      })
    );

    return vehiclesWithDetails;
  },
});

// Generate upload URL for file storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    return await ctx.storage.generateUploadUrl();
  },
});

// Create a new vehicle with processed images
export const createVehicleWithImages = mutation({
  args: {
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
    addOns: v.optional(
      v.array(
        v.object({
          name: v.string(),
          price: v.number(),
          description: v.optional(v.string()),
          isRequired: v.optional(v.boolean()),
        })
      )
    ),
    images: v.array(
      v.object({
        storageId: v.optional(v.id('_storage')),
        thumbnailStorageId: v.optional(v.id('_storage')),
        cardStorageId: v.optional(v.id('_storage')),
        detailStorageId: v.optional(v.id('_storage')),
        heroStorageId: v.optional(v.id('_storage')),
        imageUrl: v.optional(v.string()), // For legacy support
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
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const userId = identity.subject;
    const now = Date.now();

    // Create the vehicle
    const vehicleId = await ctx.db.insert('vehicles', {
      ownerId: userId,
      trackId: args.trackId,
      make: args.make,
      model: args.model,
      year: args.year,
      dailyRate: args.dailyRate,
      description: args.description,
      horsepower: args.horsepower,
      transmission: args.transmission,
      drivetrain: args.drivetrain,
      engineType: args.engineType,
      mileage: args.mileage,
      amenities: args.amenities,
      addOns: args.addOns || [],
      isActive: true,
      isApproved: false,
      createdAt: now,
      updatedAt: now,
    });

    // Create vehicle images with storage IDs
    await Promise.all(
      args.images.map(async image => {
        // Get URLs for all storage IDs
        const [imageUrl] = await Promise.all([
          image.storageId
            ? ctx.storage.getUrl(image.storageId)
            : image.imageUrl || '',
          image.thumbnailStorageId
            ? ctx.storage.getUrl(image.thumbnailStorageId)
            : null,
          image.cardStorageId ? ctx.storage.getUrl(image.cardStorageId) : null,
          image.detailStorageId
            ? ctx.storage.getUrl(image.detailStorageId)
            : null,
          image.heroStorageId ? ctx.storage.getUrl(image.heroStorageId) : null,
        ]);

        return ctx.db.insert('vehicleImages', {
          vehicleId,
          storageId: image.storageId,
          thumbnailStorageId: image.thumbnailStorageId,
          cardStorageId: image.cardStorageId,
          detailStorageId: image.detailStorageId,
          heroStorageId: image.heroStorageId,
          imageUrl: imageUrl || image.imageUrl || '', // Use hero URL as primary or fallback to provided URL
          isPrimary: image.isPrimary,
          order: image.order,
          metadata: image.metadata,
        });
      })
    );

    return vehicleId;
  },
});

// Create a new vehicle (legacy function for backward compatibility)
export const create = mutation({
  args: {
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
    images: v.array(
      v.object({
        imageUrl: v.string(),
        isPrimary: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const userId = identity.subject;
    const now = Date.now();

    // Create the vehicle
    const vehicleId = await ctx.db.insert('vehicles', {
      ownerId: userId,
      trackId: args.trackId,
      make: args.make,
      model: args.model,
      year: args.year,
      dailyRate: args.dailyRate,
      description: args.description,
      horsepower: args.horsepower,
      transmission: args.transmission,
      drivetrain: args.drivetrain,
      engineType: args.engineType,
      mileage: args.mileage,
      amenities: args.amenities,
      addOns: [],
      isActive: true,
      isApproved: false,
      createdAt: now,
      updatedAt: now,
    });

    // Create vehicle images
    await Promise.all(
      args.images.map((image, index) =>
        ctx.db.insert('vehicleImages', {
          vehicleId,
          storageId: undefined, // Optional field for legacy support
          imageUrl: image.imageUrl,
          isPrimary: image.isPrimary,
          order: index,
        })
      )
    );

    return vehicleId;
  },
});

// Update vehicle
export const update = mutation({
  args: {
    id: v.id('vehicles'),
    trackId: v.optional(v.id('tracks')),
    make: v.optional(v.string()),
    model: v.optional(v.string()),
    year: v.optional(v.number()),
    dailyRate: v.optional(v.number()),
    description: v.optional(v.string()),
    horsepower: v.optional(v.number()),
    transmission: v.optional(v.string()),
    drivetrain: v.optional(v.string()),
    engineType: v.optional(v.string()),
    mileage: v.optional(v.number()),
    fuelType: v.optional(v.string()),
    color: v.optional(v.string()),
    amenities: v.optional(v.array(v.string())),
    performanceSpecs: v.optional(
      v.object({
        torque: v.optional(v.number()),
        acceleration: v.optional(v.number()),
        topSpeed: v.optional(v.number()),
        weight: v.optional(v.number()),
        engineType: v.optional(v.string()),
        displacement: v.optional(v.number()),
        fuelCapacity: v.optional(v.number()),
        tireSize: v.optional(v.string()),
        brakeType: v.optional(v.string()),
        suspensionType: v.optional(v.string()),
        differentialType: v.optional(v.string()),
        coolingSystem: v.optional(v.string()),
      })
    ),
    addOns: v.optional(
      v.array(
        v.object({
          name: v.string(),
          price: v.number(),
          description: v.optional(v.string()),
          isRequired: v.optional(v.boolean()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const vehicle = await ctx.db.get(args.id);
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId !== identity.subject) {
      throw new Error('Not authorized to update this vehicle');
    }

    const { id, ...updateData } = args;
    void id; // Exclude id from updateData
    await ctx.db.patch(args.id, {
      ...updateData,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Delete vehicle (soft delete)
export const remove = mutation({
  args: { id: v.id('vehicles') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const vehicle = await ctx.db.get(args.id);
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId !== identity.subject) {
      throw new Error('Not authorized to delete this vehicle');
    }

    await ctx.db.patch(args.id, {
      isActive: false,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// Add vehicle image
export const addImage = mutation({
  args: {
    vehicleId: v.id('vehicles'),
    imageUrl: v.string(),
    isPrimary: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    if (vehicle.ownerId !== identity.subject) {
      throw new Error('Not authorized to modify this vehicle');
    }

    // Get current image count for order
    const existingImages = await ctx.db
      .query('vehicleImages')
      .withIndex('by_vehicle', q => q.eq('vehicleId', args.vehicleId))
      .collect();

    const imageId = await ctx.db.insert('vehicleImages', {
      vehicleId: args.vehicleId,
      storageId: undefined, // Optional field for legacy support
      imageUrl: args.imageUrl,
      isPrimary: args.isPrimary,
      order: existingImages.length,
    });

    // If this is primary, unset other primary images
    if (args.isPrimary) {
      await Promise.all(
        existingImages
          .filter(img => img.isPrimary)
          .map(img => ctx.db.patch(img._id, { isPrimary: false }))
      );
    }

    return imageId;
  },
});

// Remove vehicle image
export const removeImage = mutation({
  args: { imageId: v.id('vehicleImages') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    const image = await ctx.db.get(args.imageId);
    if (!image) {
      throw new Error('Image not found');
    }

    const vehicle = await ctx.db.get(image.vehicleId);
    if (!vehicle || vehicle.ownerId !== identity.subject) {
      throw new Error('Not authorized to modify this vehicle');
    }

    await ctx.db.delete(args.imageId);
    return args.imageId;
  },
});

// Get all tracks
export const getTracks = query({
  handler: async ctx => await ctx.db
      .query('tracks')
      .withIndex('by_active', q => q.eq('isActive', true))
      .order('asc')
      .collect(),
});

// Migration function to fix existing vehicle images
export const migrateVehicleImages = mutation({
  args: {},
  handler: async ctx => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // Get all vehicle images that don't have storageId
    const imagesToMigrate = await ctx.db
      .query('vehicleImages')
      .filter(q => q.eq(q.field('storageId'), undefined))
      .collect();

    console.log(`Found ${imagesToMigrate.length} images to migrate`);

    // For now, we'll just ensure all images have the required fields
    // In a real migration, you might want to upload the images to Convex storage
    const migrationResults = await Promise.all(
      imagesToMigrate.map(async image => {
        // Ensure the image has all required fields
        const updateData: Record<string, unknown> = {};

        // If storageId is missing, we'll leave it as undefined for now
        // The imageUrl field should already be present

        // Ensure order is a number
        if (typeof image.order !== 'number') {
          updateData.order = 0;
        }

        // Ensure isPrimary is a boolean
        if (typeof image.isPrimary !== 'boolean') {
          updateData.isPrimary = false;
        }

        if (Object.keys(updateData).length > 0) {
          await ctx.db.patch(image._id, updateData);
          return { id: image._id, updated: true, changes: updateData };
        }

        return { id: image._id, updated: false };
      })
    );

    return {
      totalImages: imagesToMigrate.length,
      migratedImages: migrationResults.filter(r => r.updated).length,
      results: migrationResults,
    };
  },
});

// Admin function to approve a vehicle
export const approveVehicle = mutation({
  args: { vehicleId: v.id('vehicles') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // TODO: Add admin role check here
    // For now, any authenticated user can approve vehicles
    // In production, you should check if the user has admin privileges

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    await ctx.db.patch(args.vehicleId, {
      isApproved: true,
      updatedAt: Date.now(),
    });

    return args.vehicleId;
  },
});

// Admin function to reject a vehicle
export const rejectVehicle = mutation({
  args: { vehicleId: v.id('vehicles') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // TODO: Add admin role check here
    // For now, any authenticated user can reject vehicles
    // In production, you should check if the user has admin privileges

    const vehicle = await ctx.db.get(args.vehicleId);
    if (!vehicle) {
      throw new Error('Vehicle not found');
    }

    await ctx.db.patch(args.vehicleId, {
      isApproved: false,
      updatedAt: Date.now(),
    });

    return args.vehicleId;
  },
});

// Admin function to get all pending vehicles for review
export const getPendingVehicles = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Not authenticated');
    }

    // TODO: Add admin role check here
    // For now, any authenticated user can view pending vehicles
    // In production, you should check if the user has admin privileges

    const { limit = 50 } = args;

    const vehicles = await ctx.db
      .query('vehicles')
      .withIndex('by_active_approved', q =>
        q.eq('isActive', true).eq('isApproved', false)
      )
      .order('desc')
      .take(limit);

    // Get vehicle images and owner details
    const vehiclesWithDetails = await Promise.all(
      vehicles.map(async vehicle => {
        const [images, owner, track] = await Promise.all([
          ctx.db
            .query('vehicleImages')
            .withIndex('by_vehicle', q => q.eq('vehicleId', vehicle._id))
            .order('asc')
            .collect(),
          ctx.db
            .query('users')
            .withIndex('by_external_id', q =>
              q.eq('externalId', vehicle.ownerId)
            )
            .first(),
          ctx.db.get(vehicle.trackId),
        ]);

        return {
          ...vehicle,
          images,
          owner,
          track,
        };
      })
    );

    return vehiclesWithDetails;
  },
});
