# Adalo to Convex Migration Guide

This guide outlines the best practices for migrating data from your Adalo app to this Next.js/Convex web application.

## Overview

The migration process involves:
1. **Data Export** from Adalo
2. **Data Transformation** to match Convex schema
3. **User Account Migration** (Clerk setup)
4. **Data Import** into Convex
5. **Image Migration** to R2/ImageKit
6. **Verification** and cleanup

## Prerequisites

- Access to Adalo admin panel for data export
- Clerk account setup (for user authentication)
- Convex deployment configured
- R2 bucket configured for image storage
- ImageKit account configured (for image optimization)

## Step-by-Step Migration Process

### Step 1: Export Data from Adalo

1. **Export Users**
   - Go to Adalo admin → Users
   - Export as CSV or JSON
   - Include fields: ID, Email, Name, Phone, Profile Image URL, Bio, Location, Created Date

2. **Export Vehicles**
   - Include: ID, Owner ID, Make, Model, Year, Daily Rate, Description, Track/Location, Images, Specs, Amenities, Address

3. **Export Reservations**
   - Include: ID, Vehicle ID, Renter ID, Owner ID, Start Date, End Date, Total Amount, Status, Created Date

4. **Export Reviews**
   - Include: ID, Reservation ID, Reviewer ID, Reviewed ID, Rating, Review Text, Created Date

5. **Export Other Data**
   - Tracks/Locations
   - Favorites
   - Messages/Conversations (if applicable)
   - Any other custom collections

### Step 2: Prepare Data Mapping

Create a mapping file (JSON) that maps:
- Adalo User IDs → Clerk User IDs
- Adalo Vehicle IDs → Convex Vehicle IDs
- Adalo Track Names → Convex Track IDs

Example mapping structure:
```json
{
  "users": {
    "adalo_user_123": "clerk_user_abc",
    "adalo_user_456": "clerk_user_def"
  },
  "vehicles": {
    "adalo_vehicle_789": "convex_vehicle_xyz"
  },
  "tracks": {
    "Daytona": "track_id_1",
    "COTA": "track_id_2"
  }
}
```

### Step 3: Create Clerk Accounts for Users

**Option A: Manual Creation (Small Dataset)**
- Create accounts one by one in Clerk dashboard
- Map Adalo user ID to Clerk user ID

**Option B: Bulk Import via Clerk API (Recommended)**
- Use Clerk's API to create users programmatically
- Script example:
```typescript
// scripts/create-clerk-users.ts
import { ClerkClient } from '@clerk/clerk-sdk-node'

const clerk = new ClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

async function createUsersFromAdalo(adaloUsers: AdaloUser[]) {
  const mapping = {}
  
  for (const user of adaloUsers) {
    try {
      const clerkUser = await clerk.users.createUser({
        emailAddress: [user.email],
        firstName: user.name.split(' ')[0],
        lastName: user.name.split(' ').slice(1).join(' '),
        skipPasswordChecks: true, // Users will reset password on first login
        skipPasswordRequirement: true,
      })
      
      mapping[user.id] = clerkUser.id
      console.log(`Created Clerk user: ${clerkUser.id} for ${user.email}`)
    } catch (error) {
      console.error(`Failed to create user ${user.email}:`, error)
    }
  }
  
  return mapping
}
```

**Option C: User Self-Migration (Best UX)**
- Provide a migration page where users can:
  1. Enter their Adalo email
  2. Create/verify their Clerk account
  3. Link their Adalo data automatically

### Step 4: Transform Data Format

Create a transformation script to convert Adalo data to Convex format:

```typescript
// scripts/transform-adalo-data.ts

interface AdaloData {
  users: AdaloUser[]
  vehicles: AdaloVehicle[]
  reservations: AdaloReservation[]
  reviews: AdaloReview[]
}

interface TransformedData {
  users: Array<{
    adaloUser: AdaloUser
    clerkExternalId: string
  }>
  vehicles: Array<{
    adaloVehicle: AdaloVehicle
    ownerClerkId: string
    trackId?: string
    trackName?: string
  }>
  // ... etc
}

function transformData(
  adaloData: AdaloData,
  userMapping: Record<string, string>
): TransformedData {
  // Transform users
  const transformedUsers = adaloData.users.map(user => ({
    adaloUser: user,
    clerkExternalId: userMapping[user.id],
  }))

  // Transform vehicles
  const transformedVehicles = adaloData.vehicles.map(vehicle => ({
    adaloVehicle: vehicle,
    ownerClerkId: userMapping[vehicle.ownerId],
    trackName: vehicle.trackName, // Will be resolved during migration
  }))

  // ... transform other data types

  return {
    users: transformedUsers,
    vehicles: transformedVehicles,
    // ...
  }
}
```

### Step 5: Run Migration Scripts

**Option A: Use Convex Dashboard**
- Go to Convex Dashboard → Functions
- Call migration functions manually with test data

**Option B: Create Migration Script**
```typescript
// scripts/run-migration.ts
import { ConvexHttpClient } from "convex/browser"
import { api } from "../packages/backend/convex/_generated/api"

const client = new ConvexHttpClient(process.env.CONVEX_URL!)

async function runMigration() {
  // 1. Migrate users
  const userResults = await client.mutation(
    api.migrateAdalo.migrateUsersBatch,
    {
      users: transformedData.users,
    }
  )
  console.log(`Migrated ${userResults.successCount} users`)

  // 2. Migrate vehicles (after users)
  for (const vehicle of transformedData.vehicles) {
    try {
      await client.mutation(api.migrateAdalo.migrateVehicle, vehicle)
    } catch (error) {
      console.error(`Failed to migrate vehicle:`, error)
    }
  }

  // 3. Migrate reservations (after vehicles)
  // ... etc
}
```

