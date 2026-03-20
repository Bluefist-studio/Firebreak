import { Forest } from "./Forest.js";
import { WeatherSystem } from "../systems/WeatherSystem.js";
import { FireSpreadSystem } from "../systems/FireSpreadSystem.js";

export class GameState {
  constructor({ mission, gameMode = null, viewport = { width: 1280, height: 720 }, sprites = null }) {
    this.mission = mission;
    this.gameMode = gameMode;
    this.viewport = viewport;
    this.sprites = sprites;
    this.bomberSprite = sprites?.bomber || null;
    this.heloSprite = sprites?.helo || null;
    this.bulldozerSprite = sprites?.bulldozer || null;
    this.started = false;
    this.over = false;
    this.timeSinceStart = 0;

    this.weather = new WeatherSystem({
      temperature: mission.weather?.temperature ?? 22,
      humidity: mission.weather?.humidity ?? 40,
      windAngle: mission.weather?.windAngle ?? 0,
      windStrength: mission.weather?.windStrength ?? 0.3,
    });

    this.forest = new Forest({
      width: mission.width,
      height: mission.height,
      treeCount: mission.treeCount,
      sprites: this.sprites,
    });

    this.fire = new FireSpreadSystem({ forest: this.forest, weather: this.weather });

    this.camera = { x: 0, y: 0, zoom: 1.25 };
    this.player = { x: this.camera.x + 400, y: this.camera.y + 300 };

    this.money = mission.startMoney;
    this.saved = 0;

    // Skill system (activated with number keys 1-5 + click)
    this.skills = {
      1: { id: "waterBomber", name: "Water Bomber", cost: 100, radius: 220 },
      2: { id: "bulldozer", name: "Bulldozer", cost: 40, radius: 180 },
      3: { id: "heliDrop", name: "Heli Drop", cost: 50, radius: 260 },
      4: { id: "workerCrew", name: "Worker Crew", cost: 50, radius: 140 },
      5: { id: "watchTower", name: "Watch Tower", cost: 20, radius: 320 },
    };
    this.selectedSkillKey = null;
    this.skillMessage = "";
    this.skillMessageTimer = 0;

    // Watch Tower skill (key 5) - minimap fog of war reveal
    this.watchTowerMode = false; // targeting mode
    this.watchTowerMouseX = 0;
    this.watchTowerMouseY = 0;
    this.watchTowerZones = []; // Array of { x, y, radius }
    this.watchTowerCooldown = 0;
    this.watchTowerCooldownDuration = 10; // 10 second cooldown
    this.waterBomberMode = null; // null, "selectStart", "selectEnd"
    this.waterBomberStart = null;
    this.waterBomberPreview = null;
    this.waterBomberStrafing = false;
    this.waterBomberStrafeTime = 0;
    this.waterBomberStrafeDuration = 2.5; // 2.5 second strafe duration
    this.waterBomberStrafeRadius = 36; // 1.5 * player spray radius (24)
    this.waterBomberPath = null; // { startX, startY, endX, endY, entryX, entryY, exitX, exitY }
    this.waterBomberEndpointHit = false; // Track if suppression has been applied
    this.waterBomberCooldown = 0; // Cooldown timer
    this.waterBomberCooldownDuration = 8; // 8 second cooldown between uses

    // Bulldozer skill (key 2) - faster cutting with energy system
    this.bulldozerActive = false;
    this.bulldozerEnergy = 100; // 0-100
    this.bulldozerMaxEnergy = 100;
    this.bulldozerRechargeRate = 5; // energy per second when not active
    this.bulldozerDrainRate = 25; // energy per second when active (slower drain)
    this.bulldozerCutTime = 0.2; // reduced cut time from 0.9 to 0.2
    this.bulldozerMouseX = 0;
    this.bulldozerMouseY = 0;

    // Heli Drop skill (key 3) - circle suppression with cooldown
    this.heliDropMode = false; // targeting mode
    this.heliDropRadius = 43; // 1.8 * player spray radius (24)
    this.heliDropCooldown = 0;
    this.heliDropCooldownDuration = 4; // 4 second cooldown
    this.heliDropAnimations = []; // Track active helicopter animations

    // Worker Crew skill (key 4) - humidity buff zone
    this.workerCrewMode = false; // targeting mode
    this.workerCrewRadius = 72; // 3 * player spray radius (24)
    this.workerCrewCooldown = 0;
    this.workerCrewCooldownDuration = 12; // 12 second cooldown
    this.workerCrewZone = null; // { x, y, startTime, duration }

    // Debug/Visual toggles
    this.showDebugInfo = false; // Toggle with 'B' key

    // Fire build-up mechanic: speeds up fire until threshold trees are burning/burnt
    this.fireBuildup = {
      enabled: mission.fireBuildup?.enabled ?? true,
      burntThreshold: mission.fireBuildup?.burntThreshold ?? 200, // Speed up until this many trees are burning/burnt
      maxSpeedup: mission.fireBuildup?.maxSpeedup ?? 50.0, // Maximum multiplier for fire spread speed (timelapse effect)
    };
  }

  start() {
    this.started = true;
    this.over = false;
    this.timeSinceStart = 0;

    this.forest.generate();
    this.fire.reset();

    // Use game mode's fire initialization if available, otherwise fall back to default
    if (this.gameMode && typeof this.gameMode.initializeFires === "function") {
      this.gameMode.initializeFires(this.forest, this.mission);
    } else {
      // Default fallback
      this.forest.igniteRandom(3);
    }

    // Ensure we have at least one fire to avoid immediately ending the mission.
    if (this.forest.burningCount === 0) {
      this.forest.igniteRandom(1);
    }

    // Center the camera on the play area
    const worldCenterX = this.forest.width / 2;
    const worldCenterY = this.forest.height / 2;
    const viewW = this.viewport.width / this.camera.zoom;
    const viewH = this.viewport.height / this.camera.zoom;
    
    this.camera.x = Math.max(0, Math.min(this.forest.width - viewW, worldCenterX - viewW / 2));
    this.camera.y = Math.max(0, Math.min(this.forest.height - viewH, worldCenterY - viewH / 2));
  }

