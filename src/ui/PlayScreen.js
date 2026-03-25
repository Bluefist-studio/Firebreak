import { GameState } from "../core/GameState.js";
import { FireControlModal } from "./FireControlModal.js";
import { HelpTooltipsModal } from "./HelpTooltipsModal.js";
import { SkillHotbarHUD } from "./SkillHotbarHUD.js";
import { TopStatusHUD } from "./TopStatusHUD.js";

export class PlayScreen {
  constructor({ onExitToMenu, canvas, sprites, screenManager, onLevelComplete, economyState }) {
    this.onExitToMenu = onExitToMenu;
    this.canvas = canvas;
    this.sprites = sprites;
    this.screenManager = screenManager;
    this.onLevelComplete = onLevelComplete;
    this.economyState = economyState ?? null;
    this.gameState = null;
    this.gameMode = null;
    this.fireControlModal = null;
    this.helpTooltipsModal = new HelpTooltipsModal();
    this.skillHotbarHUD = null;
    this.topStatusHUD = null;
    this.keys = {};
    this.mouse = { x: 0, y: 0 };
    this.leftHeld = false;
    this.rightHeld = false;
    this.currentMission = null;
    this.levelCompleteHandled = false;
    
    // Announcement state
    this.showingAnnouncement = false;
    this.announcementTimer = 0;
    this.announcementDuration = 6; // 6 seconds
    this.announcementText = "";
    this.isFirstTrainingRun = false;
    this.currentDay = 0;

    // Game speed control
    this.gameSpeed = 1;
    this.speedLevels = [1, 2, 3, 5];
  }

  onEnter(payload) {
    if (payload?.mission) {
      this.currentMission = payload.mission;
      this.gameMode = payload.gameMode ?? null;
      this.isFirstTrainingRun = payload.isFirstRun ?? false;
      this.currentDay = payload.day ?? 0;
      this.levelCompleteHandled = false;
      this.gameSpeed = 1;
      
      const viewport = {
        width: this.canvas?.width ?? 1280,
        height: this.canvas?.height ?? 720,
      };
      
      // If a mode is available, use it to scale the mission
      let scaledMission = payload.mission;
      if (this.gameMode && typeof this.gameMode.getScaledMission === "function") {
        scaledMission = this.gameMode.getScaledMission(payload.mission);
      } else {
        scaledMission = JSON.parse(JSON.stringify(payload.mission));
      }
      
      // Get announcement text from mode if available
      if (this.gameMode && typeof this.gameMode.getAnnouncementText === "function") {
        this.announcementText = this.gameMode.getAnnouncementText(this.isFirstTrainingRun);
        this.showingAnnouncement = true;
      } else {
        this.showingAnnouncement = false;
      }
      this.announcementTimer = 0;
      
      // Get starting money from mode if available
      let startingMoney = payload.money ?? scaledMission.startMoney;
      if (this.gameMode && typeof this.gameMode.getStartingMoney === "function") {
        startingMoney = this.gameMode.getStartingMoney(scaledMission.startMoney);
      }
      
      // Reset held mouse buttons so the new mission doesn't inherit a stuck right/left click
      this.rightHeld = false;
      this.leftHeld = false;

      this.gameState = new GameState({ mission: scaledMission, gameMode: this.gameMode, viewport, sprites: this.sprites, economyState: this.economyState });
      
      // Override money with calculated amount
      this.gameState.money = startingMoney;
      
      // Set current day for HUD display
      this.gameState.currentDay = this.currentDay;
      
      this.fireControlModal = new FireControlModal({ gameState: this.gameState });
      this.skillHotbarHUD = new SkillHotbarHUD({ gameState: this.gameState });
      this.topStatusHUD = new TopStatusHUD({ gameState: this.gameState, playScreen: this });
      this.gameState.start();
    }
  }