**Option C: Use Convex CLI**
```bash
# Run migration function via CLI
npx convex run migrateAdalo:migrateUsersBatch --args '{"users": [...]}'
```

### Step 6: Handle Image Migration

Images are automatically migrated during the migration process:
- Profile images → R2 `profiles/` folder
- Vehicle images → R2 `vehicles/{vehicleId}/` folder
- Images are optimized via ImageKit

**Note**: Large image migrations may take time. Consider:
- Running image migration in batches
- Using a background job queue
- Monitoring R2 storage usage

### Step 7: Verify Migration

Create verification queries:

```typescript
// packages/backend/convex/migrateAdalo.ts (add these)

export const verifyMigration = query({
  args: {
    expectedUserCount: v.number(),
    expectedVehicleCount: v.number(),
  },
  handler: async (ctx, args) => {
    const actualUserCount = await ctx.db.query("users").collect().then(u => u.length)
    const actualVehicleCount = await ctx.db.query("vehicles").collect().then(v => v.length)
    
    return {
      users: {
        expected: args.expectedUserCount,
        actual: actualUserCount,
        match: args.expectedUserCount === actualUserCount,
      },
      vehicles: {
        expected: args.expectedVehicleCount,
        actual: actualVehicleCount,
        match: args.expectedVehicleCount === actualVehicleCount,
      },
    }
  },
})
```

### Step 8: Post-Migration Tasks

1. **Update User Passwords**
   - Send password reset emails to all migrated users
   - Or provide a migration page for password setup

2. **Verify Stripe Accounts**
   - Hosts need to reconnect Stripe accounts
   - Send onboarding emails to hosts

3. **Test Critical Flows**
   - User login
   - Vehicle browsing
   - Reservation creation
   - Payment processing

4. **Data Cleanup**
   - Remove test/migration data
   - Archive old Adalo data
   - Update any hardcoded references

## Migration Order

**Critical**: Migrate data in this order to maintain referential integrity:

1. **Tracks** (if not already seeded)
2. **Users** (with Clerk accounts)
3. **Vehicles** (depends on users and tracks)
4. **Vehicle Images** (depends on vehicles)
5. **Reservations** (depends on vehicles and users)
6. **Reviews** (depends on reservations)
7. **Favorites** (depends on users and vehicles)
8. **Messages/Conversations** (depends on users and reservations)

## Handling Edge Cases

### Missing Data
- Handle null/undefined fields gracefully
- Use default values where appropriate
- Log missing data for review

### Duplicate Prevention
- Check for existing records before inserting
- Use upsert patterns where appropriate
- Handle conflicts gracefully

### Image Failures
- Continue migration even if some images fail
- Log failed images for manual review
- Provide fallback placeholder images

### Date Format Issues
- Normalize all dates to ISO format
- Handle timezone conversions
- Preserve original timestamps where possible

## Performance Considerations

### Batch Processing
- Process data in batches (e.g., 50-100 records at a time)
- Add delays between batches to avoid rate limits
- Monitor Convex function execution time

### Parallel Processing
- Migrate independent data types in parallel
- Use Promise.all() for batch operations
- Be mindful of R2 rate limits for images

### Error Handling
- Implement retry logic for transient failures
- Log all errors for debugging
- Create rollback procedures

## Rollback Plan

If migration fails or needs to be reversed:

1. **Backup Current Data**
   - Export current Convex data before migration
   - Keep Adalo data intact

2. **Delete Migrated Data**
   - Create cleanup functions to remove migrated data
   - Use Convex dashboard to manually delete if needed

3. **Restore from Backup**
   - Re-import previous Convex data if available

## Testing Strategy

1. **Test with Small Dataset**
   - Migrate 5-10 users first
   - Verify data integrity
   - Test user login and basic flows

2. **Staged Rollout**
   - Migrate users in batches
   - Monitor for issues
   - Gradually increase batch size

3. **Production Migration**
   - Schedule during low-traffic period
   - Have rollback plan ready
   - Monitor closely for first 24 hours

## Migration Checklist

- [ ] Export all data from Adalo
- [ ] Create data transformation scripts
- [ ] Set up Clerk accounts for all users
- [ ] Create user ID mapping file
- [ ] Test migration with small dataset
- [ ] Run full migration
- [ ] Verify data integrity
- [ ] Test user authentication
- [ ] Test critical user flows
- [ ] Send migration completion emails
- [ ] Update documentation
- [ ] Archive Adalo data

## Support and Troubleshooting

### Common Issues

1. **User Authentication Fails**
   - Verify Clerk user IDs match externalId in Convex
   - Check Clerk account status
   - Verify email addresses match

2. **Images Not Loading**
   - Check R2 bucket permissions
   - Verify ImageKit configuration
   - Check image URLs in database

3. **Missing Relationships**
   - Verify all foreign keys are mapped correctly
   - Check migration order
   - Review error logs

### Getting Help

- Check Convex logs in dashboard
- Review migration error logs
- Test individual migration functions
- Use Convex query functions to inspect data

## Next Steps After Migration

1. **User Communication**
   - Send welcome emails with new app link
   - Provide migration guide for users
   - Offer support for account issues

2. **Feature Parity**
   - Verify all Adalo features work in new app
   - Document any missing features
   - Plan feature additions

3. **Performance Monitoring**
   - Monitor app performance
   - Check database query performance
   - Optimize slow queries

4. **User Feedback**
   - Collect feedback from migrated users
   - Address common issues
   - Iterate on improvements