  update(dt) {
    if (!this.started || this.over) return;

    this.timeSinceStart += dt;

    this.weather.update(dt);
    
    // Pass Worker Crew zone to fire spread system for humidity effect
    this.fire.workerCrewZone = this.workerCrewZone;
    this.fire.workerCrewRadius = this.workerCrewRadius;
    
    // Pass fire build-up info to fire spread system
    this.fire.fireBuildup = this.fireBuildup;
    // Count both burning and burnt trees for buildup threshold
    this.fire.currentBurntCount = this.forest.burningCount + this.forest.burntCount;
    
    this.fire.update(dt);
    this._applyPlayerActions(dt);
    this.forest.update(dt);

    // Game over / win conditions
    // Delay the win check briefly to avoid ending immediately when the game first starts.
    if (this.timeSinceStart >= 0.5 && this.forest.burningCount === 0) {
      // If the fire died too quickly (e.g., no burning trees were generated), give the simulation a moment and retry.
      if (this.timeSinceStart < 2) {
        this.forest.igniteRandom(1);
      } else {
        this.over = true;
        this.saved = this.forest.normalCount;
      }
    }

    // Lose condition: no more trees left at all
    if (this.timeSinceStart >= 0.5 && this.forest.normalCount === 0) {
      this.over = true;
      this.saved = 0;
    }

    // Skill message timer
    if (this.skillMessageTimer > 0) {
      this.skillMessageTimer -= dt;
      if (this.skillMessageTimer <= 0) {
        this.skillMessage = "";
        this.skillMessageTimer = 0;
      }
    }

    // Decrease water bomber cooldown
    if (this.waterBomberCooldown > 0) {
      this.waterBomberCooldown -= dt;
    }

    // Decrease heli drop cooldown
    if (this.heliDropCooldown > 0) {
      this.heliDropCooldown -= dt;
    }

    // Update active heli drop animations
    for (let i = this.heliDropAnimations.length - 1; i >= 0; i--) {
      const anim = this.heliDropAnimations[i];
      anim.time += dt;
      
      // Spray at 0.5 seconds (after fade in)
      if (anim.time >= 0.5 && !anim.sprayed) {
        anim.sprayed = true;
        this._applyHeliDropSuppression(anim.x, anim.y);
      }
      
      // Remove when animation complete (3 seconds)
      if (anim.time >= 3) {
        this.heliDropAnimations.splice(i, 1);
      }
    }

    // Decrease worker crew cooldown
    if (this.workerCrewCooldown > 0) {
      this.workerCrewCooldown -= dt;
    }

    // Decrease watch tower cooldown
    if (this.watchTowerCooldown > 0) {
      this.watchTowerCooldown -= dt;
    }

    // Update worker crew zone humidity effect
    if (this.workerCrewZone) {
      const elapsed = this.timeSinceStart - this.workerCrewZone.startTime;
      if (elapsed >= this.workerCrewZone.duration) {
        this.workerCrewZone = null;
      }
      // Local humidity effect is applied during fire spread in FireSpreadSystem
    }

    // Bulldozer energy management - only drain when active AND clicking
    if (this.bulldozerActive && this.player?.left && this.bulldozerEnergy > 0) {
      this.bulldozerEnergy -= this.bulldozerDrainRate * dt;
      if (this.bulldozerEnergy <= 0) {
        this.bulldozerEnergy = 0;
        this.bulldozerActive = false;
      }
    } else if (this.bulldozerEnergy < this.bulldozerMaxEnergy) {
      // Recharge when not actively using (not clicking) or when inactive
      this.bulldozerEnergy += this.bulldozerRechargeRate * dt;
      if (this.bulldozerEnergy > this.bulldozerMaxEnergy) {
        this.bulldozerEnergy = this.bulldozerMaxEnergy;
      }
    }

    // Update watch tower states (check for fire spread like trees)
    const burning = this.forest.trees.filter((t) => t.state === "burning");
    for (let i = this.watchTowerZones.length - 1; i >= 0; i--) {
      const zone = this.watchTowerZones[i];
      if (zone.state === "active") {
        // Check if any burning tree is nearby to catch fire
        for (const tree of burning) {
          const dx = zone.x - tree.x;
          const dy = zone.y - tree.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Use wind-aware spread radius (like trees)
          const spreadRadius = 22 + this.weather.windStrength * 30;
          
          if (dist <= spreadRadius) {
            // Use same fire spread probability as trees
            let chance = this.weather.computeSpreadModifier(tree, { x: zone.x, y: zone.y });
            if (Math.random() < chance) {
              zone.state = "burning";
              zone.timer = 0;
              break;
            }
          }
        }
      } else if (zone.state === "burning") {
        // Burning duration (similar to trees)
        zone.timer += dt;
        const burnDuration = 10; // 10 seconds to burn out
        if (zone.timer >= burnDuration) {
          // Remove burnt tower completely
          this.watchTowerZones.splice(i, 1);
        }
      }
    }

    // Water Bomber strafe animation
    if (this.waterBomberStrafing) {
      this.waterBomberStrafeTime += dt;
      const progress = Math.min(1, this.waterBomberStrafeTime / this.waterBomberStrafeDuration);
      
      // Check if bomber has reached the end point (around 0.5-0.67 of total flight)
      const endPointProgress = 1.75 / 2.5; // Spray at 1.75 seconds (0.5s delay from original 1.25s)
      if (progress >= endPointProgress && !this.waterBomberEndpointHit) {
        this.waterBomberEndpointHit = true;
        this._applyStrafeSupression();
      }
      
      if (this.waterBomberStrafeTime >= this.waterBomberStrafeDuration) {
        this.waterBomberStrafing = false;
        this.waterBomberStrafeTime = 0;
        this.waterBomberMode = null;
        this.waterBomberStart = null;
        this.waterBomberPreview = null;
        this.waterBomberPath = null;
        this.waterBomberEndpointHit = false;
      }
    }
  }

