import { ScreenManager } from "./core/ScreenManager.js";
import { EconomyState } from "./core/EconomyState.js";
import { TitleScreen } from "./ui/TitleScreen.js";
import { MainMenuScreen } from "./ui/MainMenuScreen.js";
import { BaseScreen } from "./ui/BaseScreen.js";
import { RegionMapScreen } from "./ui/RegionMapScreen.js";
import { PlayScreen } from "./ui/PlayScreen.js";
import { LevelCompleteScreen } from "./ui/LevelCompleteScreen.js";
import { PreMissionScreen } from "./ui/PreMissionScreen.js";
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
const treeSprites = {
  normal: new Image(),
  burning: new Image(),
  burnt: new Image(),
  wet: new Image(),
};

const spritePaths = {
  normal: "./Media/normal_tree2.png",
  burning: "./Media/burning_tree2.png",
  burnt: "./Media/burnt_tree.png",
  wet: "./Media/suppresed_tree.png",
};

for (const key of Object.keys(spritePaths)) {
  treeSprites[key].src = encodeURI(spritePaths[key]);
}

// Title/backdrop image (shown on the title screen)
const titleBackground = new Image();
const titleBackgroundPath = "./Media/menu_background10.png";
titleBackground.src = encodeURI(titleBackgroundPath);


// Main menu background
const menuBackground = new Image();
const menuBackgroundPath = "./Media/menu_background9.png";
menuBackground.src = encodeURI(menuBackgroundPath);


// Base background
const baseBackground = new Image();
baseBackground.src = encodeURI("./Media/base_background3.png");

// Mission select background
const levelSelectBackground = new Image();
const levelSelectBackgroundPath = "./Media/mission_select.png";
levelSelectBackground.src = encodeURI(levelSelectBackgroundPath);

// Bomber sprite
const bomberSprite = new Image();
bomberSprite.src = encodeURI("./Media/bomber.png");

// Helicopter sprite
const heloSprite = new Image();
heloSprite.src = encodeURI("./Media/helo.png");

// Bulldozer sprite
const bulldozerSprite = new Image();
bulldozerSprite.src = encodeURI("./Media/bulldozer.png");

// Game mode instances
const trainingMode = new TrainingGroundMode();
const fireSeasonMode = new FireSeasonMode();
const pineRidgeMode = new PineRidgeMode();
const wildfireFrontMode = new WildfireFrontMode();

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
  for (const key of Object.keys(fresh.assetDurability)) {
    economyState.assetDurability[key] = fresh.assetDurability[key];
  }
  economyState.save();
}

// Debug console commands
window.grant = () => { economyState.money += 50000; return `Money: $${economyState.money.toLocaleString()}`; };
window.resetSave = () => { EconomyState.deleteSave(); location.reload(); };

const screenManager = new ScreenManager({
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
      onNavigate: (target) => {
        if (target === "missions") {
          economyState.save();
          screenManager.goTo("region");
        }
      },
      onBack: () => {
        economyState.save();
        screenManager.goTo("menu");
      },
    }),
    region: new RegionMapScreen({
      backgroundImage: levelSelectBackground,
      missions,
      onBack: () => screenManager.goTo("base"),
      onSelectMission: (mission) => {
        screenManager.goTo("preMission", { mission });
      }
    }),
    preMission: new PreMissionScreen({
      economyState,
      onStart: (payload) => {
        const mission = payload.mission;
        if (mission.id === "training") {
          currentGameMode = trainingMode;
          trainingMode.initializeNewSession(mission.startMoney);
          screenManager.goTo("play", { mission, gameMode: trainingMode, isFirstRun: true });
        } else if (mission.id === "fire_season") {
          currentGameMode = fireSeasonMode;
          fireSeasonMode.initializeNewSession(mission.startMoney);
          screenManager.goTo("play", { mission, gameMode: fireSeasonMode, isFirstRun: true, day: 0, money: mission.startMoney });
        } else if (mission.id === "pine") {
          currentGameMode = pineRidgeMode;
          pineRidgeMode.initializeNewSession(mission.startMoney);
          screenManager.goTo("play", { mission, gameMode: pineRidgeMode, isFirstRun: true, money: mission.startMoney });
        } else if (mission.id === "wildfire") {
          currentGameMode = wildfireFrontMode;
          wildfireFrontMode.initializeNewSession(mission.startMoney);
          screenManager.goTo("play", { mission, gameMode: wildfireFrontMode, isFirstRun: true, money: mission.startMoney });
        } else {
          currentGameMode = null;
          screenManager.goTo("play", { mission, isFirstRun: true });
        }
      },
      onBack: () => screenManager.goTo("region"),
    }),
    play: new PlayScreen({
      canvas,
      sprites: { ...treeSprites, bomber: bomberSprite, helo: heloSprite, bulldozer: bulldozerSprite },
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
        screenManager.goTo("base");
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

  screenManager.update(dt);
  screenManager.render(ctx);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

canvas.addEventListener("pointerdown", (evt) => {
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

// Support mouse wheel zoom in/out in play screen
window.addEventListener("wheel", (evt) => {
  const playScreen = screenManager.current;
  if (!playScreen || !(playScreen instanceof Object) || !playScreen.gameState) return;

  const zoomStep = 0.0;
  const minZoom = 1.75;
  const maxZoom = 1.75;
  if (evt.deltaY > 0) {
    playScreen.gameState.camera.zoom = Math.max(minZoom, playScreen.gameState.camera.zoom - zoomStep);
  } else if (evt.deltaY < 0) {
    playScreen.gameState.camera.zoom = Math.min(maxZoom, playScreen.gameState.camera.zoom + zoomStep);
  }
  evt.preventDefault();
}, { passive: false });

window.addEventListener("keyup", (evt) => {
  screenManager.handleKeyUp(evt);
});
