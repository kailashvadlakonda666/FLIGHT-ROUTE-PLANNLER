import { db } from "@/db";
import { cities, flights } from "@/db/schema";
import { ensureNetworkSeeded } from "@/lib/ensure-network";
import {
  calculateRoutePlan,
  type PlannerMode,
  type RouteAlgorithm,
  type RouteRequest,
} from "@/lib/route-algorithms";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const mode: PlannerMode = body.mode === "tour" ? "tour" : "shortest";
    const algorithm: RouteAlgorithm =
      body.algorithm === "floyd-warshall" ? "floyd-warshall" : mode === "tour" ? "tsp" : "dijkstra";
    const fromSlug = typeof body.fromSlug === "string" ? body.fromSlug : "";
    const toSlug = typeof body.toSlug === "string" ? body.toSlug : fromSlug;
    const selectedSlugs = Array.isArray(body.selectedSlugs)
      ? [...new Set(body.selectedSlugs.filter((slug): slug is string => typeof slug === "string"))]
      : [];

    await ensureNetworkSeeded();
    const [cityRows, flightRows] = await Promise.all([
      db.select().from(cities).orderBy(cities.sortOrder),
      db.select().from(flights).orderBy(flights.id),
    ]);

    const routeRequest: RouteRequest = {
      mode,
      algorithm,
      fromSlug,
      toSlug,
      selectedSlugs,
    };
    const plan = calculateRoutePlan(routeRequest, cityRows, flightRows);
    return Response.json(plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to calculate this route.";
    return Response.json({ error: message }, { status: 400 });
  }
}
