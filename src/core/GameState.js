import { Forest } from "./Forest.js";
import { WeatherSystem } from "../systems/WeatherSystem.js";
import { FireSpreadSystem } from "../systems/FireSpreadSystem.js";

export class GameState {
  constructor({ mission, gameMode = null, viewport = { width: 1280, height: 720 }, sprites = null, economyState = null }) {
    this.mission = mission;
    this.gameMode = gameMode;
    this.viewport = viewport;
    this.sprites = sprites;
    this.economyState = economyState;
    this.foodWearAccumulated = 0; // Track food wear during mission (resolved between missions)
    this.fuelConsumed = 0; // Track total fuel consumed during mission
    this.retardantConsumed = 0; // Track total retardant consumed during mission
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

    this.minZoom = mission.minZoom ?? 1.75;
    this.maxZoom = mission.maxZoom ?? 1.75;
    this.camera = { x: 0, y: 0, zoom: mission.startZoom ?? 1.75};
    this.player = { x: this.camera.x + 400, y: this.camera.y + 300 };

    this.money = mission.startMoney;
    this.saved = 0;

    // Skill system (activated with number keys 1-9 + click)
    this.skills = {
      1: { id: "waterBomber", name: "Water Bomber", cost: 100, radius: 220 },
      2: { id: "bulldozer", name: "Bulldozer", cost: 40, radius: 180 },
      3: { id: "heliDrop", name: "Heli Drop", cost: 50, radius: 260 },
      4: { id: "sprinklerTrailer", name: "Sprinkler Trailer", cost: 0, radius: 140 },
      5: { id: "fireWatch", name: "Fire Watch", cost: 20, radius: 320 },
      6: { id: "fireCrew", name: "Fire Crew", cost: 0, radius: 96 },
      7: { id: "droneRecon", name: "Drone Recon", cost: 0, radius: 280 },
      8: { id: "engineTruck", name: "Fire Truck", cost: 0, radius: 60 },
      9: { id: "reconPlane", name: "Recon Plane", cost: 2000, radius: 600 },
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
    this.watchTowerCooldownDuration = 10; // 10 second recharge per charge
    this.watchTowerCharges = 1;
    this.watchTowerMaxCharges = 1;
    this.watchTowerRechargeTimer = 0;
    this.waterBomberMode = null; // null, "selectStart", "selectEnd"
    this.waterBomberUseRetardant = false; // water vs retardant toggle
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

    // Bulldozer skill (key 2) - faster cutting, fuel-based + energy system
    this.bulldozerActive = false;
    this.bulldozerCutTime = 0.2; // reduced cut time from 0.9 to 0.2
    this.bulldozerMouseX = 0;
    this.bulldozerMouseY = 0;
    this.bulldozerEnergy = 100;
    this.bulldozerMaxEnergy = 100;
    this.bulldozerRechargeRate = 5; // energy per second when inactive
    this.bulldozerDrainRate = 25; // energy per second when active

    // Heli Drop skill (key 3) - circle suppression with cooldown
    this.heliDropMode = false; // targeting mode
    this.heliDropUseRetardant = false; // water vs retardant toggle
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

    // Fire Crew skill (key 6) - place a crew that actively cuts firebreaks (line-based)
    this.fireCrewMode = null; // null, "selectStart", "selectEnd"
    this.fireCrewStart = null;
    this.fireCrewPreview = null;
    this.fireCrewLines = []; // Array of { startX, startY, endX, endY, progress, cutPoints, startTime }
    this.fireCrewCooldown = 0;
    this.fireCrewCooldownDuration = 2;
    this.fireCrewCharges = 1;
    this.fireCrewMaxCharges = 1;
    this.fireCrewRechargeTimer = 0;
    this.fireCrewDeferredCount = 0; // number of charges waiting on crew completion before cooldown starts
    this.fireCrewMaxLength = 150; // max firebreak length in world pixels
    this.fireCrewCutThreshold = 8.0; // seconds per tree (much slower than hand tool's 0.9)
    this.fireCrewLineWidth = 32; // width of firebreak
    this.fireCrewSpeed = 14; // pixels per second the crew front advances along the line

    // Drone Recon skill (key 7) - movable timed intel reveal (smaller than Fire Watch)
    this.droneReconMode = false;
    this.droneReconMouseX = 0;
    this.droneReconMouseY = 0;
    this.droneReconActive = []; // Array of { x, y, targetX, targetY, radius, startTime }
    this.droneReconCooldown = 0;
    this.droneReconCooldownDuration = 10;
    this.droneReconCharges = 1;
    this.droneReconMaxCharges = 1;
    this.droneReconRechargeTimer = 0;
    this.droneReconDuration = 45; // seconds before drone expires
    this.droneReconRadius = 200; // smaller than Fire Watch's 320
    this.droneReconMoveSpeed = 120; // pixels per second when repositioning
    this.droneReconMoving = false; // true when player clicked on drone and is choosing new location

    // Engine Truck skill (key 8) - small area suppression zone
    this.engineTruckMode = false;
    this.engineTruckMouseX = 0;
    this.engineTruckMouseY = 0;
    this.engineTruckZone = null; // { x, y, radius, startTime, duration }
    this.engineTruckCooldown = 0;
    this.engineTruckCooldownDuration = 5; // quick cooldown
    this.engineTruckDuration = 6; // seconds active
    this.engineTruckRadius = 25; // very small area

    // Recon Plane skill (key 9) - large area intel reveal
    this.reconPlaneMode = false;
    this.reconPlaneMouseX = 0;
    this.reconPlaneMouseY = 0;
    this.reconPlaneZones = []; // Array of { x, y, radius, startTime, duration }
    this.reconPlaneCooldown = 0;
    this.reconPlaneCooldownDuration = 20;
    this.reconPlaneDuration = 25;
    this.reconPlaneRadius = 600;

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

    // Apply crew charge upgrades
    let crewMaxCharges = 1;
    if (this._hasUpgrade("crewAvail1")) crewMaxCharges++;
    if (this._hasUpgrade("crewAvail2")) crewMaxCharges++;
    this.watchTowerMaxCharges = crewMaxCharges;
    this.watchTowerCharges = crewMaxCharges;
    this.watchTowerMaxActive = crewMaxCharges; // max active towers on map
    this.fireCrewMaxCharges = crewMaxCharges;
    this.fireCrewCharges = crewMaxCharges;
    this.droneReconMaxCharges = crewMaxCharges;
    this.droneReconCharges = crewMaxCharges;
    this.droneReconActive = [];
    this.droneReconMoving = false;
    this._selectedDrone = null;

    this.forest.generate();
    this.fire.reset();
    this.weather.resetTimer();

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

    // Do not adjust camera zoom at start: keep current starting zoom (from constructor/default)
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
    // Use historical unique burned tree count (never decreases on suppression)
    this.fire.currentBurntCount = this.forest.everBurnedCount;
    
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
        this._applyHeliDropSuppression(anim.x, anim.y, anim.usedRetardant);
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

    // Recharge watch tower charges
    if (this.watchTowerCharges < this.watchTowerMaxCharges) {
      this.watchTowerRechargeTimer -= dt;
      if (this.watchTowerRechargeTimer <= 0) {
        this.watchTowerCharges++;
        if (this.watchTowerCharges < this.watchTowerMaxCharges) {
          this.watchTowerRechargeTimer = this._getCrewRechargeTime("fireWatch");
        } else {
          this.watchTowerRechargeTimer = 0;
        }
      }
    }
    // Mirror for HUD display
    this.watchTowerCooldown = this.watchTowerCharges > 0 ? 0 : this.watchTowerRechargeTimer;

    // Recharge fire crew charges — cooldown starts only after crew finishes its line
    // When a line completes, convert deferred charges into active cooldown slots
    if (this.fireCrewDeferredCount > 0 && this.fireCrewLines.length < this.fireCrewDeferredCount) {
      this.fireCrewDeferredCount = this.fireCrewLines.length;
      // Start the recharge timer if not already counting down
      if (this.fireCrewRechargeTimer <= 0) {
        this.fireCrewRechargeTimer = this._getCrewRechargeTime("fireCrew");
      }
    }
    // Count non-deferred empty slots that need recharging
    const fireCrewEmptySlots = this.fireCrewMaxCharges - this.fireCrewCharges - this.fireCrewDeferredCount;
    if (fireCrewEmptySlots > 0) {
      this.fireCrewRechargeTimer -= dt;
      if (this.fireCrewRechargeTimer <= 0) {
        this.fireCrewCharges++;
        const remainingEmpty = this.fireCrewMaxCharges - this.fireCrewCharges - this.fireCrewDeferredCount;
        if (remainingEmpty > 0) {
          this.fireCrewRechargeTimer = this._getCrewRechargeTime("fireCrew");
        } else {
          this.fireCrewRechargeTimer = 0;
        }
      }
    }
    // Mirror for HUD display: 0 = ready, -1 = all deferred (working), >0 = timer counting down
    this.fireCrewCooldown = this.fireCrewCharges > 0 ? 0 : (fireCrewEmptySlots > 0 ? this.fireCrewRechargeTimer : -1);

    // Update fire crew lines — progressively cut trees front-to-back
    if (!Array.isArray(this.fireCrewLines)) this.fireCrewLines = [];
    for (let i = this.fireCrewLines.length - 1; i >= 0; i--) {
      const line = this.fireCrewLines[i];
      const lineDx = line.endX - line.startX;
      const lineDy = line.endY - line.startY;
      const lineLen = Math.sqrt(lineDx * lineDx + lineDy * lineDy);
      if (lineLen === 0) { this.fireCrewLines.splice(i, 1); continue; }

      // Advance crew front along the line (fasterCutting upgrade boosts speed)
      const crewSpeed = this.fireCrewSpeed * (this._hasUpgrade("fasterCutting") ? 1.4 : 1);
      line.crewProgress = (line.crewProgress || 0) + crewSpeed * dt;

      // Query all trees within the line's bounding area
      const cx = (line.startX + line.endX) / 2;
      const cy = (line.startY + line.endY) / 2;
      const queryRadius = lineLen / 2 + this.fireCrewLineWidth;
      const candidates = this.forest.grid.queryCircle(cx, cy, queryRadius);

      // Filter to trees within the line's width and crew reach
      const halfW = this.fireCrewLineWidth / 2;
      const dirX = lineDx / lineLen;
      const dirY = lineDy / lineLen;

      let cuttingLeft = false;
      for (const tree of candidates) {
        if (tree.state === "burnt") continue;
        // Project tree onto line — must be within cutting corridor
        const tx = tree.x - line.startX;
        const ty = tree.y - line.startY;
        const along = tx * dirX + ty * dirY;
        if (along < -halfW || along > lineLen + halfW) continue;
        const perp = Math.abs(tx * (-dirY) + ty * dirX);
        if (perp > halfW) continue;

        // Only process trees that the crew front has reached
        if (along > line.crewProgress) {
          cuttingLeft = true;
          continue;
        }

        const cutThreshold = this.fireCrewCutThreshold * (this._hasUpgrade("fasterCutting") ? 0.7 : 1);

        // Suppress burning trees within the corridor (same timing as cutting)
        // Burning trees do NOT block line completion — fires may re-spread into corridor
        if (tree.state === "burning") {
          tree.fireCrewCutTimer = (tree.fireCrewCutTimer || 0) + dt;
          if (tree.fireCrewCutTimer >= cutThreshold) {
            this.forest.setState(tree, "wet");
            tree.fireCrewCutTimer = 0;
          }
          continue;
        }

        // This tree is within crew reach — increment its cutTimer
        tree.fireCrewCutTimer = (tree.fireCrewCutTimer || 0) + dt;
        if (tree.fireCrewCutTimer >= cutThreshold) {
          this.forest.setState(tree, "burnt");
          tree.fireCrewCutTimer = 0;
        } else {
          cuttingLeft = true;
        }
      }

      // Remove line when crew has passed the end AND all normal trees are cut.
      // Burning trees don't block — they may re-spread into the corridor indefinitely.
      if (line.crewProgress >= lineLen && !cuttingLeft) {
        this.fireCrewLines.splice(i, 1);
      }
    }

    // Recharge drone recon charges
    if (this.droneReconCharges < this.droneReconMaxCharges) {
      this.droneReconRechargeTimer -= dt;
      if (this.droneReconRechargeTimer <= 0) {
        this.droneReconCharges++;
        if (this.droneReconCharges < this.droneReconMaxCharges) {
          this.droneReconRechargeTimer = this._getCrewRechargeTime("droneRecon");
        } else {
          this.droneReconRechargeTimer = 0;
        }
      }
    }
    // Mirror for HUD display
    this.droneReconCooldown = this.droneReconCharges > 0 ? 0 : this.droneReconRechargeTimer;

    // Update drone recon — animate movement toward target + expire after duration
    const droneMoveSpeed = this.droneReconMoveSpeed * (this._hasUpgrade("droneControl") ? 1.5 : 1);
    let droneDur = this.droneReconDuration;
    if (this._hasUpgrade("droneDuration1")) droneDur += 15;
    if (this._hasUpgrade("droneDuration2")) droneDur += 15;
    for (let di = this.droneReconActive.length - 1; di >= 0; di--) {
      const d = this.droneReconActive[di];
      const dx = d.targetX - d.x;
      const dy = d.targetY - d.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) {
        const step = Math.min(droneMoveSpeed * dt, dist);
        d.x += (dx / dist) * step;
        d.y += (dy / dist) * step;
      } else {
        d.x = d.targetX;
        d.y = d.targetY;
      }
      const elapsed = this.timeSinceStart - d.startTime;
      if (elapsed >= droneDur) {
        this.droneReconActive.splice(di, 1);
        if (this.droneReconActive.length === 0) this.droneReconMoving = false;
        this._setSkillMessage("Drone Recon expired");
      }
    }

    // Decrease engine truck cooldown
    if (this.engineTruckCooldown > 0) {
      this.engineTruckCooldown -= dt;
    }

    // Update engine truck zone — keeps normal trees wet (suppressed) while active
    if (this.engineTruckZone) {
      const elapsed = this.timeSinceStart - this.engineTruckZone.startTime;
      if (elapsed >= this.engineTruckZone.duration) {
        this.engineTruckZone = null;
      } else {
        const targets = this.forest.grid.queryCircle(
          this.engineTruckZone.x, this.engineTruckZone.y, this.engineTruckZone.radius
        );
        for (const tree of targets) {
          if (tree.state !== "wet" && tree.state !== "burnt") {
            this.forest.setState(tree, "wet");
          }
        }
      }
    }

    // Decrease recon plane cooldown
    if (this.reconPlaneCooldown > 0) {
      this.reconPlaneCooldown -= dt;
    }

    // Update recon plane zones — expire after duration
    for (let i = this.reconPlaneZones.length - 1; i >= 0; i--) {
      const zone = this.reconPlaneZones[i];
      const elapsed = this.timeSinceStart - zone.startTime;
      if (elapsed >= zone.duration) {
        this.reconPlaneZones.splice(i, 1);
      }
    }

    // Update worker crew zone humidity effect
    if (this.workerCrewZone) {
      const elapsed = this.timeSinceStart - this.workerCrewZone.startTime;
      if (elapsed >= this.workerCrewZone.duration) {
        this.workerCrewZone = null;
      }
      // Local humidity effect is applied during fire spread in FireSpreadSystem
    }

    // Bulldozer energy + fuel + wear management
    if (this.bulldozerActive && this.player?.left) {
      // Drain energy while active and clicking
      this.bulldozerEnergy = Math.max(0, this.bulldozerEnergy - this.bulldozerDrainRate * dt);
      if (this.bulldozerEnergy <= 0) {
        this.bulldozerActive = false;
        this._setSkillMessage("Bulldozer overheated — wait for recharge");
      }
      // Economy: bulldozer fuel + durability wear per second
      if (this.economyState && !this.isSkillFree()) {
        // vehicleFuelEff upgrades slow fuel timer (base interval reduced to 1s for higher cost)
        const fuelInterval = this._hasUpgrade("vehicleFuelEff1") ? (this._hasUpgrade("vehicleFuelEff2") ? 1.6 : 1.3) : 1;
        this._bulldozerFuelTimer = (this._bulldozerFuelTimer ?? 0) + dt;
        this._bulldozerWearTimer = (this._bulldozerWearTimer ?? 0) + dt;
        // Fuel consumption (base 1 per 1 second, slowed by efficiency upgrades)
        if (this._bulldozerFuelTimer >= fuelInterval) {
          this._bulldozerFuelTimer -= fuelInterval;
          if (this.economyState.fuel > 0) {
            this.economyState.fuel -= 1;
            this.fuelConsumed += 1;
          } else {
            this.bulldozerActive = false;
            this._setSkillMessage("Bulldozer out of fuel");
          }
        }
        // Durability wear (base 3 per 2 sec, vehicleWear upgrades extend interval)
        const wearInterval = 2 * (this._hasUpgrade("vehicleWear1") ? 1.3 : 1) * (this._hasUpgrade("vehicleWear2") ? 1.3 : 1);
        if (this._bulldozerWearTimer >= wearInterval) {
          this._bulldozerWearTimer -= wearInterval;
          this.economyState.assetDurability.bulldozer = Math.max(0, this.economyState.assetDurability.bulldozer - 3);
          if (this.economyState.assetDurability.bulldozer <= 0) {
            this.bulldozerActive = false;
            this._setSkillMessage("Bulldozer broken — repair at base");
          }
        }
      }
    } else {
      // Recharge energy when not active or not clicking
      if (this.bulldozerEnergy < this.bulldozerMaxEnergy) {
        this.bulldozerEnergy = Math.min(this.bulldozerMaxEnergy, this.bulldozerEnergy + this.bulldozerRechargeRate * dt);
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
    // Draw fire crew line preview
    if (this.fireCrewMode) {
      this._drawFireCrewOverlay(ctx);
    }
    // Draw active fire crew lines
    this._drawFireCrewLines(ctx);
    // Draw active worker crew zone effect
    if (this.workerCrewZone) {
      this._drawWorkerCrewZone(ctx);
    }

    // Draw all active watch tower zones
    for (const zone of this.watchTowerZones) {
      this._drawWatchTowerZone(ctx, zone);
    }

    // Draw active drone recon zones
    for (const drone of this.droneReconActive) {
      this._drawDroneReconZone(ctx, drone);
    }

    // Draw drone recon targeting overlay (deploy or reposition)
    if (this.droneReconMode || this.droneReconMoving) {
      this._drawDroneReconOverlay(ctx);
    }

    // Draw active engine truck zone
    if (this.engineTruckZone) {
      this._drawEngineTruckZone(ctx);
    }

    // Draw engine truck targeting overlay
    if (this.engineTruckMode) {
      this._drawEngineTruckOverlay(ctx);
    }

    // Draw active recon plane zones
    for (const zone of this.reconPlaneZones) {
      this._drawReconPlaneZone(ctx, zone);
    }

    // Draw recon plane targeting overlay
    if (this.reconPlaneMode) {
      this._drawReconPlaneOverlay(ctx);
    }

    // Draw watch tower targeting circle
    if (this.watchTowerMode) {
      this._drawWatchTowerOverlay(ctx);
    }

    // Draw wind direction spread visualization on burning trees
    this._drawWindSpreadVisualization(ctx);

    // Draw low resource warnings at cursor when a skill is targeting
    this._drawCursorResourceWarning(ctx);

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
        const isWarning = this.skillMessage.includes("Warning:");
        if (isWarning) {
          // Extract warning text and draw as prominent banner
          const warnMatch = this.skillMessage.match(/Warning:\s*(.*)/);
          const warnText = warnMatch ? warnMatch[1] : this.skillMessage;
          // Pulsing red-orange banner near center-top
          const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 250);
          const bannerW = ctx.canvas.width * 0.4;
          const bannerH = 36;
          const bannerX = (ctx.canvas.width - bannerW) / 2;
          const bannerY = 60;
          ctx.fillStyle = `rgba(180, 40, 0, ${0.85 * pulse})`;
          ctx.beginPath();
          ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 8);
          ctx.fill();
          ctx.strokeStyle = `rgba(255, 100, 0, ${pulse})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 8);
          ctx.stroke();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 18px Arial";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(`⚠ ${warnText}`, bannerX + bannerW / 2, bannerY + bannerH / 2);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
        }
        // Also still show the skill mode text
        ctx.fillStyle = isWarning ? "#ff4400" : this.waterBomberMode ? "#f99" : "#ffb";
        ctx.font = isWarning ? "bold 16px Arial" : "14px Arial";
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
      
      // Bulldozer status
      ctx.font = "13px Arial";
      ctx.fillStyle = this.bulldozerActive ? "rgba(255, 200, 100, 1)" : "rgba(200, 150, 100, 0.7)";
      ctx.fillText(`[2] Bulldozer ${this.bulldozerActive ? "ACTIVE" : "Ready"}`, 12, 290);
      
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
      const bulldozerSize = 52; // Increased size to make the dozer more visible
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
      // Game over rendering is handled by LevelCompleteScreen
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

    // Fire Crew line targeting (two-step like bomber)
    if (this.fireCrewMode === "selectStart" && evt?.button === 0) {
      this.fireCrewStart = { x: worldX, y: worldY };
      this.fireCrewMode = "selectEnd";
      this._setSkillMessage("Click end point for firebreak");
      return;
    }
    if (this.fireCrewMode === "selectEnd" && evt?.button === 0) {
      // Clamp end point to max distance if desired (optional)
      const dx = worldX - this.fireCrewStart.x;
      const dy = worldY - this.fireCrewStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = this.fireCrewMaxLength; // max firebreak length
      let finalX = worldX, finalY = worldY;
      if (dist > maxDist) {
        const scale = maxDist / dist;
        finalX = this.fireCrewStart.x + dx * scale;
        finalY = this.fireCrewStart.y + dy * scale;
      }
      // Create cut points along the line using clamped endpoints
      const lineDx = finalX - this.fireCrewStart.x;
      const lineDy = finalY - this.fireCrewStart.y;
      const lineLen = Math.sqrt(lineDx * lineDx + lineDy * lineDy);
      const steps = Math.ceil(lineLen / 20);
      const cutPoints = [];
      for (let i = 0; i <= steps; i++) {
        const t = steps === 0 ? 0 : i / steps;
        cutPoints.push({
          x: this.fireCrewStart.x + lineDx * t,
          y: this.fireCrewStart.y + lineDy * t,
          cut: false,
          cutTimer: 0
        });
      }
      // Economy resource check (food wear)
      if (!this._consumeResourcesForSkill("fireCrew")) return;

      this.fireCrewLines.push({
        startX: this.fireCrewStart.x,
        startY: this.fireCrewStart.y,
        endX: finalX,
        endY: finalY,
        progress: 0,
        cutPoints,
        startTime: this.timeSinceStart
      });
      this.fireCrewCharges--;
      this.fireCrewDeferredCount++; // cooldown starts when this crew finishes
      this._setSkillMessage(`Fire Crew deployed: clearing firebreak (${this.fireCrewCharges}/${this.fireCrewMaxCharges} charges)`);
      this.fireCrewMode = null;
      this.fireCrewStart = null;
      this.fireCrewPreview = null;
      return;
    }
    if (this.fireCrewMode && evt?.button === 2) {
      this.fireCrewMode = null;
      this.fireCrewStart = null;
      this.fireCrewPreview = null;
      this._setSkillMessage("Fire Crew canceled");
      return;
    }

    // Drone Recon: click on active drone to select it for repositioning
    if (this.droneReconActive.length > 0 && !this.droneReconMode && !this.droneReconMoving && evt?.button === 0) {
      for (const d of this.droneReconActive) {
        const dx = worldX - d.x;
        const dy = worldY - d.y;
        const clickDist = Math.sqrt(dx * dx + dy * dy);
        if (clickDist <= 30) { // click within 30px of drone center to select
          this.droneReconMoving = true;
          this._selectedDrone = d;
          this._setSkillMessage("Drone selected — click new location");
          return;
        }
      }
    }
    // Drone Recon: place drone at new location after selecting it
    if (this.droneReconMoving && this._selectedDrone && evt?.button === 0) {
      this._selectedDrone.targetX = worldX;
      this._selectedDrone.targetY = worldY;
      this.droneReconMoving = false;
      this._selectedDrone = null;
      this._setSkillMessage("Drone moving to new position...");
      return;
    }
    // Cancel drone move on right-click
    if (this.droneReconMoving && evt?.button === 2) {
      this.droneReconMoving = false;
      this._setSkillMessage("Drone move canceled");
      return;
    }
    // Drone Recon targeting (deploy new)
    if (this.droneReconMode && evt?.button === 0) {
      this._executeDroneRecon(worldX, worldY);
      this.droneReconMode = false;
      return;
    }
    if (this.droneReconMode && evt?.button === 2) {
      this.droneReconMode = false;
      this._setSkillMessage("Drone Recon canceled");
      return;
    }

    // Engine Truck targeting
    if (this.engineTruckMode && evt?.button === 0) {
      this._executeEngineTruck(worldX, worldY);
      this.engineTruckMode = false;
      return;
    }
    if (this.engineTruckMode && evt?.button === 2) {
      this.engineTruckMode = false;
      this._setSkillMessage("Fire Truck canceled");
      return;
    }

    // Recon Plane targeting
    if (this.reconPlaneMode && evt?.button === 0) {
      this._executeReconPlane(worldX, worldY);
      this.reconPlaneMode = false;
      return;
    }
    if (this.reconPlaneMode && evt?.button === 2) {
      this.reconPlaneMode = false;
      this._setSkillMessage("Recon Plane canceled");
      return;
    }

    // General right-click deselect for toggle skills (bulldozer)
    if (evt?.button === 2 && this.bulldozerActive) {
      this.bulldozerActive = false;
      this._setSkillMessage("Bulldozer deactivated");
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
    if (k >= "1" && k <= "9") {
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
      if (keyNum !== 6) {
        this.fireCrewMode = null;
        this.fireCrewStart = null;
        this.fireCrewPreview = null;
      }
      if (keyNum !== 7) {
        this.droneReconMode = false;
        this.droneReconMoving = false;
      }
      if (keyNum !== 8) {
        this.engineTruckMode = false;
      }
      if (keyNum !== 9) {
        this.reconPlaneMode = false;
      }

      // Water Bomber (key 1): activate targeting directly
      if (keyNum === 1) {
        if (!this._isAssetUnlocked("waterBomber")) {
          this._setSkillMessage("Water Bomber not unlocked (need Airfield)");
          return;
        }
        if (this.economyState && !this.isSkillFree() && !this.economyState.isAssetAvailable("waterBomber")) {
          this._setSkillMessage("Water Bomber durability depleted — repair at base");
          return;
        }
        if (this.waterBomberCooldown > 0) {
          this._setSkillMessage(`Water Bomber cooldown: ${this.waterBomberCooldown.toFixed(1)}s`);
          return;
        }
        // If already in targeting mode, toggle water/retardant
        if (this.waterBomberMode) {
          this.waterBomberUseRetardant = !this.waterBomberUseRetardant;
          const mode = this.waterBomberUseRetardant ? "Retardant" : "Water";
          const warnToggle = this._getResourceWarning("waterBomber");
          this._setSkillMessage(warnToggle ? `Water Bomber: ${mode} mode — ${warnToggle}` : `Water Bomber: ${mode} mode (press 1 to toggle)`);
          return;
        }
        this.waterBomberUseRetardant = false;
        this.waterBomberMode = "selectStart";
        const warn1 = this._getResourceWarning("waterBomber");
        this._setSkillMessage(warn1 ? `Water Bomber: Water mode — ${warn1}` : "Water Bomber: Water mode (press 1 to toggle)");
        return;
      }

      // Bulldozer (key 2): toggle active mode (energy + fuel-based)
      if (keyNum === 2) {
        if (!this._isAssetUnlocked("bulldozer")) {
          this._setSkillMessage("Bulldozer not unlocked (need Vehicle Bay T3)");
          return;
        }
        if (this.economyState && !this.isSkillFree() && !this.economyState.isAssetAvailable("bulldozer")) {
          this._setSkillMessage("Bulldozer durability depleted — repair at base");
          return;
        }
        if (this.economyState && !this.isSkillFree() && this.economyState.fuel <= 0) {
          this._setSkillMessage("Bulldozer out of fuel");
          return;
        }
        if (this.bulldozerEnergy <= 0) {
          this._setSkillMessage("Bulldozer overheated — wait for recharge");
          return;
        }
        this.bulldozerActive = !this.bulldozerActive;
        if (this.bulldozerActive) {
          const warn2 = this._getResourceWarning("bulldozer");
          this._setSkillMessage(warn2 ? `Bulldozer ACTIVE — ${warn2}` : "Bulldozer ACTIVE");
        } else {
          this._setSkillMessage("Bulldozer deactivated");
        }
        return;
      }

      // Heli Drop (key 3): activate targeting mode
      if (keyNum === 3) {
        if (!this._isAssetUnlocked("heliDrop")) {
          this._setSkillMessage("Helicopter not unlocked (need Helipad)");
          return;
        }
        if (this.economyState && !this.isSkillFree() && !this.economyState.isAssetAvailable("helicopter")) {
          this._setSkillMessage("Helicopter durability depleted — repair at base");
          return;
        }
        if (this.heliDropCooldown > 0) {
          this._setSkillMessage(`Heli Drop cooldown: ${this.heliDropCooldown.toFixed(1)}s`);
          return;
        }
        // If already in targeting mode, toggle water/retardant
        if (this.heliDropMode) {
          this.heliDropUseRetardant = !this.heliDropUseRetardant;
          const mode = this.heliDropUseRetardant ? "Retardant" : "Water";
          const warnToggle3 = this._getResourceWarning("heliDrop");
          this._setSkillMessage(warnToggle3 ? `Helicopter: ${mode} mode — ${warnToggle3}` : `Helicopter: ${mode} mode (press 3 to toggle)`);
          return;
        }
        this.heliDropUseRetardant = false;
        this.heliDropMode = true;
        const warn3 = this._getResourceWarning("heliDrop");
        this._setSkillMessage(warn3 ? `Helicopter: Water mode — ${warn3}` : "Helicopter: Water mode (press 3 to toggle)");
        return;
      }

      // Sprinkler Trailer (key 4): activate targeting mode
      if (keyNum === 4) {
        if (!this._isAssetUnlocked("sprinklerTrailer")) {
          this._setSkillMessage("Sprinkler Trailer not unlocked (need Vehicle Bay T2)");
          return;
        }
        if (this.economyState && !this.isSkillFree() && !this.economyState.isAssetAvailable("sprinklerTrailer")) {
          this._setSkillMessage("Sprinkler Trailer durability depleted — repair at base");
          return;
        }
        if (this.workerCrewCooldown > 0) {
          this._setSkillMessage(`Sprinkler Trailer cooldown: ${this.workerCrewCooldown.toFixed(1)}s`);
          return;
        }
        this.workerCrewMode = !this.workerCrewMode;
        this._setSkillMessage(this.workerCrewMode ? "Click to deploy" : "Sprinkler Trailer canceled");
        return;
      }

      // Fire Watch (key 5): activate targeting mode like other skills
      if (keyNum === 5) {
        if (!this._isAssetUnlocked("fireWatch")) {
          this._setSkillMessage("Fire Watch not unlocked (need Crew Facilities)");
          return;
        }
        if (this.watchTowerCharges <= 0) {
          this._setSkillMessage(`Fire Watch recharging: ${this.watchTowerRechargeTimer.toFixed(1)}s (${this.watchTowerCharges}/${this.watchTowerMaxCharges})`);
          return;
        }
        this.watchTowerMode = !this.watchTowerMode;
        this._setSkillMessage(this.watchTowerMode ? "Click to place Fire Watch" : "Fire Watch canceled");
        return;
      }

      // Fire Crew (key 6): activate line targeting mode
      if (keyNum === 6) {
        if (!this._isAssetUnlocked("fireCrew")) {
          this._setSkillMessage("Fire Crew not unlocked (need Crew Facilities)");
          return;
        }
        if (this.fireCrewCharges <= 0) {
          if (this.fireCrewDeferredCount > 0) {
            this._setSkillMessage(`Fire Crew working... (${this.fireCrewCharges}/${this.fireCrewMaxCharges})`);
          } else {
            this._setSkillMessage(`Fire Crew recharging: ${this.fireCrewRechargeTimer.toFixed(1)}s (${this.fireCrewCharges}/${this.fireCrewMaxCharges})`);
          }
          return;
        }
        if (this.fireCrewMode) {
          this.fireCrewMode = null;
          this.fireCrewStart = null;
          this.fireCrewPreview = null;
          this._setSkillMessage("Fire Crew canceled");
          return;
        }
        this.fireCrewMode = "selectStart";
        this._setSkillMessage("Fire Crew: Click start of firebreak line");
        return;
      }

      // Drone Recon (key 7): deploy drone
      if (keyNum === 7) {
        if (!this._isAssetUnlocked("droneRecon")) {
          this._setSkillMessage("Drone Recon not unlocked (need Intel Facility)");
          return;
        }
        if (this.droneReconCharges <= 0) {
          this._setSkillMessage(`Drone Recon recharging: ${this.droneReconRechargeTimer.toFixed(1)}s (${this.droneReconCharges}/${this.droneReconMaxCharges})`);
          return;
        }
        if (this.droneReconMode) {
          this.droneReconMode = false;
          this._setSkillMessage("Drone Recon canceled");
          return;
        }
        this.droneReconMode = true;
        this._setSkillMessage("Click to deploy Drone Recon");
        return;
      }

      // Engine Truck (key 8): deploy suppression zone
      if (keyNum === 8) {
        if (!this._isAssetUnlocked("engineTruck")) {
          this._setSkillMessage("Fire Truck not unlocked (need Vehicle Bay)");
          return;
        }
        if (this.economyState && !this.isSkillFree() && !this.economyState.isAssetAvailable("engineTruck")) {
          this._setSkillMessage("Fire Truck durability depleted — repair at base");
          return;
        }
        if (this.engineTruckCooldown > 0) {
          this._setSkillMessage(`Fire Truck cooldown: ${this.engineTruckCooldown.toFixed(1)}s`);
          return;
        }
        if (this.engineTruckMode) {
          this.engineTruckMode = false;
          this._setSkillMessage("Fire Truck canceled");
          return;
        }
        this.engineTruckMode = true;
        const warn8 = this._getResourceWarning("engineTruck");
        this._setSkillMessage(warn8 ? `Fire Truck — ${warn8}` : "Click to deploy Fire Truck");
        return;
      }

      // Recon Plane (key 9): reveal large area on minimap
      if (keyNum === 9) {
        if (!this._isAssetUnlocked("reconPlane")) {
          this._setSkillMessage("Recon Plane not unlocked (need Intel Facility T3 + Airfield)");
          return;
        }
        if (this.economyState && !this.isSkillFree() && !this.economyState.isAssetAvailable("reconPlane")) {
          this._setSkillMessage("Recon Plane durability depleted — repair at base");
          return;
        }
        if (this.reconPlaneCooldown > 0) {
          this._setSkillMessage(`Recon Plane cooldown: ${this.reconPlaneCooldown.toFixed(1)}s`);
          return;
        }
        if (this.reconPlaneMode) {
          this.reconPlaneMode = false;
          this._setSkillMessage("Recon Plane canceled");
          return;
        }
        this.reconPlaneMode = true;
        const warn9 = this._getResourceWarning("reconPlane");
        this._setSkillMessage(warn9 ? `Recon Plane — ${warn9}` : "Click to deploy Recon Plane");
        return;
      }
    }

    if (k === "escape") {
      if (this.reconPlaneMode) {
        this.reconPlaneMode = false;
        this._setSkillMessage("Recon Plane canceled");
        return;
      }
      if (this.engineTruckMode) {
        this.engineTruckMode = false;
        this._setSkillMessage("Fire Truck canceled");
        return;
      }
      if (this.droneReconMoving) {
        this.droneReconMoving = false;
        this._setSkillMessage("Drone move canceled");
        return;
      }
      if (this.droneReconMode) {
        this.droneReconMode = false;
        this._setSkillMessage("Drone Recon canceled");
        return;
      }
      if (this.fireCrewMode) {
        this.fireCrewMode = null;
        this.fireCrewStart = null;
        this.fireCrewPreview = null;
        this._setSkillMessage("Fire Crew canceled");
        return;
      }
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

  // ── Economy integration: upgrade helper ──

  _hasUpgrade(id) {
    return this.economyState?.upgrades?.has(id) ?? false;
  }

  // ── Economy integration: crew recharge time (with fed penalty + upgrades) ──

  _getCrewRechargeTime(skillId) {
    const fedPenalty = this.economyState ? this.economyState.getCooldownModifier() : 0;
    let cd;
    if (skillId === "fireWatch") cd = this.watchTowerCooldownDuration;
    else if (skillId === "fireCrew") cd = this.fireCrewCooldownDuration;
    else if (skillId === "droneRecon") cd = this.droneReconCooldownDuration;
    else return 10;
    if (this._hasUpgrade("crewRecovery")) cd *= 0.75;
    return cd + fedPenalty;
  }

  // ── Economy integration: real-time food consumption for crew skills ──

  _consumeCrewFood() {
    const e = this.economyState;
    if (!e || this.isSkillFree()) return;

    // Each crew skill use wears fed status (lowerFoodCons upgrades reduce drain)
    let drain = 5;
    if (this._hasUpgrade("lowerFoodCons1")) drain *= 0.75;
    if (this._hasUpgrade("lowerFoodCons2")) drain *= 0.75;
    e.crewFedStatus = Math.max(0, e.crewFedStatus - drain);

    // Auto-feed: when fed drops to underfed threshold, spend 1 food to restore 20%
    if (e.crewFedStatus <= 75 && e.food > 0) {
      e.food -= 1;
      e.crewFedStatus = Math.min(100, e.crewFedStatus + 20);
    }
  }

  // ── Economy integration: asset unlock checks ──

  _isAssetUnlocked(skillId) {
    const e = this.economyState;
    if (!e) return true; // No economy state = all available (legacy/training)
    if (this.isSkillFree()) return true;
    if (skillId === "waterBomber") return e.hasWaterBomber;
    if (skillId === "bulldozer") return e.hasBulldozer;
    if (skillId === "heliDrop") return e.hasHelicopter;
    if (skillId === "sprinklerTrailer") return e.hasSprinklerTrailer;
    if (skillId === "fireWatch") return e.hasFireWatch;
    if (skillId === "fireCrew") return e.hasFireCrew;
    if (skillId === "droneRecon") return e.hasDroneRecon;
    if (skillId === "engineTruck") return e.hasEngineTruck;
    if (skillId === "reconPlane") return e.hasReconPlane && e.hasWaterBomber; // Recon Plane requires Airfield
    return true;
  }

  getBulldozerEnergyPercent() {
    return this.bulldozerEnergy / this.bulldozerMaxEnergy;
  }

  // ── Economy integration: resource consumption ──
  // Returns true if resources were consumed (or free mode), false if insufficient.

  _getResourceWarning(skillId) {
    const e = this.economyState;
    if (!e || this.isSkillFree()) return null;
    if (skillId === "waterBomber") {
      const fuelCost = this._hasUpgrade("bomberFuelEff") ? 6 : 8;
      if (e.fuel < fuelCost) return "Warning: Low fuel!";
      if (this.waterBomberUseRetardant) {
        const retCost = this._hasUpgrade("bomberRetEff") ? 3 : 4;
        if (e.retardant < retCost) return "Warning: Low retardant!";
      }
    }
    if (skillId === "bulldozer") {
      if (e.fuel < 1) return "Warning: Low fuel!";
    }

    if (skillId === "heliDrop") {
      const fuelCost = this._hasUpgrade("heliFuelEff") ? 4 : 5;
      if (e.fuel < fuelCost) return "Warning: Low fuel!";
      if (this.heliDropUseRetardant && e.retardant < 2) return "Warning: Low retardant!";
    }
    if (skillId === "engineTruck") {
      if (e.fuel < 1) return "Warning: Low fuel!";
    }
    if (skillId === "reconPlane") {
      if (e.money < 2000) return "Warning: Not enough money!";
    }
    return null;
  }

  _consumeResourcesForSkill(skillId) {
    const e = this.economyState;
    if (!e || this.isSkillFree()) return true;

    if (skillId === "waterBomber") {
      // 8 Fuel per sortie (bomberFuelEff reduces to 6)
      let fuelCost = this._hasUpgrade("bomberFuelEff") ? 6 : 8;
      // Retardant: 4 per sortie (bomberRetEff reduces to 3)
      let retCost = this._hasUpgrade("bomberRetEff") ? 3 : 4;
      if (e.fuel < fuelCost) {
        this._setSkillMessage(`Not enough fuel (need ${fuelCost})`);
        return false;
      }
      if (this.waterBomberUseRetardant && e.retardant < retCost) {
        this._setSkillMessage(`Not enough retardant (need ${retCost})`);
        return false;
      }
      e.fuel -= fuelCost;
      this.fuelConsumed += fuelCost;
      if (this.waterBomberUseRetardant) { e.retardant -= retCost; this.retardantConsumed += retCost; }
      // Durability: 5 wear per sortie (bomberDurability reduces to 3)
      const bomberWear = this._hasUpgrade("bomberDurability") ? 3 : 5;
      e.assetDurability.waterBomber = Math.max(0, e.assetDurability.waterBomber - bomberWear);
      return true;
    }

    if (skillId === "heliDrop") {
      // 5 Fuel per deployment (heliFuelEff reduces to 4)
      let fuelCost = this._hasUpgrade("heliFuelEff") ? 4 : 5;
      if (e.fuel < fuelCost) {
        this._setSkillMessage(`Not enough fuel (need ${fuelCost})`);
        return false;
      }
      if (this.heliDropUseRetardant && e.retardant < 2) {
        this._setSkillMessage("Not enough retardant (need 2)");
        return false;
      }
      e.fuel -= fuelCost;
      this.fuelConsumed += fuelCost;
      if (this.heliDropUseRetardant) { e.retardant -= 2; this.retardantConsumed += 2; }
      // Durability: 4 wear per deployment (heliDurability reduces to 2)
      const heliWear = this._hasUpgrade("heliDurability") ? 2 : 4;
      e.assetDurability.helicopter = Math.max(0, e.assetDurability.helicopter - heliWear);
      return true;
    }

    if (skillId === "sprinklerTrailer") {
      // No fuel cost, 2 durability wear per activation (vehicleWear1 reduces to 1)
      let wear = 2;
      if (this._hasUpgrade("vehicleWear1")) wear = 1;
      e.assetDurability.sprinklerTrailer = Math.max(0, e.assetDurability.sprinklerTrailer - wear);
      return true;
    }

    if (skillId === "fireWatch") {
      this._consumeCrewFood();
      return true;
    }

    if (skillId === "fireCrew") {
      this._consumeCrewFood();
      return true;
    }

    if (skillId === "droneRecon") {
      this._consumeCrewFood();
      return true;
    }

    if (skillId === "engineTruck") {
      // 1 Fuel per use
      if (e.fuel < 1) {
        this._setSkillMessage("Not enough fuel (need 1)");
        return false;
      }
      e.fuel -= 1;
      this.fuelConsumed += 1;
      // Durability: 1 wear per use
      e.assetDurability.engineTruck = Math.max(0, e.assetDurability.engineTruck - 1);
      return true;
    }

    if (skillId === "reconPlane") {
      // $2,000 per deployment
      if (e.money < 2000) {
        this._setSkillMessage("Not enough money ($2,000 needed)");
        return false;
      }
      e.money -= 2000;
      // Durability: 2 wear per deployment
      e.assetDurability.reconPlane = Math.max(0, e.assetDurability.reconPlane - 2);
      return true;
    }

    return true; // Bulldozer fuel is handled per-tick
  }

  _executeWaterBomberStrafe(x1, y1, x2, y2) {
    const skill = this.skills[1];
    const useEconomy = this.economyState && !this.isSkillFree();

    if (!useEconomy) {
      const cost = this.getSkillCost(skill);
      if (this.money < cost) {
        this._setSkillMessage("Not enough money");
        return;
      }
      if (cost > 0) this.money -= cost;
    }

    // Economy resource check (fuel + durability)
    if (!this._consumeResourcesForSkill("waterBomber")) return;
    
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
    this.waterBomberStrafeUsedRetardant = this.waterBomberUseRetardant;
    this.waterBomberCooldown = this.waterBomberCooldownDuration * (this._hasUpgrade("bomberTurnaround") ? 0.7 : 1); // Start cooldown
    this.waterBomberPath = { startX: x1, startY: y1, endX: x2, endY: y2, entryX, entryY, exitX, exitY };
    this.waterBomberPreview = { x1, y1, x2, y2 };
    this._setSkillMessage(this.waterBomberUseRetardant ? "Bomber incoming (retardant)!" : "Bomber incoming!");
  }

  _applyStrafeSupression() {
    if (!this.waterBomberPath) return;
    
    const { startX: x1, startY: y1, endX: x2, endY: y2 } = this.waterBomberPath;
    const useRetardant = this.waterBomberStrafeUsedRetardant;
    
    // Apply suppression along the strafe line
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist / 20);

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const targets = this.forest.grid.queryCircle(px, py, this.waterBomberStrafeRadius * (this._hasUpgrade("bomberDrop1") ? 1.25 : 1) * (this._hasUpgrade("bomberDrop2") ? 1.25 : 1));

      for (const tree of targets) {
        if (tree.state !== "wet" && tree.state !== "burnt") {
          this.forest.setState(tree, "wet");
          if (useRetardant) tree.retardant = true;
        }
      }
    }
  }

  _executeHeliDrop(x, y) {
    const skill = this.skills[3];
    const useEconomy = this.economyState && !this.isSkillFree();

    if (!useEconomy) {
      const cost = this.getSkillCost(skill);
      if (this.money < cost) {
        this._setSkillMessage("Not enough money");
        return;
      }
      if (cost > 0) this.money -= cost;
    }

    // Economy resource check (fuel + durability)
    if (!this._consumeResourcesForSkill("heliDrop")) return;

    // Start helicopter animation (spray happens during animation)
    this.heliDropAnimations.push({
      x,
      y,
      time: 0,
      sprayed: false,
      usedRetardant: this.heliDropUseRetardant,
      rotation: Math.random() * Math.PI * 2, // Random rotation 0-360 degrees
    });

    let heliCD = this.heliDropCooldownDuration;
    if (this._hasUpgrade("heliTurnaround1")) heliCD *= 0.8;
    if (this._hasUpgrade("heliTurnaround2")) heliCD *= 0.8;
    this.heliDropCooldown = heliCD;
    this._setSkillMessage(this.heliDropUseRetardant ? "Helicopter incoming (retardant)..." : "Helicopter incoming...");
  }

  _applyHeliDropSuppression(x, y, usedRetardant) {
    // Apply suppression effect (wet status) to all trees in radius
    let heliRadius = this.heliDropRadius;
    if (this._hasUpgrade("heliSuppression")) heliRadius *= 1.3;
    const targets = this.forest.grid.queryCircle(x, y, heliRadius);

    for (const tree of targets) {
      const dx = tree.x - x;
      const dy = tree.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= heliRadius) {
        // Apply suppression to burning and normal trees (not already wet/burnt)
        if (tree.state === "burning" || tree.state === "normal") {
          this.forest.setState(tree, "wet");
          if (usedRetardant) tree.retardant = true;
        }
      }
    }
  }

  _executeDroneRecon(x, y) {
    // Economy resource check (food wear)
    if (!this._consumeResourcesForSkill("droneRecon")) return;

    // Apply drone upgrades
    let droneRadius = this.droneReconRadius;
    if (this._hasUpgrade("droneRadius1")) droneRadius += 50;
    if (this._hasUpgrade("droneRadius2")) droneRadius += 50;
    this.droneReconActive.push({
      x, y,
      targetX: x,
      targetY: y,
      radius: droneRadius,
      startTime: this.timeSinceStart,
    });
    this.droneReconCharges--;
    if (this.droneReconCharges < this.droneReconMaxCharges && this.droneReconRechargeTimer <= 0) {
      this.droneReconRechargeTimer = this._getCrewRechargeTime("droneRecon");
    }
    this._setSkillMessage(`Drone Recon deployed! (${this.droneReconCharges}/${this.droneReconMaxCharges} charges)`);
  }

  _drawDroneReconOverlay(ctx) {
    // Show targeting circle at mouse position
    const mouseX = this.droneReconMouseX || (this.player ? this.player.x : 0);
    const mouseY = this.droneReconMouseY || (this.player ? this.player.y : 0);
    const radius = this.droneReconRadius;

    // Targeting zone circle - dashed cyan border
    ctx.strokeStyle = "rgba(0, 200, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center dot
    ctx.fillStyle = "rgba(0, 200, 255, 0.8)";
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 6, 0, Math.PI * 2);
    ctx.fill();

    // If repositioning, draw a line from selected drone to mouse
    if (this.droneReconMoving && this._selectedDrone) {
      ctx.strokeStyle = "rgba(0, 200, 255, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(this._selectedDrone.x, this._selectedDrone.y);
      ctx.lineTo(mouseX, mouseY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  _drawDroneReconZone(ctx, d) {
    if (!d) return;

    // Reveal zone circle - dashed cyan border
    ctx.strokeStyle = "rgba(0, 200, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Drone icon at center - small rotating marker
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 300);
    ctx.fillStyle = `rgba(0, 200, 255, ${pulse})`;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Outer ring
    ctx.strokeStyle = `rgba(0, 200, 255, ${0.3 + 0.2 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 10, 0, Math.PI * 2);
    ctx.stroke();

    // If moving, draw a movement trail line
    const dx = d.targetX - d.x;
    const dy = d.targetY - d.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 2) {
      ctx.strokeStyle = "rgba(0, 200, 255, 0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.targetX, d.targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Target marker
      ctx.strokeStyle = "rgba(0, 200, 255, 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(d.targetX, d.targetY, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _executeWorkerCrew(x, y) {
    const skill = this.skills[4];
    const useEconomy = this.economyState && !this.isSkillFree();

    if (!useEconomy) {
      const cost = this.getSkillCost(skill);
      if (this.money < cost) {
        this._setSkillMessage("Not enough money");
        return;
      }
      if (cost > 0) this.money -= cost;
    }

    // Economy resource check (durability wear)
    if (!this._consumeResourcesForSkill("sprinklerTrailer")) return;

    // Create a humidity buff zone (sprinklerDur extends duration, sprinklerRadius extends zone)
    let sprinklerDuration = 10;
    if (this._hasUpgrade("sprinklerDur")) sprinklerDuration += 4;
    this.workerCrewZone = {
      x,
      y,
      startTime: this.timeSinceStart,
      duration: sprinklerDuration,
    };
    // Apply sprinklerRadius upgrade to the active zone
    if (this._hasUpgrade("sprinklerRadius")) {
      this.workerCrewRadius = 72 * 1.3;
    } else {
      this.workerCrewRadius = 72;
    }
    
    let sprinklerCD = this.workerCrewCooldownDuration;
    if (this._hasUpgrade("sprinklerCooldown")) sprinklerCD *= 0.7;
    this.workerCrewCooldown = sprinklerCD;
    this._setSkillMessage(`Sprinkler Trailer deployed! Humidity boosted for ${sprinklerDuration}s`);
  }

  _executeEngineTruck(x, y) {
    // Economy resource check (fuel + durability)
    if (!this._consumeResourcesForSkill("engineTruck")) return;

    // Apply engine truck upgrades
    let etRadius = this.engineTruckRadius;
    if (this._hasUpgrade("engineOutput")) etRadius *= 1.35;
    let etDuration = this.engineTruckDuration;
    if (this._hasUpgrade("engineMobility")) etDuration += 3;
    this.engineTruckZone = {
      x, y,
      radius: etRadius,
      startTime: this.timeSinceStart,
      duration: etDuration,
    };
    let etCD = this.engineTruckCooldownDuration;
    if (this._hasUpgrade("engineRecharge")) etCD *= 0.7;
    this.engineTruckCooldown = etCD;
    this._setSkillMessage(`Fire Truck deployed! Suppressing for ${etDuration}s`);
  }

  _drawEngineTruckOverlay(ctx) {
    const mouseX = this.engineTruckMouseX || (this.player ? this.player.x : 0);
    const mouseY = this.engineTruckMouseY || (this.player ? this.player.y : 0);
    let radius = this.engineTruckRadius;
    if (this._hasUpgrade("engineOutput")) radius *= 1.35;

    // Fill with translucent red
    ctx.fillStyle = "rgba(255, 80, 40, 0.12)";
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Dashed border
    ctx.strokeStyle = "rgba(255, 120, 60, 0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center dot
    ctx.fillStyle = "rgba(255, 120, 60, 0.8)";
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  _executeReconPlane(x, y) {
    // Economy resource check ($2,000 + durability)
    if (!this._consumeResourcesForSkill("reconPlane")) return;

    // Apply recon plane upgrades
    let rpRadius = this.reconPlaneRadius;
    if (this._hasUpgrade("reconScanRadius")) rpRadius += 150;
    let rpDuration = this.reconPlaneDuration;
    if (this._hasUpgrade("reconDuration")) rpDuration += 10;
    this.reconPlaneZones.push({
      x, y,
      radius: rpRadius,
      startTime: this.timeSinceStart,
      duration: rpDuration,
    });
    this.reconPlaneCooldown = this.reconPlaneCooldownDuration;
    this._setSkillMessage(`Recon Plane deployed! Revealing area for ${rpDuration}s`);
  }

  _drawReconPlaneOverlay(ctx) {
    const mouseX = this.reconPlaneMouseX || (this.player ? this.player.x : 0);
    const mouseY = this.reconPlaneMouseY || (this.player ? this.player.y : 0);
    let radius = this.reconPlaneRadius;
    if (this._hasUpgrade("reconScanRadius")) radius += 150;

    // Fill with translucent blue
    ctx.fillStyle = "rgba(80, 160, 255, 0.08)";
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, radius, 0, Math.PI * 2);
    ctx.fill();

    // Dashed border
    ctx.strokeStyle = "rgba(80, 160, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center dot
    ctx.fillStyle = "rgba(80, 160, 255, 0.7)";
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawReconPlaneZone(ctx, zone) {
    const elapsed = this.timeSinceStart - zone.startTime;
    const remaining = Math.max(0, zone.duration - elapsed);
    const pct = remaining / zone.duration;

    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);

    // Border fades as time runs out
    ctx.strokeStyle = `rgba(80, 160, 255, ${0.2 + 0.2 * pct})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Timer arc
    ctx.strokeStyle = `rgba(120, 180, 255, ${0.4 + 0.3 * pct})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();

    // Center marker
    ctx.fillStyle = `rgba(100, 170, 255, ${0.5 + 0.2 * pulse})`;
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawEngineTruckZone(ctx) {
    const z = this.engineTruckZone;
    if (!z) return;

    const elapsed = this.timeSinceStart - z.startTime;
    const remaining = Math.max(0, z.duration - elapsed);
    const pct = remaining / z.duration;

    // Pulsing suppression zone
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
    ctx.fillStyle = `rgba(255, 100, 50, ${0.08 + 0.06 * pulse})`;
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
    ctx.fill();

    // Border - fades as time runs out
    ctx.strokeStyle = `rgba(255, 120, 60, ${0.3 + 0.3 * pct})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Timer arc showing remaining time
    ctx.strokeStyle = `rgba(255, 180, 80, ${0.5 + 0.3 * pct})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.radius + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct);
    ctx.stroke();

    // Center marker
    ctx.fillStyle = `rgba(255, 140, 60, ${0.6 + 0.2 * pulse})`;
    ctx.beginPath();
    ctx.arc(z.x, z.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  _useSelectedSkill(worldX, worldY) {
    const skill = this.skills[this.selectedSkillKey];
    if (!skill) return;
    const useEconomy = this.economyState && !this.isSkillFree();

    if (!useEconomy) {
      const cost = this.getSkillCost(skill);
      if (this.money < cost) {
        this._setSkillMessage("Not enough money");
        return;
      }
      if (cost > 0) this.money -= cost;
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

    if (skill.id === "sprinklerTrailer") {
      for (const t of targets) {
        if (t.state === "burning") {
          this.forest.setState(t, "normal");
        }
      }
      this._setSkillMessage("Sprinkler Trailer deployed.");
    }

    if (skill.id === "fireWatch") {
      this.watchTowerZones.push({ x: worldX, y: worldY, radius: skill.radius });
      this.watchTowerCharges--;
      if (this.watchTowerCharges < this.watchTowerMaxCharges && this.watchTowerRechargeTimer <= 0) {
        this.watchTowerRechargeTimer = this._getCrewRechargeTime("fireWatch");
      }
      this._setSkillMessage(`Fire Watch deployed! (${this.watchTowerCharges}/${this.watchTowerMaxCharges} charges)`);
    }
  }

  _placeWatchTower(x, y) {
    const skill = this.skills[5];
    if (!skill) return;
    const useEconomy = this.economyState && !this.isSkillFree();

    if (!useEconomy) {
      const cost = this.getSkillCost(skill);
      if (this.money < cost) {
        this._setSkillMessage("Not enough money");
        return;
      }
      if (cost > 0) this.money -= cost;
    }

    // Economy resource check (food wear)
    if (!this._consumeResourcesForSkill("fireWatch")) return;

    // Enforce max active watch towers — remove oldest if at limit
    const activeWatches = this.watchTowerZones.filter(z => z.state === "active");
    while (activeWatches.length >= this.watchTowerMaxActive) {
      const oldest = activeWatches.shift();
      const idx = this.watchTowerZones.indexOf(oldest);
      if (idx !== -1) this.watchTowerZones.splice(idx, 1);
    }

    // Add watch tower zone
    // Apply Fire Watch sight upgrades to radius
    let watchRadius = skill.radius;
    if (this._hasUpgrade("fireWatchSight1")) watchRadius += 60;
    if (this._hasUpgrade("fireWatchSight2")) watchRadius += 60;
    this.watchTowerZones.push({
      x,
      y,
      radius: watchRadius,
      state: "active", // active, burning, burnt
      timer: 0, // for burning duration
    });

    const fedPenalty = this.economyState ? this.economyState.getCooldownModifier() : 0;
    this.watchTowerCharges--;
    if (this.watchTowerCharges < this.watchTowerMaxCharges && this.watchTowerRechargeTimer <= 0) {
      this.watchTowerRechargeTimer = this._getCrewRechargeTime("fireWatch");
    }
    this._setSkillMessage(`Fire Watch deployed! (${this.watchTowerCharges}/${this.watchTowerMaxCharges} charges)`);
  }

  _applyPlayerActions(dt) {
    if (!this.player) return;

    const { x, y, left, right } = this.player;
    let radius = 24;
    // dozerLineWidth upgrade widens bulldozer cut radius
    if (this.bulldozerActive && this._hasUpgrade("dozerLineWidth")) radius = 32;
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
        let cutThreshold = this.bulldozerActive ? this.bulldozerCutTime : 0.9;
        // dozerSpeed upgrade makes bulldozer cut faster
        if (this.bulldozerActive && this._hasUpgrade("dozerSpeed")) cutThreshold *= 0.6;
        if (tree.cutTimer >= cutThreshold) {
          this.forest.setState(tree, "burnt");
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

    // Main reveal zone circle - dashed border only, reduced alpha
    ctx.strokeStyle = "rgba(255, 200, 0, 0.25)";
    ctx.lineWidth = 1.5;
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

    // Watch tower zone circle - dashed border only, reduced alpha
    if (state === "active") {
      ctx.strokeStyle = "rgba(255, 200, 0, 0.2)";
    } else if (state === "burning") {
      ctx.strokeStyle = "rgba(255, 100, 0, 0.4)"; // Orange-red for burning
    }
    
    ctx.lineWidth = 1.5;
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
    const miniW = 360; // doubled width from 180
    const miniH = 240; // doubled height from 120
    const padding = 10;
    const x = padding;
    const y = ctx.canvas.height - miniH - padding;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x, y, miniW, miniH);
    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, miniW, miniH);

    const scaleX = miniW / this.forest.width;
    const scaleY = miniH / this.forest.height;

    // Helper function to check if a world position is revealed by any watch tower or drone
    const isRevealed = (worldX, worldY) => {
      for (const zone of this.watchTowerZones) {
        if (zone.state !== "active") continue;
        const dx = worldX - zone.x;
        const dy = worldY - zone.y;
        if (Math.sqrt(dx * dx + dy * dy) <= zone.radius) return true;
      }
      for (const d of this.droneReconActive) {
        const dx = worldX - d.x;
        const dy = worldY - d.y;
        if (Math.sqrt(dx * dx + dy * dy) <= d.radius) return true;
      }
      for (const zone of this.reconPlaneZones) {
        const dx = worldX - zone.x;
        const dy = worldY - zone.y;
        if (Math.sqrt(dx * dx + dy * dy) <= zone.radius) return true;
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
        if (zone.state !== "active") continue;
        const zx = x + zone.x * scaleX;
        const zy = y + zone.y * scaleY;
        const zr = zone.radius * ((scaleX + scaleY) / 2);
        ctx.beginPath();
        ctx.arc(zx, zy, zr, 0, Math.PI * 2);
        ctx.fill();
      }
      // Drone recon also reveals fog
      for (const d of this.droneReconActive) {
        const dzx = x + d.x * scaleX;
        const dzy = y + d.y * scaleY;
        const dzr = d.radius * ((scaleX + scaleY) / 2);
        ctx.beginPath();
        ctx.arc(dzx, dzy, dzr, 0, Math.PI * 2);
        ctx.fill();
      }
      // Recon plane zones reveal fog
      for (const zone of this.reconPlaneZones) {
        const rzx = x + zone.x * scaleX;
        const rzy = y + zone.y * scaleY;
        const rzr = zone.radius * ((scaleX + scaleY) / 2);
        ctx.beginPath();
        ctx.arc(rzx, rzy, rzr, 0, Math.PI * 2);
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

  _drawCursorResourceWarning(ctx) {
    const e = this.economyState;
    if (!e || this.isSkillFree()) return;

    let warnText = null;
    let cx = this.player?.x ?? 0;
    let cy = this.player?.y ?? 0;

    // Water Bomber targeting
    if (this.waterBomberMode) {
      const warn = this._getResourceWarning("waterBomber");
      if (warn) {
        warnText = warn.includes("retardant") ? "Low Retardant" : "Low Fuel";
        if (this.waterBomberStart) {
          cx = this.player.x;
          cy = this.player.y;
        }
      }
    }
    // Bulldozer active
    else if (this.bulldozerActive) {
      if (e.fuel < 1) warnText = "Low Fuel";
      cx = this.player?.x ?? 0;
      cy = this.player?.y ?? 0;
    }
    // Heli Drop targeting
    else if (this.heliDropMode) {
      const warn = this._getResourceWarning("heliDrop");
      if (warn) {
        warnText = warn.includes("retardant") ? "Low Retardant" : "Low Fuel";
        cx = this.heliDropMouseX ?? cx;
        cy = this.heliDropMouseY ?? cy;
      }
    }
    // Engine Truck targeting
    else if (this.engineTruckMode) {
      if (e.fuel < 1) {
        warnText = "Low Fuel";
        cx = this.engineTruckMouseX ?? cx;
        cy = this.engineTruckMouseY ?? cy;
      }
    }

    if (!warnText) return;

    // Draw pulsing warning text near cursor
    const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 250);
    ctx.fillStyle = `rgba(255, 68, 0, ${pulse})`;
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(warnText, cx, cy - 30);
  }

  _drawWaterBomberOverlay(ctx) {
    // Compute upgraded strafe radius for preview
    let strafeR = this.waterBomberStrafeRadius;
    if (this._hasUpgrade("bomberDrop1")) strafeR *= 1.25;
    if (this._hasUpgrade("bomberDrop2")) strafeR *= 1.25;

    // Color scheme: blue for water, orange/red for retardant
    const useRet = this.waterBomberUseRetardant;
    const fillCol = useRet ? "rgba(255, 120, 40, 0.2)" : "rgba(100, 150, 200, 0.2)";
    const strokeCol = useRet ? "rgba(255, 140, 60, 0.8)" : "rgba(100, 180, 255, 0.8)";
    const strokeCol2 = useRet ? "rgba(255, 140, 60, 0.6)" : "rgba(100, 180, 255, 0.6)";
    const lineStroke = useRet ? "rgba(255, 160, 80, 0.8)" : "rgba(100, 200, 255, 0.8)";
    const fillCol2 = useRet ? "rgba(255, 120, 40, 0.25)" : "rgba(100, 150, 200, 0.25)";
    const endFill = useRet ? "rgba(255, 120, 40, 0.18)" : "rgba(100, 150, 200, 0.18)";
    const endStroke = useRet ? "rgba(255, 160, 80, 0.7)" : "rgba(100, 200, 255, 0.7)";
    const endStroke2 = useRet ? "rgba(255, 160, 80, 0.5)" : "rgba(100, 200, 255, 0.5)";

    // If in start point selection mode, show targeting at player position
    if (!this.waterBomberStart && this.waterBomberMode === "selectStart") {
      const x = this.player.x;
      const y = this.player.y;
      
      // Start point circle (targeting preview)
      ctx.fillStyle = fillCol;
      ctx.beginPath();
      ctx.arc(x, y, strafeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, strafeR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = strokeCol2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.lineTo(x + 10, y);
      ctx.moveTo(x, y - 10);
      ctx.lineTo(x, y + 10);
      ctx.stroke();

      // Mode label above targeting circle (immediate, like heli drop)
      if (useRet) {
        ctx.fillStyle = "rgba(255, 140, 60, 0.9)";
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("RETARDANT", x, y - strafeR - 6);
      }
      return;
    }

    if (!this.waterBomberPreview && !this.waterBomberStart) return;

    // Only draw targeting mode (strafe animation is now drawn in HUD space)
    if (!this.waterBomberStart) return;
    
    let x1, y1, x2, y2;
    const maxStrafeDist = strafeR * 3;

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

    ctx.strokeStyle = lineStroke;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Start point circle (similar style to spray radius)
    ctx.fillStyle = fillCol2;
    ctx.beginPath();
    ctx.arc(x1, y1, strafeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x1, y1, strafeR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = strokeCol2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1 - 10, y1);
    ctx.lineTo(x1 + 10, y1);
    ctx.moveTo(x1, y1 - 10);
    ctx.lineTo(x1, y1 + 10);
    ctx.stroke();

    // End point circle (similarly styled)
    ctx.fillStyle = endFill;
    ctx.beginPath();
    ctx.arc(x2, y2, strafeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = endStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x2, y2, strafeR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = endStroke2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x2 - 10, y2);
    ctx.lineTo(x2 + 10, y2);
    ctx.moveTo(x2, y2 - 10);
    ctx.lineTo(x2, y2 + 10);
    ctx.stroke();

    // Retardant label at midpoint
    if (useRet) {
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2 - 16;
      ctx.fillStyle = "rgba(255, 140, 60, 0.9)";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("RETARDANT", mx, my);
    }
  }

  _drawHeliDropOverlay(ctx) {
    // Draw targeting circle at mouse position (will be set by PlayScreen)
    const mouseX = this.heliDropMouseX ?? this.player?.x ?? 0;
    const mouseY = this.heliDropMouseY ?? this.player?.y ?? 0;
    let heliRadius = this.heliDropRadius;
    if (this._hasUpgrade("heliSuppression")) heliRadius *= 1.3;

    // Color scheme: green for water, orange/red for retardant
    const useRet = this.heliDropUseRetardant;
    const fillC = useRet ? "rgba(255, 120, 40, 0.15)" : "rgba(0, 255, 0, 0.15)";
    const strokeC = useRet ? "rgba(255, 140, 60, 0.6)" : "rgba(0, 255, 0, 0.6)";
    const centerC = useRet ? "rgba(255, 140, 60, 0.8)" : "rgba(0, 255, 0, 0.8)";
    const centerS = useRet ? "rgba(255, 160, 80, 0.6)" : "rgba(0, 255, 100, 0.6)";

    // Main suppression circle
    ctx.fillStyle = fillC;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, heliRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = strokeC;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, heliRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Center point
    ctx.fillStyle = centerC;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = centerS;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 6, 0, Math.PI * 2);
    ctx.stroke();

    // Retardant label above targeting circle
    if (useRet) {
      ctx.fillStyle = "rgba(255, 140, 60, 0.9)";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("RETARDANT", mouseX, mouseY - heliRadius - 6);
    }
  }

  _drawWorkerCrewOverlay(ctx) {
    // Draw targeting circle at mouse position (will be set by PlayScreen)
    const mouseX = this.workerCrewMouseX ?? this.player?.x ?? 0;
    const mouseY = this.workerCrewMouseY ?? this.player?.y ?? 0;
    let sprinklerR = this.workerCrewRadius;
    if (this._hasUpgrade("sprinklerRadius")) sprinklerR = 72 * 1.3;

    // Main humidity zone circle
    ctx.fillStyle = "rgba(100, 150, 255, 0.15)";
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, sprinklerR, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(100, 150, 255, 0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, sprinklerR, 0, Math.PI * 2);
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

  _drawFireCrewOverlay(ctx) {
    // Draw dashed preview line from start point to cursor during targeting
    if (this.fireCrewMode === "selectEnd" && this.fireCrewStart) {
      // Clamp preview end point to max firebreak length
      const maxDist = this.fireCrewMaxLength;
      let endX = this.player.x;
      let endY = this.player.y;
      const dx = endX - this.fireCrewStart.x;
      const dy = endY - this.fireCrewStart.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > maxDist) {
        const scale = maxDist / dist;
        endX = this.fireCrewStart.x + dx * scale;
        endY = this.fireCrewStart.y + dy * scale;
      }

      ctx.save();
      ctx.strokeStyle = "rgba(255, 180, 80, 0.7)";
      ctx.lineWidth = this.fireCrewLineWidth;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.moveTo(this.fireCrewStart.x, this.fireCrewStart.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Dashed center line
      ctx.strokeStyle = "rgba(255, 220, 150, 0.8)";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(this.fireCrewStart.x, this.fireCrewStart.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Start point marker
      ctx.fillStyle = "rgba(255, 200, 100, 0.9)";
      ctx.beginPath();
      ctx.arc(this.fireCrewStart.x, this.fireCrewStart.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // End point marker
      ctx.fillStyle = "rgba(255, 200, 100, 0.6)";
      ctx.beginPath();
      ctx.arc(endX, endY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Start point cursor when in selectStart mode
    if (this.fireCrewMode === "selectStart") {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 180, 80, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(this.player.x, this.player.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  _drawFireCrewLines(ctx) {
    for (const line of this.fireCrewLines) {
      const lineDx = line.endX - line.startX;
      const lineDy = line.endY - line.startY;
      const lineLen = Math.sqrt(lineDx * lineDx + lineDy * lineDy);
      if (lineLen === 0) continue;
      const dirX = lineDx / lineLen;
      const dirY = lineDy / lineLen;
      const progress = line.crewProgress || 0;

      ctx.save();

      // Draw the full planned line path (faded)
      ctx.strokeStyle = "rgba(180, 130, 60, 0.2)";
      ctx.lineWidth = this.fireCrewLineWidth;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(line.startX, line.startY);
      ctx.lineTo(line.endX, line.endY);
      ctx.stroke();

      // Draw the worked segment (start to crew front) in darker brown
      const frontDist = Math.min(progress, lineLen);
      const frontX = line.startX + dirX * frontDist;
      const frontY = line.startY + dirY * frontDist;
      ctx.strokeStyle = "rgba(100, 70, 30, 0.4)";
      ctx.lineWidth = this.fireCrewLineWidth;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(line.startX, line.startY);
      ctx.lineTo(frontX, frontY);
      ctx.stroke();

      // Draw crew front marker (animated pulse)
      if (progress < lineLen) {
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
        ctx.fillStyle = `rgba(255, 200, 80, ${0.5 + 0.3 * pulse})`;
        ctx.beginPath();
        ctx.arc(frontX, frontY, 5 + 2 * pulse, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw per-tree progress for trees being actively cut
      const halfW = this.fireCrewLineWidth / 2;
      const queryRadius = lineLen / 2 + this.fireCrewLineWidth;
      const cx = (line.startX + line.endX) / 2;
      const cy = (line.startY + line.endY) / 2;
      const candidates = this.forest.grid.queryCircle(cx, cy, queryRadius);
      for (const tree of candidates) {
        if (tree.state === "burnt" || !tree.fireCrewCutTimer) continue;
        const tx = tree.x - line.startX;
        const ty = tree.y - line.startY;
        const along = tx * dirX + ty * dirY;
        if (along < -halfW || along > lineLen + halfW) continue;
        const perp = Math.abs(tx * (-dirY) + ty * dirX);
        if (perp > halfW) continue;

        // Show tree cut progress as a shrinking ring
        const pct = tree.fireCrewCutTimer / this.fireCrewCutThreshold;
        ctx.strokeStyle = `rgba(255, 180, 60, ${0.4 + 0.4 * pct})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tree.x, tree.y, 6 * (1 - pct * 0.5), 0, Math.PI * 2 * pct);
        ctx.stroke();
      }

      // Dashed center line
      ctx.strokeStyle = "rgba(255, 220, 150, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(line.startX, line.startY);
      ctx.lineTo(line.endX, line.endY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }
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
