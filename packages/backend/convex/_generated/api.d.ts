/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as availability from "../availability.js";
import type * as conversations from "../conversations.js";
import type * as disputes from "../disputes.js";
import type * as driverProfiles from "../driverProfiles.js";
import type * as emails from "../emails.js";
import type * as favorites from "../favorites.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as rentalCompletions from "../rentalCompletions.js";
import type * as reservations from "../reservations.js";
import type * as reviews from "../reviews.js";
import type * as seed from "../seed.js";
import type * as stripe from "../stripe.js";
import type * as teamApplications from "../teamApplications.js";
import type * as teams from "../teams.js";
import type * as tracks from "../tracks.js";
import type * as users from "../users.js";
import type * as vehicleAnalytics from "../vehicleAnalytics.js";
import type * as vehicles from "../vehicles.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  availability: typeof availability;
  conversations: typeof conversations;
  disputes: typeof disputes;
  driverProfiles: typeof driverProfiles;
  emails: typeof emails;
  favorites: typeof favorites;
  http: typeof http;
  messages: typeof messages;
  rentalCompletions: typeof rentalCompletions;
  reservations: typeof reservations;
  reviews: typeof reviews;
  seed: typeof seed;
  stripe: typeof stripe;
  teamApplications: typeof teamApplications;
  teams: typeof teams;
  tracks: typeof tracks;
  users: typeof users;
  vehicleAnalytics: typeof vehicleAnalytics;
  vehicles: typeof vehicles;
}>;
declare const fullApiWithMounts: typeof fullApi;

export declare const api: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApiWithMounts,
  FunctionReference<any, "internal">
>;

export declare const components: {};
