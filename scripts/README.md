# Migration Scripts

This directory contains scripts to help migrate data from Adalo to the Convex-based web application.

## Scripts

### 1. `create-clerk-users.ts`

Creates Clerk user accounts from Adalo user data and generates a mapping file.

**Prerequisites:**
- Clerk account with API access
- `CLERK_SECRET_KEY` environment variable

**Usage:**
```bash
CLERK_SECRET_KEY=your-secret-key tsx scripts/create-clerk-users.ts \
  --users-file adalo-users.json \
  --output user-mapping.json
```

**Input Format:**
```json
[
  {
    "id": "adalo_user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+1234567890"
  }
]
```

**Output:**
A JSON mapping file that maps Adalo user IDs to Clerk user IDs:
```json
{
  "adalo_user_123": "clerk_user_abc",
  "adalo_user_456": "clerk_user_def"
}
```

### 2. `migrate-from-adalo.ts`

Migrates data from Adalo to Convex using the migration functions.

**Prerequisites:**
- Convex deployment URL
- User mapping file (from `create-clerk-users.ts`)
- Adalo data export file

**Usage:**
```bash
CONVEX_URL=your-convex-url tsx scripts/migrate-from-adalo.ts \
  --data-file adalo-export.json \
  --user-mapping user-mapping.json \
  --convex-url your-convex-url
```

**Input Format:**
```json
{
  "users": [...],
  "vehicles": [...],
  "reservations": [...],
  "reviews": [...]
}
```

**What it does:**
1. Migrates users (creates Convex user records)
2. Migrates vehicles (with images to R2)
3. Migrates reservations
4. Migrates reviews
5. Prints migration statistics

## Installation

Install required dependencies:

```bash
pnpm add -D tsx @clerk/clerk-sdk-node
pnpm add convex
```

## Migration Workflow

### Step 1: Export Data from Adalo

Export your data from Adalo admin panel:
- Users (CSV or JSON)
- Vehicles
- Reservations
- Reviews
- Other collections

### Step 2: Create Clerk Accounts

```bash
# Create Clerk user accounts
CLERK_SECRET_KEY=your-key tsx scripts/create-clerk-users.ts \
  --users-file adalo-users.json \
  --output user-mapping.json
```

### Step 3: Prepare Data File

Combine all exported data into a single JSON file:

```json
{
  "users": [...],
  "vehicles": [...],
  "reservations": [...],
  "reviews": [...]
}
```

### Step 4: Run Migration

```bash
# Run the migration
CONVEX_URL=your-convex-url tsx scripts/migrate-from-adalo.ts \
  --data-file adalo-export.json \
  --user-mapping user-mapping.json
```

### Step 5: Verify Migration

Check the migration statistics and verify data in Convex dashboard.

## Troubleshooting

### Users Not Created in Clerk

- Verify `CLERK_SECRET_KEY` is correct
- Check Clerk API rate limits
- Review error messages in console

### Migration Fails

- Check Convex deployment URL
- Verify user mapping file is correct
- Review Convex function logs
- Check for missing required fields

### Images Not Migrating

- Verify R2 bucket is configured
- Check image URLs are accessible
- Review R2 upload permissions
- Check network connectivity

## Notes

- Migration runs sequentially to maintain referential integrity
- Large datasets may take significant time
- Images are downloaded and re-uploaded to R2
- Failed items are logged but don't stop the migration
- Review error logs after migration completes

## Support

For issues or questions:
1. Check the main migration guide: `ADALO_MIGRATION_GUIDE.md`
2. Review Convex function logs
3. Check error messages in console output