  render(ctx) {
    // background
    ctx.fillStyle = "#1d1f22";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // world transform
    ctx.save();
    ctx.scale(this.camera.zoom, this.camera.zoom);
    ctx.translate(-this.camera.x, -this.camera.y);

    this.forest.render(ctx);

    // Draw action visual feedback in world space
    this._drawActionRadiusIndicator(ctx);

    // Draw water bomber targeting (only targeting mode in world space)
    if (this.waterBomberMode && !this.waterBomberStrafing) {
      this._drawWaterBomberOverlay(ctx);
    }

    // Draw heli drop targeting circle
    if (this.heliDropMode) {
      this._drawHeliDropOverlay(ctx);
    }

    // Draw worker crew zone
    if (this.workerCrewMode) {
      this._drawWorkerCrewOverlay(ctx);
    }

    // Draw active worker crew zone effect
    if (this.workerCrewZone) {
      this._drawWorkerCrewZone(ctx);
    }

    // Draw all active watch tower zones
    for (const zone of this.watchTowerZones) {
      this._drawWatchTowerZone(ctx, zone);
    }

    // Draw watch tower targeting circle
    if (this.watchTowerMode) {
      this._drawWatchTowerOverlay(ctx);
    }

    // Draw wind direction spread visualization on burning trees
    this._drawWindSpreadVisualization(ctx);

    ctx.restore();

    // Ensure HUD is drawn in canvas space (no world transform) and lines are anchored at the top-left.
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Draw strafe animation in HUD space (on top of everything)
    if (this.waterBomberStrafing && this.waterBomberPath) {
      this._drawBomberStrafe(ctx);
    }

    // Draw active helicopter animations
    for (const anim of this.heliDropAnimations) {
      this._drawHeliDropAnimation(ctx, anim);
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    if (this.showDebugInfo) {
      // HUD
      ctx.fillStyle = "white";
      ctx.font = "16px Arial";
      ctx.fillText(`Mission: ${this.mission.name}`, 12, 20);
      ctx.fillText(`Money: $${Math.floor(this.money)}`, 12, 40);
      ctx.fillText(`Active fire: ${this.forest.burningCount}`, 12, 60);
      ctx.fillText(`Temp: ${this.weather.temperature.toFixed(0)}°C`, 12, 80);
      ctx.fillText(`Humidity: ${this.weather.humidity.toFixed(0)}%`, 12, 100);
      ctx.fillText(`Fire risk: ${this.weather.getFireRisk()}`, 12, 120);
      ctx.fillText(`Wind: ${this.weather.windStrength.toFixed(2)} (dir ${(this.weather.windAngle * 180/Math.PI).toFixed(0)}°)`, 12, 140);

      // Tool indicators
      ctx.font = "14px Arial";
      ctx.fillStyle = this.player?.left ? "rgba(255, 100, 100, 1)" : "rgba(255, 100, 100, 0.5)";
      ctx.fillText("[ Left-Click: CUT ]", 12, 165);
      ctx.fillStyle = this.player?.right ? "rgba(100, 180, 255, 1)" : "rgba(100, 180, 255, 0.5)";
      ctx.fillText("[ Right-Click: SPRAY ]", 12, 185);

      // Skill selection (number keys) and current selection
      ctx.font = "14px Arial";
      ctx.fillStyle = "white";
      ctx.fillText("[1] Water Bomber  [2] Bulldozer  [3] Heli Drop  [4] Crew  [5] Tower", 12, 205);
      const selectedSkill = this.selectedSkillKey ? this.skills[this.selectedSkillKey] : null;
      ctx.fillText(`Selected: ${selectedSkill ? selectedSkill.name : "None"}`, 12, 225);
      if (this.skillMessage) {
        ctx.fillStyle = this.waterBomberMode ? "#f99" : "#ffb";
        ctx.fillText(this.skillMessage, 12, 245);
      }
      
      // Water Bomber cooldown display (fades out in last 1 second)
      if (this.waterBomberCooldown > 0) {
        let cooldownOpacity = 1;
        if (this.waterBomberCooldown <= 1) {
          // Fade out in the last 1 second (7-8 seconds mark)
          cooldownOpacity = this.waterBomberCooldown / 1;
        }
        ctx.fillStyle = `rgba(255, 180, 100, ${cooldownOpacity})`;
        ctx.font = "13px Arial";
        ctx.fillText(`[1] Ready in: ${this.waterBomberCooldown.toFixed(1)}s`, 12, 275);
      }
      
      // Bulldozer energy bar
      ctx.font = "13px Arial";
      ctx.fillStyle = this.bulldozerActive ? "rgba(255, 200, 100, 1)" : "rgba(200, 150, 100, 0.7)";
      ctx.fillText(`[2] Bulldozer ${this.bulldozerActive ? "ACTIVE" : "Ready"} - Energy:`, 12, 290);
      
      // Energy bar background
      const barX = 12;
      const barY = 305;
      const barWidth = 150;
      const barHeight = 12;
      ctx.fillStyle = "rgba(50, 50, 50, 0.8)";
      ctx.fillRect(barX, barY, barWidth, barHeight);
      
      // Energy bar fill
      const energyPercent = this.bulldozerEnergy / this.bulldozerMaxEnergy;
      const fillColor = energyPercent > 0.3 ? "rgba(255, 200, 100, 0.8)" : "rgba(255, 100, 100, 0.8)";
      ctx.fillStyle = fillColor;
      ctx.fillRect(barX, barY, barWidth * energyPercent, barHeight);
      
      // Energy bar border
      ctx.strokeStyle = "rgba(255, 200, 100, 0.5)";
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);
      
      // Heli Drop cooldown display
      if (this.heliDropCooldown > 0) {
        let cooldownOpacity = 1;
        if (this.heliDropCooldown <= 1) {
          cooldownOpacity = this.heliDropCooldown / 1;
        }
        ctx.fillStyle = `rgba(0, 200, 100, ${cooldownOpacity})`;
        ctx.font = "13px Arial";
        ctx.fillText(`[3] Heli Drop Ready in: ${this.heliDropCooldown.toFixed(1)}s`, 12, 330);
      }
      
      // Worker Crew cooldown display
      if (this.workerCrewCooldown > 0) {
        let cooldownOpacity = 1;
        if (this.workerCrewCooldown <= 1) {
          cooldownOpacity = this.workerCrewCooldown / 1;
        }
        ctx.fillStyle = `rgba(100, 150, 255, ${cooldownOpacity})`;
        ctx.font = "13px Arial";
        ctx.fillText(`[4] Worker Crew Ready in: ${this.workerCrewCooldown.toFixed(1)}s`, 12, 345);
      }

      // Watch Tower cooldown display
      if (this.watchTowerCooldown > 0) {
        let cooldownOpacity = 1;
        if (this.watchTowerCooldown <= 1) {
          cooldownOpacity = this.watchTowerCooldown / 1;
        }
        ctx.fillStyle = `rgba(255, 200, 100, ${cooldownOpacity})`;
        ctx.font = "13px Arial";
        ctx.fillText(`[5] Watch Tower Ready in: ${this.watchTowerCooldown.toFixed(1)}s`, 12, 360);
      }
    }

    // Draw bulldozer sprite at cursor when active
    if (this.bulldozerActive && this.bulldozerSprite && this.bulldozerSprite.complete) {
      const bulldozerSize = 40; // Size to draw the sprite
      ctx.save();
      ctx.globalAlpha = 0.8;
      ctx.drawImage(
        this.bulldozerSprite,
        this.bulldozerMouseX - bulldozerSize / 2,
        this.bulldozerMouseY - bulldozerSize / 2,
        bulldozerSize,
        bulldozerSize
      );
      ctx.restore();
    }
    
    if (this.waterBomberMode) {
      ctx.fillStyle = "#fff";
      ctx.font = "13px Arial";
      ctx.fillText("(Right-click to cancel)", 12, 260);
    }

    this._drawMiniMap(ctx);

    if (!this.started) {
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = "white";
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Click to begin", ctx.canvas.width / 2, ctx.canvas.height / 2);
      ctx.textAlign = "left";
    }

    if (this.over) {
      ctx.fillStyle = "rgba(0,0,0,0.75)";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = "white";
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Fire controlled!", ctx.canvas.width / 2, ctx.canvas.height / 2 - 20);
      ctx.fillText(`Trees saved: ${this.saved}`, ctx.canvas.width / 2, ctx.canvas.height / 2 + 20);
      ctx.textAlign = "left";
    }

    this._drawActionFeedback(ctx);
    this._drawWindCompass(ctx);
  }

  setPlayerInput({ x, y, left, right }) {
    this.player.x = x;
    this.player.y = y;
    this.player.left = left;
    this.player.right = right;
  }

