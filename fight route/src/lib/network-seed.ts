export const NETWORK_CITIES = [
  { slug: "hyderabad", name: "Hyderabad", code: "HYD", x: 397, y: 266, sortOrder: 0 },
  { slug: "mumbai", name: "Mumbai", code: "BOM", x: 250, y: 255, sortOrder: 1 },
  { slug: "delhi", name: "Delhi", code: "DEL", x: 345, y: 91, sortOrder: 2 },
  { slug: "kolkata", name: "Kolkata", code: "CCU", x: 566, y: 181, sortOrder: 3 },
  { slug: "bengaluru", name: "Bengaluru", code: "BLR", x: 357, y: 353, sortOrder: 4 },
  { slug: "chennai", name: "Chennai", code: "MAA", x: 453, y: 374, sortOrder: 5 },
  { slug: "pune", name: "Pune", code: "PNQ", x: 288, y: 274, sortOrder: 6 },
  { slug: "jaipur", name: "Jaipur", code: "JAI", x: 280, y: 143, sortOrder: 7 },
] as const;

const CONNECTIONS: ReadonlyArray<readonly [string, string, number, number]> = [
  ["hyderabad", "delhi", 5000, 1550],
  ["hyderabad", "mumbai", 4000, 620],
  ["mumbai", "delhi", 4500, 1150],
  ["delhi", "kolkata", 5500, 1300],
  ["hyderabad", "bengaluru", 3200, 570],
  ["bengaluru", "chennai", 2500, 350],
  ["hyderabad", "chennai", 3800, 630],
  ["kolkata", "chennai", 7000, 1650],
  ["delhi", "jaipur", 2200, 280],
  ["mumbai", "bengaluru", 4100, 850],
  ["mumbai", "pune", 1800, 150],
  ["pune", "bengaluru", 2800, 840],
  ["jaipur", "mumbai", 4800, 1140],
  ["jaipur", "hyderabad", 4600, 1250],
];

export const NETWORK_FLIGHTS = CONNECTIONS.flatMap(
  ([originSlug, destinationSlug, cost, distance]) => [
    { originSlug, destinationSlug, cost, distance },
    { originSlug: destinationSlug, destinationSlug: originSlug, cost, distance },
  ],
);
