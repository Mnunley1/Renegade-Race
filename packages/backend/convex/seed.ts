import { mutation } from "./_generated/server"
import type { Id } from "./_generated/dataModel"

/**
 * Seed the database with fake data for development
 * This is a public mutation that can be called from the web app
 */
export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    // Create test users (using fake Clerk externalIds)
    const users = [
      {
        externalId: "user_2test_owner1",
        name: "Mike Johnson",
        email: "mike.johnson@example.com",
        phone: "+1-555-0101",
        rating: 4.9,
        totalRentals: 127,
        memberSince: "2019",
        profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mike",
        userType: "driver" as const,
      },
      {
        externalId: "user_2test_owner2",
        name: "Sarah Chen",
        email: "sarah.chen@example.com",
        phone: "+1-555-0102",
        rating: 4.8,
        totalRentals: 89,
        memberSince: "2020",
        profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
        userType: "driver" as const,
      },
      {
        externalId: "user_2test_owner3",
        name: "David Rodriguez",
        email: "david.rodriguez@example.com",
        rating: 4.7,
        totalRentals: 156,
        memberSince: "2018",
        profileImage: "https://api.dicebear.com/7.x/avataaars/svg?seed=David",
        userType: "both" as const,
      },
    ]

    const userIds: string[] = []
    for (const userData of users) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_external_id", (q) => q.eq("externalId", userData.externalId))
        .first()

      if (!existing) {
        await ctx.db.insert("users", userData)
      }
      userIds.push(userData.externalId)
    }

    // Create tracks
    const tracks = [
      {
        name: "Daytona International Speedway",
        location: "Daytona Beach, FL",
        description:
          'The "World Center of Racing" features the 31-degree high-banked tri-oval that has made Daytona legendary.',
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
        isActive: true,
      },
      {
        name: "Circuit of the Americas",
        location: "Austin, TX",
        description:
          "State-of-the-art 3.427-mile circuit with elevation changes and challenging corners.",
        imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800",
        isActive: true,
      },
      {
        name: "Laguna Seca Raceway",
        location: "Monterey, CA",
        description: 'Famous for "The Corkscrew" - one of the most challenging turns in racing.',
        imageUrl: "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=800",
        isActive: true,
      },
      {
        name: "Sebring International Raceway",
        location: "Sebring, FL",
        description:
          "Historic 3.7-mile circuit known for its challenging surface and endurance racing heritage.",
        imageUrl: "https://images.unsplash.com/photo-1590736969955-71cc94901144?w=800",
        isActive: true,
      },
    ]

    const trackIds: Array<Id<"tracks">> = []
    for (const trackData of tracks) {
      const existing = await ctx.db
        .query("tracks")
        .filter((q) => q.eq(q.field("name"), trackData.name))
        .first()

      if (existing) {
        trackIds.push(existing._id)
      } else {
        const trackId = await ctx.db.insert("tracks", trackData)
        trackIds.push(trackId)
      }
    }

    // Create vehicles
    const vehicles = [
      {
        ownerId: userIds[0]!,
        trackId: trackIds[0]!,
        make: "Porsche",
        model: "911 GT3",
        year: 2023,
        dailyRate: 899,
        description:
          "Experience the thrill of driving a track-ready Porsche 911 GT3. This exceptional sports car delivers uncompromising performance on both the road and track. With its naturally aspirated 4.0-liter flat-six engine producing 502 horsepower, the GT3 offers an exhilarating driving experience.",
        horsepower: 502,
        transmission: "PDK",
        drivetrain: "RWD",
        engineType: "Flat-6",
        mileage: 3200,
        amenities: ["Carbon Ceramic Brakes", "Sport Chrono", "Track Mode", "Data Logger"],
        addOns: [
          {
            name: "Helmet Rental",
            price: 50,
            description: "Professional racing helmet",
          },
        ],
        isActive: true,
        isApproved: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        ownerId: userIds[1]!,
        trackId: trackIds[1]!,
        make: "Ferrari",
        model: "488 GTB",
        year: 2022,
        dailyRate: 1299,
        description:
          "The Ferrari 488 GTB combines stunning Italian design with track-focused performance. Twin-turbo V8 engine delivers 661 horsepower and an unforgettable driving experience.",
        horsepower: 661,
        transmission: "DCT",
        drivetrain: "RWD",
        engineType: "Twin-Turbo V8",
        mileage: 4500,
        amenities: ["Launch Control", "Racing Seats", "Track Telemetry", "Performance Exhaust"],
        addOns: [
          {
            name: "Professional Instruction",
            price: 300,
            description: "One-on-one track instruction from professional driver",
          },
          {
            name: "Data Analysis Session",
            price: 100,
            description: "Post-session telemetry analysis",
          },
        ],
        isActive: true,
        isApproved: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        ownerId: userIds[2]!,
        trackId: trackIds[2]!,
        make: "Lamborghini",
        model: "Huracán EVO",
        year: 2023,
        dailyRate: 1199,
        description:
          "The Lamborghini Huracán EVO brings supercar performance to the track. With 640 horsepower from a naturally aspirated V10, this car is built for excitement.",
        horsepower: 640,
        transmission: "DCT",
        drivetrain: "AWD",
        engineType: "V10",
        mileage: 2800,
        amenities: [
          "Lamborghini Dinamica Veicolo Integrata",
          "Launch Control",
          "Track Mode",
          "Racing Seats",
        ],
        addOns: [
          {
            name: "GoPro Package",
            price: 75,
            description: "Multi-angle camera setup with data overlay",
          },
        ],
        isActive: true,
        isApproved: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        ownerId: userIds[0]!,
        trackId: trackIds[3]!,
        make: "McLaren",
        model: "720S",
        year: 2022,
        dailyRate: 1399,
        description:
          "The McLaren 720S is a technological marvel with 710 horsepower from a twin-turbo V8. Its carbon fiber chassis and advanced aerodynamics deliver exceptional track performance.",
        horsepower: 710,
        transmission: "DCT",
        drivetrain: "RWD",
        engineType: "Twin-Turbo V8",
        mileage: 5200,
        amenities: [
          "ProActive Chassis Control",
          "Track Telemetry",
          "Carbon Fiber Body",
          "Active Aerodynamics",
        ],
        addOns: [],
        isActive: true,
        isApproved: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        ownerId: userIds[1]!,
        trackId: trackIds[0]!,
        make: "Audi",
        model: "R8 V10 Performance",
        year: 2023,
        dailyRate: 999,
        description:
          "The Audi R8 V10 Performance combines quattro all-wheel drive with a naturally aspirated V10 engine producing 602 horsepower for exceptional track capability.",
        horsepower: 602,
        transmission: "DCT",
        drivetrain: "AWD",
        engineType: "V10",
        mileage: 3800,
        amenities: ["quattro AWD", "Dynamic Steering", "Magnetic Ride", "Virtual Cockpit"],
        addOns: [
          {
            name: "Track Prep Service",
            price: 200,
            description: "Professional track preparation and inspection",
            isRequired: true,
          },
        ],
        isActive: true,
        isApproved: true,
        createdAt: now,
        updatedAt: now,
      },
    ]

    const vehicleIds: Array<Id<"vehicles">> = []
    for (const vehicleData of vehicles) {
      const vehicleId = await ctx.db.insert("vehicles", vehicleData)
      vehicleIds.push(vehicleId)
    }

    // Create vehicle images
    const vehicleImages = [
      // Porsche 911 GT3
      {
        vehicleId: vehicleIds[0]!,
        imageUrl: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=1200",
        isPrimary: true,
        order: 0,
      },
      {
        vehicleId: vehicleIds[0]!,
        imageUrl: "https://images.unsplash.com/photo-1605170088216-9058e29c8e9f?w=1200",
        isPrimary: false,
        order: 1,
      },
      {
        vehicleId: vehicleIds[0]!,
        imageUrl: "https://images.unsplash.com/photo-1549952891-fcf406dd2aa9?w=1200",
        isPrimary: false,
        order: 2,
      },
      {
        vehicleId: vehicleIds[0]!,
        imageUrl: "https://images.unsplash.com/photo-1542362567-b07e54358753?w=1200",
        isPrimary: false,
        order: 3,
      },
      {
        vehicleId: vehicleIds[0]!,
        imageUrl: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200",
        isPrimary: false,
        order: 4,
      },
      {
        vehicleId: vehicleIds[0]!,
        imageUrl: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200",
        isPrimary: false,
        order: 5,
      },
      {
        vehicleId: vehicleIds[0]!,
        imageUrl: "https://images.unsplash.com/photo-1552519507-88aa2dfa9fdb?w=1200",
        isPrimary: false,
        order: 6,
      },
      // Ferrari 488 GTB
      {
        vehicleId: vehicleIds[1]!,
        imageUrl: "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1200",
        isPrimary: true,
        order: 0,
      },
      {
        vehicleId: vehicleIds[1]!,
        imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200",
        isPrimary: false,
        order: 1,
      },
      {
        vehicleId: vehicleIds[1]!,
        imageUrl: "https://images.unsplash.com/photo-1590736969955-71cc94901144?w=1200",
        isPrimary: false,
        order: 2,
      },
      // Lamborghini Huracán EVO
      {
        vehicleId: vehicleIds[2]!,
        imageUrl: "https://images.unsplash.com/photo-1544829099-b9a0c55e42c2?w=1200",
        isPrimary: true,
        order: 0,
      },
      {
        vehicleId: vehicleIds[2]!,
        imageUrl: "https://images.unsplash.com/photo-1544829099-b9a0c55e42c3?w=1200",
        isPrimary: false,
        order: 1,
      },
      {
        vehicleId: vehicleIds[2]!,
        imageUrl: "https://images.unsplash.com/photo-1544829099-b9a0c55e42c4?w=1200",
        isPrimary: false,
        order: 2,
      },
      // McLaren 720S
      {
        vehicleId: vehicleIds[3]!,
        imageUrl: "https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200",
        isPrimary: true,
        order: 0,
      },
      {
        vehicleId: vehicleIds[3]!,
        imageUrl: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200",
        isPrimary: false,
        order: 1,
      },
      // Audi R8
      {
        vehicleId: vehicleIds[4]!,
        imageUrl: "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=1200",
        isPrimary: true,
        order: 0,
      },
      {
        vehicleId: vehicleIds[4]!,
        imageUrl: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200",
        isPrimary: false,
        order: 1,
      },
    ]

    for (const imageData of vehicleImages) {
      await ctx.db.insert("vehicleImages", imageData)
    }

    // Create platform settings
    const existingSettings = await ctx.db
      .query("platformSettings")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first()

    if (!existingSettings) {
      await ctx.db.insert("platformSettings", {
        platformFeePercentage: 5,
        minimumPlatformFee: 100,
        maximumPlatformFee: 5000,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
    }

    return {
      usersCreated: userIds.length,
      tracksCreated: trackIds.length,
      vehiclesCreated: vehicleIds.length,
      imagesCreated: vehicleImages.length,
      vehicleIds,
    }
  },
})
