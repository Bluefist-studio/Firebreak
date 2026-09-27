// ╔══════════════════════════════════════════════════════════════╗
// ║                  MISSION DATA FIELD GUIDE                    ║
// ╚══════════════════════════════════════════════════════════════╝
//
// ── CORE FIELDS ──────────────────────────────────────────────
// id              → unique string key — used to dispatch the correct game mode
//                   known modes: "training", "fire_season", "pine", "wildfire"
//                   any other id uses the generic mode (respects all config fields)
// name            → display name shown in menus, HUD debug view, and end screens
// description     → flavor text shown on the mission select and pre-mission screens
// difficulty      → label string:   
//  "very easy": 4000,
//  "easy": 8000,
//  "moderate": 12000,
//  "challenging": 18000,
//  "hard": 22000,
// "very hard": 26000,
// "extreme": 32000, (color-coded in UI)
//
// width / height  → map size in pixels
// treeCount       → total number of trees to generate in the forest
// startMoney      → player's starting budget (dollars)
// missionReward   → dollars awarded on mission success (shown in pre-mission panel)
// failBurnPercent → % of total trees burned that immediately fails the mission
//                   FireSeasonMode decreases this by 0.25 per day (floor 4)
// winCondition    → "default" (win when all fires are out) or "timer" (win when countdown expires)
//                   default: "default"
// winTimer        → seconds for the countdown when winCondition: "timer"
//                   e.g. winTimer: 180 — player must survive 3 minutes to win
//                   failBurnPercent still fails the mission if reached before the timer expires
// minZoom         → minimum camera zoom (default 1.75 = zoomed in)
// maxZoom         → maximum camera zoom (default 1.0 = zoomed out)
// startZoom       → initial camera zoom when the mission loads (default 1.75)
// cameraStart     → { x, y } world-space position to center the camera on at mission start (default: map center)
//
// ── FOREST GENERATION ────────────────────────────────────────
// defaultTreeType → "conifer" (21.4s burn, easier ignition) or "deciduous" (30.6s burn, harder)
// treeMix         → optional { conifer: %, deciduous: % } blend (percentages should sum to 100)
//                   e.g. treeMix: { conifer: 25, deciduous: 75 } — overrides defaultTreeType per-tree
//                   omit treeMix to use 100% defaultTreeType
// forestStyle     → "clustered" (default) organic groups of trees, or "dense" uniform random, or "gradient" density-weighted control points
// forestGradient  → (only used with forestStyle:"gradient") array of control points:
//   { x, y, radius, density, treeType? }
//   x, y      — world position in pixels
//   radius    — influence radius in px (density falls off to 0 at edge via quadratic)
//   density   — 0..1 peak accept probability (1 = same density as "dense" style)
//   treeType  — optional "conifer" | "deciduous" override for trees in this zone
//
// Example — dense conifer core fading to sparse deciduous edges:
//   forestStyle: "gradient",
//   forestGradient: [
//     { x: 1800, y: 1300, radius: 800,  density: 1.0, treeType: "conifer" },
//     { x: 600,  y: 400,  radius: 600,  density: 0.6, treeType: "deciduous" },
//     { x: 3000, y: 2000, radius: 500,  density: 0.5, treeType: "deciduous" },
//   ],
// seed            → optional integer to reproduce a specific forest layout (e.g. seed: 123456789)
//                   omit or set to null to generate a new random layout each time
//                   the generated seed is shown in the debug view (press B in-game)
//
// ── TERRAIN FEATURES ─────────────────────────────────────────
// roads  → array of road paths. Wide dirt tracks drawn over the forest floor; trees cleared along them.
// creeks → array of creek paths. Narrow water channels; trees cleared along them.
//          Both always visible on the minimap regardless of fog of war.
// Format (same for both):
//    roads: [
//      { points: [{x: 0, y: 1300}, {x: 1800, y: 1300}, {x: 3600, y: 900}], width: 40 },
//    ],
//    creeks: [
//      { points: [{x: 1100, y: 0}, {x: 1200, y: 600}, {x: 1000, y: 1400}], width: 14 },
//    ],
//   points → polyline of world-space {x, y} waypoints (minimum 2, can have many for curves)
//   width  → visual stroke width in pixels; tree clearance = width/2 + 14px edge buffer
//            roads are wider than creeks; wider = more trees cleared = bigger firebreak
//
// ── TREE TYPE STATS ──────────────────────────────────────────
// treeTypes → optional overrides for per-type burn duration and ignition resistance.
//             omit entirely to use the global defaults below.
// treeTypes: {
//   conifer:   { burnDuration: 21.4, ignitionResistance: 1.10 },
//   deciduous: { burnDuration: 30.6, ignitionResistance: 0.90 },
// }
//   burnDuration      → seconds a tree burns before becoming a burnt stump (modified by fuel humidity)
//                       trees inside settlements burn 3× longer
//   ignitionResistance → multiplier on ignition chance for this tree type
//                         >1.0 = easier to ignite (conifer), <1.0 = harder (deciduous)
//
// ── FIRE BEHAVIOR ────────────────────────────────────────────
// weather: {
//   temperature   → base spread radius in pixels (10°C=10px … 50°C=50px)
//                   FireSeasonMode increments +0.5/day (cap 50)
//   airHumidity   → ignition chance multiplier (80%=×0.60 … 10%=×1.22)
//                   FireSeasonMode decrements −1/day (floor 10)
//   fuelHumidity  → spread interval + burn speed (80%=2.0s/×0.75 … 10%=0.5s/×1.30)
//                   FireSeasonMode decrements −1/day (floor 10)
//   windStrength  → downwind spread radius bonus (1=+1px … 100=+50px)
//                   FireSeasonMode increments +2/day (cap 90)
//   windAngle     → initial wind direction in radians (0 = East, π/2 = South)
//                   overridden each run when randomizeWind: true
//   randomizeWind → if true, re-rolls windAngle to a random cardinal direction each run
// }
//
// ── WIND ANGLE CHART ─────────────────────────────────────────
//  windAngle controls which direction fire spreads toward.
//  The map Y-axis increases DOWNWARD, so South = positive Y = Math.PI/2.
//
//  ┌─────────────────────────────────────────────────────────┐
//  │  Fire spreads…  │  Set windAngle to:      │  Approx.   │
//  │─────────────────│─────────────────────────│────────────│
//  │  → East         │  0                      │   0.000    │
//  │  ↓ South        │  Math.PI / 2            │   1.571    │
//  │  ← West         │  Math.PI                │   3.142    │
//  │  ↑ North        │  -Math.PI / 2           │  -1.571    │
//  │  ↘ South-East   │  Math.PI / 4            │   0.785    │
//  │  ↙ South-West   │  3 * Math.PI / 4        │   2.356    │
//  │  ↗ North-East   │  -Math.PI / 4           │  -0.785    │
//  │  ↖ North-West   │  -3 * Math.PI / 4       │  -2.356    │
//  └─────────────────────────────────────────────────────────┘