  handlePointerDown(x, y, evt) {
    if (!this.started) {
      this.start();
      return;
    }

    const worldX = x / this.camera.zoom + this.camera.x;
    const worldY = y / this.camera.zoom + this.camera.y;

    // Water Bomber strafe targeting
    if (this.waterBomberMode === "selectStart" && evt?.button === 0) {
      this.waterBomberStart = { x: worldX, y: worldY };
      this.waterBomberMode = "selectEnd";
      this._setSkillMessage("Click end point for strafe");
      return;
    }

    if (this.waterBomberMode === "selectEnd" && evt?.button === 0) {
      // Clamp end point to max distance from start point
      const dx = worldX - this.waterBomberStart.x;
      const dy = worldY - this.waterBomberStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxStrafeDist = this.waterBomberStrafeRadius * 3; // 108
      
      let finalX = worldX, finalY = worldY;
      if (dist > maxStrafeDist) {
        const scale = maxStrafeDist / dist;
        finalX = this.waterBomberStart.x + dx * scale;
        finalY = this.waterBomberStart.y + dy * scale;
      }
      
      this._executeWaterBomberStrafe(this.waterBomberStart.x, this.waterBomberStart.y, finalX, finalY);
      this.waterBomberMode = null;
      this.waterBomberStart = null;
      this.waterBomberPreview = null;
      return;
    }

    // Cancel water bomber on right-click
    if (this.waterBomberMode && evt?.button === 2) {
      this.waterBomberMode = null;
      this.waterBomberStart = null;
      this.waterBomberPreview = null;
      this._setSkillMessage("Water Bomber canceled");
      return;
    }

    // Heli Drop targeting
    if (this.heliDropMode && evt?.button === 0) {
      this._executeHeliDrop(worldX, worldY);
      this.heliDropMode = false;
      return;
    }

    // Cancel heli drop on right-click
    if (this.heliDropMode && evt?.button === 2) {
      this.heliDropMode = false;
      this._setSkillMessage("Heli Drop canceled");
      return;
    }

    // Worker Crew targeting
    if (this.workerCrewMode && evt?.button === 0) {
      this._executeWorkerCrew(worldX, worldY);
      this.workerCrewMode = false;
      return;
    }

    // Cancel worker crew on right-click
    if (this.workerCrewMode && evt?.button === 2) {
      this.workerCrewMode = false;
      this._setSkillMessage("Worker Crew canceled");
      return;
    }

    // Watch Tower targeting
    if (this.watchTowerMode && evt?.button === 0) {
      this._placeWatchTower(worldX, worldY);
      this.watchTowerMode = false;
      return;
    }

    // Cancel watch tower on right-click
    if (this.watchTowerMode && evt?.button === 2) {
      this.watchTowerMode = false;
      this._setSkillMessage("Watch Tower canceled");
      return;
    }

    // If a skill is selected, handle it
    if (this.selectedSkillKey && evt?.button === 0) {
      // Other skills use normal world coordinates
      this._useSelectedSkill(worldX, worldY);
      this.selectedSkillKey = null;
      return;
    }

    // Middle click recenters the camera (useful for navigation while playing).
    if (evt?.button === 1) {
      const viewW = this.viewport.width / this.camera.zoom;
      const viewH = this.viewport.height / this.camera.zoom;

      this.camera.x = Math.max(0, Math.min(this.forest.width - viewW, worldX - viewW / 2));
      this.camera.y = Math.max(0, Math.min(this.forest.height - viewH, worldY - viewH / 2));
    }
  }

  handleKeyDown(evt) {
    const k = evt.key.toLowerCase();

    // Skill selection (number keys)
    if (k >= "1" && k <= "5") {
      const keyNum = Number(k);
      
      // Cancel all other active skills
      if (keyNum !== 1) {
        this.waterBomberMode = null;
        this.waterBomberStart = null;
        this.waterBomberPreview = null;
      }
      if (keyNum !== 2) {
        this.bulldozerActive = false;
      }
      if (keyNum !== 3) {
        this.heliDropMode = false;
      }
      if (keyNum !== 4) {
        this.workerCrewMode = false;
      }
      if (keyNum !== 5) {
        this.watchTowerMode = false;
      }

      // Water Bomber (key 1): activate targeting directly
      if (keyNum === 1) {
        if (this.waterBomberCooldown > 0) {
          this._setSkillMessage(`Water Bomber cooldown: ${this.waterBomberCooldown.toFixed(1)}s`);
          return;
        }
        this.waterBomberMode = "selectStart";
        this._setSkillMessage("Click start point for strafe");
        return;
      }

      // Bulldozer (key 2): toggle active mode with energy
      if (keyNum === 2) {
        if (this.bulldozerEnergy <= 0) {
          this._setSkillMessage("Bulldozer out of energy");
          return;
        }
        this.bulldozerActive = !this.bulldozerActive;
        this._setSkillMessage(this.bulldozerActive ? "Bulldozer ACTIVE" : "Bulldozer deactivated");
        return;
      }

      // Heli Drop (key 3): activate targeting mode
      if (keyNum === 3) {
        if (this.heliDropCooldown > 0) {
          this._setSkillMessage(`Heli Drop cooldown: ${this.heliDropCooldown.toFixed(1)}s`);
          return;
        }
        this.heliDropMode = !this.heliDropMode;
        this._setSkillMessage(this.heliDropMode ? "Click to drop" : "Heli Drop canceled");
        return;
      }

      // Worker Crew (key 4): activate targeting mode
      if (keyNum === 4) {
        if (this.workerCrewCooldown > 0) {
          this._setSkillMessage(`Worker Crew cooldown: ${this.workerCrewCooldown.toFixed(1)}s`);
          return;
        }
        this.workerCrewMode = !this.workerCrewMode;
        this._setSkillMessage(this.workerCrewMode ? "Click to deploy" : "Worker Crew canceled");
        return;
      }

      // Watch Tower (key 5): activate targeting mode like other skills
      if (keyNum === 5) {
        if (this.watchTowerCooldown > 0) {
          this._setSkillMessage(`Watch Tower cooldown: ${this.watchTowerCooldown.toFixed(1)}s`);
          return;
        }
        this.watchTowerMode = !this.watchTowerMode;
        this._setSkillMessage(this.watchTowerMode ? "Click to place watch tower" : "Watch Tower canceled");
        return;
      }
    }

    if (k === "escape") {
      if (this.waterBomberMode) {
        this.waterBomberMode = null;
        this.waterBomberStart = null;
        this.waterBomberPreview = null;
        this._setSkillMessage("Water Bomber canceled");
        return;
      }
      if (this.selectedSkillKey) {
        this.selectedSkillKey = null;
        this._setSkillMessage("Skill canceled");
        return;
      }
      this.over = true;
    }

    // basic weather adjustment
    if (k === "t") this.weather.temperature = Math.min(50, this.weather.temperature + 1);
    if (k === "y") this.weather.temperature = Math.max(-10, this.weather.temperature - 1);
    if (k === "u") this.weather.humidity = Math.min(100, this.weather.humidity + 5);
    if (k === "j") this.weather.humidity = Math.max(0, this.weather.humidity - 5);

    // wind controls
    if (k === "q") this.weather.windAngle -= Math.PI / 16;
    if (k === "e") this.weather.windAngle += Math.PI / 16;
    if (k === "k") this.weather.windStrength = Math.max(0, this.weather.windStrength - 0.05);
    if (k === "l") this.weather.windStrength = Math.min(1, this.weather.windStrength + 0.05);

    // Debug toggles
    if (k === "b") this.showDebugInfo = !this.showDebugInfo;
  }

  handleKeyUp(evt) {
    // placeholder: used by PlayScreen to keep key state
  }

