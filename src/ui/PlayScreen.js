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

    // End-of-mission overlay (shown in-place before navigating away)
    this._missionOver = false;
    this._missionOverPayload = null;
    this._resultsMinimized = false;
    this._resultsButtons = [];
  }

  onEnter(payload) {
    if (payload?.mission) {
      this.currentMission = payload.mission;
      this.gameMode = payload.gameMode ?? null;
      this.isFirstTrainingRun = payload.isFirstRun ?? false;
      this.currentDay = payload.day ?? 0;
      this.levelCompleteHandled = false;
      this.gameSpeed = 1;
      this._missionOver = false;
      this._missionOverPayload = null;
      this._resultsMinimized = false;
      this._resultsButtons = [];
      
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

      this._missionOver = true;
      this._resultsMinimized = false;
      this._missionOverPayload = {
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
      };
      return;
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

    // If mission is over, allow panning but freeze all game logic
    if (this._missionOver) return;

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

    if (this._missionOver) {
      this._renderEndOverlay(ctx);
      return;
    }

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

    // Handle end-of-mission overlay buttons first
    if (this._missionOver) {
      for (const btn of this._resultsButtons) {
        if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
          btn.callback();
          return;
        }
      }
      return;
    }

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

  _renderEndOverlay(ctx) {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const p = this._missionOverPayload;
    if (!p) return;

    this._resultsButtons = [];

    if (this._resultsMinimized) {
      // Small "Show Results" chip at top-center
      const bw = 180, bh = 36, bx = (W - bw) / 2, by = 12;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = "#aaa";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 15px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("▲  Show Results", bx + bw / 2, by + bh / 2);
      this._resultsButtons.push({ x: bx, y: by, w: bw, h: bh, callback: () => { this._resultsMinimized = false; } });
      return;
    }

    // Full results panel
    const panelW = Math.min(480, W - 40);
    const panelH = Math.min(520, H - 40);
    const panelX = (W - panelW) / 2;
    const panelY = (H - panelH) / 2;

    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.strokeStyle = p.isFailed ? "#f44" : "#4CAF50";
    ctx.lineWidth = 2;
    ctx.strokeRect(panelX, panelY, panelW, panelH);

    const cx = panelX + panelW / 2;
    let ly = panelY + 36;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // Title
    ctx.fillStyle = p.isFailed ? "#f66" : "#8f8";
    ctx.font = "bold 30px Arial";
    const title = p.isEndless
      ? (p.isFailed ? `Day ${p.currentDay + 1} — Season Over!` : `Day ${p.currentDay + 1} Survived!`)
      : (p.isFailed ? "Mission Failed" : "Level Complete!");
    ctx.fillText(title, cx, ly); ly += 36;

    ctx.fillStyle = "#ccc";
    ctx.font = "18px Arial";
    ctx.fillText(`Mission: ${p.mission?.name ?? ""}`, cx, ly); ly += 28;
    ctx.fillText(`Trees Saved: ${p.saved}`, cx, ly); ly += 24;
    ctx.fillText(`Trees Burnt: ${p.burntCount} (${p.burnPercent}%)`, cx, ly); ly += 24;

    // Settlements
    if (p.settlements?.length > 0) {
      const safe = p.settlements.filter(s => !s.destroyed).length;
      ctx.font = "bold 18px Arial";
      ctx.fillStyle = safe === p.settlements.length ? "#8f8" : safe === 0 ? "#f44" : "#fa0";
      ctx.fillText(`Settlements: ${safe} / ${p.settlements.length} protected`, cx, ly); ly += 22;
      for (const s of p.settlements) {
        ctx.font = "15px Arial";
        ctx.fillStyle = s.destroyed ? "#f77" : "#8f8";
        ctx.fillText(`${s.name}: ${s.destroyed ? "DESTROYED" : "Safe"}`, cx, ly); ly += 20;
      }
      ly += 6;
    }

    // Reward / failure note
    if (p.isFailed) {
      ctx.fillStyle = "#f44";
      ctx.font = "bold 18px Arial";
      ctx.fillText(p.settlementFailed ? "A settlement was destroyed!" : `Too much forest lost! (limit: ${p.mission?.failBurnPercent ?? 0}%)`, cx, ly); ly += 26;
      ctx.fillStyle = "#aaa"; ctx.font = "16px Arial";
      ctx.fillText("No reward earned.", cx, ly); ly += 24;
    } else if (p.reward > 0) {
      ctx.fillStyle = "#4CAF50"; ctx.font = "bold 22px Arial";
      ctx.fillText(`Reward: $${p.reward.toLocaleString()}`, cx, ly); ly += 30;
    }
    if (p.fallbackGrant > 0) {
      ctx.fillStyle = "#FFD54F"; ctx.font = "bold 18px Arial";
      ctx.fillText(`Government Funding: +$${p.fallbackGrant.toLocaleString()}`, cx, ly); ly += 26;
    }

    // Resources
    if (p.fuelConsumed > 0 || p.retardantConsumed > 0 || p.foodWear > 0) {
      ly += 4;
      ctx.fillStyle = "#888"; ctx.font = "bold 15px Arial";
      ctx.fillText("— Resource Usage —", cx, ly); ly += 22;
      if (p.fuelConsumed > 0) { ctx.fillStyle = "#f90"; ctx.font = "16px Arial"; ctx.fillText(`Fuel: ${p.fuelConsumed}`, cx, ly); ly += 20; }
      if (p.retardantConsumed > 0) { ctx.fillStyle = "#f44"; ctx.font = "16px Arial"; ctx.fillText(`Retardant: ${p.retardantConsumed}`, cx, ly); ly += 20; }
      if (p.foodWear > 0) { ctx.fillStyle = "#f94"; ctx.font = "16px Arial"; ctx.fillText(`Food consumed: ${p.foodWear}`, cx, ly); ly += 20; }
    }

    // Buttons
    const btnW = 160, btnH = 42, btnGap = 16;
    const totalBtnsW = p.isEndless && !p.isFailed ? btnW * 2 + btnGap : btnW + btnGap + btnW;
    const btnStartX = cx - totalBtnsW / 2;
    const btnY = panelY + panelH - btnH - 16;

    // "View Map" button (always present)
    const viewBtn = { x: btnStartX, y: btnY, w: btnW, h: btnH };
    ctx.fillStyle = "#333";
    ctx.fillRect(viewBtn.x, viewBtn.y, viewBtn.w, viewBtn.h);
    ctx.strokeStyle = "#888"; ctx.lineWidth = 1;
    ctx.strokeRect(viewBtn.x, viewBtn.y, viewBtn.w, viewBtn.h);
    ctx.fillStyle = "#ddd"; ctx.font = "bold 16px Arial";
    ctx.textBaseline = "middle";
    ctx.fillText("▼  View Map", viewBtn.x + viewBtn.w / 2, viewBtn.y + viewBtn.h / 2);
    this._resultsButtons.push({ ...viewBtn, callback: () => { this._resultsMinimized = true; } });

    // Primary action button
    const actBtn = { x: btnStartX + btnW + btnGap, y: btnY, w: btnW, h: btnH };
    const actLabel = p.isEndless && !p.isFailed ? "Next Day →" : (p.isEndless ? "End Season" : "Return to Base");
    ctx.fillStyle = "#4CAF50";
    ctx.fillRect(actBtn.x, actBtn.y, actBtn.w, actBtn.h);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1;
    ctx.strokeRect(actBtn.x, actBtn.y, actBtn.w, actBtn.h);
    ctx.fillStyle = "#fff"; ctx.font = "bold 16px Arial";
    ctx.fillText(actLabel, actBtn.x + actBtn.w / 2, actBtn.y + actBtn.h / 2);
    this._resultsButtons.push({
      ...actBtn,
      callback: () => {
        this._missionOver = false;
        this.screenManager?.goTo("levelComplete", this._missionOverPayload);
      },
    });
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
