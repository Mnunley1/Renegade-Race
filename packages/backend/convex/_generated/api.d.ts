/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as availability from "../availability.js";
import type * as conversations from "../conversations.js";
import type * as driverProfiles from "../driverProfiles.js";
import type * as favorites from "../favorites.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as rentalCompletions from "../rentalCompletions.js";
import type * as reservations from "../reservations.js";
import type * as reviews from "../reviews.js";
import type * as stripe from "../stripe.js";
import type * as teamApplications from "../teamApplications.js";
import type * as teams from "../teams.js";
import type * as tracks from "../tracks.js";
import type * as users from "../users.js";
import type * as vehicles from "../vehicles.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  availability: typeof availability;
  conversations: typeof conversations;
  driverProfiles: typeof driverProfiles;
  favorites: typeof favorites;
  http: typeof http;
  messages: typeof messages;
  rentalCompletions: typeof rentalCompletions;
  reservations: typeof reservations;
  reviews: typeof reviews;
  stripe: typeof stripe;
  teamApplications: typeof teamApplications;
  teams: typeof teams;
  tracks: typeof tracks;
  users: typeof users;
  vehicles: typeof vehicles;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
