"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  AlgorithmStep,
  City,
  Flight,
  MatrixSnapshot,
  PlannerMode,
  RouteAlgorithm,
  RoutePlan,
  RouteRequest,
} from "@/lib/route-algorithms";
import { formatRupees } from "@/lib/route-algorithms";

type PageKey = "planner" | "lab" | "saved";
type IconName =
  | "compass"
  | "route"
  | "matrix"
  | "bookmark"
  | "arrow"
  | "plane"
  | "swap"
  | "sparkle"
  | "pin"
  | "chevron"
  | "check"
  | "clock"
  | "trash"
  | "plus"
  | "close"
  | "refresh"
  | "globe"
  | "target"
  | "bars"
  | "external";

type SavedRoute = {
  id: string;
  request: RouteRequest;
  cost: number | null;
  distance: number | null;
  path: string[];
  visitOrder: string[];
  savedAt: string;
};

type RoutePlannerProps = {
  initialCities: City[];
  initialFlights: Flight[];
  initialPlan: RoutePlan;
};

const iconShapes: Record<IconName, ReactNode> = {
  compass: <><circle cx="12" cy="12" r="8.7" /><path d="m15.7 8.3-2.4 5-5 2.4 2.4-5 5-2.4Z" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2" /></>,
  route: <><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8.2 18h2.2a3.3 3.3 0 0 0 3.3-3.3v-5.4A3.3 3.3 0 0 1 17 6h1" /><path d="m14 9 3-3 3 3" /></>,
  matrix: <><rect x="3" y="3" width="18" height="18" rx="2.5" /><path d="M3 9h18M3 15h18M9 3v18m6-18v18" /></>,
  bookmark: <><path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-3.7L6 21V4.8Z" /></>,
  arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  plane: <><path d="m21 3-7.2 18-3.3-7.5L3 10.2 21 3Z" /><path d="m10.5 13.5 4-4" /></>,
  swap: <><path d="M16 3l4 4-4 4M4 7h16M8 21l-4-4 4-4m12 4H4" /></>,
  sparkle: <><path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.4" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.4 2" /></>,
  trash: <><path d="M4 7h16m-10 4v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
  plus: <path d="M12 5v14m-7-7h14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  refresh: <><path d="M20 11a8.1 8.1 0 0 0-14.9-3L3 11" /><path d="M3 5v6h6m-5 2a8.1 8.1 0 0 0 14.9 3L21 13" /><path d="M21 19v-6h-6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18m0-18a15 15 0 0 0 0 18" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  bars: <><path d="M4 19V9m5 10V5m5 14v-7m5 7V3" /></>,
  external: <><path d="M14 4h6v6m0-6-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></>,
};

function Icon({ name, size = 18, strokeWidth = 1.8 }: { name: IconName; size?: number; strokeWidth?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconShapes[name]}
    </svg>
  );
}

function cityLabel(cities: City[], slug: string) {
  return cities.find((city) => city.slug === slug)?.name ?? slug;
}

function requestFor(
  mode: PlannerMode,
  algorithm: RouteAlgorithm,
  fromSlug: string,
  toSlug: string,
  selectedSlugs: string[],
): RouteRequest {
  return {
    mode,
    algorithm: mode === "tour" ? "tsp" : algorithm,
    fromSlug,
    toSlug: mode === "tour" ? fromSlug : toSlug,
    selectedSlugs: mode === "tour" ? selectedSlugs : [],
  };
}

function edgeKey(a: string, b: string) {
  return [a, b].sort().join("--");
}

function curvePath(a: City, b: City, index: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const bend = index % 2 === 0 ? 9 : -9;
  const cx = (a.x + b.x) / 2 - (dy / length) * bend;
  const cy = (a.y + b.y) / 2 + (dx / length) * bend;
  return `M ${a.x} ${a.y} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x} ${b.y}`;
}

