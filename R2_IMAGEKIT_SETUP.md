# Cloudflare R2 + ImageKit Setup Guide

This guide explains how to set up Cloudflare R2 storage and ImageKit image optimization for the Renegade Race Rentals platform.

## Overview

The application now uses:
- **Cloudflare R2** for object storage (S3-compatible)
- **ImageKit** for on-the-fly image optimization and CDN delivery
- **Convex R2 Component** for seamless integration

## Prerequisites

1. **Cloudflare Account**
   - Create a Cloudflare account at https://cloudflare.com
   - Navigate to R2 Object Storage

2. **ImageKit Account**
   - Sign up at https://imagekit.io
   - Get your ImageKit URL endpoint (e.g., `https://ik.imgkit.net/your_imagekit_id`)

## Setup Steps

### 1. Create R2 Bucket

1. In Cloudflare dashboard, go to **R2 Object Storage**
2. Click **Create bucket**
3. Name your bucket (e.g., `renegade-rentals-images`)
4. Note the bucket name for later

### 2. Configure R2 CORS

Add a CORS policy to your R2 bucket to allow uploads from your app. This is **critical** for browser-based uploads to work.

1. In Cloudflare dashboard, go to your R2 bucket
2. Click on **Settings** tab
3. Scroll down to **CORS Policy** section
4. Click **Edit CORS Policy**
5. Paste the following JSON configuration:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "http://localhost:3001",
      "https://yourdomain.com"
    ],
    "AllowedMethods": ["GET", "PUT", "POST", "HEAD", "OPTIONS"],
    "AllowedHeaders": [
      "*"
    ],
    "ExposedHeaders": [
      "ETag",
      "x-amz-request-id",
      "x-amz-id-2"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

**Important Notes:**
- Replace `https://yourdomain.com` with your actual production domain
- The `"AllowedHeaders": ["*"]` allows all headers, which is necessary for signed URL uploads that include AWS signature headers
- `OPTIONS` method is required for CORS preflight requests
- `MaxAgeSeconds` controls how long browsers cache the CORS preflight response (3600 = 1 hour)

**If you're still getting CORS errors after updating:**
- Make sure you've saved the CORS policy in the Cloudflare dashboard
- Clear your browser cache or try an incognito window
- Verify the origin in the error message matches exactly what's in `AllowedOrigins` (including protocol and port)
- **See [R2_CORS_TROUBLESHOOTING.md](./R2_CORS_TROUBLESHOOTING.md) for detailed troubleshooting steps**

### 3. Create R2 API Token

1. In R2 dashboard, click **Manage R2 API Tokens**
2. Click **Create API Token**
3. Set permissions to **Object Read & Write**
4. Select your bucket
5. Click **Create API Token**
6. **Save these values** (shown only once):
   - **Token Value**: `R2_TOKEN`
   - **Access Key ID**: `R2_ACCESS_KEY_ID`
   - **Secret Access Key**: `R2_SECRET_ACCESS_KEY`
   - **Endpoint**: `R2_ENDPOINT`

### 4. Configure ImageKit

1. In ImageKit dashboard, go to **Settings** → **URLs**
2. Copy your **ImageKit URL endpoint** (e.g., `https://ik.imgkit.net/your_id`)
3. Configure ImageKit to pull from your R2 bucket:
   - Go to **Settings** → **Media Library**
   - Add **Origin** pointing to your R2 bucket public endpoint
   - Or use a custom domain if you've set one up

### 5. Set Convex Environment Variables

Run these commands in your `packages/backend` directory:

```bash
npx convex env set R2_BUCKET <your-bucket-name>
npx convex env set R2_TOKEN <your-token-value>
npx convex env set R2_ACCESS_KEY_ID <your-access-key-id>
npx convex env set R2_SECRET_ACCESS_KEY <your-secret-access-key>
npx convex env set R2_ENDPOINT <your-endpoint>
npx convex env set IMAGEKIT_URL_ENDPOINT <your-imagekit-url-endpoint>
```

### 6. Set Frontend Environment Variables

Add to your `.env.local` file in `apps/web`:

```env
NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT=https://ik.imgkit.net/your_imagekit_id
```

## How It Works

### Upload Flow

1. User selects images in the frontend
2. `useUploadFile` hook from `@convex-dev/r2/react` handles:
   - Generating signed upload URL
   - Uploading file directly to R2
   - Syncing metadata to Convex
3. R2 key is stored in Convex database
4. ImageKit serves optimized images on-the-fly

### Image Serving

Images are served through ImageKit with automatic optimization:
- **Thumbnail**: 240x160px, 70% quality
- **Card**: 600x400px, 80% quality
- **Detail**: 1600x900px, 80% quality
- **Hero**: 1920x1080px, 75% quality
- **Original**: Full size, 90% quality

All variants are generated on-the-fly by ImageKit based on the R2 key.

## Code Structure

### Backend (`packages/backend/convex/`)

- **`r2.ts`**: R2 client setup, ImageKit URL generation, upload mutations
- **`vehicles.ts`**: Updated to use R2 keys and ImageKit URLs
- **`users.ts`**: Updated profile image upload to use R2

### Frontend (`apps/web/`)

- **`lib/imagekit.ts`**: ImageKit URL helper utilities
- **`app/host/vehicles/new/page.tsx`**: Updated to use `useUploadFile` hook

## Migration from Legacy Storage

The implementation maintains backward compatibility:
- Legacy `imageUrl` fields still work
- Old Convex storage IDs are supported
- New uploads use R2 keys
- ImageKit URLs are generated automatically

## Testing

1. Start your Convex dev server:
   ```bash
   cd packages/backend
   pnpm convex:dev
   ```

2. Start your Next.js app:
   ```bash
   cd apps/web
   pnpm dev
   ```

3. Test image upload:
   - Navigate to `/host/vehicles/new`
   - Upload vehicle images
   - Verify images appear with ImageKit URLs

## Troubleshooting

### "Failed to fetch" or "Failed to upload image" errors

**⚠️ IMPORTANT: See [R2_CORS_TROUBLESHOOTING.md](./R2_CORS_TROUBLESHOOTING.md) for a complete step-by-step guide to fix CORS issues.**

This error typically indicates one of the following issues:

1. **CORS Configuration Not Applied**
   - Verify you've saved the CORS policy in Cloudflare dashboard
   - Clear browser cache or use incognito mode
   - Check browser DevTools → Network tab to see if OPTIONS preflight request is failing
   - Ensure your origin (e.g., `http://localhost:3000`) exactly matches what's in `AllowedOrigins`

2. **R2 Environment Variables Not Set**
   - Run `npx convex env ls` in `packages/backend` to verify all R2 variables are set:
     - `R2_BUCKET`
     - `R2_TOKEN`
     - `R2_ACCESS_KEY_ID`
     - `R2_SECRET_ACCESS_KEY`
     - `R2_ENDPOINT`
   - If any are missing, set them using `npx convex env set <VAR_NAME> <value>`

3. **R2 API Token Permissions**
   - Verify the API token has "Object Read & Write" permissions
   - Ensure the token is scoped to the correct bucket
   - Try creating a new API token if permissions are unclear

4. **Network/Connectivity Issues**
   - Check browser console for detailed error messages
   - Verify the R2 endpoint URL is correct (should be something like `https://<account-id>.r2.cloudflarestorage.com`)
   - Check if there are any firewall or network restrictions

5. **Convex R2 Component Not Initialized**
   - Verify `convex.config.ts` includes `app.use(r2)`
   - Restart your Convex dev server after making changes
   - Check Convex dashboard logs for any initialization errors

### Images not uploading
- Check R2 environment variables are set correctly
- Verify CORS policy allows your origin
- Check browser console for errors
- Verify file size is within limits (R2 supports large files, but check your app's limits)

### Images not displaying
- Verify ImageKit URL endpoint is configured
- Check ImageKit origin is pointing to your R2 bucket
- Ensure R2 bucket is publicly accessible (or ImageKit has access)
- Verify the R2 key is being stored correctly in your database

### Upload errors
- Verify R2 API token has correct permissions
- Check bucket name matches environment variable
- Ensure endpoint URL is correct
- Check file type and size restrictions

## Next Steps

- [ ] Set up custom domain for R2 (optional)
- [ ] Configure ImageKit signed URLs for private images (if needed)
- [ ] Set up image cleanup jobs for deleted vehicles
- [ ] Monitor R2 storage usage and costs
- [ ] Configure ImageKit caching rules

## Resources

- [Convex R2 Component Docs](https://www.convex.dev/components/cloudflare-r2)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [ImageKit Docs](https://docs.imagekit.io/)