//
//  Tip: randomizeWind: true picks a random cardinal each run.
//       windStrength: 0 = perfectly calm (no directional bias).
//
// ── FIRE BUILDUP ─────────────────────────────────────────────
// Runs before player gets control, simulating a head start for the fire.
// fireBuildup: {
//   enabled          → whether the pre-mission buildup phase runs at all
//   buildupDuration  → max seconds the buildup runs (real seconds × timeSpeed)
//                      FireSeasonMode increments +0.5/day (floor 1)
//   treeThreshold    → buildup stops early when this many trees are burning or burned
//   timeSpeed        → simulation speed multiplier during buildup (e.g. 50.0 = 50× real time)
// }
//
// ── FIRE START ───────────────────────────────────────────────
// fireStartCount    → number of fire ignition points at mission start
//                     FireSeasonMode increments +1 every 5 days (cap 5)
// fireStartPattern  → "center"          — all fires ignite at the center of the map (default)
//                     "random"          — fires spawn randomly across the entire map
//                     "quadrant"        — fires distributed across fireStartQuadrants (~1 per quadrant)
//                     "random quadrant" — all fires placed inside one randomly chosen quadrant
// fireStartRadius   → (only used with fireStartPattern: "center")
//                     radius in pixels around map center to ignite trees (default 20)
//                     e.g. fireStartRadius: 50 — burns all trees within 50px of center (default 25)
// fireStartQuadrants → eligible quadrants for "quadrant" and "random quadrant" patterns.
//                      Each entry can be a plain string or an object:
//                      Simple:  ["NW", "NE"]  — fires ignite at the quadrant center (nearest trees only)
//                      Object with radius (ignites ALL trees within radius of the target point):
//                        [{ quadrant: "NW", radius: 50 }]
//                      Object with cornerOffset (0=corner, 0.5=quadrant center, 1=map center):
//                        [{ quadrant: "NW", cornerOffset: 0.2, radius: 30 }]
//                      Object with centerOffset (pixel offset from quadrant center):
//                        [{ quadrant: "NW", centerOffset: { x: 200, y: -100 }, radius: 40 }]
//                      centerOffset takes priority over cornerOffset when both are present.
//                      Without radius, ignites only the nearest `count` trees to that point.
//                      Mix freely: ["NE", { quadrant: "SW", centerOffset: { x: -300, y: 0 }, radius: 60 }]
//
// ── TIMED FIRE STARTS ────────────────────────────────────────
// timedFireStarts → array of fire events that trigger mid-mission.
//   Two modes:
//     One-shot:  { time, count?, pattern?, ... }        — fires once when timeSinceStart >= time (seconds)
//     Interval:  { interval, startAfter?, count?, ... } — repeats every interval seconds
//                                                          startAfter: delay before first fire (default 0)
//   Shared options:
//     count    → trees to ignite per trigger (default 1; ignored when radius is set — all trees in radius ignite)
//     radius   → if set, ignites ALL trees within this px radius of the target point
//                omit to ignite only `count` nearest trees instead
//     pattern  → "random"   — ignite anywhere on the map (default)
//                "position" — ignite near a fixed world-space point: requires x, y
//                             optional radius (default 25px)
//                "quadrant" — ignite in a named quadrant: "NW" | "NE" | "SW" | "SE"
//                             optional cornerOffset (0=corner … 1=map center, default 0.5)
//                             optional centerOffset: { x, y } pixel offset from quadrant center
//                             optional radius (default 25px)
//                "center"   — ignite near the map center
//                             optional radius (default 25px)
//
//   Example:
//   timedFireStarts: [
//     { time: 30, count: 2, pattern: "random" },
//     { time: 60, count: 1, pattern: "position", x: 800, y: 600 },
//     { interval: 45, startAfter: 30, count: 1, pattern: "quadrant", quadrant: "NE" },
//   ],
//
// ── SETTLEMENTS ──────────────────────────────────────────────
// settlements → array of settlement objects. Each settlement is a mission objective:
//               if ≥75% of its trees burn the mission fails immediately.
// {
//   quadrant      → "NW" | "NE" | "SW" | "SE" — which corner of the map to place the settlement
//   radius        → protection zone radius in pixels (trees inside = settlement trees)
//   cornerOffset  → 0 = exact corner, 1 = map center, 0.5 = quadrant center (default 0.5)
//   centerOffset  → { x, y } pixel offset from the quadrant center — takes priority over cornerOffset
//                   e.g. centerOffset: { x: 200, y: -150 }  (positive x=right, positive y=down)
//   name          → label drawn above the settlement and shown in the end-of-round summary
//   sprite        → sprite key for the undamaged settlement image
//   burningSprite → sprite key for the burning state (defaults to sprite + "_burning" if omitted)
//   imageScale    → multiplier on drawn sprite size relative to the zone diameter (default 2)
//   imageSizePx   → fixed draw width in world pixels — overrides imageScale if set,
//                   so the sprite stays the same size regardless of radius
// }