function RouteMap({
  cities,
  flights,
  path,
}: {
  cities: City[];
  flights: Flight[];
  path: string[];
}) {
  const cityIndex = useMemo(() => new Map(cities.map((city, index) => [city.slug, index])), [cities]);
  const uniqueFlights = useMemo(() => {
    const seen = new Set<string>();
    return flights.filter((flight) => {
      const key = edgeKey(flight.originSlug, flight.destinationSlug);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [flights]);
  const activeEdges = new Set(
    path.slice(1).map((slug, index) => edgeKey(path[index], slug)),
  );
  const onPath = new Set(path);
  const labelOffsets: Record<string, { dx: number; dy: number; anchor: "start" | "end" }> = {
    hyderabad: { dx: 14, dy: 20, anchor: "start" },
    mumbai: { dx: -13, dy: 22, anchor: "end" },
    delhi: { dx: 0, dy: -19, anchor: "middle" as "start" },
    kolkata: { dx: 14, dy: -9, anchor: "start" },
    bengaluru: { dx: -15, dy: 22, anchor: "end" },
    chennai: { dx: 13, dy: 19, anchor: "start" },
    pune: { dx: 13, dy: -8, anchor: "start" },
    jaipur: { dx: -13, dy: -11, anchor: "end" },
  };

  return (
    <section className="network-card" aria-label="Interactive flight network map">
      <div className="network-card-head">
        <div>
          <span className="micro-label">THE FLIGHT NETWORK</span>
          <h2>India, connected.</h2>
        </div>
        <div className="network-live"><span className="live-dot" />LIVE NETWORK</div>
      </div>
      <div className="map-canvas">
        <div className="map-map-label"><Icon name="globe" size={13} /> INDIA · DOMESTIC ROUTES</div>
        <div className="map-key"><span className="key-line" /> YOUR OPTIMAL ROUTE <span className="key-line key-line-muted" /> FLIGHT CONNECTION</div>
        <svg className="route-map-svg" viewBox="0 0 720 440" role="img" aria-label="Flight network map with the selected route highlighted">
          <defs>
            <pattern id="map-grid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#e9eee8" strokeWidth="0.7" />
            </pattern>
            <linearGradient id="land-fill" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="#edf3e9" />
              <stop offset="1" stopColor="#e7eee5" />
            </linearGradient>
            <filter id="route-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <rect width="720" height="440" fill="url(#map-grid)" />
          <path
            className="india-outline"
            d="M249 61 287 51 321 62 355 75 388 78 419 92 448 94 471 109 490 116 515 131 529 146 510 159 488 157 480 176 464 190 460 214 443 237 433 259 424 286 414 311 399 336 386 365 371 388 357 383 348 359 333 336 324 314 308 295 291 273 277 253 266 233 247 220 236 204 220 188 210 167 218 147 207 126 219 106 227 86Z"
          />
          <path className="map-river" d="M288 147c38 13 62 23 97 34 29 9 55 13 77 20" />
          <path className="map-river map-river-soft" d="M292 194c39 21 63 37 91 56" />
          {uniqueFlights.map((flight, index) => {
            const startIndex = cityIndex.get(flight.originSlug);
            const endIndex = cityIndex.get(flight.destinationSlug);
            const start = cities.find((city) => city.slug === flight.originSlug);
            const end = cities.find((city) => city.slug === flight.destinationSlug);
            if (!start || !end || startIndex === undefined || endIndex === undefined) return null;
            const active = activeEdges.has(edgeKey(flight.originSlug, flight.destinationSlug));
            return (
              <g key={edgeKey(flight.originSlug, flight.destinationSlug)}>
                <path d={curvePath(start, end, index)} className="flight-line" />
                {active && <path d={curvePath(start, end, index)} className="flight-line-active-glow" />}
                {active && <path d={curvePath(start, end, index)} className="flight-line-active" />}
              </g>
            );
          })}
          {cities.map((city) => {
            const active = onPath.has(city.slug);
            const offset = labelOffsets[city.slug] ?? { dx: 12, dy: -12, anchor: "start" as const };
            const x = city.x + offset.dx;
            const y = city.y + offset.dy;
            return (
              <g key={city.slug} className={active ? "map-city map-city-active" : "map-city"}>
                {active && <circle cx={city.x} cy={city.y} r="17" className="map-marker-halo" />}
                <circle cx={city.x} cy={city.y} r={active ? 7 : 5.3} className="map-marker" />
                <circle cx={city.x} cy={city.y} r="2" className="map-marker-core" />
                <text x={x} y={y} textAnchor={offset.anchor} className="map-city-code">{city.code}</text>
                <text x={x} y={y + 12} textAnchor={offset.anchor} className="map-city-name">{city.name}</text>
              </g>
            );
          })}
        </svg>
        <div className="map-route-caption">
          <span className="caption-route-icon"><Icon name="route" size={15} /></span>
          <span>{path.length ? path.map((slug) => cities.find((city) => city.slug === slug)?.code ?? slug).join("  →  ") : "Choose a route to light up the network"}</span>
          <span className="map-caption-label">{path.length > 1 ? `${path.length - 1} LEGS` : "READY"}</span>
        </div>
      </div>
      <div className="network-footnote">
        <span><span className="legend-dot legend-dot-route" /> Optimized connection</span>
        <span><span className="legend-dot" /> Available flight</span>
        <span className="map-footnote-right"><Icon name="pin" size={13} /> ROUTES TO GO PLACES</span>
      </div>
    </section>
  );
}

function RouteStops({ plan, cities }: { plan: RoutePlan; cities: City[] }) {
  const stops = plan.mode === "tour" ? plan.visitOrder : plan.path;
  if (!stops.length) {
    return <div className="no-route-note"><Icon name="pin" size={17} /> No connected route was found. Try a different pair of cities.</div>;
  }
  return (
    <div className="route-stops" aria-label="Calculated route">
      {stops.map((slug, index) => {
        const city = cities.find((item) => item.slug === slug);
        const isHome = plan.mode === "tour" && (index === 0 || index === stops.length - 1);
        return (
          <div className="route-stop-group" key={`${slug}-${index}`}>
            {index > 0 && <div className="route-stop-connector"><span /><Icon name="plane" size={13} /></div>}
            <div className={`route-stop ${index === 0 || isHome ? "route-stop-home" : ""}`}>
              <span className="route-stop-code">{city?.code ?? slug.slice(0, 3).toUpperCase()}</span>
              <span className="route-stop-city">{city?.name ?? slug}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Walkthrough({
  steps,
  cities,
  algorithm,
}: {
  steps: AlgorithmStep[];
  cities: City[];
  algorithm: RouteAlgorithm;
}) {
  const [expanded, setExpanded] = useState(true);
  const algorithmLabel = algorithm === "tsp" ? "Travelling Salesperson" : algorithm === "floyd-warshall" ? "Floyd–Warshall" : "Dijkstra";
  return (
    <section className="walkthrough-card">
      <button className="walkthrough-heading" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="walkthrough-icon"><Icon name="sparkle" size={17} /></span>
        <span className="walkthrough-heading-copy"><span className="micro-label">UNDER THE HOOD</span><strong>How {algorithmLabel} found it</strong></span>
        <span className="walkthrough-count">{steps.length} STEPS</span>
        <span className={`expand-chevron ${expanded ? "expanded" : ""}`}><Icon name="chevron" size={16} /></span>
      </button>
      {expanded && (
        <div className="walkthrough-steps">
          {steps.map((step, index) => (
            <div className="walkthrough-step" key={`${step.title}-${index}`}>
              <span className={`step-number ${index === steps.length - 1 ? "step-number-last" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
              <div className="step-content">
                <div className="step-title-row"><strong>{step.title}</strong>{step.selected && <span className="step-selected">Selected · {cityLabel(cities, step.selected)}</span>}</div>
                <p>{step.detail}</p>
                {step.distances && (
                  <div className="known-costs">
                    <span className="known-costs-label">KNOWN COSTS</span>
                    {cities.filter((city) => step.distances?.[city.slug] !== null).slice(0, 5).map((city) => (
                      <span className="known-cost-chip" key={city.slug}><b>{city.code}</b> {formatRupees(step.distances?.[city.slug] ?? 0)}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MatrixLab({
  plan,
  cities,
  stage,
  setStage,
}: {
  plan: RoutePlan;
  cities: City[];
  stage: number;
  setStage: (stage: number) => void;
}) {
  const history = plan.matrixHistory;
  const safeStage = Math.max(0, Math.min(stage, history.length - 1));
  const current: MatrixSnapshot = history[safeStage];
  const previous = safeStage > 0 ? history[safeStage - 1] : null;
  const highlight = current.improvements.find((item) => item.before !== null) ?? current.improvements[0];
  const comparison = plan.comparison;
  const from = cityLabel(cities, comparison.fromSlug);
  const to = cityLabel(cities, comparison.toSlug);

  return (
    <div className="lab-page">
      <div className="page-heading lab-heading">
        <div className="page-heading-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> THE ALGORITHM LAB</div>
          <h1>Same map.<br /><span>Different thinking.</span></h1>
          <p>Three classic algorithms. Three very different ways to make your next trip better.</p>
        </div>
        <div className="complexity-note"><span className="complexity-orb"><Icon name="bars" size={18} /></span><div><span>THE WHOLE GRAPH, IN VIEW</span><strong>8 cities · 28 connections</strong><small>Real calculations on the live flight network</small></div></div>
      </div>

      <div className="algorithm-cards">
        <article className="algorithm-card algorithm-card-featured">
          <div className="algorithm-card-top"><span className="algorithm-icon"><Icon name="route" size={19} /></span><span className="algorithm-tag">ONE TO ONE</span></div>
          <h2>Dijkstra</h2>
          <p>Finds the cheapest route between one starting city and one destination. Visits the most promising city next.</p>
          <div className="algorithm-card-bottom"><span>Best for</span><strong>A → B · Cheapest fare</strong><span className="complexity">O((V + E) log V)</span></div>
        </article>
        <article className="algorithm-card algorithm-card-featured">
          <div className="algorithm-card-top"><span className="algorithm-icon algorithm-icon-sage"><Icon name="matrix" size={18} /></span><span className="algorithm-tag">ALL TO ALL</span></div>
          <h2>Floyd–Warshall</h2>
          <p>Calculates shortest paths for every pair of cities. Each city gets a chance to be a useful connection.</p>
          <div className="algorithm-card-bottom"><span>Best for</span><strong>Every city pair · Full matrix</strong><span className="complexity">O(V³)</span></div>
        </article>
        <article className="algorithm-card algorithm-card-featured">
          <div className="algorithm-card-top"><span className="algorithm-icon algorithm-icon-lime"><Icon name="globe" size={18} /></span><span className="algorithm-tag">ROUND TRIP</span></div>
          <h2>The TSP</h2>
          <p>Searches the possible visit orders to find the minimum-cost loop through all your selected stops.</p>
          <div className="algorithm-card-bottom"><span>Best for</span><strong>Many stops · Return to start</strong><span className="complexity">Exact search · ≤ 7 cities</span></div>
        </article>
      </div>

      <section className="comparison-panel">
        <div className="comparison-head">
          <div><span className="micro-label">A FAIR FIGHT, SAME INPUT</span><h2>{from} <span className="heading-arrow">→</span> {to}</h2><p>Different strategies, identical fares and flight connections.</p></div>
          <div className="same-answer-pill"><Icon name="check" size={15} /> SAME OPTIMAL FARE</div>
        </div>
        <div className="comparison-results">
          <div className="comparison-result"><span className="compare-algorithm"><span className="compare-dot compare-dot-dijkstra" /> Dijkstra</span><strong>{comparison.dijkstraCost === null ? "No route" : formatRupees(comparison.dijkstraCost)}</strong><small>{comparison.dijkstraPath.length ? comparison.dijkstraPath.map((slug) => cities.find((city) => city.slug === slug)?.code).join(" → ") : "No connected route"}</small></div>
          <span className="compare-equals">=</span>
          <div className="comparison-result"><span className="compare-algorithm"><span className="compare-dot compare-dot-floyd" /> Floyd–Warshall</span><strong>{comparison.floydWarshallCost === null ? "No route" : formatRupees(comparison.floydWarshallCost)}</strong><small>{comparison.floydWarshallPath.length ? comparison.floydWarshallPath.map((slug) => cities.find((city) => city.slug === slug)?.code).join(" → ") : "No connected route"}</small></div>
          <div className="compare-insight"><span className="insight-icon"><Icon name="sparkle" size={16} /></span><p>One asks “what’s the best way there?” The other asks “what’s the best way <em>everywhere?</em>”</p></div>
        </div>
      </section>

      <section className="matrix-panel">
        <div className="matrix-panel-head">
          <div><span className="micro-label">WATCH THE MATRIX EVOLVE</span><h2>Every connection, reconsidered.</h2><p>Floyd–Warshall lets each city become a possible middle stop. Watch the fares update.</p></div>
          <span className="matrix-currency">ALL FARES IN INR · ₹</span>
        </div>
        <div className="matrix-stage-control">
          <div className="stage-copy"><span>STEP {String(safeStage).padStart(2, "0")} <span>/ {String(history.length - 1).padStart(2, "0")}</span></span><strong>{current.label}</strong></div>
          <div className="stage-slider-wrap"><input aria-label="Floyd-Warshall matrix stage" type="range" min={0} max={history.length - 1} value={safeStage} onChange={(event) => setStage(Number(event.target.value))} /><div className="slider-labels"><span>Direct fares</span><span>All connections optimized</span></div></div>
          <div className="stage-buttons"><button className="stage-button" onClick={() => setStage(Math.max(0, safeStage - 1))} disabled={safeStage === 0} aria-label="Previous matrix step">‹</button><button className="stage-button" onClick={() => setStage(Math.min(history.length - 1, safeStage + 1))} disabled={safeStage === history.length - 1} aria-label="Next matrix step">›</button></div>
        </div>
        <div className="matrix-scroll">
          <table className="fare-matrix"><thead><tr><th className="matrix-corner">FROM <span>TO ↓</span></th>{cities.map((city) => <th key={city.slug}><span>{city.code}</span><small>{city.name}</small></th>)}</tr></thead><tbody>{cities.map((fromCity, row) => <tr key={fromCity.slug}><th scope="row"><span>{fromCity.code}</span><small>{fromCity.name}</small></th>{cities.map((toCity, column) => {
            const cost = current.matrix[row]?.[column] ?? null;
            const oldCost = previous?.matrix[row]?.[column] ?? null;
            const changed = previous !== null && cost !== oldCost;
            return <td key={toCity.slug} className={`${cost === null ? "matrix-unreachable" : ""} ${row === column ? "matrix-diagonal" : ""} ${changed ? "matrix-updated" : ""}`}>{cost === null ? "—" : cost === 0 ? "·" : cost.toLocaleString("en-IN")}</td>;
          })}</tr>)}</tbody></table>
        </div>
        <div className="matrix-footnote"><span className="matrix-update-swatch" /> Cells updated at this step <span className="matrix-footnote-right">{current.improvements.length} {current.improvements.length === 1 ? "improvement" : "improvements"}</span></div>
        {highlight && <div className="matrix-explanation"><span className="matrix-explanation-icon"><Icon name="sparkle" size={16} /></span><span><strong>The “aha” moment</strong>{highlight.before === null ? ` ${cityLabel(cities, highlight.fromSlug)} → ${cityLabel(cities, highlight.toSlug)} is now reachable for ${formatRupees(highlight.after)} via ${cityLabel(cities, current.intermediate ?? "")}.` : ` ${cityLabel(cities, highlight.fromSlug)} → ${cityLabel(cities, highlight.toSlug)} just got cheaper: ${formatRupees(highlight.before)} → ${formatRupees(highlight.after)}, using ${cityLabel(cities, current.intermediate ?? "")} as the middle stop.`}</span></div>}
        {!highlight && <div className="matrix-explanation"><span className="matrix-explanation-icon"><Icon name="sparkle" size={16} /></span><span><strong>The “aha” moment</strong> No fares improved through {current.intermediate ? cityLabel(cities, current.intermediate) : "a middle city"} at this step. Keep going — every pair gets checked.</span></div>}
      </section>

      <div className="lab-bottom-note"><span className="lab-bottom-icon"><Icon name="target" size={17} /></span><div><strong>Why keep all three?</strong><p>Dijkstra is quick for one journey, Floyd–Warshall is reusable across every pair, and TSP handles the extra challenge of planning a whole loop.</p></div><button onClick={() => setStage(history.length - 1)}>Show final matrix <Icon name="arrow" size={15} /></button></div>
    </div>
  );
}

function SavedPage({
  savedRoutes,
  cities,
  onOpen,
  onRemove,
}: {
  savedRoutes: SavedRoute[];
  cities: City[];
  onOpen: (route: SavedRoute) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="saved-page">
      <div className="page-heading saved-heading"><div className="page-heading-copy"><div className="eyebrow"><span className="eyebrow-dot" /> YOUR LITTLE BLACK BOOK</div><h1>Good routes.<br /><span>Saved for later.</span></h1><p>Keep your favorite routes close. Pick up right where you left off.</p></div><div className="saved-count"><span>{String(savedRoutes.length).padStart(2, "0")}</span><small>SAVED<br />ROUTES</small></div></div>
      {savedRoutes.length === 0 ? (
        <section className="empty-saves"><span className="empty-bookmark"><Icon name="bookmark" size={23} /></span><h2>A clean slate.</h2><p>Find a route you love and save it here. We’ll keep it right in this browser.</p><button onClick={() => onOpen({ id: "new", request: { mode: "shortest", algorithm: "dijkstra", fromSlug: "hyderabad", toSlug: "kolkata", selectedSlugs: [] }, cost: null, distance: null, path: [], visitOrder: [], savedAt: "" })}>Plan your first route <Icon name="arrow" size={15} /></button></section>
      ) : (
        <div className="saved-grid">{savedRoutes.map((route, index) => {
          const display = route.request.mode === "tour" ? route.visitOrder : route.path;
          return <article className="saved-card" key={route.id}><div className="saved-card-top"><span className="saved-card-index">ROUTE {String(index + 1).padStart(2, "0")}</span><button className="icon-button remove-saved" aria-label="Remove saved route" onClick={() => onRemove(route.id)}><Icon name="trash" size={16} /></button></div><div className="saved-route-line">{display.slice(0, 5).map((slug, itemIndex) => <span key={`${slug}-${itemIndex}`}>{itemIndex > 0 && <b>→</b>}{cities.find((city) => city.slug === slug)?.code ?? slug}</span>)}{display.length > 5 && <small>+{display.length - 5}</small>}</div><div className="saved-card-details"><div><span>ESTIMATED COST</span><strong>{route.cost === null ? "—" : formatRupees(route.cost)}</strong></div><div><span>OPTIMIZED WITH</span><strong>{route.request.mode === "tour" ? "TSP · Round trip" : route.request.algorithm === "floyd-warshall" ? "Floyd–Warshall" : "Dijkstra"}</strong></div></div><button className="saved-open-button" onClick={() => onOpen(route)}>Open this route <Icon name="arrow" size={15} /></button></article>;
        })}</div>
      )}
    </div>
  );
}

export default function RoutePlanner({ initialCities, initialFlights, initialPlan }: RoutePlannerProps) {
  const [activePage, setActivePage] = useState<PageKey>("planner");
  const [mode, setMode] = useState<PlannerMode>("shortest");
  const [algorithm, setAlgorithm] = useState<RouteAlgorithm>("dijkstra");
  const [fromSlug, setFromSlug] = useState("hyderabad");
  const [toSlug, setToSlug] = useState("kolkata");
  const [selectedStops, setSelectedStops] = useState<string[]>(["mumbai", "delhi", "kolkata"]);
  const [plan, setPlan] = useState(initialPlan);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastRequest, setLastRequest] = useState(
    JSON.stringify(requestFor("shortest", "dijkstra", "hyderabad", "kolkata", [])),
  );
  const [matrixStage, setMatrixStage] = useState(initialPlan.matrixHistory.length - 1);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [notice, setNotice] = useState("");

  const draftRequest = useMemo(
    () => requestFor(mode, algorithm, fromSlug, toSlug, selectedStops),
    [mode, algorithm, fromSlug, toSlug, selectedStops],
  );
  const draftKey = JSON.stringify(draftRequest);
  const isDirty = draftKey !== lastRequest;
  const activeSavedRoute = savedRoutes.find((route) => JSON.stringify(route.request) === lastRequest);
  const totalConnections = Math.floor(initialFlights.length / 2);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("routewise-saved-routes");
      if (stored) {
        const parsed = JSON.parse(stored) as SavedRoute[];
        if (Array.isArray(parsed)) setSavedRoutes(parsed);
      }
    } catch {
      // Ignore malformed browser storage and keep the planner fully usable.
    }
  }, []);

  function toast(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  async function submitRoute(request: RouteRequest) {
    const requestKey = JSON.stringify(request);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestKey,
      });
      const payload = (await response.json()) as RoutePlan | { error?: string };
      if (!response.ok || !("matrixHistory" in payload)) {
        throw new Error("error" in payload ? payload.error ?? "Could not find a complete route." : "Could not find a complete route.");
      }
      setPlan(payload);
      setLastRequest(requestKey);
      setMatrixStage(payload.matrixHistory.length - 1);
      setActivePage("planner");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function calculateRoute() {
    void submitRoute(draftRequest);
  }

  function saveCurrentRoute() {
    if (isDirty || plan.cost === null) return;
    const route: SavedRoute = {
      id: activeSavedRoute?.id ?? `${Date.now()}`,
      request: JSON.parse(lastRequest) as RouteRequest,
      cost: plan.cost,
      distance: plan.distance,
      path: plan.path,
      visitOrder: plan.visitOrder,
      savedAt: new Date().toISOString(),
    };
    const next = [route, ...savedRoutes.filter((item) => item.id !== route.id)].slice(0, 12);
    setSavedRoutes(next);
    try {
      window.localStorage.setItem("routewise-saved-routes", JSON.stringify(next));
    } catch {
      // In-memory saved routes still work if browser storage is unavailable.
    }
    toast(activeSavedRoute ? "Saved route updated" : "Route tucked away for later");
  }

  function removeSavedRoute(id: string) {
    const next = savedRoutes.filter((route) => route.id !== id);
    setSavedRoutes(next);
    try {
      window.localStorage.setItem("routewise-saved-routes", JSON.stringify(next));
    } catch {
      // The in-memory list is kept current regardless.
    }
    toast("Route removed from saved trips");
  }

  function openSavedRoute(route: SavedRoute) {
    setFromSlug(route.request.fromSlug);
    setToSlug(route.request.toSlug);
    setMode(route.request.mode);
    setAlgorithm(route.request.algorithm === "floyd-warshall" ? "floyd-warshall" : "dijkstra");
    setSelectedStops(route.request.selectedSlugs);
    void submitRoute(route.request);
  }

  function changeFrom(slug: string) {
    if (mode === "tour") {
      setSelectedStops((previous) => previous.filter((stop) => stop !== slug));
      setFromSlug(slug);
    } else {
      if (slug === toSlug) setToSlug(fromSlug);
      setFromSlug(slug);
    }
  }

  function changeTo(slug: string) {
    if (slug === fromSlug) setFromSlug(toSlug);
    setToSlug(slug);
  }

  function toggleStop(slug: string) {
    setSelectedStops((previous) => {
      if (previous.includes(slug)) return previous.filter((stop) => stop !== slug);
      if (previous.length >= 6) return previous;
      return [...previous, slug];
    });
  }

  const savedPageName = activePage === "lab" ? "Algorithm lab" : activePage === "saved" ? "Saved routes" : "Trip planner";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><span className="brand-mark"><Icon name="compass" size={20} strokeWidth={1.7} /></span><span className="brand-name">routewise<span className="brand-period">.</span><small>THE ALGORITHM STUDIO</small></span></div>
        <div className="sidebar-network-status"><span className="live-dot" /> NETWORK ONLINE <span className="status-divider" /> INDIA</div>
        <div className="sidebar-section-label">YOUR WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <button className={`nav-item ${activePage === "planner" ? "nav-active" : ""}`} onClick={() => setActivePage("planner")}><span className="nav-icon"><Icon name="route" size={17} /></span><span>Trip planner</span><Icon name="chevron" size={14} /></button>
          <button className={`nav-item ${activePage === "lab" ? "nav-active" : ""}`} onClick={() => setActivePage("lab")}><span className="nav-icon"><Icon name="matrix" size={17} /></span><span>Algorithm lab</span><Icon name="chevron" size={14} /></button>
          <button className={`nav-item ${activePage === "saved" ? "nav-active" : ""}`} onClick={() => setActivePage("saved")}><span className="nav-icon"><Icon name="bookmark" size={17} /></span><span>Saved routes</span>{savedRoutes.length > 0 && <span className="nav-count">{savedRoutes.length}</span>}</button>
        </nav>
        <div className="sidebar-section-label network-label">YOUR NETWORK</div>
        <div className="network-mini-card"><div className="network-mini-top"><span className="mini-network-icon"><Icon name="globe" size={15} /></span><span className="mini-network-online">ACTIVE</span></div><strong>India domestic</strong><span>{initialCities.length} cities <b>·</b> {totalConnections} connections</span><div className="mini-network-bars"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><small>Graph data stored in PostgreSQL</small></div>
        <div className="sidebar-bottom"><div className="sidebar-bottom-stamp"><span className="stamp-stars">✳</span><span>MADE FOR THE<br /><strong>CURIOUS MIND</strong></span></div><span className="version-label">ROUTEWISE · v1.0</span></div>
      </aside>

      <main className="main-shell">
        <header className="topbar"><div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{savedPageName}</strong></div><div className="topbar-actions"><span className="topbar-network"><span className="live-dot" /> Flights updating live</span><span className="topbar-separator" /><button className="avatar-button" aria-label="Routewise account">r<span>.</span></button></div></header>
        <div className="main-content">
          {activePage === "planner" && (
            <div className="planner-page">
              <section className="planner-hero"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot" /> BETTER ROUTES START HERE <span className="hero-sparkle"><Icon name="sparkle" size={13} /></span></div><h1>Go farther.<br /><span>Spend smarter.</span></h1><p>Tell us where you’re headed. We’ll show you the route —<br className="desktop-break" /> and the algorithm that found it.</p></div><div className="hero-aside"><span className="hero-aside-orbit"><Icon name="compass" size={28} /></span><span className="hero-aside-caption">A LITTLE LESS GUESSWORK.</span><strong>A LOT MORE<br />WONDER.</strong><span className="hero-aside-rule" /></div><div className="hero-decoration hero-decoration-one" /><div className="hero-decoration hero-decoration-two" /></section>

              <div className="planner-workspace">
                <section className="builder-card">
                  <div className="builder-card-head"><div><span className="micro-label">THE ROUTE BUILDER</span><h2>Where to next?</h2></div><span className="step-count-pill">01 <span>/</span> 02</span></div>
                  <div className="mode-switch" role="tablist" aria-label="Choose a trip type"><button role="tab" aria-selected={mode === "shortest"} className={mode === "shortest" ? "mode-active" : ""} onClick={() => { setMode("shortest"); setAlgorithm("dijkstra"); }}>One-way<span>One best route</span></button><button role="tab" aria-selected={mode === "tour"} className={mode === "tour" ? "mode-active" : ""} onClick={() => { setMode("tour"); setAlgorithm("tsp"); }}>Multi-city<span>Find the best loop</span></button></div>

                  {mode === "shortest" ? (
                    <div className="city-selector-block">
                      <label className="city-field"><span className="field-topline"><span>STARTING CITY</span><span className="field-dot" /></span><span className="select-wrap"><span className="field-code">{initialCities.find((city) => city.slug === fromSlug)?.code}</span><select aria-label="Starting city" value={fromSlug} onChange={(event) => changeFrom(event.target.value)}>{initialCities.map((city) => <option key={city.slug} value={city.slug}>{city.name}</option>)}</select><Icon name="chevron" size={15} /></span></label>
                      <div className="swap-divider"><span /><button aria-label="Swap origin and destination" onClick={() => { setFromSlug(toSlug); setToSlug(fromSlug); }}><Icon name="swap" size={15} /></button><span /></div>
                      <label className="city-field"><span className="field-topline"><span>DESTINATION</span><span className="field-dot field-dot-end" /></span><span className="select-wrap"><span className="field-code">{initialCities.find((city) => city.slug === toSlug)?.code}</span><select aria-label="Destination city" value={toSlug} onChange={(event) => changeTo(event.target.value)}>{initialCities.map((city) => <option key={city.slug} value={city.slug}>{city.name}</option>)}</select><Icon name="chevron" size={15} /></span></label>
                    </div>
                  ) : (
                    <div className="tour-selector-block">
                      <label className="city-field"><span className="field-topline"><span>HOME CITY · START & FINISH</span><span className="field-dot" /></span><span className="select-wrap"><span className="field-code">{initialCities.find((city) => city.slug === fromSlug)?.code}</span><select aria-label="Tour starting city" value={fromSlug} onChange={(event) => changeFrom(event.target.value)}>{initialCities.map((city) => <option key={city.slug} value={city.slug}>{city.name}</option>)}</select><Icon name="chevron" size={15} /></span></label>
                      <div className="stop-picker-head"><div><span className="field-topline">CITIES TO INCLUDE</span><p>Pick stops. We’ll figure out the order.</p></div><span className="stop-count">{selectedStops.length + 1} / 7</span></div>
                      <div className="stop-options">{initialCities.filter((city) => city.slug !== fromSlug).map((city) => {
                        const checked = selectedStops.includes(city.slug);
                        const unavailable = !checked && selectedStops.length >= 6;
                        const fare = initialFlights.find((flight) => flight.originSlug === fromSlug && flight.destinationSlug === city.slug)?.cost;
                        return <button type="button" key={city.slug} disabled={unavailable} className={`stop-option ${checked ? "stop-option-checked" : ""}`} onClick={() => toggleStop(city.slug)}><span className="stop-checkbox">{checked && <Icon name="check" size={12} />}</span><span className="stop-option-city"><strong>{city.name}</strong><small>{city.code}{fare ? ` · from ${formatRupees(fare)}` : ""}</small></span></button>;
                      })}</div>
                      <div className="tour-hint"><Icon name="sparkle" size={14} /><span>Great trips have a little room for surprise.</span></div>
                    </div>
                  )}

                  {mode === "shortest" ? <div className="algorithm-picker"><div className="algorithm-picker-heading"><span className="field-topline">PICK YOUR ALGORITHM</span><button className="tiny-text-button" onClick={() => setActivePage("lab")}>What’s this? <Icon name="arrow" size={12} /></button></div><div className="algorithm-choices"><button className={`algorithm-choice ${algorithm === "dijkstra" ? "algorithm-choice-active" : ""}`} onClick={() => setAlgorithm("dijkstra")}><span className="algorithm-choice-radio">{algorithm === "dijkstra" && <i />}</span><span className="algorithm-choice-copy"><strong>Dijkstra</strong><small>Fastest for one route</small></span><span className="algorithm-choice-spark"><Icon name="route" size={15} /></span></button><button className={`algorithm-choice ${algorithm === "floyd-warshall" ? "algorithm-choice-active" : ""}`} onClick={() => setAlgorithm("floyd-warshall")}><span className="algorithm-choice-radio">{algorithm === "floyd-warshall" && <i />}</span><span className="algorithm-choice-copy"><strong>Floyd–Warshall</strong><small>Solves every pair</small></span><span className="algorithm-choice-spark"><Icon name="matrix" size={15} /></span></button></div></div> : <div className="tsp-explainer"><span className="tsp-explainer-icon"><Icon name="globe" size={17} /></span><span><strong>Powered by the Travelling Salesperson Problem.</strong><small>We check every possible stop order and bring you back home.</small></span><span className="tsp-explainer-complexity">TSP</span></div>}

                  {error && <div className="route-error" role="alert"><Icon name="close" size={15} />{error}</div>}
                  {isDirty && !error && <div className="draft-note"><span className="draft-note-dot" /> Route changed — run it again to see your result.</div>}
                  <button className="run-route-button" onClick={calculateRoute} disabled={loading || (mode === "tour" && selectedStops.length === 0)}>{loading ? <><span className="button-spinner" /> Finding the best route…</> : <><span>{mode === "tour" ? "Find my perfect loop" : "Find my best route"}</span><span className="run-button-icon"><Icon name="arrow" size={17} /></span></>}<span className="run-button-glint" /></button>
                  <div className="builder-reassurance"><span><Icon name="check" size={12} /> No booking. Just good math.</span><span>GRAPH ALGORITHM STUDIO</span></div>
                </section>

                <div className="results-column">
                  <RouteMap cities={initialCities} flights={initialFlights} path={isDirty ? [] : plan.path} />
                  <section className="route-result-card">
                    <div className="result-card-header"><div><span className="micro-label">{plan.mode === "tour" ? "THE OPTIMAL ROUND TRIP" : "YOUR ROUTE, FIGURED OUT"}</span><h2>{plan.mode === "tour" ? "A very good way around." : "And there you have it."}</h2></div><button className={`save-route-button ${activeSavedRoute ? "is-saved" : ""}`} disabled={isDirty || plan.cost === null} onClick={saveCurrentRoute}><Icon name="bookmark" size={16} />{activeSavedRoute ? "Saved" : "Save route"}</button></div>
                    <RouteStops plan={plan} cities={initialCities} />
                    <div className="result-metrics"><div className="result-price-block"><span>{plan.mode === "tour" ? "TOTAL ROUND-TRIP COST" : "LOWEST FARE"}</span><strong>{plan.cost === null ? "No route" : formatRupees(plan.cost)}</strong><small>{plan.algorithm === "tsp" ? "all chosen cities, back home" : plan.directFlight && plan.cost !== null && plan.cost < plan.directFlight.cost ? `${formatRupees(plan.directFlight.cost - plan.cost)} less than flying direct` : plan.algorithm === "floyd-warshall" ? "all-pairs shortest path" : "best path through the network"}</small></div><div className="metric-divider" /><div className="result-stat"><span>FLIGHT DISTANCE</span><strong>{plan.distance === null ? "—" : `${plan.distance.toLocaleString("en-IN")} <small>km</small>`}</strong><small>{plan.path.length > 1 ? `${plan.path.length - 1} flight legs` : "across the network"}</small></div><div className="metric-divider" /><div className="result-stat algorithm-result"><span>FIGURED OUT BY</span><strong>{plan.algorithm === "tsp" ? "TSP" : plan.algorithm === "floyd-warshall" ? "Floyd–Warshall" : "Dijkstra"}</strong><small>{plan.algorithm === "tsp" ? "Every stop, in order" : plan.algorithm === "floyd-warshall" ? "All pairs, all at once" : "One source, one destination"}</small></div></div>
                    <Walkthrough steps={isDirty ? [] : plan.steps} cities={initialCities} algorithm={plan.algorithm} />
                    <button className="matrix-shortcut" onClick={() => setActivePage("lab")}><span className="matrix-shortcut-icon"><Icon name="matrix" size={15} /></span><span><strong>Curious about all the other city pairs?</strong><small>Watch the Floyd–Warshall matrix change, step by step.</small></span><Icon name="arrow" size={16} /></button>
                  </section>
                </div>
              </div>
              <footer className="page-footer"><span>ROUTEWISE <i>·</i> A FLIGHT GRAPH, WITH A LITTLE MORE SOUL.</span><span>MADE FOR THE WAY YOU WONDER <b>✳</b></span></footer>
            </div>
          )}
          {activePage === "lab" && <MatrixLab plan={plan} cities={initialCities} stage={matrixStage} setStage={setMatrixStage} />}
          {activePage === "saved" && <SavedPage savedRoutes={savedRoutes} cities={initialCities} onOpen={openSavedRoute} onRemove={removeSavedRoute} />}
        </div>
      </main>
      {notice && <div className="toast-message" role="status"><span><Icon name="check" size={16} /></span>{notice}</div>}
    </div>
  );
}
