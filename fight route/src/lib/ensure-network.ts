import { db } from "@/db";
import { cities, flights } from "@/db/schema";
import { NETWORK_CITIES, NETWORK_FLIGHTS } from "@/lib/network-seed";

export async function ensureNetworkSeeded() {
  const existingCities = await db.select({ slug: cities.slug }).from(cities).limit(1);

  if (existingCities.length === 0) {
    await db.insert(cities).values([...NETWORK_CITIES]).onConflictDoNothing();
  }

  const existingFlights = await db.select({ id: flights.id }).from(flights).limit(1);

  if (existingFlights.length === 0) {
    await db.insert(flights).values(NETWORK_FLIGHTS).onConflictDoNothing();
  }
}
