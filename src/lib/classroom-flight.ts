export type Flight = "mix" | "wave" | "orbit" | "spiral" | "bounce" | "fire" | "eight" | "pendulum";
export type FlightPattern = Exclude<Flight, "mix">;
export const FLIGHT_PATTERNS: FlightPattern[] = ["wave", "eight", "spiral", "orbit", "fire", "bounce", "pendulum"];
export const FLIGHT_PALETTES: Record<Flight, [string, string, string]> = {
  mix: ["#8b5cf6", "#ec4899", "#fb923c"],
  wave: ["#e4df46", "#7df452", "#29dedf"],
  eight: ["#91ed49", "#3ce5b1", "#4872e8"],
  spiral: ["#f09b48", "#b7ee55", "#32df9b"],
  orbit: ["#4338ca", "#7c3aed", "#0891b2"],
  fire: ["#991b1b", "#ea580c", "#fbbf24"],
  bounce: ["#22d95e", "#3ce0e6", "#7650eb"],
  pendulum: ["#0f766e", "#22b8c7", "#6366f1"],
};
const TAU = Math.PI * 2;
const reflect = (v: number) => 1 - Math.abs(((v % 2) + 2) % 2 - 1);
export function flightPattern(flight: Flight, sec: number): FlightPattern {
  return flight === "mix" ? FLIGHT_PATTERNS[Math.floor(Math.max(0, sec) / 3.5) % FLIGHT_PATTERNS.length] : flight;
}

/** Normalized geometry also draws the guides, so portraits follow the visible paths. */
export function flightPoint(pattern: FlightPattern, u: number, lane = 0) {
  const theta = u * TAU;
  if (pattern === "wave") return { x: u, y: .2 + lane * .3 + .12 * Math.sin(theta * 1.5 + lane * 1.2) };
  if (pattern === "eight") return { x: .5 + .42 * Math.sin(theta), y: .5 + .36 * Math.sin(theta * 2) };
  if (pattern === "spiral") { const r = .04 + .42 * u; return { x: .5 + r * Math.cos(theta * 3), y: .5 + r * Math.sin(theta * 3) }; }
  if (pattern === "orbit") { const r = .55 + lane * .22; return { x: .5 + .43 * r * Math.cos(theta), y: .5 + .39 * r * Math.sin(theta) }; }
  if (pattern === "pendulum") { const angle = Math.sin(theta) * 1.04, length = .52 + lane * .12; return { x: .5 + .46 * Math.sin(angle), y: .08 + length * Math.cos(angle) }; }
  if (pattern === "fire") return { x: .15 + lane * .35 + .055 * Math.sin(theta * 2 + lane), y: 1 - u };
  return { x: reflect(u * (1.1 + lane * .13) + lane * .24), y: reflect(u * (1.67 + lane * .2) + .17 + lane * .21) };
}

export function portraitFlightPoint(pattern: FlightPattern, sec: number, seed: number, index: number) {
  const lane = index % 3;
  if (pattern === "bounce") return flightPoint(pattern, sec * .18 + seed * 5, lane);
  if (pattern === "spiral") return flightPoint(pattern, .5 + .5 * Math.sin(sec * .48 + seed * TAU), lane);
  const speed = pattern === "fire" ? .18 : pattern === "wave" ? .13 : .12;
  return flightPoint(pattern, (seed + sec * speed) % 1, lane);
}
