# Adalo Migration Quick Start

This is a quick reference guide for migrating from Adalo to this web application. For detailed information, see [ADALO_MIGRATION_GUIDE.md](./ADALO_MIGRATION_GUIDE.md).

## 🎯 Best Course of Action

The recommended migration approach is:

### **Option 1: Automated Migration (Recommended)**

Best for: Complete migration with all data types

1. **Export data from Adalo** → JSON/CSV files
2. **Create Clerk accounts** → Use `scripts/create-clerk-users.ts`
3. **Run migration script** → Use `scripts/migrate-from-adalo.ts`
4. **Verify and test** → Check data integrity

**Time Estimate:** 2-4 hours for setup + migration time depends on data volume

### **Option 2: Staged Migration**

Best for: Large datasets or when you want to test incrementally

1. Migrate users first (test authentication)
2. Migrate vehicles (test browsing)
3. Migrate reservations (test booking flow)
4. Migrate reviews and other data

**Time Estimate:** 1-2 days with testing between stages

### **Option 3: User Self-Migration**

Best for: Better UX and gradual transition

1. Build a migration page in your app
2. Users log in and claim their Adalo data
3. Data is migrated on-demand per user
4. Adalo app remains active during transition

**Time Estimate:** 1-2 weeks development + ongoing migration

## 📋 Quick Start Checklist

- [ ] Export all data from Adalo
- [ ] Set up Clerk account (if not already done)
- [ ] Configure Convex deployment
- [ ] Set up R2 bucket for images
- [ ] Install migration script dependencies
- [ ] Create Clerk user accounts
- [ ] Run migration script
- [ ] Verify data integrity
- [ ] Test critical user flows
- [ ] Send migration completion emails

## 🚀 Quick Start Commands

### 1. Install Dependencies

```bash
pnpm add -D tsx @clerk/clerk-sdk-node
pnpm add convex
```

### 2. Create Clerk Users

```bash
CLERK_SECRET_KEY=your-key tsx scripts/create-clerk-users.ts \
  --users-file adalo-users.json \
  --output user-mapping.json
```

### 3. Run Migration

```bash
CONVEX_URL=your-convex-url tsx scripts/migrate-from-adalo.ts \
  --data-file adalo-export.json \
  --user-mapping user-mapping.json
```

## 📁 File Structure

```
Renegade-Race-Rentals/
├── ADALO_MIGRATION_GUIDE.md      # Detailed migration guide
├── MIGRATION_QUICK_START.md      # This file
├── packages/backend/convex/
│   └── migrateAdalo.ts            # Migration functions
└── scripts/
    ├── README.md                  # Scripts documentation
    ├── create-clerk-users.ts     # Clerk user creation
    └── migrate-from-adalo.ts     # Migration runner
```

## 🔑 Key Considerations

### User Authentication

- **Critical**: Users must have Clerk accounts before migration
- Clerk user IDs become `externalId` in Convex
- Users will need to reset passwords on first login
- Consider sending password reset emails after migration

### Image Migration

- Images are downloaded from Adalo URLs
- Re-uploaded to R2 (Cloudflare R2)
- Optimized via ImageKit
- Large image sets may take significant time

### Data Relationships

Migration must happen in order:
1. Tracks (if not seeded)
2. Users
3. Vehicles
4. Reservations
5. Reviews
6. Other related data

### Payment Integration

- Stripe accounts need to be reconnected
- Hosts must complete Stripe onboarding again
- Payment history may not migrate (depends on Adalo data)

## ⚠️ Common Pitfalls

1. **Missing User Mappings**: Ensure all users have Clerk accounts before migrating
2. **Image Failures**: Some images may fail to migrate - check logs
3. **Date Formats**: Ensure dates are in ISO format (YYYY-MM-DD)
4. **Rate Limits**: Clerk and Convex have rate limits - scripts include delays
5. **Missing Fields**: Some optional fields may be missing - migration handles gracefully

## 📊 Migration Statistics

After migration, you'll see:
- ✅ Success count for each data type
- ❌ Failure count and errors
- Detailed error logs for debugging

## 🆘 Getting Help

1. **Check Logs**: Review console output and Convex function logs
2. **Verify Data**: Use Convex dashboard to inspect migrated data
3. **Test Functions**: Test individual migration functions with sample data
4. **Review Guide**: See [ADALO_MIGRATION_GUIDE.md](./ADALO_MIGRATION_GUIDE.md) for detailed information

## 🎓 Next Steps After Migration

1. **User Communication**
   - Send welcome emails with new app link
   - Provide password reset instructions
   - Offer support for account issues

2. **Testing**
   - Test user login and authentication
   - Verify vehicle browsing and search
   - Test reservation creation flow
   - Verify payment processing

3. **Monitoring**
   - Monitor app performance
   - Check for errors in logs
   - Collect user feedback

4. **Cleanup**
   - Archive Adalo data
   - Update documentation
   - Remove migration scripts (optional)

## 📝 Example Data Formats

### Adalo User Export
```json
{
  "id": "adalo_user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "phone": "+1234567890",
  "profileImageUrl": "https://...",
  "bio": "Racing enthusiast",
  "location": "Austin, TX"
}
```

### Adalo Vehicle Export
```json
{
  "id": "adalo_vehicle_456",
  "ownerId": "adalo_user_123",
  "make": "Porsche",
  "model": "911 GT3",
  "year": 2023,
  "dailyRate": 899,
  "description": "Track-ready...",
  "trackName": "Circuit of the Americas",
  "images": [
    {
      "url": "https://...",
      "isPrimary": true,
      "order": 0
    }
  ]
}
```

## 🔄 Rollback Plan

If migration fails:
1. Keep Adalo data intact (don't delete)
2. Use Convex dashboard to delete migrated data
3. Fix issues and re-run migration
4. Consider migrating in smaller batches

---

**Ready to start?** Begin with [ADALO_MIGRATION_GUIDE.md](./ADALO_MIGRATION_GUIDE.md) for detailed instructions.