export const DIFFICULTY_REWARDS = {
  "none":                   0,
  "increasing difficulty":  14000,
  "very easy":              6000,
  "easy":                   8000,
  "moderate":               12000,
  "challenging":            18000,
  "hard":                   22000,
  "very hard":              26000,
  "extreme":                32000,
};

/** Returns the reward for a mission based on its difficulty field. */
export function getMissionReward(mission) {
  const key = (mission?.difficulty ?? "").toLowerCase();
  return DIFFICULTY_REWARDS[key] ?? 0;
}

export const missions = [

//////////////////////////////////////////////////////////////////////////////
///////////////////////////** Training Grounds **/////////////////////////////
//////////////////////////////////////////////////////////////////////////////
    {
    id: "training",
    name: "Training Grounds",
    description: "A small, easy map to learn controls. You have access to Fire Control and use your assets for free.",
    difficulty: "None",
    failBurnPercent: 100,
    width: 2200,
    height: 1400,
    treeCount: 20000,
    isTrainingGround: true,
    treeMix: { conifer: 75, deciduous: 25 },
    fireStartCount: 1,
    fireStartPattern: "center",
    fireStartQuadrants: ["NW", "NE", "SE", "SW"],
    fireBuildup: {
      enabled: true,
      buildupDuration: 2,      
      treeThreshold: 100,      
      timeSpeed: 50.0,
    },
    weather: {
      temperature: 23,
      airHumidity: 30,
      fuelHumidity: 45,
      windAngle: 0,
      windStrength: 10,
      randomizeWind: true,
    },
  },
//////////////////////////////////////////////////////////////////////////////
////////////////////////** Fire Season (Endless) **///////////////////////////
//////////////////////////////////////////////////////////////////////////////
  {
    id: "fire_season",
    name: "Fire Season (Endless)",
    description: "A small and dense forest with progressively more challenging days.",
    difficulty: "Increasing Difficulty",
    failBurnPercent: 10,
    width: 2200,
    height: 1400,
    treeCount: 30000,
    forestStyle: "dense",
    treeMix: { conifer: 75, deciduous: 25 },
    fireStartCount: 1,
    fireStartPattern: "center",
    fireStartRadius: 25,
    fireStartQuadrants: [],
    fireBuildup: {
      enabled: true,
      buildupDuration: 1,
      treeThreshold: 100,
      timeSpeed: 50.0,
    },
    weather: {
      temperature: 23,
      airHumidity: 30,
      fuelHumidity: 40,
      windAngle: 0,
      windStrength: 10,
      randomizeWind: true,
    },
  },
//////////////////////////////////////////////////////////////////////////////
////////////////////////////** CAMPFIRE CALLOUT **//////////////////////////////
//////////////////////////////////////////////////////////////////////////////
  {
    id: "campfire_callout",
    name: "Campfire Callout",
    description: "A neglected campfire has ignited a small patch of woods. Contain the flames before they spread beyond the clearing.",
    difficulty: "easy",
    cameraStart: { x: 1500, y: 325 },
    failBurnPercent: 10,
    width: 1500,
    height: 1300,
    treeCount: 16000,
    treeMix: { conifer: 75, deciduous: 25 },
    forestStyle: "clustered",
    seed: 2981856818,
    fireStartCount: 1,
    fireStartPattern: "quadrant",
    fireStartQuadrants: [
      { quadrant: "NE", radius: 25 },
    ],
    settlements: [],
    roads: [
      { points: [{x: 300, y: 0}, {x: 400, y: 400}, {x: 300, y: 800}, {x: 500, y:900}, {x: 350, y:1000}, {x: 425, y:1175}, {x: 550, y:1320},], width: 20 },
    ],
    fireBuildup: {
      enabled: true,
      buildupDuration: 5,
      treeThreshold: 100,
      timeSpeed: 50.0,
    },
    weather: {
      temperature: 25,
      airHumidity: 25,
      fuelHumidity: 45,
      windAngle: 2.356,
      windStrength: 30,
      randomizeWind: false,
    },
  },
//////////////////////////////////////////////////////////////////////////////
////////////////////////////** ROADSIDE SPARK **//////////////////////////////
//////////////////////////////////////////////////////////////////////////////
  {
    id: "roadside_spark",
    name: "Roadside Spark",
    description: "A roadside ignition has started creeping into thin forest. A simple first response, but the fire is already moving.",
    difficulty: "Very easy",
    cameraStart: { x: 0, y: 550 },
    failBurnPercent: 10,
    width: 1500,
    height: 1300,
    treeCount: 16000,
    treeMix: { conifer: 80, deciduous: 20 },
    forestStyle: "clustered",
    seed: 3096822593,
    fireStartCount: 1,
    fireStartPattern: "quadrant",
    fireStartQuadrants: [
      { quadrant: "NW", centerOffset: { x: -70, y: 240 }, radius: 25 },
    ],
    settlements: [],
    roads: [
      { points: [{x: 300, y: 0}, {x: 200, y: 400}, {x: 300, y: 800}, {x: 500, y:900}, {x: 350, y:1000}, {x: 400, y:1175}, {x: 600, y:1175}, {x: 550, y:1320},], width: 20 },
    ],
    fireBuildup: {
      enabled: true,
      buildupDuration: 5,
      treeThreshold: 100,
      timeSpeed: 50.0,
    },
    weather: {
      temperature: 27,
      airHumidity: 25,
      fuelHumidity: 45,
      windAngle: 0,
      windStrength: 10,
      randomizeWind: false,
    },
  },
//////////////////////////////////////////////////////////////////////////////
///////////////////////////** TOWNLINE DEFENSE **/////////////////////////////
//////////////////////////////////////////////////////////////////////////////
  {
    id: "townline_defense",
    name: "Townline Defense",
    description: "A wildfire is advancing toward the outer edge of a rural settlement. Protecting structures and routes matters as much as saving forest.",
    difficulty: "Challenging",
    cameraStart: { x: 0, y: 10 },
    failBurnPercent: 25,
    width: 1500,
    height: 1300,
    treeCount: 15000,
    treeMix: { conifer: 75, deciduous: 25 },
    forestStyle: "clustered",
    //seed: 1051353607,
    seed: 4277218347,
    fireStartCount: 3,
    fireStartPattern: "quadrant",
    fireStartQuadrants: [
      { quadrant: "NW", centerOffset: { x: -100, y: 125 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -100, y: 200 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -100, y: 250 }, radius: 25 },
    ],
    settlements: [
      { quadrant: "NW", radius: 180, centerOffset: { x: 800, y: -20 }, sprite: "settlement3" },
      { quadrant: "NW", radius: 180, centerOffset: { x: 850, y: 500 }, sprite: "settlement5" },
    ],
    roads: [
      { points: [{x: 150, y: 0}, {x: 150, y: 2000},{x: 150, y:0}, {x: 150, y:75}, {x: 1000, y:150}, {x: 1180, y:120}, {x: 1250, y:320}, {x: 1350, y:350}, {x: 1370, y:510}, {x: 1240, y:630}, {x: 1220, y:700}, ], width: 20 },
    ],
    fireBuildup: {
      enabled: true,
      buildupDuration: 4,
      treeThreshold: 400,
      timeSpeed: 50.0,
    },
    weather: {
      temperature: 25,
      airHumidity: 30,
      fuelHumidity: 40,
      windAngle: 0.25, //0.785,
      windStrength: 30,
      randomizeWind: false,
    },
  },
//////////////////////////////////////////////////////////////////////////////
////////////////////////////** BRUSHLINE BURN **//////////////////////////////
//////////////////////////////////////////////////////////////////////////////
  {
    id: "brushline_burn",
    name: "Brushline Burn",
    description: "Dry brush along a treeline has caught fire and is feeding the first real run of the season. Act quickly before it reaches denser fuel.",
    difficulty: "Moderate",
    cameraStart: { x: 0, y: 1300 },
    failBurnPercent: 20,
    width: 1600,
    height: 1300,
    treeCount: 20000,
    treeMix: { conifer: 90, deciduous: 10 },
    forestStyle: "gradient",
    forestGradient: [
     { x: 1489, y: 0, radius: 2100,  density: 1.2, treeType: { conifer: 90, deciduous: 10 } },
    ],
    seed: 3695012664,
    //seed: 1727155367,
    fireStartCount: 5,
    fireStartPattern: "quadrant",
    fireStartQuadrants: [
      { quadrant: "SW", centerOffset: { x: 100, y: -100 }, radius: 25 },
      { quadrant: "SW", centerOffset: { x: 125, y: -50 }, radius: 25 },
      { quadrant: "SW", centerOffset: { x: 150, y: -25 }, radius: 25 },
      { quadrant: "SW", centerOffset: { x: 200, y: 0 }, radius: 25 },
      { quadrant: "SW", centerOffset: { x: 250, y: 25 }, radius: 25 },
      { quadrant: "SW", centerOffset: { x: 300, y: 50 }, radius: 25 },
      { quadrant: "SW", centerOffset: { x: 350, y: 100 }, radius: 25 },
    ],
    creeks: [
     { points: [{x: 0, y: 300}, {x: 200, y: 400}, {x: 320, y: 900}, {x: 400, y: 1100}, {x: 900, y: 1250}, {x: 1200, y: 1250}, {x: 1400, y: 1400}], width: 6 },
    ],
    fireBuildup: {
      enabled: true,
      buildupDuration: 3,
      treeThreshold: 300,
      timeSpeed: 50.0,
    },
    weather: {
      temperature: 28,
      airHumidity: 35,
      fuelHumidity: 40,
      windAngle: -0.785,
      windStrength: 20,
      randomizeWind: false,
    },
  },
//////////////////////////////////////////////////////////////////////////////
////////////////////////////** WILDFIRE FRONT **//////////////////////////////
//////////////////////////////////////////////////////////////////////////////
  {
    id: "wildfire",
    name: "Wildfire Front",
    description: "A hard mission with a big hot spot. Two settlements must be defended!",
    difficulty: "Challenging",
    failBurnPercent: 20,
    width: 3600,
    height: 2600,
    treeCount: 70000,
    treeMix: { conifer: 75, deciduous: 25 },
    seed: 739412915,
    fireStartCount: 1,
    fireStartPattern: "center",
    fireStartRadius: 25,
    fireStartQuadrants: [],
    settlements: [
      { quadrant: "NE", radius: 180, cornerOffset: 0.75, sprite: "settlement3" },
      { quadrant: "SW", radius: 180, cornerOffset: 0.75, sprite: "settlement5" },
    ],
    fireBuildup: {
      enabled: true,
      buildupDuration: 3,
      treeThreshold: 300,
      timeSpeed: 50.0,
    },
    weather: {
      temperature: 28,
      airHumidity: 25,
      fuelHumidity: 30,
      windAngle: 0,
      windStrength: 0,
      randomizeWind: true,
    },
  },
//////////////////////////////////////////////////////////////////////////////
//////////////////////////////** PINE RIDGE **////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
  {
    id: "pine",
    name: "Pine Ridge",
    description: "A big forest with scattered fires. Protect the settlements!",
    difficulty: "Hard",
    failBurnPercent: 20,
    width: 3600,
    height: 2600,
    treeCount: 75000,
    treeMix: { conifer: 75, deciduous: 25 },
    seed: 2130978333,
    fireStartCount: 2,
    fireStartPattern: "quadrant",
    fireStartQuadrants: [{ quadrant: "NE", radius: 25 }, { quadrant: "SW", radius: 25 }],
    settlements: [
      { quadrant: "NE", radius: 180, cornerOffset: 0.75, sprite: "settlement3" },
      { quadrant: "SW", radius: 180, cornerOffset: 0.75, sprite: "settlement5" },
    ],
    fireBuildup: {
      enabled: true,
      buildupDuration: 4,
      treeThreshold: 400,
      timeSpeed: 50.0,
    },
    weather: {
      temperature: 28,
      airHumidity: 25,
      fuelHumidity: 40,
      windAngle: 0,
      windStrength: 0,
      randomizeWind: true,
    },
  },
//////////////////////////////////////////////////////////////////////////////
////////////////////////////** WILDFIRE WATCH **//////////////////////////////
//////////////////////////////////////////////////////////////////////////////
  {
    id: "wildfire_watch",
    name: "Wildfire Watch",
    description: "Survive the wildfire for a set amount of time.",
    difficulty: "Hard",
    failBurnPercent: 20,
    winCondition: "timer",
    winTimer: 600, 
    width: 3600,
    height: 2600,
    treeCount: 75000,
    treeMix: { conifer: 75, deciduous: 25 },
    //seed: 403,
    fireStartCount: 1,
    fireStartPattern: "center",
    fireStartRadius: 25,
    fireStartQuadrants: [],
    timedFireStarts: [
      { interval: 20, count: 1, pattern: "random", radius: 25 },
    ],
    settlements: [],
    fireBuildup: {
      enabled: true,
      buildupDuration: 2,
      treeThreshold: 200,
      timeSpeed: 50.0,
    },
    weather: {
      temperature: 28,
      airHumidity: 30,
      fuelHumidity: 40,
      windAngle: 0,
      windStrength: 0,
      randomizeWind: true,
    },
  },
//////////////////////////////////////////////////////////////////////////////
////////////////////////////** FIREWALL **//////////////////////////////
//////////////////////////////////////////////////////////////////////////////
  {
    id: "firewall",
    name: "Firewall",
    description: "A massive wildfire is raging with multiple ignition points. Can you contain it before it consumes the entire forest?",
    difficulty: "Very Hard",
    cameraStart: { x: 0, y: 750 },
    failBurnPercent: 60,
    width: 1500,
    height: 1300,
    treeCount: 18000,
    treeMix: { conifer: 80, deciduous: 20 },
    forestStyle: "clustered",
    seed: 1046606629,
    //seed: 1046606629,
    fireStartCount: 11,
    fireStartPattern: "quadrant",
    fireStartQuadrants: [
      { quadrant: "NW", centerOffset: { x: -325, y: -300 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: -200 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: -100 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 0 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: -100 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 100 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 200 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 300 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 400 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 500 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 600 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 700 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 800 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 900 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 1000 }, radius: 25 },
    ],
    settlements: [],
    roads: [],
    fireBuildup: {
      enabled: true,
      buildupDuration: 5,
      treeThreshold: 500,
      timeSpeed: 50.0,
    },
    weather: {
      temperature: 25,
      airHumidity: 15,
      fuelHumidity: 25,
      windAngle: 0,
      windStrength: 30,
      randomizeWind: false,
    },
  },
//////////////////////////////////////////////////////////////////////////////
////////////////////////////** FIREWALL x2 **//////////////////////////////
//////////////////////////////////////////////////////////////////////////////
  {
    id: "firewall_extreme",
    name: "Firewall x2",
    description: "An extreme version of Firewall. Can you hold the line?",
    difficulty: "Very Hard",
    cameraStart: { x: 0, y: 750 },
    failBurnPercent: 70,
    width: 1500,
    height: 1300,
    treeCount: 18000,
    treeMix: { conifer: 80, deciduous: 20 },
    forestStyle: "clustered",
    seed: 1046606629,
    //seed: 1046606629,
    fireStartCount: 11,
    fireStartPattern: "quadrant",
    fireStartQuadrants: [
      { quadrant: "NW", centerOffset: { x: -325, y: -300 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: -200 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: -100 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 0 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: -100 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 100 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 200 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 300 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 400 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 500 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 600 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 700 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 800 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 900 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 1000 }, radius: 25 },
    ],
    settlements: [],
    roads: [],
    fireBuildup: {
      enabled: true,
      buildupDuration: 5,
      treeThreshold: 500,
      timeSpeed: 50.0,
    },
    weather: {
      temperature: 25,
      airHumidity: 10,
      fuelHumidity: 10,
      windAngle: 0,
      windStrength: 30,
      randomizeWind: false,
    },
  },
//////////////////////////////////////////////////////////////////////////////
////////////////////////////** FIRESTORM **//////////////////////////////
//////////////////////////////////////////////////////////////////////////////
  {
    id: "firestorm",
    name: "Firestorm",
    description: "A massive wildfire is raging with multiple ignition points. Can you contain it before it consumes the entire forest?",
    difficulty: "Extreme",
    cameraStart: { x: 750, y: 650 },
    winCondition: "timer",
    winTimer: 120, 
    width: 1500,
    height: 1300,
    treeCount: 18000,
    treeMix: { conifer: 80, deciduous: 20 },
    forestStyle: "clustered",
    seed: 1046606629,
    //seed: 1046606629,
    fireStartCount: 11,
    fireStartPattern: "quadrant",
    fireStartQuadrants: [
      { quadrant: "NW", centerOffset: { x: -325, y: -300 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: -200 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: -100 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 0 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: -100 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 100 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 200 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 300 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 400 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 500 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 600 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 700 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 800 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 900 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 1000 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 1500 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 1500 }, radius: 25 },
      { quadrant: "NW", centerOffset: { x: -325, y: 1500 }, radius: 25 },
    ],
    settlements: [      
      { quadrant: "NE", radius: 180, cornerOffset: 1, sprite: "settlement3" },
    ],
    roads: [],
     treeTypes: {
       conifer:   { burnDuration: 21.4 * 0.4, ignitionResistance: 1.10 },
       deciduous: { burnDuration: 23.6 * 0.4, ignitionResistance: 1.00 },
     },
    fireBuildup: {
      enabled: true,
      buildupDuration: 5,
      treeThreshold: 500,
      timeSpeed: 50.0,
    },
    weather: {
      temperature: 28,
      airHumidity: 25,
      fuelHumidity: 10,
      windAngle: 0,
      windStrength: 50,
      randomizeWind: false,
    },
  },
];