  _setSkillMessage(msg) {
    this.skillMessage = msg;
    this.skillMessageTimer = 2;
  }

  getSkillCost(skill) {
    if (!skill) return 0;
    const multiplier = this.gameMode?.getSkillCostMultiplier?.() ?? 1;
    return Math.max(0, skill.cost * multiplier);
  }

  isSkillFree() {
    return this.gameMode?.isSkillFree?.() ?? false;
  }

  _executeWaterBomberStrafe(x1, y1, x2, y2) {
    const skill = this.skills[1];
    const cost = this.getSkillCost(skill);

    if (this.money < cost) {
      this._setSkillMessage("Not enough money");
      return;
    }

    if (cost > 0) {
      this.money -= cost;
    }
    
    // Calculate extended strafe path (entry point before start, exit point after end)
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const extendDist = 150; // Reduced from 300 to make entry/exit closer to target area
    
    let entryX, entryY, exitX, exitY;
    if (dist > 0) {
      const dirX = dx / dist;
      const dirY = dy / dist;
      entryX = x1 - dirX * extendDist;
      entryY = y1 - dirY * extendDist;
      exitX = x2 + dirX * extendDist;
      exitY = y2 + dirY * extendDist;
    } else {
      entryX = x1 - 300;
      entryY = y1;
      exitX = x1 + 300;
      exitY = y1;
    }
    
    this.waterBomberStrafing = true;
    this.waterBomberStrafeTime = 0;
    this.waterBomberEndpointHit = false;
    this.waterBomberCooldown = this.waterBomberCooldownDuration; // Start cooldown
    this.waterBomberPath = { startX: x1, startY: y1, endX: x2, endY: y2, entryX, entryY, exitX, exitY };
    this.waterBomberPreview = { x1, y1, x2, y2 };
    this._setSkillMessage("Bomber incoming!");
  }

  _applyStrafeSupression() {
    if (!this.waterBomberPath) return;
    
    const { startX: x1, startY: y1, endX: x2, endY: y2 } = this.waterBomberPath;
    
    // Apply suppression along the strafe line
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist / 20);

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const targets = this.forest.grid.queryCircle(px, py, this.waterBomberStrafeRadius);

