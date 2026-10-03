export type City = {
  slug: string;
  name: string;
  code: string;
  x: number;
  y: number;
  sortOrder?: number;
};

export type Flight = {
  id?: number;
  originSlug: string;
  destinationSlug: string;
  cost: number;
  distance: number;
};

export type PlannerMode = "shortest" | "tour";
export type RouteAlgorithm = "dijkstra" | "floyd-warshall" | "tsp";
export type RouteRequest = {
  mode: PlannerMode;
  algorithm: RouteAlgorithm;
  fromSlug: string;
  toSlug: string;
  selectedSlugs: string[];
};

export type AlgorithmStep = {
  title: string;
  detail: string;
  selected?: string;
  distances?: Record<string, number | null>;
};

export type MatrixImprovement = {
  fromSlug: string;
  toSlug: string;
  before: number | null;
  after: number;
};

export type MatrixSnapshot = {
  stage: number;
  label: string;
  intermediate: string | null;
  matrix: Array<Array<number | null>>;
  improvements: MatrixImprovement[];
};

export type RoutePlan = {
  mode: PlannerMode;
  algorithm: RouteAlgorithm;
  fromSlug: string;
  toSlug: string;
  path: string[];
  visitOrder: string[];
  cost: number | null;
  distance: number | null;
  directFlight: { cost: number; distance: number } | null;
  steps: AlgorithmStep[];
  matrixHistory: MatrixSnapshot[];
  comparison: {
    fromSlug: string;
    toSlug: string;
    dijkstraCost: number | null;
    floydWarshallCost: number | null;
    dijkstraPath: string[];
    floydWarshallPath: string[];
  };
};

type InternalMatrix = number[][];
const INFINITY = Number.POSITIVE_INFINITY;