  update(dt) {
    if (!this.gameState) return;

    // Handle announcement display
    if (this.showingAnnouncement) {
      this.announcementTimer += dt;
      if (this.announcementTimer >= this.announcementDuration) {
        this.showingAnnouncement = false;
      }
    }

    // Check if level is complete (fire controlled or failed)
    if ((this.gameState.over || this._checkBurnFailure()) && !this.levelCompleteHandled) {
      this.levelCompleteHandled = true;
      
      // Force game over state if burn failure triggered while fire still active
      this.gameState.over = true;
      this.gameState.saved = this.gameState.forest.normalCount;
      
      // Calculate burn percentage for failure check (only fully burnt trees count)
      const totalTrees = this.gameState.forest.treeCount || 1;
      const burntCount = this.gameState.forest.burntCount || 0;
      const burnPercent = (burntCount / totalTrees) * 100;
      const failThreshold = this.currentMission?.failBurnPercent ?? 100;
      const isFailed = burnPercent >= failThreshold || (this.gameState.settlementFailed ?? false);
      
      // Save the money for next level
      this.onLevelComplete?.(this.gameState.money);

      // Calculate and apply mission reward (skip for free/training modes and failures)
      let reward = this.currentMission?.missionReward ?? 0;
      const isFreeMode = this.gameMode?.isSkillFree?.() ?? false;

      // Fire Season: day-based reward formula
      if (!isFreeMode && this.currentMission?.id === "fire_season" && this.gameMode?.currentDay != null) {
        reward = 1000 + 500 * this.gameMode.currentDay;
      }

      if (isFailed) reward = 0;

      if (reward > 0 && this.economyState && !isFreeMode) {
        this.economyState.addMissionReward(reward);
      }

      // Food is now consumed in real-time during mission — just track total for display
      const foodWear = Math.ceil(this.gameState.foodWearAccumulated || 0);

      // Fallback government funding — only granted on mission failure if player is low (skip for training)
      let fallbackGrant = 0;
      if (isFailed && this.economyState && !isFreeMode) {
        const fundingAmount = this.economyState.getFallbackFunding();
        if (this.economyState.money < fundingAmount) {
          fallbackGrant = fundingAmount - this.economyState.money;
          this.economyState.money = fundingAmount;
        }
      }
      
      // Persist money and state for endless/campaign modes
      this.gameMode?.onLevelComplete?.(this.gameState.money);

      this.screenManager?.goTo("levelComplete", {
        mission: this.currentMission,
        saved: this.gameState.saved,
        burntCount: this.gameState.forest.burntCount,
        totalTrees: this.gameState.forest.treeCount,
        burnPercent: Math.round(burnPercent),
        isFailed,
        reward: isFreeMode ? 0 : reward,
        fallbackGrant,
        foodWear: Math.ceil(this.gameState.foodWearAccumulated || 0),
        fuelConsumed: this.gameState.fuelConsumed || 0,
        retardantConsumed: this.gameState.retardantConsumed || 0,
        isEndless: this.currentMission?.id === "fire_season",
        currentDay: this.gameMode?.currentDay ?? 0,
        settlements: this.gameState.settlements ?? [],
        settlementFailed: this.gameState.settlementFailed ?? false,
      });
      return; // Don't continue updating
    }

    const cam = this.gameState.camera;
    const viewW = this.canvas.width / cam.zoom;
    const viewH = this.canvas.height / cam.zoom;
    const panSpeed = 350 * dt;

    // Allow WASD camera control even while cutting/spraying
    if (this.keys["w"]) cam.y -= panSpeed;
    if (this.keys["s"]) cam.y += panSpeed;
    if (this.keys["a"]) cam.x -= panSpeed;
    if (this.keys["d"]) cam.x += panSpeed;

    cam.x = Math.max(0, Math.min(this.gameState.forest.width - viewW, cam.x));
    cam.y = Math.max(0, Math.min(this.gameState.forest.height - viewH, cam.y));

    const worldX = cam.x + this.mouse.x / cam.zoom;
    const worldY = cam.y + this.mouse.y / cam.zoom;
    this.gameState.setPlayerInput({
      x: worldX,
      y: worldY,
      left: this.leftHeld,
      right: this.rightHeld,
    });

    this.gameState.gameSpeed = this.gameSpeed;
    this.gameState.update(dt * this.gameSpeed);
  }

