import { db } from "@/db";
import { cities as citiesTable, flights as flightsTable } from "@/db/schema";
import { ensureNetworkSeeded } from "@/lib/ensure-network";
import { calculateRoutePlan, type City, type Flight } from "@/lib/route-algorithms";
import RoutePlanner from "./route-planner";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureNetworkSeeded();
  const [cityRows, flightRows] = await Promise.all([
    db.select().from(citiesTable).orderBy(citiesTable.sortOrder),
    db.select().from(flightsTable).orderBy(flightsTable.id),
  ]);

  const networkCities: City[] = cityRows;
  const networkFlights: Flight[] = flightRows;
  const initialPlan = calculateRoutePlan(
    {
      mode: "shortest",
      algorithm: "dijkstra",
      fromSlug: "hyderabad",
      toSlug: "kolkata",
      selectedSlugs: [],
    },
    networkCities,
    networkFlights,
  );

  return (
    <RoutePlanner
      initialCities={networkCities}
      initialFlights={networkFlights}
      initialPlan={initialPlan}
    />
  );
}
