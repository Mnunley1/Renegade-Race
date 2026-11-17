# Return evidence access and release

Return notes and submitted photos belong to the renter and owner on the reservation. A support administrator who is not a participant can moderate a dispute without seeing its return form. Individual, list and dispute queries check the reservation before returning a form.

The web client sends return images to the Convex HTTP action at `/return-photo`. It uses a Clerk token for both uploads and downloads. New images are stored in Convex file storage. The client receives a reservation-scoped evidence reference. It renders the authenticated response as a temporary browser image and drops it when the session changes. `NEXT_PUBLIC_CONVEX_SITE_URL` can specify the HTTP action origin for a custom Convex hostname.

## Moving existing R2 evidence

Coordinate the backend and web cutover. Earlier web builds use a public R2 upload function and construct public image URLs. During the transition, the new backend can serve a verified historical attachment by fetching it from R2 with server credentials. Participants see a slot reference instead of the original key. References with unverifiable ownership need individual review.

1. In a restricted operator session, page through the internal `returnEvidence:inventoryLegacy` query. Start with an empty argument object and pass the returned `continueCursor` as `cursor` until `isDone`. Keep keys and subject identifiers in restricted storage.
2. For each verified entry, run the internal `returnEvidence:migrateLegacyPhoto` action with its `completionId` and `key`. It copies the image, checks that the original attachment still belongs to the reservation and submitting user, replaces the reference, and queues removal of the old R2 object. Resolve manual or unavailable entries against trusted upload records before removing any object.
3. Verify that the renter and owner receive the same image bytes from the authenticated endpoint. Verify that an unrelated account and a signed-out client receive no bytes. Check that removal completed at the origin and that previously issued upload URLs can no longer recreate a publicly readable object.
4. Inventory the historical `images/returns/` namespace for unattached objects as well. Reconcile them before deletion or move them into private storage. Close public delivery of this namespace through every enabled origin and proxy, including the R2 public hostname, custom domains and ImageKit. Purge copies from the CDN and the old Next.js image optimizer. Check known original URLs and optimized variants without credentials. Removing an origin object alone does not invalidate an existing cached response.

Record results and unresolved entries in restricted release records. Use aggregate counts in Linear. Historical URLs may continue to serve until the origin and cache work is complete.