  render(ctx) {
    this.gameState?.render(ctx);
    this.topStatusHUD?.render(ctx);
    
    // Only show FireControlModal if mode allows it
    if (this.gameMode?.shouldShowFireControl?.() ?? true) {
      this.fireControlModal?.render(ctx);
    }
    
    this.skillHotbarHUD?.render(ctx);
    this.helpTooltipsModal?.render(ctx);
    
    // Display announcement overlay if active
    if (this.showingAnnouncement) {
      // Calculate opacity - fade out over time
      const fadeProgress = this.announcementTimer / this.announcementDuration;
      const opacity = Math.max(0, 1 - fadeProgress); // Fade from 1 to 0
      
      ctx.fillStyle = `rgba(255, 215, 0, ${opacity})`;
      ctx.font = "bold 40px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.announcementText, ctx.canvas.width / 2, ctx.canvas.height / 2);
    }
  }

  handlePointerDown(x, y, evt) {
    this.mouse.x = x;
    this.mouse.y = y;

    // If help modal is open, route input to it first and consume on click
    if (this.helpTooltipsModal?.isOpen) {
      if (this.helpTooltipsModal.handlePointerDown(x, y)) {
        return;
      }
      // keep allowing clicks to fall through when background is clicked
    }

    // Check if click is on the clock/speed controls
    if (this.topStatusHUD?.handlePointerDown(x, y)) {
      return;
    }

    // Check if click is on the skill hotbar HUD first
    if (this.skillHotbarHUD?.handlePointerDown(x, y)) {
      return;
    }

    // If fire control modal is expanded, route input to it
    if (this.fireControlModal?.isExpanded) {
      this.fireControlModal.handlePointerDown(x, y);
      return;
    }

    // Always route to fire control modal (for collapse/expand toggle on header)
    this.fireControlModal?.handlePointerDown(x, y);

    // If mission is over, the level complete screen should show.
    // (Handled by update() transition, but safety fallback)
    if (this.gameState?.over) {
      return;
    }

    // Pass pointer input to GameState (for camera centering and skill usage).
    if (!this.gameState?.started || evt.button === 1) {
      this.gameState?.handlePointerDown(x, y, evt);
    } else {
      // If a skill is selected, the GameState will consume the click via handlePointerDown.
      // Only set the held flags when not deploying a skill.
      const selectedSkill = this.gameState?.selectedSkillKey;
      const inWaterBomberMode = this.gameState?.waterBomberMode;
      const inHeliDropMode = this.gameState?.heliDropMode;
      const inWorkerCrewMode = this.gameState?.workerCrewMode;
      const inWatchTowerMode = this.gameState?.watchTowerMode;
      const inDroneReconMode = this.gameState?.droneReconMode || this.gameState?.droneReconMoving;
      const inEngineTruckMode = this.gameState?.engineTruckMode;
      const inReconPlaneMode = this.gameState?.reconPlaneMode;
      
      if (!selectedSkill && !inWaterBomberMode && !inHeliDropMode && !inWorkerCrewMode && !inWatchTowerMode && !inDroneReconMode && !inEngineTruckMode && !inReconPlaneMode) {
        // Check if clicking on an active drone to select it
        if (this.gameState?.droneReconActive?.length > 0 && evt.button === 0) {
          const worldX = x / (this.gameState.camera?.zoom || 1) + (this.gameState.camera?.x || 0);
          const worldY = y / (this.gameState.camera?.zoom || 1) + (this.gameState.camera?.y || 0);
          for (const d of this.gameState.droneReconActive) {
            const dx = worldX - d.x;
            const dy = worldY - d.y;
            if (Math.sqrt(dx * dx + dy * dy) <= 30) {
              this.gameState.handlePointerDown(x, y, evt);
              return;
            }
          }
        }
        if (evt.button === 0) this.leftHeld = true;
        if (evt.button === 2) this.rightHeld = true;
      } else {
        this.gameState?.handlePointerDown(x, y, evt);
      }
    }
  }

