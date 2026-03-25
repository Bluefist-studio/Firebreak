// ── FIRE BEHAVIOR GUIDE ──────────────────────────────────────
// temperature     → base spread radius (10°C=10px … 50°C=50px)
// airHumidity     → ignition chance multiplier (80%=×0.60 … 10%=×1.22)
// fuelHumidity    → spread interval + burn speed (80%=2.0s/×0.75 … 10%=0.5s/×1.30)
// windStrength    → directional radius bonus (1=+1px … 100=+50px downwind)
// defaultTreeType → "conifer" (7s burn, easier ignition) or "deciduous" (10s burn, harder ignition)
//
// ── SETTLEMENT GUIDE ─────────────────────────────────────────
// settlements     → array of { quadrant, radius, cornerOffset?, name? } objects
// quadrant        → "NW" | "NE" | "SW" | "SE" — corner of map where settlement is placed
// radius          → protection zone radius in pixels (trees inside = settlement trees)
// imageScale     → multiplier on the drawn sprite size relative to the zone diameter (default 2)
// Settlements are objectives: if ≥50% of their trees burn → mission fails immediately

export const missions = [
    {
    id: "training",
    name: "Training Grounds",
    description: "A small, easy map to learn controls. You have access to Fire Control and use your assets for free.",
    difficulty: "easy",
    missionReward: 0,
    failBurnPercent: 100,
    width: 2200,
    height: 1400,
    treeCount: 20000,
    startMoney: 500,
    isTrainingGround: true,
    defaultTreeType: "conifer",
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
  {
    id: "fire_season",
    name: "Fire Season (Endless)",
    description: "A small and dense forest with progressively more challenging days.",
    difficulty: "medium",
    missionReward: 14000,
    failBurnPercent: 10,
    width: 2200,
    height: 1400,
    treeCount: 25000,
    startMoney: 200,
    defaultTreeType: "conifer",
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
      fuelHumidity: 40,
      windAngle: 0,
      windStrength: 10,
      randomizeWind: true,
    },
  },
  {
    id: "pine",
    name: "Pine Ridge",
    description: "A big forest with scattered fires. Protect the settlements!",
    difficulty: "very hard",
    missionReward: 26000,
    failBurnPercent: 20,
    width: 3600,
    height: 2600,
    treeCount: 70000,
    startMoney: 500,
    defaultTreeType: "conifer",
    fireStartCount: 2,
    fireStartPattern: "random quadrant",
    fireStartQuadrants: ["NW", "NE", "SE", "SW"],
    settlements: [
      { quadrant: "NE", radius: 150, cornerOffset: 0.75, radius: 150 },
      { quadrant: "SW", radius: 150, cornerOffset: 0.75, radius: 150 },
    ],
    fireBuildup: {
      enabled: true,
      buildupDuration: 2,
      treeThreshold: 200,
      timeSpeed: 50.0,
    },
    weather: {
      temperature: 23,
      airHumidity: 30,
      fuelHumidity: 40,
      windAngle: 0,
      windStrength: 30,
      randomizeWind: true,
    },
  },
  {
    id: "wildfire",
    name: "Wildfire Front",
    description: "A hard mission with a big hot spot. Two settlements must be defended!",
    difficulty: "hard",
    missionReward: 14000,
    failBurnPercent: 20,
    width: 3600,
    height: 2600,
    treeCount: 50000,
    startMoney: 500,
    defaultTreeType: "conifer",
    fireStartCount: 1,
    fireStartPattern: "center",
    fireStartQuadrants: ["NW", "NE", "SE", "SW"],
    settlements: [
      { quadrant: "NE", radius: 150, cornerOffset: 0.75, radius: 150 },
      { quadrant: "SW", radius: 150, cornerOffset: 0.75, radius: 150 },
    ],
    fireBuildup: {
      enabled: true,
      buildupDuration: 2,
      treeThreshold: 200,
      timeSpeed: 50.0,
    },
    weather: {
      temperature: 28,
      airHumidity: 25,
      fuelHumidity: 30,
      windAngle: 0,
      windStrength: 10,
      randomizeWind: true,
    },
  }
];
