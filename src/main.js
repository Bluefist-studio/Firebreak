import { ScreenManager } from "./core/ScreenManager.js";
import { TitleScreen } from "./ui/TitleScreen.js";
import { MainMenuScreen } from "./ui/MainMenuScreen.js";
import { RegionMapScreen } from "./ui/RegionMapScreen.js";
import { PlayScreen } from "./ui/PlayScreen.js";
import { LevelCompleteScreen } from "./ui/LevelCompleteScreen.js";
import { TrainingGroundMode } from "./modes/TrainingGroundMode.js";
import { FireSeasonMode } from "./modes/FireSeasonMode.js";
import { PineRidgeMode } from "./modes/PineRidgeMode.js";
import { WildfireFrontMode } from "./modes/WildfireFrontMode.js";
import { missions } from "./data/missions.js";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

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
const titleBackgroundPath = "./Media/menu_background5.png";
titleBackground.src = encodeURI(titleBackgroundPath);


// Main menu background
const menuBackground = new Image();
const menuBackgroundPath = "./Media/menu_background4.png";
menuBackground.src = encodeURI(menuBackgroundPath);


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

const screenManager = new ScreenManager({
  screens: {
    title: new TitleScreen({
      backgroundImage: titleBackground,
      onStart: () => screenManager.goTo("menu")
    }),
    menu: new MainMenuScreen({
      backgroundImage: menuBackground,
      onNavigate: (target) => screenManager.goTo(target)
    }),
    region: new RegionMapScreen({
      backgroundImage: levelSelectBackground,
      missions,
      onBack: () => screenManager.goTo("menu"),
      onSelectMission: (mission) => {
        // Select appropriate game mode based on mission
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
          // Non-mode missions (none currently)
          currentGameMode = null;
          screenManager.goTo("play", { mission, isFirstRun: true });
        }
      }
    }),
    play: new PlayScreen({
      canvas,
      sprites: { ...treeSprites, bomber: bomberSprite, helo: heloSprite, bulldozer: bulldozerSprite },
      gameMode: trainingMode,  // Default to training mode, will be updated dynamically
      onExitToMenu: () => screenManager.goTo("menu"),
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
        screenManager.goTo("menu");
      },
    }),
  },
  initial: "title",
});

// Set screenManager reference after initialization to avoid circular dependency
screenManager.screens.play.screenManager = screenManager;

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

window.addEventListener("keyup", (evt) => {
  screenManager.handleKeyUp(evt);
});