      for (const tree of targets) {
        if (tree.state !== "wet" && tree.state !== "burnt") {
          this.forest.setState(tree, "wet");
        }
      }
    }
  }

  _executeHeliDrop(x, y) {
    const skill = this.skills[3];
    const cost = this.getSkillCost(skill);
    if (this.money < cost) {
      this._setSkillMessage("Not enough money");
      return;
    }
    if (cost > 0) {
      this.money -= cost;
    }

    // Start helicopter animation (spray happens during animation)
    this.heliDropAnimations.push({
      x,
      y,
      time: 0,
      sprayed: false,
      rotation: Math.random() * Math.PI * 2, // Random rotation 0-360 degrees
    });

    this.heliDropCooldown = this.heliDropCooldownDuration;
    this._setSkillMessage("Helicopter incoming...");
  }

  _applyHeliDropSuppression(x, y) {
    // Apply suppression effect (wet status) to all trees in radius
    const targets = this.forest.grid.queryCircle(x, y, this.heliDropRadius);
    let suppressedCount = 0;

    for (const tree of targets) {
      const dx = tree.x - x;
      const dy = tree.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= this.heliDropRadius) {
        // Apply suppression to burning and normal trees (not already wet/burnt)
        if (tree.state === "burning" || tree.state === "normal") {
          this.forest.setState(tree, "wet");
          suppressedCount++;
        }
      }
    }
  }

  _executeWorkerCrew(x, y) {
    const skill = this.skills[4];
    const cost = this.getSkillCost(skill);
    if (this.money < cost) {
      this._setSkillMessage("Not enough money");
      return;
    }
    if (cost > 0) {
      this.money -= cost;
    }

    // Create a humidity buff zone that lasts 10 seconds
    this.workerCrewZone = {
      x,
      y,
      startTime: this.timeSinceStart,
      duration: 10, // 10 seconds
    };
    
    this.workerCrewCooldown = this.workerCrewCooldownDuration;
    this._setSkillMessage("Worker Crew deployed! Humidity boosted for 10s");
  }

  _useSelectedSkill(worldX, worldY) {
    const skill = this.skills[this.selectedSkillKey];
    if (!skill) return;

    const cost = this.getSkillCost(skill);
    if (this.money < cost) {
      this._setSkillMessage("Not enough money");
      return;
    }

    if (cost > 0) {
      this.money -= cost;
    }

    const targets = this.forest.grid.queryCircle(worldX, worldY, skill.radius);

    if (skill.id === "waterBomber") {
      for (const t of targets) {
        if (t.state === "burning" && Math.random() < 0.75) {
          this.forest.setState(t, "normal");
        }
      }
      this._setSkillMessage("Water Bomber dropped!");
    }

    if (skill.id === "bulldozer") {
      for (const t of targets) {
        if (t.state !== "burnt") {
          this.forest.setState(t, "burnt");
        }
      }
      this._setSkillMessage("Bulldozer cleared the area.");
    }

    if (skill.id === "heliDrop") {
      for (const t of targets) {
        if (t.state === "burning") {
          this.forest.setState(t, "normal");
        } else if (t.state === "normal" && Math.random() < 0.35) {
          this.forest.setState(t, "wet");
        }
      }
      this._setSkillMessage("Helicopter drop complete.");
    }

    if (skill.id === "workerCrew") {
      for (const t of targets) {
        if (t.state === "burning") {
          this.forest.setState(t, "normal");
        }
      }
      this._setSkillMessage("Crew deployed.");
    }

    if (skill.id === "watchTower") {
      this.watchTowerZones.push({ x: worldX, y: worldY, radius: skill.radius });
      this.watchTowerCooldown = this.watchTowerCooldownDuration;
      this._setSkillMessage("Watch Tower deployed!");
    }
  }

  _placeWatchTower(x, y) {
    const skill = this.skills[5];
    if (!skill) return;

    const cost = this.getSkillCost(skill);
    if (this.money < cost) {
      this._setSkillMessage("Not enough money");
      return;
    }

    if (cost > 0) {
      this.money -= cost;
    }

    // Add watch tower zone
    this.watchTowerZones.push({
      x,
      y,
      radius: skill.radius,
      state: "active", // active, burning, burnt
      timer: 0, // for burning duration
    });

    this.watchTowerCooldown = this.watchTowerCooldownDuration;
    this._setSkillMessage("Watch Tower deployed!");
  }

  _applyPlayerActions(dt) {
    if (!this.player) return;

    const { x, y, left, right } = this.player;
    const radius = 24;
    const maxPerTick = 8;
    let processed = 0;

    if (!left && !right) {
      // reset timers so actions require continuous hold
      this.forest.forNearby(x, y, radius, (tree) => {
        tree.cutTimer = 0;
        tree.extinguishTimer = 0;
      });
      return;
    }

    this.forest.forNearby(x, y, radius, (tree) => {
      if (processed >= maxPerTick) return false;

      if (left && (tree.state === "normal" || tree.state === "wet")) {
        tree.cutTimer += dt;
        const cutThreshold = this.bulldozerActive ? this.bulldozerCutTime : 0.9;
        if (tree.cutTimer >= cutThreshold) {
          this.forest.setState(tree, "burnt");
          if (this.bulldozerActive && !this.isSkillFree()) {
            // Bulldozer mode costs money outside training.
            this.money -= 1;
          }
          // Hand cutting now does not gain money in any mode.
        }
        processed++;
      }

      if (right && tree.state !== "wet" && tree.state !== "burnt") {
        tree.extinguishTimer += dt;
        if (tree.extinguishTimer >= 0.7) {
          this.forest.setState(tree, "wet");
          // Hand extinguish now does not gain money in any mode.
        }
        processed++;
      }

      return true;
    });
  }

  _drawWatchTowerOverlay(ctx) {
    // Draw targeting circle at mouse position
    if (!this.watchTowerMouseX && !this.watchTowerMouseY && this.player) {
      // If mouse position not set, use player position as fallback
      this.watchTowerMouseX = this.player.x;
      this.watchTowerMouseY = this.player.y;
    }
    
    const mouseX = this.watchTowerMouseX;
    const mouseY = this.watchTowerMouseY;
    const skill = this.skills[5];
    const radius = skill ? skill.radius : 320;

    // Main reveal zone circle - dashed border only, no background
    ctx.strokeStyle = "rgba(255, 200, 0, 0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]); // 8px dashes, 6px gaps
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Center point
    ctx.fillStyle = "rgba(255, 200, 0, 0.8)";
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 220, 100, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawWatchTowerZone(ctx, zone) {
    const { x, y, radius, state } = zone;

    // Watch tower zone circle - dashed border only, no background
    if (state === "active") {
      ctx.strokeStyle = "rgba(255, 200, 0, 0.6)";
    } else if (state === "burning") {
      ctx.strokeStyle = "rgba(255, 100, 0, 0.8)"; // Orange-red for burning
    }
    
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]); // 8px dashes, 6px gaps
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    // Center tower (small circle)
    if (state === "active") {
      ctx.fillStyle = "rgba(255, 200, 0, 0.8)";
    } else if (state === "burning") {
      ctx.fillStyle = "rgba(255, 100, 0, 1)"; // Orange-red for burning
    }
    
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();

    const strokeColor = state === "active" ? "rgba(255, 220, 100, 0.9)" : 
                       "rgba(255, 150, 0, 1)";
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawMiniMap(ctx) {
    const miniW = 180;
    const miniH = 120;
    const padding = 10;
    const x = padding;
    const y = ctx.canvas.height - miniH - padding;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x, y, miniW, miniH);
    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, miniW, miniH);

    const scaleX = miniW / this.forest.width;
    const scaleY = miniH / this.forest.height;

    // Helper function to check if a world position is revealed by any watch tower
    const isRevealed = (worldX, worldY) => {
      for (const zone of this.watchTowerZones) {
        // Only active towers reveal
        if (zone.state !== "active") continue;
        
        const dx = worldX - zone.x;
        const dy = worldY - zone.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= zone.radius) {
          return true;
        }
      }
      return false;
    };

    // Save canvas state for clipping
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, miniW, miniH);
    ctx.clip();

    // Draw full fog of war overlay first (skipif debug info is enabled)
    if (!this.showDebugInfo) {
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(x, y, miniW, miniH);

      // Cut out revealed zones to show content
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(255,255,255,1)";
      for (const zone of this.watchTowerZones) {
        // Skip burning towers - they don't reveal fog of war
        if (zone.state !== "active") continue;
        
        const zx = x + zone.x * scaleX;
        const zy = y + zone.y * scaleY;
        const zr = zone.radius * ((scaleX + scaleY) / 2);
        ctx.beginPath();
        ctx.arc(zx, zy, zr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // Now draw burning trees in revealed areas (or all if debug info is enabled)
    for (let i = 0; i < this.forest.trees.length; i++) {
      const t = this.forest.trees[i];
      if (t.state !== "burning") continue;
      
      // Show all burning trees if debug enabled, otherwise only in revealed zones
      if (!this.showDebugInfo && !isRevealed(t.x, t.y)) continue;
      
      const tx = x + t.x * scaleX;
      const ty = y + t.y * scaleY;
      ctx.fillStyle = "rgba(255,130,0,0.9)";
      ctx.fillRect(tx, ty, 2, 2);
    }

    ctx.restore();

    // viewport box
    const viewW = (ctx.canvas.width / this.camera.zoom) * scaleX;
    const viewH = (ctx.canvas.height / this.camera.zoom) * scaleY;
    const viewX = x + this.camera.x * scaleX;
    const viewY = y + this.camera.y * scaleY;

    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.strokeRect(viewX, viewY, viewW, viewH);

    // player marker
    const px = x + this.player.x * scaleX;
    const py = y + this.player.y * scaleY;
    ctx.fillStyle = "cyan";
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawActionRadiusIndicator(ctx) {
    if (!this.player || (!this.player.left && !this.player.right)) return;

    const { x, y, left, right } = this.player;
    const radius = 24;

    // Determine action type and color
    let actionColor;
    let actionType;
    
    if (left) {
      actionColor = "rgba(200, 80, 80, 0.3)"; // Red for cutting
      actionType = "CUT";
    } else if (right) {
      actionColor = "rgba(80, 150, 200, 0.3)"; // Blue for spraying
      actionType = "SPRAY";
    }

    // Draw action radius circle
    ctx.fillStyle = actionColor;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Draw circle outline
    ctx.strokeStyle = left ? "rgba(255, 100, 100, 0.8)" : "rgba(100, 180, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw center crosshair
    ctx.strokeStyle = left ? "rgba(255, 100, 100, 0.6)" : "rgba(100, 180, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 8);
    ctx.stroke();

    // Highlight affected trees
    const candidates = this.forest.grid.queryCircle(x, y, radius);
    for (const tree of candidates) {
      const dx = tree.x - x;
      const dy = tree.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;

      // Check if this tree would be affected by current action
      const canAffect = (left && (tree.state === "normal" || tree.state === "wet")) || (right && tree.state !== "wet" && tree.state !== "burnt");
      
      if (canAffect) {
        // Draw highlight glow around tree
        ctx.fillStyle = left ? "rgba(255, 150, 100, 0.4)" : "rgba(100, 200, 255, 0.4)";
        ctx.beginPath();
        ctx.arc(tree.x, tree.y, 8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _drawBomberStrafe(ctx) {
    if (!this.waterBomberPath) return;
    
    const { entryX, entryY, exitX, exitY } = this.waterBomberPath;
    const progress = Math.min(1, this.waterBomberStrafeTime / this.waterBomberStrafeDuration);
    
    // Position along the full extended path
    const worldX = entryX + (exitX - entryX) * progress;
    const worldY = entryY + (exitY - entryY) * progress;
    
    // Convert world coordinates to screen coordinates
    const screenX = (worldX - this.camera.x) * this.camera.zoom;
    const screenY = (worldY - this.camera.y) * this.camera.zoom;

    // Fade timing: quick fade in, stay visible most of duration, quick fade out at end
    let opacity;
    const fadeInDuration = 0.2 / 2.5;   // 0.2 seconds fade in
    const fadeOutStart = 2.3 / 2.5;    // Start fade out at 2.3 seconds (last 0.2 seconds)
    
    if (progress < fadeInDuration) {
      opacity = progress / fadeInDuration;  // Fade in
    } else if (progress < fadeOutStart) {
      opacity = 1;  // Full opacity
    } else {
      opacity = (1 - progress) / (1 - fadeOutStart);  // Fade out
    }
    opacity = Math.max(0, Math.min(1, opacity)); // Clamp to [0, 1]

    // Draw bomber sprite with fade effect, rotated to face direction
    if (this.bomberSprite && this.bomberSprite.complete) {
      // Calculate angle based on strafe direction
      const dx = exitX - entryX;
      const dy = exitY - entryY;
      const angle = Math.atan2(dy, dx);
      
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(screenX, screenY);
      ctx.rotate(angle);
      
      const spriteWidth = 100 * this.camera.zoom;
      const spriteHeight = 130 * this.camera.zoom;
      ctx.drawImage(this.bomberSprite, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
      
      ctx.restore();
    } else {
      // Fallback: draw orange circle if sprite not loaded
      ctx.fillStyle = `rgba(255, 150, 50, ${opacity})`;
      ctx.beginPath();
      ctx.arc(screenX, screenY, 24, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawHeliDropAnimation(ctx, anim) {
    if (!this.heloSprite || !this.heloSprite.complete) return;

    const { x, y, time, rotation } = anim;

    // Calculate opacity: fade in 0-0.5s, hover 0.5-1.5s, fade out 1.5-3s
    let opacity;
    if (time < 0.5) {
      // Fade in over 0.5 seconds
      opacity = time / 0.5;
    } else if (time < 1.5) {
      // Full opacity during hover (1 second)
      opacity = 1;
    } else {
      // Fade out over 1.5 seconds
      opacity = Math.max(0, (3 - time) / 1.5);
    }

    // Convert world to screen coordinates
    const screenX = (x - this.camera.x) * this.camera.zoom;
    const screenY = (y - this.camera.y) * this.camera.zoom;

    // Draw helicopter as square with rotation
    const heloSize = 100 * this.camera.zoom;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(screenX, screenY);
    ctx.rotate(rotation);

    // Draw helicopter sprite (square)
    if (this.heloSprite) {
      ctx.drawImage(this.heloSprite, -heloSize / 2, -heloSize / 2, heloSize, heloSize);
    }

    ctx.restore();

    // Draw spray effect circle when spraying (0.5 to 1.5 seconds)
    if (time >= 0.5 && time < 1.5) {
      const sprayOpacity = Math.sin((time - 0.5) * Math.PI * 4) * 0.5 + 0.5; // Pulsing effect
      ctx.globalAlpha = sprayOpacity * opacity;
      
      ctx.fillStyle = "rgba(0, 200, 255, 0.3)";
      ctx.beginPath();
      ctx.arc(screenX, screenY, this.heliDropRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(0, 200, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, this.heliDropRadius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }

  _drawActionFeedback(ctx) {
    if (!this.player.left && !this.player.right) return;

    const radius = 40;
    const candidates = this.forest.grid.queryCircle(this.player.x, this.player.y, radius);
    let best = null;
    let bestDist = Infinity;
    let action = null;
    let progress = 0;

    for (const tree of candidates) {
      const dx = tree.x - this.player.x;
      const dy = tree.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;

      if (this.player.left && tree.state === "normal") {
        const p = Math.min(1, tree.cutTimer / 0.15);
        if (dist < bestDist) {
          bestDist = dist;
          best = tree;
          action = "Cutting";
          progress = p;
        }
      }

      if (this.player.right && tree.state === "burning") {
        const p = Math.min(1, tree.extinguishTimer / 0.25);
        if (dist < bestDist) {
          bestDist = dist;
          best = tree;
          action = "Extinguishing";
          progress = p;
        }
      }
    }

    if (!best) return;

    // Draw a small progress bar at bottom-right
    const barW = 160;
    const barH = 16;
    const bx = ctx.canvas.width - barW - 14;
    const by = ctx.canvas.height - barH - 20;

    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(bx - 4, by - 4, barW + 8, barH + 28);

    ctx.fillStyle = "white";
    ctx.font = "14px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`${action}...`, bx, by - 10);

    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(bx, by, barW, barH);

    ctx.fillStyle = action === "Extinguishing" ? "#5cf" : "#c55";
    ctx.fillRect(bx, by, barW * progress, barH);

    ctx.strokeStyle = "white";
    ctx.strokeRect(bx, by, barW, barH);
  }

  _drawWindCompass(ctx) {
    // Draw wind direction compass in top-right corner
    const compassX = ctx.canvas.width - 80;
    const compassY = 60;
    const compassRadius = 45;
    const letterDistance = 28; // Keep letters at fixed distance

    ctx.save();

    // Draw compass circle background
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.beginPath();
    ctx.arc(compassX, compassY, compassRadius - 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw compass circle border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(compassX, compassY, compassRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw cardinal directions
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // N (top)
    ctx.fillText("N", compassX, compassY - letterDistance + 5);
    // S (bottom)
    ctx.fillText("S", compassX, compassY + letterDistance - 5);
    // E (right)
    ctx.textAlign = "left";
    ctx.fillText("E", compassX + letterDistance - 5, compassY);
    // W (left)
    ctx.textAlign = "right";
    ctx.fillText("W", compassX - letterDistance + 5, compassY);

    // Draw wind direction arrow
    // Wind angle is already in radians (0 = east/right, π/2 = south/down, π = west/left, 3π/2 = north/up)
    // Add π/2 to convert to compass convention (0 = north/up)
    const windAngle = this.weather.windAngle + Math.PI / 2;
    const arrowLength = compassRadius - 8;
    const arrowEndX = compassX + Math.sin(windAngle) * arrowLength;
    const arrowEndY = compassY - Math.cos(windAngle) * arrowLength;

    // Draw arrow line
    ctx.strokeStyle = "rgba(100, 200, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(compassX, compassY);
    ctx.lineTo(arrowEndX, arrowEndY);
    ctx.stroke();

    // Draw arrowhead
    const arrowSize = 8;
    const angle1 = windAngle + (Math.PI * 0.85);
    const angle2 = windAngle - (Math.PI * 0.85);

    ctx.fillStyle = "rgba(100, 200, 255, 0.9)";
    ctx.beginPath();
    ctx.moveTo(arrowEndX, arrowEndY);
    ctx.lineTo(arrowEndX + Math.sin(angle1) * arrowSize, arrowEndY - Math.cos(angle1) * arrowSize);
    ctx.lineTo(arrowEndX + Math.sin(angle2) * arrowSize, arrowEndY - Math.cos(angle2) * arrowSize);
    ctx.closePath();
    ctx.fill();

    // Draw wind strength label
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`Wind: ${this.weather.windStrength.toFixed(2)}`, compassX, compassY + compassRadius + 8);

    ctx.restore();
  }

  _drawWaterBomberOverlay(ctx) {
    // If in start point selection mode, show targeting at player position
    if (!this.waterBomberStart && this.waterBomberMode === "selectStart") {
      const x = this.player.x;
      const y = this.player.y;
      
      // Start point circle (targeting preview)
      ctx.fillStyle = "rgba(100, 150, 200, 0.2)";
      ctx.beginPath();
      ctx.arc(x, y, this.waterBomberStrafeRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 180, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, this.waterBomberStrafeRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(100, 180, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x, y + 10);
      ctx.stroke();
      return;
    }

    if (!this.waterBomberPreview && !this.waterBomberStart) return;

    // Only draw targeting mode (strafe animation is now drawn in HUD space)
    if (!this.waterBomberStart) return;
    
    let x1, y1, x2, y2;
    const maxStrafeDist = this.waterBomberStrafeRadius * 3; // 108

    // During targeting: clamp preview end point to max distance
    x1 = this.waterBomberStart.x;
    y1 = this.waterBomberStart.y;
    x2 = this.player.x;
    y2 = this.player.y;
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > maxStrafeDist) {
      const scale = maxStrafeDist / dist;
      x2 = x1 + dx * scale;
      y2 = y1 + dy * scale;
    }

    ctx.strokeStyle = "rgba(100, 200, 255, 0.8)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Start point circle (similar style to spray radius)
    ctx.fillStyle = "rgba(100, 150, 200, 0.25)";
    ctx.beginPath();
    ctx.arc(x1, y1, this.waterBomberStrafeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 180, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x1, y1, this.waterBomberStrafeRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(100, 180, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1 - 10, y1);
    ctx.lineTo(x1 + 10, y1);
    ctx.moveTo(x1, y1 - 10);
    ctx.lineTo(x1, y1 + 10);
    ctx.stroke();

    // End point circle (similarly styled)
    ctx.fillStyle = "rgba(100, 150, 200, 0.18)";
    ctx.beginPath();
    ctx.arc(x2, y2, this.waterBomberStrafeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(100, 200, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x2, y2, this.waterBomberStrafeRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(100, 200, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x2 - 10, y2);
    ctx.lineTo(x2 + 10, y2);
    ctx.moveTo(x2, y2 - 10);
    ctx.lineTo(x2, y2 + 10);
    ctx.stroke();
  }

  _drawHeliDropOverlay(ctx) {
    // Draw targeting circle at mouse position (will be set by PlayScreen)
    const mouseX = this.heliDropMouseX ?? this.player?.x ?? 0;
    const mouseY = this.heliDropMouseY ?? this.player?.y ?? 0;

    // Main suppression circle
    ctx.fillStyle = "rgba(0, 255, 0, 0.15)";
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, this.heliDropRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(0, 255, 0, 0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, this.heliDropRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Center point
    ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(0, 255, 100, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawWorkerCrewOverlay(ctx) {
    // Draw targeting circle at mouse position (will be set by PlayScreen)
    const mouseX = this.workerCrewMouseX ?? this.player?.x ?? 0;
    const mouseY = this.workerCrewMouseY ?? this.player?.y ?? 0;

    // Main humidity zone circle
    ctx.fillStyle = "rgba(100, 150, 255, 0.15)";
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, this.workerCrewRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(100, 150, 255, 0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, this.workerCrewRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Center point
    ctx.fillStyle = "rgba(100, 200, 255, 0.8)";
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(150, 200, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawWorkerCrewZone(ctx) {
    if (!this.workerCrewZone) return;

    const { x, y } = this.workerCrewZone;
    const elapsed = this.timeSinceStart - this.workerCrewZone.startTime;
    const progress = Math.min(1, elapsed / this.workerCrewZone.duration);
    
    // Fade visual over time
    const opacity = Math.max(0.1, 1 - progress * 0.5);

    // Active zone circle (blue tint) - base layer
    ctx.fillStyle = `rgba(100, 150, 255, ${0.15 * opacity})`;
    ctx.beginPath();
    ctx.arc(x, y, this.workerCrewRadius, 0, Math.PI * 2);
    ctx.fill();

    // Radar scan effect - rotating sweep line
    const scanAngle = (elapsed * 3) % (Math.PI * 2); // Rotate 3 rotations per 10 seconds
    ctx.strokeStyle = `rgba(100, 200, 255, ${0.8 * opacity})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x + Math.cos(scanAngle) * this.workerCrewRadius,
      y + Math.sin(scanAngle) * this.workerCrewRadius
    );
    ctx.stroke();

    // Concentric radar circles
    ctx.strokeStyle = `rgba(100, 150, 255, ${0.4 * opacity})`;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(x, y, (this.workerCrewRadius / 3) * i, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Outer boundary circle
    ctx.strokeStyle = `rgba(100, 150, 255, ${0.6 * opacity})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, this.workerCrewRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Center point with glow
    ctx.fillStyle = `rgba(100, 200, 255, ${0.9 * opacity})`;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  _isTreeInWorkerCrewZone(tree) {
    if (!this.workerCrewZone) return false;
    
    const dx = tree.x - this.workerCrewZone.x;
    const dy = tree.y - this.workerCrewZone.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    return dist <= this.workerCrewRadius;
  }

  _drawWindSpreadVisualization(ctx) {
    // Draw wind direction spread indicators on burning trees
    const burning = this.forest.trees.filter((t) => t.state === "burning");
    
    for (const tree of burning) {
      // Calculate base spread radius
      const baseRadius = 22 + (this.weather.temperature - 22) * 1.5;
    // Wind angle is already in radians; no conversion needed
    const windAngleRad = this.weather.windAngle;
      for (let layer = 0; layer < 3; layer++) {
        const layerOpacity = 0.03 * (1 - layer / 3);
        ctx.fillStyle = `rgba(100, 80, 60, ${layerOpacity})`;
        ctx.beginPath();
        
        const layerOffset = layer * 3;
        
        for (let angle = 0; angle <= Math.PI * 2; angle += Math.PI / 24) {
          // Calculate wind influence at this angle
          const windInfluence = Math.cos(angle - windAngleRad);
          let radius = baseRadius + this.weather.windStrength * windInfluence * 30 + this.weather.windStrength * 5;
          
          // Add waviness
          const waveAmount = Math.sin(angle * 4 + layer * Math.PI / 3) * 3;
          radius += waveAmount + layerOffset;
          
          const x = tree.x + Math.cos(angle) * radius;
          const y = tree.y + Math.sin(angle) * radius;
          
          if (angle === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }

      // Draw border if toggle is enabled
      if (this.showDebugInfo) {
        ctx.strokeStyle = "rgba(255, 200, 100, 0.6)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let angle = 0; angle <= Math.PI * 2; angle += Math.PI / 32) {
          const windInfluence = Math.cos(angle - windAngleRad);
          const radius = baseRadius + this.weather.windStrength * windInfluence * 30 + this.weather.windStrength * 5;
          
          const x = tree.x + Math.cos(angle) * radius;
          const y = tree.y + Math.sin(angle) * radius;
          
          if (angle === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
}
