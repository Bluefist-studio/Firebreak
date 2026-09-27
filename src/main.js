import { ScreenManager } from "./core/ScreenManager.js";
import { EconomyState } from "./core/EconomyState.js";
import { MusicManager } from "./core/MusicManager.js";
import { TitleScreen } from "./ui/TitleScreen.js";
import { MainMenuScreen } from "./ui/MainMenuScreen.js";
import { BaseScreen } from "./ui/BaseScreen.js";
import { PlayScreen } from "./ui/PlayScreen.js";
import { LevelCompleteScreen } from "./ui/LevelCompleteScreen.js";
import { PreMissionScreen } from "./ui/PreMissionScreen.js";
import { BaseMode } from "./modes/BaseMode.js";
import { TrainingGroundMode } from "./modes/TrainingGroundMode.js";
import { FireSeasonMode } from "./modes/FireSeasonMode.js";
import { PineRidgeMode } from "./modes/PineRidgeMode.js";
import { WildfireFrontMode } from "./modes/WildfireFrontMode.js";
import { missions } from "./data/missions.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Keep canvas scalable to current window while preserving internal resolution
const MAX_GAME_WIDTH = 1920;
const MAX_GAME_HEIGHT = 1080;

function resizeCanvas() {
  // Maintain internal render resolution at 1920x1080 for consistent visuals
  canvas.width = MAX_GAME_WIDTH;
  canvas.height = MAX_GAME_HEIGHT;

  // Scale canvas to fill window while preserving aspect ratio
  const windowRatio = window.innerWidth / window.innerHeight;
  const targetRatio = MAX_GAME_WIDTH / MAX_GAME_HEIGHT;

  if (windowRatio >= targetRatio) {
    // window is wider than 16:9 -> fit by height
    canvas.style.height = `${window.innerHeight}px`;
    canvas.style.width = `${window.innerHeight * targetRatio}px`;
  } else {
    // window is taller than 16:9 -> fit by width
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerWidth / targetRatio}px`;
  }

  // Update viewport if a game is active
  if (typeof screenManager !== "undefined") {
    const playScreen = screenManager?.screens?.play;
    if (playScreen?.gameState) {
      playScreen.gameState.viewport.width = canvas.width;
      playScreen.gameState.viewport.height = canvas.height;

      // Keep camera inside world bounds
      const cam = playScreen.gameState.camera;
      const viewW = canvas.width / cam.zoom;
      const viewH = canvas.height / cam.zoom;
      cam.x = Math.max(0, Math.min(playScreen.gameState.forest.width - viewW, cam.x));
      cam.y = Math.max(0, Math.min(playScreen.gameState.forest.height - viewH, cam.y));
    }
  }
}

// Optional tree sprites (falls back to vector rendering if not loaded)
// Structure: { conifer: { normal: Image[], burning, burnt, wet }, deciduous: { ... } }
const treeSprites = {
  conifer: {
    normal: [new Image(), new Image(), new Image(), new Image()], // normal_tree1–4
    burning: new Image(),
    burnt: new Image(),
    wet: new Image(),
    retardant: new Image(),
  },
  deciduous: {
    normal: [new Image(), new Image(), new Image()], // normal_tree6, normal_tree8, normal_tree9
    burning: new Image(),
    burnt: new Image(),
    wet: new Image(),
    retardant: new Image(),
  },
  settlementTree: {
    normal: new Image(),   // invisible_tree.png
    burning: [new Image(), new Image(), new Image()],  // fire1.png, fire2.png, fire3.png
    burnt: new Image(),    // burnt.png
    wet: new Image(),      // supressed.png
  },
};

const spritePaths = {
  conifer: {
    normal: [
      "./Media/normal_tree1.png",
      "./Media/normal_tree2.png",
      "./Media/normal_tree3.png",
      "./Media/normal_tree4.png",
    ],
    burning: "./Media/burning_tree2.png",
    burnt: "./Media/burnt_tree.png",
    wet: "./Media/suppresed_tree.png",
    retardant: "./Media/retardant_tree.png",
  },
  deciduous: {
    normal: [
      "./Media/normal_tree6.png",
      "./Media/normal_tree8.png",
      "./Media/normal_tree9.png",
    ],
    burning: "./Media/burning_tree1.png",
    burnt: "./Media/burnt_tree2.png",
    wet: "./Media/suppresed_tree2.png",
    retardant: "./Media/retardant_tree2.png",
  },
  settlementTree: {
    normal: "./Media/invisible_tree.png",
    burning: ["./Media/fire1.png", "./Media/fire2.png", "./Media/fire3.png"],
    burnt: "./Media/burnt.png",
    wet: "./Media/supressed2.png",
  },
};

for (const type of Object.keys(spritePaths)) {
  for (const [state, val] of Object.entries(spritePaths[type])) {
    if (Array.isArray(val)) {
      val.forEach((path, i) => { treeSprites[type][state][i].src = encodeURI(path); });
    } else {
      treeSprites[type][state].src = encodeURI(val);
    }
  }
}

// Title/backdrop image (shown on the title screen)
const titleBackground = new Image();
const titleBackgroundPath = "./Media/menu_background5.png";
titleBackground.src = encodeURI(titleBackgroundPath);


// Main menu background
const menuBackground = new Image();
const menuBackgroundPath = "./Media/menu_background4.png";
menuBackground.src = encodeURI(menuBackgroundPath);


// Base background
const baseBackground = new Image();
baseBackground.src = encodeURI("./Media/menu_background.png");

// Mission select background
const levelSelectBackground = new Image();
const levelSelectBackgroundPath = "./Media/mission_select.png";
levelSelectBackground.src = encodeURI(levelSelectBackgroundPath);

// Pre-mission briefing background
const preMissionBackground = new Image();
preMissionBackground.src = encodeURI("./Media/levelselect_back.png");

// Bomber sprite
const bomberSprite = new Image();
bomberSprite.src = encodeURI("./Media/bomber5.png");

// Helicopter sprite
const heloSprite = new Image();
heloSprite.src = encodeURI("./Media/helo2.png");

// Bulldozer sprite
const bulldozerSprite = new Image();
bulldozerSprite.src = encodeURI("./Media/bulldozer3.png");

// Sprinkler Trailer sprite
const sprinklerSprite = new Image();
sprinklerSprite.src = encodeURI("./Media/sprinkler.png");

// Forest floor background (tiled world background in play mode)
const forestFloorSprite = new Image();
forestFloorSprite.src = encodeURI("./Media base/forest_floor10.png");

// Settlement sprites
const settlementSprite = new Image();
settlementSprite.src = encodeURI("./Media base/settlement.png");
const settlement3Sprite = new Image();
settlement3Sprite.src = encodeURI("./Media/settlemen_n3.png");
const settlement5Sprite = new Image();
settlement5Sprite.src = encodeURI("./Media/settlemen_n1.png");
const settlement7BurningSprite = new Image();
settlement7BurningSprite.src = encodeURI("./Media/settlemen_n4.png");
const settlement6BurningSprite = new Image();
settlement6BurningSprite.src = encodeURI("./Media/settlemen_n2.png");

// Watch tower sprite
const watchTowerSprite = new Image();
watchTowerSprite.src = encodeURI("./Media/firecrew2.png");

// Drone sprite
const droneSprite = new Image();
droneSprite.src = encodeURI("./Media/drone2.png");

// Wheel selection icons (one per skill, 1–7)
const wheelIconBomber  = new Image(); wheelIconBomber.src  = encodeURI('./Media/bomber_icon.png');
const wheelIconHeli    = new Image(); wheelIconHeli.src    = encodeURI('./Media/heli_icon.png');
const wheelIconBull    = new Image(); wheelIconBull.src    = encodeURI('./Media/bulldozer_icon.png');
const wheelIconSpri    = new Image(); wheelIconSpri.src    = encodeURI('./Media/sprinkler.png');
const wheelIconFW      = new Image(); wheelIconFW.src      = encodeURI('./Media/firewatch_icon.png');
const wheelIconDrone   = new Image(); wheelIconDrone.src   = encodeURI('./Media/drone_icon.png');
const wheelIconRecon   = new Image(); wheelIconRecon.src   = encodeURI('./Media/recon_icon.png');

// Road texture
const roadTextureSprite = new Image();
roadTextureSprite.src = encodeURI("./Media/roadtexture.png");

// Game mode instances
const trainingMode = new TrainingGroundMode();
const fireSeasonMode = new FireSeasonMode();
const pineRidgeMode = new PineRidgeMode();
const wildfireFrontMode = new WildfireFrontMode();
const genericMode = new BaseMode(); // Fallback for custom missions

let currentGameMode = null; // Track which mode is active

// Persistent economy state (survives across missions)
const economyState = new EconomyState();

// Load saved game if one exists (Continue will use this; New Game resets it)
if (EconomyState.hasSavedGame()) {
  economyState.load();
}

// Helper: reset economyState to fresh defaults for New Game
function resetEconomyForNewGame() {
  EconomyState.deleteSave();
  const fresh = new EconomyState();
  Object.assign(economyState, {
    money: fresh.money,
    tutorialComplete: fresh.tutorialComplete,
    fuel: fresh.fuel,
    retardant: fresh.retardant,
    food: fresh.food,
    parts: fresh.parts,
    crewFedStatus: fresh.crewFedStatus,
    loadoutSlots: fresh.loadoutSlots,
    fallbackFundingTier: fresh.fallbackFundingTier,
  });
  economyState.storageLevel = { ...fresh.storageLevel };
  for (const [id, b] of Object.entries(fresh.buildings)) {
    economyState.buildings[id].tier = b.tier;
  }
  economyState.upgrades = new Set();
  economyState.unlockedSkills = new Set([...fresh.unlockedSkills]);
  for (const key of Object.keys(fresh.assetDurability)) {
    economyState.assetDurability[key] = fresh.assetDurability[key];
  }
  // Reset mission progress
  economyState.completedMissions = new Set();
  economyState.missionBestDays = {};
  economyState.save();
}

// Debug console commands
window.grant = (amount = 50000) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    return "Invalid amount. Use grant(1000000) or another positive number.";
  }
  economyState.money += value;
  return `Money: $${economyState.money.toLocaleString()}`;
};
window.resetSave = () => { EconomyState.deleteSave(); location.reload(); };

const musicManager = new MusicManager();

const screenManager = new ScreenManager({
  musicManager,
  screens: {
    title: new TitleScreen({
      backgroundImage: titleBackground,
      onStart: () => screenManager.goTo("menu")
    }),
    menu: new MainMenuScreen({
      backgroundImage: menuBackground,
      onNavigate: (target) => screenManager.goTo(target),
      onNewGame: () => {
        resetEconomyForNewGame();
        screenManager.goTo("base");
      },
      onSettings: () => {
        // TODO: open settings screen
      }
    }),
    base: new BaseScreen({
      backgroundImage: baseBackground,
      economyState,
      missions,
      onSelectMission: (mission) => {
        economyState.save();
        screenManager.goTo("preMission", { mission });
      },
      onBack: () => {
        economyState.save();
        screenManager.goTo("menu");
      },
    }),
    preMission: new PreMissionScreen({
      economyState,
      backgroundImage: preMissionBackground,
      onStart: (payload) => {
        const mission = payload.mission;
        if (mission.id === "training") {
          currentGameMode = trainingMode;
          trainingMode.initializeNewSession(mission.startMoney);
          screenManager.goTo("play", { mission, gameMode: trainingMode, isFirstRun: true });
        } else if (mission.id === "fire_season") {
          currentGameMode = fireSeasonMode;
          fireSeasonMode.initializeNewSession(mission.startMoney);
          screenManager.goTo("play", { mission, gameMode: fireSeasonMode, isFirstRun: true, day: 1, money: mission.startMoney });
        } else if (mission.id === "pine") {
          currentGameMode = pineRidgeMode;
          pineRidgeMode.initializeNewSession(mission.startMoney);
          screenManager.goTo("play", { mission, gameMode: pineRidgeMode, isFirstRun: true, money: mission.startMoney });
        } else if (mission.id === "wildfire") {
          currentGameMode = wildfireFrontMode;
          wildfireFrontMode.initializeNewSession(mission.startMoney);
          screenManager.goTo("play", { mission, gameMode: wildfireFrontMode, isFirstRun: true, money: mission.startMoney });
        } else {
          // Custom mission: use generic mode that respects fireStartCount and fireStartPattern
          currentGameMode = genericMode;
          screenManager.goTo("play", { mission, gameMode: genericMode, isFirstRun: true });
        }
      },
      onBack: () => screenManager.goTo("base", { openMissions: true }),
    }),
    play: new PlayScreen({
      canvas,
      sprites: { ...treeSprites, bomber: bomberSprite, helo: heloSprite, bulldozer: bulldozerSprite, sprinkler: sprinklerSprite, forestFloor: forestFloorSprite, settlement: settlementSprite, settlement3: settlement3Sprite, settlement5: settlement5Sprite, settlement3_burning: settlement7BurningSprite, settlement5_burning: settlement6BurningSprite, watchTower: watchTowerSprite, drone: droneSprite, roadTexture: roadTextureSprite,
        wheelIcons: { 1: wheelIconBomber, 2: wheelIconHeli, 3: wheelIconBull, 4: wheelIconSpri, 5: wheelIconFW, 6: wheelIconDrone, 7: wheelIconRecon } },
      gameMode: trainingMode,
      economyState,
      onExitToMenu: () => screenManager.goTo("base"),
      onLevelComplete: (money) => {
        // Money is already tracked by trainingMode.onLevelComplete in PlayScreen
      },
    }),
    levelComplete: new LevelCompleteScreen({
      onContinue: () => {
        if (!currentGameMode) {
          // Non-mode missions just return to menu
          screenManager.goTo("menu");
          return;
        }

        currentGameMode.progressDay();

        const getMissionIdForMode = (mode) => {
          if (mode === trainingMode) return "training";
          if (mode === fireSeasonMode) return "fire_season";
          if (mode === pineRidgeMode) return "pine";
          if (mode === wildfireFrontMode) return "wildfire";
          return null;
        };

        const missionId = getMissionIdForMode(currentGameMode);
        if (!missionId) {
          screenManager.goTo("menu");
          return;
        }

        const mission = missions.find((m) => m.id === missionId);
        if (!mission) {
          screenManager.goTo("menu");
          return;
        }

        const payload = {
          mission,
          gameMode: currentGameMode,
          isFirstRun: false,
          money: currentGameMode.getStartingMoney?.(mission.startMoney) ?? mission.startMoney,
        };

        if (currentGameMode === fireSeasonMode) {
          payload.day = fireSeasonMode.currentDay;
        }

        screenManager.goTo("play", payload);
      },
      onReturnToMenu: () => {
        if (currentGameMode) {
          currentGameMode.reset();
        }
        economyState.save();
        screenManager.goTo("base", { openMissions: true });
      },
    }),
  },
  initial: "title",
});

// Set screenManager reference after initialization to avoid circular dependency
screenManager.screens.play.screenManager = screenManager;

// Enable responsive resizing now that screenManager exists
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

let lastTime = performance.now();
function loop(time) {
  const dt = (time - lastTime) / 1000;
  lastTime = time;

  musicManager.update(dt);
  screenManager.update(dt);
  screenManager.render(ctx);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

canvas.addEventListener("pointerdown", (evt) => {
  // Prevent the browser autoscroll cursor from appearing on middle-click
  if (evt.button === 1) evt.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (evt.clientX - rect.left) * scaleX;
  const y = (evt.clientY - rect.top) * scaleY;
  screenManager.handlePointerDown(x, y, evt);
});

canvas.addEventListener("contextmenu", (evt) => {
  // Prevent the browser context menu while playing
  evt.preventDefault();
});

canvas.addEventListener("pointermove", (evt) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (evt.clientX - rect.left) * scaleX;
  const y = (evt.clientY - rect.top) * scaleY;
  screenManager.handlePointerMove(x, y, evt);
});

canvas.addEventListener("pointerup", (evt) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (evt.clientX - rect.left) * scaleX;
  const y = (evt.clientY - rect.top) * scaleY;
  screenManager.handlePointerUp(x, y, evt);
});

window.addEventListener("keydown", (evt) => {
  screenManager.handleKeyDown(evt);
});

// Release held mouse buttons when window loses focus (prevents stuck Fire Truck / Fire Crew)
window.addEventListener("blur", () => {
  screenManager.handleWindowBlur();
});

// Support mouse wheel zoom in/out in play screen, and scrolling in region map
window.addEventListener("wheel", (evt) => {
  const screen = screenManager.current;
  if (!screen) return;

  // Region map: scroll mission list
  if (typeof screen.handleWheel === "function" && !screen.gameState) {
    screen.handleWheel(evt);
    evt.preventDefault();
    return;
  }

  // Play screen: zoom
  if (!screen.gameState) return;
  const zoomStep = 0.01;
  const minZoom = 2.5;
  const maxZoom = 1.75;
  if (evt.deltaY > 0) {
    screen.gameState.camera.zoom = Math.max(minZoom, screen.gameState.camera.zoom - zoomStep);
  } else if (evt.deltaY < 0) {
    screen.gameState.camera.zoom = Math.min(maxZoom, screen.gameState.camera.zoom + zoomStep);
  }
  evt.preventDefault();
}, { passive: false });

window.addEventListener("keyup", (evt) => {
  screenManager.handleKeyUp(evt);
});