export function formatRupees(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function cityName(cities: City[], slug: string) {
  return cities.find((city) => city.slug === slug)?.name ?? slug;
}

function createAdjacency(cities: City[], flights: Flight[]) {
  const adjacency = new Map<string, Flight[]>();
  for (const city of cities) adjacency.set(city.slug, []);
  for (const flight of flights) adjacency.get(flight.originSlug)?.push(flight);
  return adjacency;
}

function printableDistances(cities: City[], distances: Map<string, number>) {
  return Object.fromEntries(
    cities.map((city) => {
      const value = distances.get(city.slug) ?? INFINITY;
      return [city.slug, Number.isFinite(value) ? value : null];
    }),
  );
}

function solveDijkstra(cities: City[], flights: Flight[], fromSlug: string, toSlug: string) {
  const adjacency = createAdjacency(cities, flights);
  const distances = new Map(cities.map((city) => [city.slug, INFINITY]));
  const distanceKm = new Map(cities.map((city) => [city.slug, 0]));
  const previous = new Map<string, string>();
  const remaining = new Set(cities.map((city) => city.slug));
  const steps: AlgorithmStep[] = [];

  distances.set(fromSlug, 0);
  steps.push({
    title: "Set the starting point",
    detail: `Give ${cityName(cities, fromSlug)} a cost of ₹0. Every other city starts at infinity.`,
    selected: fromSlug,
    distances: printableDistances(cities, distances),
  });

  while (remaining.size > 0) {
    let current: string | null = null;
    let best = INFINITY;
    for (const slug of remaining) {
      const candidate = distances.get(slug) ?? INFINITY;
      if (candidate < best) {
        current = slug;
        best = candidate;
      }
    }

    if (current === null || !Number.isFinite(best)) break;
    remaining.delete(current);
    steps.push({
      title: `Visit ${cityName(cities, current)}`,
      detail: `It has the smallest unvisited known cost: ${formatRupees(best)}.`,
      selected: current,
      distances: printableDistances(cities, distances),
    });

    if (current === toSlug) {
      steps.push({
        title: "Destination reached",
        detail: `The cheapest known route to ${cityName(cities, toSlug)} is ${formatRupees(best)}.`,
        selected: current,
        distances: printableDistances(cities, distances),
      });
      break;
    }

    for (const flight of adjacency.get(current) ?? []) {
      if (!remaining.has(flight.destinationSlug)) continue;
      const alternative = best + flight.cost;
      if (alternative < (distances.get(flight.destinationSlug) ?? INFINITY)) {
        const oldCost = distances.get(flight.destinationSlug) ?? INFINITY;
        distances.set(flight.destinationSlug, alternative);
        distanceKm.set(
          flight.destinationSlug,
          (distanceKm.get(current) ?? 0) + flight.distance,
        );
        previous.set(flight.destinationSlug, current);
        steps.push({
          title: `Relax ${cityName(cities, current)} → ${cityName(cities, flight.destinationSlug)}`,
          detail: `${formatRupees(best)} + ${formatRupees(flight.cost)} = ${formatRupees(alternative)}${Number.isFinite(oldCost) ? `, improving ${formatRupees(oldCost)}.` : ". First route discovered."}`,
          selected: current,
          distances: printableDistances(cities, distances),
        });
      }
    }
  }

  const cost = distances.get(toSlug) ?? INFINITY;
  const path: string[] = [];
  if (Number.isFinite(cost)) {
    let current: string | undefined = toSlug;
    while (current) {
      path.unshift(current);
      if (current === fromSlug) break;
      current = previous.get(current);
    }
    if (path[0] !== fromSlug) path.length = 0;
  }

  return {
    path,
    cost: Number.isFinite(cost) ? cost : null,
    distance: path.length ? distanceKm.get(toSlug) ?? 0 : null,
    steps,
  };
}

function matrixSnapshot(matrix: InternalMatrix): Array<Array<number | null>> {
  return matrix.map((row) => row.map((value) => (Number.isFinite(value) ? value : null)));
}

function solveFloydWarshall(cities: City[], flights: Flight[]) {
  const indexBySlug = new Map(cities.map((city, index) => [city.slug, index]));
  const size = cities.length;
  const matrix: InternalMatrix = Array.from({ length: size }, (_, from) =>
    Array.from({ length: size }, (_, to) => (from === to ? 0 : INFINITY)),
  );
  const next = Array.from({ length: size }, (_, from) =>
    Array.from({ length: size }, (_, to) => (from === to ? from : -1)),
  );

  for (const flight of flights) {
    const from = indexBySlug.get(flight.originSlug);
    const to = indexBySlug.get(flight.destinationSlug);
    if (from === undefined || to === undefined) continue;
    if (flight.cost < matrix[from][to]) {
      matrix[from][to] = flight.cost;
      next[from][to] = to;
    }
  }

  const history: MatrixSnapshot[] = [
    {
      stage: 0,
      label: "Direct flights only",
      intermediate: null,
      matrix: matrixSnapshot(matrix),
      improvements: [],
    },
  ];

  for (let via = 0; via < size; via += 1) {
    const improvements: MatrixImprovement[] = [];
    for (let from = 0; from < size; from += 1) {
      for (let to = 0; to < size; to += 1) {
        const alternative = matrix[from][via] + matrix[via][to];
        if (alternative < matrix[from][to]) {
          const before = matrix[from][to];
          matrix[from][to] = alternative;
          next[from][to] = next[from][via];
          improvements.push({
            fromSlug: cities[from].slug,
            toSlug: cities[to].slug,
            before: Number.isFinite(before) ? before : null,
            after: alternative,
          });
        }
      }
    }
    history.push({
      stage: via + 1,
      label: `Using ${cities[via].name} as a connection`,
      intermediate: cities[via].slug,
      matrix: matrixSnapshot(matrix),
      improvements,
    });
  }

  function getPath(fromSlug: string, toSlug: string) {
    const from = indexBySlug.get(fromSlug);
    const to = indexBySlug.get(toSlug);
    if (from === undefined || to === undefined || next[from][to] === -1) return [];
    const path = [fromSlug];
    let current = from;
    let hops = 0;
    while (current !== to && hops < size + 1) {
      current = next[current][to];
      if (current < 0) return [];
      path.push(cities[current].slug);
      hops += 1;
    }
    return current === to ? path : [];
  }

  return { matrix, history, getPath };
}

function measurePath(path: string[], flights: Flight[]) {
  let cost = 0;
  let distance = 0;
  for (let i = 1; i < path.length; i += 1) {
    const flight = flights.find(
      (candidate) => candidate.originSlug === path[i - 1] && candidate.destinationSlug === path[i],
    );
    if (!flight) return { cost: null, distance: null };
    cost += flight.cost;
    distance += flight.distance;
  }
  return { cost, distance };
}

function buildFloydSteps(
  fromSlug: string,
  toSlug: string,
  path: string[],
  cities: City[],
  history: MatrixSnapshot[],
): AlgorithmStep[] {
  const steps: AlgorithmStep[] = [
    {
      title: "Start with direct fares",
      detail: "The matrix begins with each direct flight cost; cities without a direct connection are infinity.",
    },
  ];
  for (const snapshot of history.slice(1)) {
    const improvement = snapshot.improvements.find(
      (item) => item.fromSlug === fromSlug && item.toSlug === toSlug,
    );
    if (improvement) {
      steps.push({
        title: `Try ${cityName(cities, snapshot.intermediate ?? "")}`,
        detail: `${cityName(cities, fromSlug)} → ${cityName(cities, toSlug)} improves from ${improvement.before === null ? "no known route" : formatRupees(improvement.before)} to ${formatRupees(improvement.after)} via ${cityName(cities, snapshot.intermediate ?? "")}.`,
        selected: snapshot.intermediate ?? undefined,
      });
    }
  }
  steps.push({
    title: "Read the finished matrix",
    detail: path.length
      ? `Following the next-city links gives ${path.map((slug) => cityName(cities, slug)).join(" → ")}. This is the shortest route across the whole network.`
      : `No route connects ${cityName(cities, fromSlug)} and ${cityName(cities, toSlug)}.`,
    selected: path.at(-1),
  });
  return steps;
}

function solveTsp(
  cities: City[],
  flights: Flight[],
  selectedSlugs: string[],
  startSlug: string,
  getPairPath: (from: string, to: string) => string[],
  costMatrix: InternalMatrix,
) {
  const indexBySlug = new Map(cities.map((city, index) => [city.slug, index]));
  const uniqueStops = [...new Set([startSlug, ...selectedSlugs])];
  const startIndex = indexBySlug.get(startSlug) ?? -1;
  if (startIndex < 0 || uniqueStops.length < 2 || uniqueStops.length > 7) {
    throw new Error("Select between two and seven cities, including a starting city.");
  }
  const stopIndices = uniqueStops
    .map((slug) => indexBySlug.get(slug))
    .filter((value): value is number => value !== undefined);
  if (stopIndices.length !== uniqueStops.length) {
    throw new Error("One of the selected cities is unavailable.");
  }

  let bestCost = INFINITY;
  let bestOrder: number[] = [];
  let completedTours = 0;
  const steps: AlgorithmStep[] = [
    {
      title: "Set the home city",
      detail: `Every tour starts and ends at ${cityName(cities, startSlug)}. The cost between stops uses their best known connecting route.`,
      selected: startSlug,
    },
  ];

  function visit(current: number, remaining: number[], costSoFar: number, order: number[]) {
    if (remaining.length === 0) {
      const returnCost = costMatrix[current][startIndex];
      if (!Number.isFinite(returnCost)) return;
      const tourCost = costSoFar + returnCost;
      completedTours += 1;
      if (tourCost < bestCost) {
        bestCost = tourCost;
        bestOrder = [...order, startIndex];
        if (steps.length < 9) {
          steps.push({
            title: `New best tour: ${formatRupees(tourCost)}`,
            detail: `${[...order, startIndex].map((index) => cities[index].name).join(" → ")} beats every tour checked so far.`,
            selected: cities[current].slug,
          });
        }
      }
      return;
    }

    for (const next of remaining) {
      const legCost = costMatrix[current][next];
      if (!Number.isFinite(legCost)) continue;
      visit(
        next,
        remaining.filter((candidate) => candidate !== next),
        costSoFar + legCost,
        [...order, next],
      );
    }
  }

  visit(startIndex, stopIndices.filter((index) => index !== startIndex), 0, [startIndex]);
  if (!Number.isFinite(bestCost) || bestOrder.length === 0) {
    throw new Error("No complete round trip connects all of the selected cities.");
  }

  const visitOrder = bestOrder.map((index) => cities[index].slug);
  const fullPath: string[] = [];
  for (let i = 1; i < visitOrder.length; i += 1) {
    const leg = getPairPath(visitOrder[i - 1], visitOrder[i]);
    fullPath.push(...(fullPath.length ? leg.slice(1) : leg));
  }
  const measured = measurePath(fullPath, flights);
  steps.push({
    title: "Close the loop",
    detail: `Checked ${completedTours} possible tours. Return to ${cityName(cities, startSlug)} to complete the minimum-cost round trip.`,
    selected: startSlug,
  });

  return {
    path: fullPath,
    visitOrder,
    cost: bestCost,
    distance: measured.distance,
    steps,
  };
}

export function calculateRoutePlan(request: RouteRequest, cities: City[], flights: Flight[]): RoutePlan {
  if (!cities.length) throw new Error("The flight network has no cities yet.");
  const fromSlug = request.fromSlug;
  const toSlug = request.toSlug;
  if (!cities.some((city) => city.slug === fromSlug)) throw new Error("Choose a valid starting city.");
  if (!cities.some((city) => city.slug === toSlug)) throw new Error("Choose a valid destination city.");

  const dijkstra = solveDijkstra(cities, flights, fromSlug, toSlug);
  const allPairs = solveFloydWarshall(cities, flights);
  const floydPath = allPairs.getPath(fromSlug, toSlug);
  const floydMetrics = measurePath(floydPath, flights);
  const direct = flights.find(
    (flight) => flight.originSlug === fromSlug && flight.destinationSlug === toSlug,
  );
  const comparisonToSlug =
    request.mode === "tour"
      ? request.selectedSlugs.find((slug) => slug !== fromSlug) ?? toSlug
      : toSlug;
  const comparisonDijkstra = solveDijkstra(cities, flights, fromSlug, comparisonToSlug);
  const comparisonFloydPath = allPairs.getPath(fromSlug, comparisonToSlug);
  const comparisonFloydMetrics = measurePath(comparisonFloydPath, flights);

  if (request.mode === "tour") {
    const tour = solveTsp(
      cities,
      flights,
      request.selectedSlugs,
      fromSlug,
      allPairs.getPath,
      allPairs.matrix,
    );
    return {
      mode: "tour",
      algorithm: "tsp",
      fromSlug,
      toSlug: fromSlug,
      ...tour,
      directFlight: null,
      matrixHistory: allPairs.history,
      comparison: {
        fromSlug,
        toSlug: comparisonToSlug,
        dijkstraCost: comparisonDijkstra.cost,
        floydWarshallCost: comparisonFloydMetrics.cost,
        dijkstraPath: comparisonDijkstra.path,
        floydWarshallPath: comparisonFloydPath,
      },
    };
  }

  const algorithm = request.algorithm === "floyd-warshall" ? "floyd-warshall" : "dijkstra";
  const path = algorithm === "dijkstra" ? dijkstra.path : floydPath;
  const cost = algorithm === "dijkstra" ? dijkstra.cost : floydMetrics.cost;
  const distance = algorithm === "dijkstra" ? dijkstra.distance : floydMetrics.distance;
  const steps =
    algorithm === "dijkstra"
      ? dijkstra.steps
      : buildFloydSteps(fromSlug, toSlug, floydPath, cities, allPairs.history);

  return {
    mode: "shortest",
    algorithm,
    fromSlug,
    toSlug,
    path,
    visitOrder: [],
    cost,
    distance,
    directFlight: direct ? { cost: direct.cost, distance: direct.distance } : null,
    steps,
    matrixHistory: allPairs.history,
    comparison: {
      fromSlug,
      toSlug: comparisonToSlug,
      dijkstraCost: comparisonDijkstra.cost,
      floydWarshallCost: comparisonFloydMetrics.cost,
      dijkstraPath: comparisonDijkstra.path,
      floydWarshallPath: comparisonFloydPath,
    },
  };
}
