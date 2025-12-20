# R2 CORS Troubleshooting Guide

## Error: "Failed to fetch" or "TypeError: Failed to fetch"

This error occurs when the browser cannot make a PUT request to R2 due to CORS (Cross-Origin Resource Sharing) restrictions.

## Step-by-Step Fix

### 1. Verify CORS Policy in Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Navigate to **R2 Object Storage**
3. Click on your bucket (e.g., `renegade-test`)
4. Click the **Settings** tab
5. Scroll down to **CORS Policy**
6. Click **Edit CORS Policy**

### 2. Apply the Correct CORS Configuration

Copy and paste this **exact** JSON configuration:

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

**Important:**
- Replace `https://yourdomain.com` with your actual production domain
- Keep `http://localhost:3000` if you're developing locally
- The `"AllowedHeaders": ["*"]` is **required** for signed URL uploads

### 3. Save and Wait

1. Click **Save** or **Update CORS Policy**
2. **Wait 10-30 seconds** for changes to propagate
3. Clear your browser cache or use an incognito/private window

### 4. Verify CORS is Working

Open your browser's Developer Tools (F12) and:

1. Go to the **Network** tab
2. Try uploading an image again
3. Look for:
   - An **OPTIONS** request (preflight) - should return `200 OK`
   - A **PUT** request - should return `200 OK` or `204 No Content`

If you see:
- **OPTIONS request fails (CORS error)**: CORS policy not applied correctly
- **PUT request fails (CORS error)**: CORS policy missing `PUT` method or wrong origin
- **Network error / Failed to fetch**: CORS policy not saved or not propagated

### 5. Common Issues

#### Issue: CORS policy saved but still getting errors

**Solution:**
- Wait longer (up to 1 minute) for Cloudflare to propagate changes
- Clear browser cache completely
- Try a different browser or incognito mode
- Verify the origin in the error message matches exactly (including `http://` vs `https://` and port number)

#### Issue: "AllowedHeaders" not working

**Solution:**
- Make sure you're using `"*"` (asterisk) as a string, not an array of individual headers
- Some browsers may require explicit headers. If `"*"` doesn't work, try:
  ```json
  "AllowedHeaders": [
    "Content-Type",
    "x-amz-content-sha256",
    "x-amz-date",
    "x-amz-security-token",
    "Authorization"
  ]
  ```

#### Issue: Only some uploads fail

**Solution:**
- This might be a rate limiting issue
- The code now uploads sequentially with delays
- Check if file size is within limits
- Verify R2 API token permissions

### 6. Test CORS Configuration

You can test if CORS is working by running this in your browser console (on `http://localhost:3000`):

```javascript
// Replace with your actual R2 endpoint and a test signed URL
fetch('YOUR_R2_SIGNED_URL', {
  method: 'PUT',
  headers: {
    'Content-Type': 'text/plain'
  },
  body: 'test'
})
.then(response => {
  console.log('CORS is working!', response.status)
})
.catch(error => {
  console.error('CORS error:', error)
})
```

### 7. Verify R2 Environment Variables

Make sure all R2 environment variables are set in Convex:

```bash
cd packages/backend
npx convex env ls
```

You should see:
- `R2_BUCKET`
- `R2_TOKEN`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT`

If any are missing, set them:
```bash
npx convex env set R2_BUCKET <your-bucket-name>
npx convex env set R2_TOKEN <your-token>
npx convex env set R2_ACCESS_KEY_ID <your-access-key-id>
npx convex env set R2_SECRET_ACCESS_KEY <your-secret-access-key>
npx convex env set R2_ENDPOINT <your-endpoint>
```

### 8. Check Browser Console for Detailed Errors

The improved error handling will now show:
- Which image failed
- File name and size
- Detailed error message

Look for messages like:
- `Uploading image 1/3: photo.jpg (2.5 MB)`
- `Failed to upload image 1 (photo.jpg): ...`

## Still Not Working?

1. **Check Convex Logs**: Look at your Convex dashboard for any errors when generating upload URLs
2. **Check Network Tab**: See the exact request/response in browser DevTools
3. **Verify Bucket Name**: Make sure the bucket name in CORS matches your actual bucket
4. **Try Different File**: Test with a small image file first
5. **Check R2 API Token**: Verify the token hasn't expired and has correct permissions

## Quick Checklist

- [ ] CORS policy saved in Cloudflare dashboard
- [ ] CORS policy includes `http://localhost:3000` in `AllowedOrigins`
- [ ] CORS policy includes `PUT` and `OPTIONS` in `AllowedMethods`
- [ ] CORS policy includes `"*"` in `AllowedHeaders`
- [ ] Waited 10-30 seconds after saving CORS policy
- [ ] Cleared browser cache or using incognito mode
- [ ] All R2 environment variables set in Convex
- [ ] R2 API token has correct permissions
- [ ] Checked browser console for detailed error messages
- [ ] Checked Network tab for failed requests