  handlePointerMove(x, y, evt) {
    this.mouse.x = x;
    this.mouse.y = y;

    // Sync button state from the browser's authoritative bitmask to prevent stuck buttons
    if (evt) {
      this.leftHeld  = (evt.buttons & 1) !== 0;
      this.rightHeld = (evt.buttons & 2) !== 0;
    }

    // Update bulldozer cursor position
    if (this.gameState?.bulldozerActive) {
      this.gameState.bulldozerMouseX = x;
      this.gameState.bulldozerMouseY = y;
    }

    // Update heli drop targeting circle position
    if (this.gameState?.heliDropMode) {
      const cam = this.gameState.camera;
      const worldX = cam.x + x / cam.zoom;
      const worldY = cam.y + y / cam.zoom;
      this.gameState.heliDropMouseX = worldX;
      this.gameState.heliDropMouseY = worldY;
    }

    // Update worker crew targeting circle position
    if (this.gameState?.workerCrewMode) {
      const cam = this.gameState.camera;
      const worldX = cam.x + x / cam.zoom;
      const worldY = cam.y + y / cam.zoom;
      this.gameState.workerCrewMouseX = worldX;
      this.gameState.workerCrewMouseY = worldY;
    }

    // Update watch tower targeting circle position
    if (this.gameState?.watchTowerMode) {
      const cam = this.gameState.camera;
      const worldX = cam.x + x / cam.zoom;
      const worldY = cam.y + y / cam.zoom;
      this.gameState.watchTowerMouseX = worldX;
      this.gameState.watchTowerMouseY = worldY;
    }

    // Update drone recon targeting circle position
    if (this.gameState?.droneReconMode || this.gameState?.droneReconMoving) {
      const cam = this.gameState.camera;
      const worldX = cam.x + x / cam.zoom;
      const worldY = cam.y + y / cam.zoom;
      this.gameState.droneReconMouseX = worldX;
      this.gameState.droneReconMouseY = worldY;
    }

    // Update recon plane targeting circle position
    if (this.gameState?.reconPlaneMode) {
      const cam = this.gameState.camera;
      const worldX = cam.x + x / cam.zoom;
      const worldY = cam.y + y / cam.zoom;
      this.gameState.reconPlaneMouseX = worldX;
      this.gameState.reconPlaneMouseY = worldY;
    }
  }

  handleKeyDown(evt) {
    const key = evt.key.toLowerCase();
    this.keys[key] = true;

    // Don't allow other input while fire control modal is open and expanded
    if (this.fireControlModal?.isExpanded) {
      return;
    }

    if (key === "i") {
      this.helpTooltipsModal.toggle();
      return;
    }

    if (key === "escape") {
      // Don't allow escape once level complete is being handled
      if (!this.levelCompleteHandled) {
        this.onExitToMenu?.();
      }
      return;
    }

    // Speed controls: '-' to slow down, '+' or '=' to speed up
    if (this.gameState) {
      if (key === "-") {
        const idx = this.speedLevels.indexOf(this.gameSpeed);
        if (idx > 0) this.gameSpeed = this.speedLevels[idx - 1];
        return;
      }
      if (key === "=" || key === "+") {
        const idx = this.speedLevels.indexOf(this.gameSpeed);
        if (idx < this.speedLevels.length - 1) this.gameSpeed = this.speedLevels[idx + 1];
        return;
      }
    }

    this.gameState?.handleKeyDown(evt);
  }

  handleKeyUp(evt) {
    const key = evt.key.toLowerCase();
    this.keys[key] = false;
    this.gameState?.handleKeyUp?.(evt);
  }

  handlePointerUp(evt) {
    // Use the bitmask of still-held buttons for accuracy (handles multi-button release order)
    if (evt) {
      this.leftHeld  = (evt.buttons & 1) !== 0;
      this.rightHeld = (evt.buttons & 2) !== 0;
    } else {
      if (evt?.button === 0) this.leftHeld = false;
      if (evt?.button === 2) this.rightHeld = false;
    }
  }

  handleWindowBlur() {
    // Release all held mouse buttons when the window loses focus to prevent stuck states
    this.rightHeld = false;
    this.leftHeld = false;
  }

  _checkBurnFailure() {
    if (!this.gameState || this.gameState.timeSinceStart < 1) return false;
    const totalTrees = this.gameState.forest.treeCount || 1;
    const burntCount = this.gameState.forest.burntCount || 0;
    const burnPercent = (burntCount / totalTrees) * 100;
    const failThreshold = this.currentMission?.failBurnPercent ?? 100;
    return burnPercent >= failThreshold;
  }
}
