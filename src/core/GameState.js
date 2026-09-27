import { Forest } from "./Forest.js";
import { WeatherSystem } from "../systems/WeatherSystem.js";
import { FireSpreadSystem } from "../systems/FireSpreadSystem.js";
import { SKILL_CONFIG as SC } from "../data/skillConfig.js";

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
    this.settlementSprite = sprites?.settlement || null;
    this.settlementSprites = {
      settlement: sprites?.settlement || null,
      settlement3: sprites?.settlement3 || null,
      settlement5: sprites?.settlement5 || null,
      settlement3_burning: sprites?.settlement3_burning || null,
      settlement5_burning: sprites?.settlement5_burning || null,
    };
    this.watchTowerSprite = sprites?.watchTower || null;
    this.sprinklerSprite = sprites?.sprinkler || null;
    this.droneSprite = sprites?.drone || null;
    this.forestFloorSprite = sprites?.forestFloor || null;
    this.roadTextureSprite = sprites?.roadTexture || null;
    this.started = false;
    this.over = false;
    this.timeSinceStart = 0;

    this.weather = new WeatherSystem({
      temperature: mission.weather?.temperature ?? 22,
      airHumidity: mission.weather?.airHumidity ?? 40,
      windAngle: mission.weather?.windAngle ?? 0,
      windStrength: mission.weather?.windStrength ?? 30,
      fuelHumidity: mission.weather?.fuelHumidity ?? 50,
      treeTypes: mission.treeTypes ?? null,
    });

    this.forest = new Forest({
      width: mission.width,
      height: mission.height,
      treeCount: mission.treeCount,
      sprites: this.sprites,
      defaultTreeType: mission.defaultTreeType ?? "conifer",
      treeMix: mission.treeMix ?? null,
      forestStyle: mission.forestStyle ?? "clustered",
      seed: mission.seed ?? null,
      forestGradient: mission.forestGradient ?? null,
    });

    this.roads = mission.roads ?? [];
    this.creeks = mission.creeks ?? [];

    this.fire = new FireSpreadSystem({ forest: this.forest, weather: this.weather });

    this.minZoom = mission.minZoom ?? 1.75;
    this.maxZoom = mission.maxZoom ?? 1.0;
    this.camera = { x: 0, y: 0, zoom: mission.startZoom ?? 1.75};
    this.player = { x: this.camera.x + 400, y: this.camera.y + 300 };

    this.money = mission.startMoney;
    this.saved = 0;
    this.cutPositions = []; // World positions of removed (cut) trees for minimap display

    // Settlement objectives
    this.settlements = [];
    this.settlementFailed = false;
    this._settlementCheckTimer = 0;

    // Skill system (activated with number keys 1-9 + click)
    this.skills = {
      1: { id: "waterBomber",     name: "Water Bomber",     cost: 0,   radius: SC.waterBomber.targetingRadius },
      2: { id: "heliDrop",        name: "Heli Drop",        cost: 0,   radius: SC.heliDrop.targetingRadius },
      3: { id: "bulldozer",       name: "Bulldozer",        cost: 0,   radius: SC.bulldozer.targetingRadius },
      4: { id: "sprinklerTrailer",name: "Sprinkler Trailer",cost: 0,   radius: SC.sprinklerTrailer.targetingRadius },
      5: { id: "fireWatch",       name: "Fire Watch",       cost: 0,   radius: SC.fireWatch.targetingRadius },
      6: { id: "droneRecon",      name: "Drone Recon",      cost: 0,   radius: SC.droneRecon.targetingRadius },
      7: { id: "reconPlane",      name: "Recon Plane",      cost: 200, radius: SC.reconPlane.targetingRadius },
      8: { id: "fireCrew",        name: "Fire Crew",        cost: 0,   radius: SC.fireCrew.targetingRadius },
      9: { id: "engineTruck",     name: "Fire Truck",       cost: 0,   radius: SC.engineTruck.targetingRadius },
    };
    this.selectedSkillKey = null;
    this.skillMessage = "";
    this.skillMessageTimer = 0;
    // Queue of active warning banners — each entry: { text, timer }
    // Warnings (prefixed "Warning:") are pushed here and rendered stacked.
    this._warningQueue = [];

    // Watch Tower skill (key 5) - minimap fog of war reveal
    this.watchTowerMode = false; // targeting mode
    this.watchTowerMouseX = 0;
    this.watchTowerMouseY = 0;
    this.watchTowerZones = []; // Array of { x, y, radius }
    this.watchTowerCooldown = 0;
    this.watchTowerCooldownDuration = SC.fireWatch.chargeRecharge;
    this.watchTowerCharges = SC.fireWatch.startCharges;
    this.watchTowerMaxCharges = SC.fireWatch.maxCharges;
    this.watchTowerRechargeTimer = 0;
    this.waterBomberMode = null; // null, "selectStart", "selectEnd"
    this.waterBomberUseRetardant = false; // water vs retardant toggle
    this.waterBomberStart = null;
    this.waterBomberPreview = null;
    this.waterBomberStrafing = false;
    this.waterBomberStrafeTime = 0;
    this.waterBomberStrafeDuration = SC.waterBomber.strafeDuration;
    this.waterBomberStrafeRadius = SC.waterBomber.strafeRadius;
    this.waterBomberPath = null; // { startX, startY, endX, endY, entryX, entryY, exitX, exitY }
    this.waterBomberEndpointHit = false; // Track if suppression has been applied
    this.waterBomberCooldown = 0; // Cooldown timer
    this.waterBomberCooldownDuration = SC.waterBomber.cooldown;

    // Bulldozer skill (key 3) - targeted path cutting (like Water Bomber)
    this.bulldozerMode = null;         // null, "selectStart", "selectEnd"
    this.bulldozerStart = null;        // { x, y } — first click world position
    this.bulldozerRunning = false;     // animation in progress
    this.bulldozerRunTime = 0;         // elapsed time in current run
    this.bulldozerRunDuration = 0;     // total time for this run
    this.bulldozerPath = null;         // { startX, startY, endX, endY }
    this.bulldozerCooldown = 0;
    this.bulldozerCooldownDuration = SC.bulldozer.cooldown;
    this.bulldozerMouseX = 0;          // world x of mouse/dozer for targeting+run
    this.bulldozerMouseY = 0;

    // Heli Drop skill (key 3) - circle suppression with cooldown
    this.heliDropMode = false; // targeting mode
    this.heliDropUseRetardant = false; // water vs retardant toggle
    this.heliDropRadius = SC.heliDrop.suppressionRadius;
    this.heliDropCooldown = 0;
    this.heliDropCooldownDuration = SC.heliDrop.cooldown;
    this.heliDropAnimations = []; // Track active helicopter animations

    // Worker Crew skill (key 4) - humidity buff zone
    this.workerCrewMode = false; // targeting mode
    this.workerCrewRadius = SC.sprinklerTrailer.zoneRadius;
    this.workerCrewCooldown = 0;
    this.workerCrewCooldownDuration = SC.sprinklerTrailer.cooldown;
    this.workerCrewZone = null; // { x, y, startTime, duration }

    // Fire Crew skill (key 6) - always-on left click cutting tool (energy + food wear)
    this.fireCrewEnergy = SC.fireCrew.maxEnergy;
    this.fireCrewMaxEnergy = SC.fireCrew.maxEnergy;
    this.fireCrewRechargeRate = SC.fireCrew.rechargeRate;
    this.fireCrewDrainRate = SC.fireCrew.drainRate;
    this.fireCrewCutTime = SC.fireCrew.cutTime;
    this.fireCrewRadius = SC.fireCrew.cutRadius;
    this.fireCrewCooldown = 0;      // kept for HUD compatibility
    this._fireCrewFoodTimer = 0;    // timer for periodic food wear

    // Drone Recon skill (key 7) - movable timed intel reveal (smaller than Fire Watch)
    this.droneReconMode = false;
    this.droneReconMouseX = 0;
    this.droneReconMouseY = 0;
    this.droneReconActive = []; // Array of { x, y, targetX, targetY, radius, startTime }
    this.droneReconCooldown = 0;
    this.droneReconCooldownDuration = SC.droneRecon.chargeRecharge;
    this.droneReconCharges = SC.droneRecon.startCharges;
    this.droneReconMaxCharges = SC.droneRecon.maxCharges;
    this.droneReconRechargeTimer = 0;
    this.droneReconDuration = SC.droneRecon.duration;
    this.droneReconRadius = SC.droneRecon.radius;
    this.droneReconMoveSpeed = SC.droneRecon.moveSpeed;
    this.droneReconMoving = false; // unused — kept for compatibility

    // Engine Truck (key 8) — right-click hold continuous suppression
    this.engineTruckMode = false;          // always false; right-click hold IS the truck
    this.engineTruckZone = null;           // { x, y, radius } — live zone while right held
    this.engineTruckRadius = SC.engineTruck.sprayRadius;
    this.engineTruckSprayTime = SC.engineTruck.sprayTime;
    this.engineTruckWearInterval = SC.engineTruck.wearInterval;
    this._engineTruckWearTimer = 0;

    // Recon Plane skill (key 9) - large area intel reveal
    this.reconPlaneMode = false;
    this.reconPlaneMouseX = 0;
    this.reconPlaneMouseY = 0;
    this.reconPlaneZones = []; // Array of { x, y, radius, startTime, duration }
    this.reconPlaneCooldown = 0;
    this.reconPlaneCooldownDuration = SC.reconPlane.cooldown;
    this.reconPlaneDuration = SC.reconPlane.revealDuration;
    this.reconPlaneRadius = SC.reconPlane.targetingRadius;
    this._reconPlaneModeEnterTime = 0;

    // Minimap resize state – persisted via localStorage, default one step smaller
    this._miniMapScale = parseFloat(localStorage.getItem('fb_minimapScale') || '') || 0.85;
    // Minimap focus mode: true = zoom to visible area, false = show whole map (default OFF)
    this._miniMapFocusZoom = localStorage.getItem('fb_minimapFocus') === 'true';
    this._miniMapButtons = [];

    // Debug/Visual toggles
    this.showDebugInfo = false; // Toggle with 'B' key

    // Fire build-up mechanic: runs fire at faster clock speed until time or tree count
    this.fireBuildup = {
      enabled: mission.fireBuildup?.enabled ?? true,
      buildupDuration: mission.fireBuildup?.buildupDuration ?? 2, // max seconds at fast speed
      treeThreshold: mission.fireBuildup?.treeThreshold ?? 200,   // stop buildup when this many trees burning/burnt
      timeSpeed: mission.fireBuildup?.timeSpeed ?? 50.0,          // clock speed multiplier during buildup
    };
    this.fireElapsedTime = 0;

    // Timer win condition
    this.missionTimer    = null;  // null = inactive; counts down to 0 for win
    this.missionTimerMax = null;

    // Timed fire starts
    this._pendingFireStarts = [];
  }

  start() {
    this.started = true;
    this.over = false;
    this.timeSinceStart = 0;

    // Burn threshold warnings — reset each mission run
    this._burnWarn10Fired = false;  // temp warning at 10% from failBurnPercent
    this._burnWarn5Fired  = false;  // permanent warning at 5% from failBurnPercent
    this._burnWarnPermanent = false; // true when a permanent burn warning is pinned

    // Apply crew charge upgrades
    let crewMaxCharges = 1;
    if (this._hasUpgrade("crewAvail1")) crewMaxCharges++;
    if (this._hasUpgrade("crewAvail2")) crewMaxCharges++;
    this.watchTowerMaxCharges = crewMaxCharges;
    this.watchTowerCharges = crewMaxCharges;
    this.watchTowerMaxActive = crewMaxCharges; // max active towers on map
    this.droneReconMaxCharges = crewMaxCharges;
    this.droneReconCharges = crewMaxCharges;
    this.droneReconActive = [];
    this.droneReconMoving = false;
    this._selectedDrone = null; // unused

    this.forest.generate();
    // Clear trees along roads and creeks for visual and gameplay accuracy
    const _treeHalfSize = 14; // half of TREE_SIZE (28px) keeps visual edges clean
    for (const road of this.roads) {
      this.forest.clearAlongPath(this._tessellateSmooth(road.points), (road.width ?? 35) / 2 + _treeHalfSize);
    }
    for (const creek of this.creeks) {
      this.forest.clearAlongPath(this._tessellateSmooth(creek.points), (creek.width ?? 12) / 2 + _treeHalfSize);
    }
    this.fire.reset();
    this.weather.resetTimer();
    this.fireElapsedTime = 0;

    // Timer win condition
    if (this.mission.winCondition === "timer") {
      this.missionTimer    = this.mission.winTimer ?? 180;
      this.missionTimerMax = this.missionTimer;
    } else {
      this.missionTimer    = null;
      this.missionTimerMax = null;
    }

    // Timed fire starts — copy entries with per-entry tracking state
    this._pendingFireStarts = (this.mission.timedFireStarts ?? []).map(e => ({
      ...e,
      _fired: false,
      _nextFireTime: e.interval != null ? (e.startAfter ?? 0) + e.interval : null,
    }));

    this._initializeSettlements();

    // Use game mode's fire initialization if available, otherwise fall back to default
    if (this.gameMode && typeof this.gameMode.initializeFires === "function") {
      this.gameMode.initializeFires(this.forest, this.mission);
    } else {
      // Default fallback
      this.forest.igniteRandom(6);
    }

    // Ensure we have at least one fire to avoid immediately ending the mission.
    if (this.forest.burningCount === 0) {
      this.forest.igniteRandom(1);
    }

    // Thematic fire-start alert
    const _startAlerts = [
      "Warning: 🔥 Fire detected — all units respond!",
      "Warning: 🔥 Ignition confirmed — move to intercept!",
      "Warning: 🔥 Smoke on the horizon — fire in progress!",
      "Warning: 🔥 Active burn reported — deploy assets!",
      "Warning: 🔥 Fire spotted — contain before it spreads!",
    ];
    this._setSkillMessage(_startAlerts[Math.floor(Math.random() * _startAlerts.length)]);

    // Do not adjust camera zoom at start: keep current starting zoom (from constructor/default)
    // Center the camera on cameraStart (if defined in mission) or the map center
    const worldCenterX = this.mission.cameraStart?.x ?? this.forest.width / 2;
    const worldCenterY = this.mission.cameraStart?.y ?? this.forest.height / 2;
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
    
    // Fire build-up: run fire at faster clock speed until time or tree count is reached
    let fireDt = dt;
    const bu = this.fireBuildup;
    if (bu?.enabled
        && this.fireElapsedTime < bu.buildupDuration
        && this.forest.everBurnedCount < bu.treeThreshold) {
      fireDt = dt * bu.timeSpeed;
    }
    this.fireElapsedTime += dt;
    
    this.fire.update(fireDt);
    this._applyPlayerActions(dt);
    this.forest.update(dt);

    // Check settlement objectives (every 0.5s)
    if (this.settlements.length > 0 && this.timeSinceStart >= 0.5) {
      this._settlementCheckTimer += dt;
      if (this._settlementCheckTimer >= 0.5) {
        this._settlementCheckTimer = 0;
        this._checkSettlements();
      }
    }

    // Timed fire starts — ignite additional fires at scheduled times or on an interval
    for (const entry of this._pendingFireStarts) {
      if (entry.interval != null) {
        if (this.timeSinceStart >= (entry.startAfter ?? 0) && this.timeSinceStart >= entry._nextFireTime) {
          this._igniteTimedFireStart(entry);
          entry._nextFireTime = this.timeSinceStart + entry.interval;
        }
      } else if (!entry._fired && this.timeSinceStart >= entry.time) {
        entry._fired = true;
        this._igniteTimedFireStart(entry);
      }
    }

    // Mission countdown timer (winCondition: "timer") — when it reaches 0 the player wins
    if (this.missionTimer !== null) {
      this.missionTimer = Math.max(0, this.missionTimer - dt);
      if (this.missionTimer <= 0 && !this.over) {
        this.over = true;
        this.saved = this.forest.normalCount;
      }
    }

    // Game over / win conditions
    // Delay the win check briefly to avoid ending immediately when the game first starts.
    // For "timer" win condition, extinguishing all fires does NOT grant success — only timer expiry does.
    if (this.timeSinceStart >= 0.5 && this.forest.burningCount === 0 && this.mission?.winCondition !== "timer") {
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
        if (this._burnWarnPermanent) {
          // Keep the permanent burn warning visible — don't clear it
          this.skillMessageTimer = 0;
        } else {
          this.skillMessage = "";
          this.skillMessageTimer = 0;
        }
      }
    }

    // Warning queue timers
    for (let i = this._warningQueue.length - 1; i >= 0; i--) {
      this._warningQueue[i].timer -= dt;
      if (this._warningQueue[i].timer <= 0) {
        this._warningQueue.splice(i, 1);
      }
    }

    // Burn-threshold proximity warnings
    // Temp warning fires when burned trees reach (failBurnPercent - 10)% of total.
    // Permanent warning fires when burned trees reach (failBurnPercent - 5)% of total.
    // e.g. failBurnPercent=20 → temp at 10% burned, permanent at 15% burned.
    if (!this.over && this.timeSinceStart >= 1) {
      const failPct    = this.mission?.failBurnPercent ?? 100;
      const totalTrees = this.forest.treeCount || 1;
      const burntNow   = this.forest.burntCount || 0;
      const burnPct    = (burntNow / totalTrees) * 100;

      if (!this._burnWarn5Fired && burnPct >= failPct - 5) {
        this._burnWarn5Fired    = true;
        this._burnWarn10Fired   = true;
        this._burnWarnPermanent = true;
        // Permanent — pinned until mission ends
        const permText = "Warning: 🔥 Forest critically consumed — near total loss!";
        this._warningQueue = this._warningQueue.filter(w => !w.permanent);
        this._warningQueue.push({ text: permText, timer: 9999, permanent: true });
        this.skillMessage      = "";
        this.skillMessageTimer = 0;
      } else if (!this._burnWarn10Fired && burnPct >= failPct - 10) {
        this._burnWarn10Fired = true;
        // Temporary — 5 seconds
        const tempText = "Warning: Fire is consuming the last of the forest!";
        const existing = this._warningQueue.find(w => w.text === tempText);
        if (existing) { existing.timer = 5; } else { this._warningQueue.push({ text: tempText, timer: 5 }); }
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

    // Fire crew energy + food wear management (always-on left click tool)
    // Bulldozer takes over cutting when active — crew rests and recharges
    if (this.player?.left && !this.bulldozerActive) {
      // Base drain, modified by stamina upgrades and underfed penalty
      let effectiveDrain = this.fireCrewDrainRate;
      if (this._hasUpgrade("crewStamina1")) effectiveDrain *= SC.fireCrew.drainMultUpg;
      if (this._hasUpgrade("crewStamina2")) effectiveDrain *= SC.fireCrew.drainMultUpg;
      const drainMult = this.economyState ? this.economyState.getFireCrewDrainMultiplier() : 1.0;
      this.fireCrewEnergy = Math.max(0, this.fireCrewEnergy - effectiveDrain * drainMult * dt);
      if (this.fireCrewEnergy <= 0) {
        this._setSkillMessage("Fire Crew exhausted — rest to recover");
      }
      // Food wear: drain crewFedStatus periodically during active cutting
      if (this.economyState && !this.isSkillFree()) {
        this._fireCrewFoodTimer = (this._fireCrewFoodTimer ?? 0) + dt;
        if (this._fireCrewFoodTimer >= SC.fireCrew.foodWearInterval) {
          this._fireCrewFoodTimer -= SC.fireCrew.foodWearInterval;
          this._consumeCrewFood();
        }
      }
    } else {
      // Recharge energy when not actively cutting — slowed when crew is underfed
      const rechargeMult = this.economyState ? this.economyState.getFireCrewRechargeMultiplier() : 1.0;
      const maxEnergyMult = this.economyState ? this.economyState.getFireCrewMaxEnergyMultiplier() : 1.0;
      const effectiveMax = this.fireCrewMaxEnergy * maxEnergyMult;
      this.fireCrewEnergy = Math.min(effectiveMax, this.fireCrewEnergy + this.fireCrewRechargeRate * rechargeMult * dt);
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
      // Continuously chase the cursor
      d.targetX = this.droneReconMouseX;
      d.targetY = this.droneReconMouseY;
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
        this._setSkillMessage("Drone Recon expired");
      }
    }

    // Decrease engine truck cooldown
    // Fire Truck (right-click hold) — continuous suppression with durability/fuel wear
    {
      const truckUnlocked = this._isAssetUnlocked("engineTruck");
      // Auto-repair if broken and player holds right-click with parts available
      if (this.player?.right && truckUnlocked && this.economyState && !this.isSkillFree() &&
          (this.economyState.assetDurability?.engineTruck ?? 100) <= 0) {
        this._autoRepairVehicle("engineTruck", "Fire Truck");
      }
      const durability = this.economyState?.assetDurability?.engineTruck ?? 100;
      const truckUsable = truckUnlocked && (!this.economyState || this.isSkillFree() || durability > 0);
      if (this.player?.right && truckUsable) {
        let etRadius = this.engineTruckRadius;
        if (this._hasUpgrade("engineRadius")) etRadius *= SC.engineTruck.sprayRadiusMultUpg;
        const ex = this.player.x;
        const ey = this.player.y;
        this.engineTruckZone = { x: ex, y: ey, radius: etRadius };
        // Spray trees: each tree needs to be held under the spray for sprayTime seconds
        let sprayThreshold = this.engineTruckSprayTime;
        if (this._hasUpgrade("engineSuppression")) sprayThreshold *= SC.engineTruck.sprayTimeMultUpg;
        const targets = this.forest.grid.queryCircle(ex, ey, etRadius);
        for (const tree of targets) {
          if (tree.state === "normal" || tree.state === "burning") {
            tree.sprayTimer = (tree.sprayTimer ?? 0) + dt;
            if (tree.sprayTimer >= sprayThreshold) {
              this.forest.setState(tree, "wet");
              tree.sprayTimer = 0;
            }
          } else {
            tree.sprayTimer = 0;
          }
        }
        // Durability drain: 2% per wear interval (no fuel cost)
        if (this.economyState && !this.isSkillFree()) {
          let wearInterval = this.engineTruckWearInterval;
          if (this._hasUpgrade("engineMobility")) wearInterval *= SC.engineTruck.wearIntervalUpg1;
          if (this._hasUpgrade("engineRecharge")) wearInterval *= SC.engineTruck.wearIntervalUpg2;
          this._engineTruckWearTimer += dt;
          if (this._engineTruckWearTimer >= wearInterval) {
            this._engineTruckWearTimer -= wearInterval;
            this.economyState.assetDurability.engineTruck = Math.max(
              0, this.economyState.assetDurability.engineTruck - SC.engineTruck.wearPerTick
            );
            this._autoRepairVehicle("engineTruck", "Fire Truck");
          }
        }
      } else {
        // Reset spray timers when right-click is released
        if (this.engineTruckZone) {
          const targets = this.forest.grid.queryCircle(
            this.engineTruckZone.x, this.engineTruckZone.y, this.engineTruckZone.radius
          );
          for (const tree of targets) tree.sprayTimer = 0;
        }
        this.engineTruckZone = null;
        this._engineTruckWearTimer = 0;
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
      const zone = this.workerCrewZone;
      if (zone.state === "active") {
        // Check if any burning tree can ignite the sprinkler trailer
        const burning = this.forest.trees.filter((t) => t.state === "burning");
        for (const tree of burning) {
          const dx = zone.x - tree.x;
          const dy = zone.y - tree.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const baseR = this.weather.getBaseSpreadRadius();
          const spreadRadius = baseR + this.weather.getWindRadiusBonus();
          if (dist <= spreadRadius) {
            let chance = this.weather.computeIgnitionChance("conifer");
            if (Math.random() < chance) {
              zone.state = "burning";
              zone.burnTimer = 0;
              this._setSkillMessage("Sprinkler Trailer is on fire!");
              break;
            }
          }
        }
        // Expire normally when duration elapsed
        const elapsed = this.timeSinceStart - zone.startTime;
        if (elapsed >= zone.duration) {
          this.workerCrewZone = null;
        }
      } else if (zone.state === "burning") {
        zone.burnTimer += dt;
        const burnDuration = 10;
        if (zone.burnTimer >= burnDuration) {
          this.workerCrewZone = null;
        }
      }
      // Local humidity effect is applied during fire spread in FireSpreadSystem
    }

    // Bulldozer run animation (targeted path cutting)
    if (this.bulldozerRunning && this.bulldozerPath) {
      this.bulldozerRunTime += dt;
      const progress = Math.min(1, this.bulldozerRunTime / this.bulldozerRunDuration);
      const { startX, startY, endX, endY } = this.bulldozerPath;
      // Current world position of the dozer along path
      this.bulldozerMouseX = startX + (endX - startX) * progress;
      this.bulldozerMouseY = startY + (endY - startY) * progress;
      // Per-second fuel and wear drain
      if (this.economyState && !this.isSkillFree()) {
        const fuelRate = this._hasUpgrade("vehicleFuelEff1") ? SC.bulldozer.fuelDrainRateUpg1 : SC.bulldozer.fuelDrainRate;
        this.economyState.fuel = Math.max(0, this.economyState.fuel - fuelRate * dt);
        this.fuelConsumed = (this.fuelConsumed ?? 0) + fuelRate * dt;
        const wearRate = this._hasUpgrade("vehicleWear2") ? SC.bulldozer.durabilityWearRateUpg2
                       : this._hasUpgrade("vehicleWear1") ? SC.bulldozer.durabilityWearRateUpg1
                       : SC.bulldozer.durabilityWearRate;
        this.economyState.assetDurability.bulldozer = Math.max(0, this.economyState.assetDurability.bulldozer - wearRate * dt);
        if (this.economyState.assetDurability.bulldozer <= 0) {
          this._autoRepairVehicle("bulldozer", "Bulldozer");
        }
        if (this.economyState.fuel <= 0) {
          this.bulldozerRunning = false;
          this.bulldozerPath = null;
          this._setSkillMessage("Warning: Bulldozer out of Fuel");
        }
      }
      // Cut trees near current dozer position
      let cutRadius = this._hasUpgrade("dozerLineWidth") ? SC.bulldozer.cutRadiusUpg : SC.bulldozer.cutRadius;
      const targets = this.forest.grid.queryCircle(this.bulldozerMouseX, this.bulldozerMouseY, cutRadius);
      for (const tree of targets) {
        if (tree.state === "normal" || tree.state === "wet") {
          tree.cutTimer = (tree.cutTimer ?? 0) + dt;
          let cutThreshold = SC.bulldozer.cutTime;
          if (this._hasUpgrade("dozerSpeed")) cutThreshold *= SC.bulldozer.cutTimeMultUpg;
          if (tree.cutTimer >= cutThreshold) {
            tree.wasCut = true;
            this.cutPositions.push({ x: tree.x, y: tree.y });
            this.forest.removeTree(tree);
          }
        }
      }
      if (this.bulldozerRunning && progress >= 1) {
        this.bulldozerRunning = false;
        this.bulldozerPath = null;
        this._setSkillMessage("Bulldozer path complete");
      }
    }
    // Bulldozer cooldown
    if (this.bulldozerCooldown > 0) {
      this.bulldozerCooldown = Math.max(0, this.bulldozerCooldown - dt);
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
          
          // Use temperature-based spread radius + wind bonus
          const baseR = this.weather.getBaseSpreadRadius();
          const spreadRadius = baseR + this.weather.getWindRadiusBonus();
          
          if (dist <= spreadRadius) {
            // Use same fire spread probability as trees
            let chance = this.weather.computeIgnitionChance("conifer");
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

    // Tiled forest floor background
    if (this.forestFloorSprite?.complete && this.forestFloorSprite.naturalWidth > 0) {
      const tw = this.forestFloorSprite.naturalWidth;
      const th = this.forestFloorSprite.naturalHeight;
      const startX = Math.floor(0 / tw) * tw;
      const startY = Math.floor(0 / th) * th;
      for (let ty = startY; ty < this.forest.height; ty += th) {
        for (let tx = startX; tx < this.forest.width; tx += tw) {
          ctx.drawImage(this.forestFloorSprite, tx, ty, tw, th);
        }
      }
    } else {
      ctx.fillStyle = "#2d4a2a";
      ctx.fillRect(0, 0, this.forest.width, this.forest.height);
    }

    // Roads and creeks (over floor, under trees)
    this._drawTerrainFeatures(ctx);

    // Draw settlement sprites before trees so trees render on top
    if (this.settlements.length > 0) {
      this._drawSettlementSprites(ctx);
    }

    // Populate settlement zones so Forest uses settlement-specific sprites
    this.forest.settlementZones = this.settlements.map(s => ({ x: s.x, y: s.y, radius: s.radius }));

    // Draw sprinkler sprite (over background, before trees)
    if (this.workerCrewZone) {
      this._drawSprinklerSprite(ctx);
    }

    // Draw burnt trees first (background layer)
    this.forest.renderBurntOnly(ctx);

    // Draw all active watch tower zones (under living trees)
    for (const zone of this.watchTowerZones) {
      this._drawWatchTowerZone(ctx, zone);
    }

    // Populate visibility zones so Forest dims normal trees inside them
    this.forest.visibilityZones = [
      ...this.watchTowerZones.map(z => ({ x: z.x, y: z.y, radius: z.radius })),
      ...this.droneReconActive.map(d => ({ x: d.x, y: d.y, radius: d.radius })),
    ];

    // Draw non-burnt trees (over settlements)
    this.forest.renderNonBurnt(ctx);

    // Clear per-frame zones after rendering
    this.forest.visibilityZones = [];
    this.forest.settlementZones = [];

    // Draw settlement radius and labels on top of everything
    if (this.settlements.length > 0) {
      this._drawSettlementOverlays(ctx);
    }

    // Draw action visual feedback in world space
    this._drawActionRadiusIndicator(ctx);

    // Draw water bomber targeting (only targeting mode in world space)
    if (this.waterBomberMode && !this.waterBomberStrafing) {
      this._drawWaterBomberOverlay(ctx);
    }

    // Draw bulldozer targeting overlay
    if (this.bulldozerMode && !this.bulldozerRunning) {
      this._drawBulldozerOverlay(ctx);
    }
    // Draw bulldozer run animation (world space)
    if (this.bulldozerRunning && this.bulldozerPath) {
      this._drawBulldozerRunWorld(ctx);
    }

    // Draw heli drop targeting circle
    if (this.heliDropMode) {
      this._drawHeliDropOverlay(ctx);
    }

    // Draw worker crew zone
    if (this.workerCrewMode) {
      this._drawWorkerCrewOverlay(ctx);
    }
    // Draw fire crew cursor (hidden while fire truck is held)
    if (!this.player?.right) {
      this._drawFireCrewActiveCursor(ctx);
    }
    // Draw active worker crew zone effect
    if (this.workerCrewZone) {
      this._drawWorkerCrewZone(ctx);
    }

    // Draw all active drone recon zones
    for (const drone of this.droneReconActive) {
      this._drawDroneReconZone(ctx, drone);
    }

    // Draw drone recon targeting overlay (deploy)
    if (this.droneReconMode) {
      this._drawDroneReconOverlay(ctx);
    }

    // Draw active engine truck zone
    if (this.engineTruckZone) {
      this._drawEngineTruckZone(ctx);
    }

    // Draw active recon plane zones
    for (const zone of this.reconPlaneZones) {
      this._drawReconPlaneZone(ctx, zone);
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
      ctx.fillText(`Forest seed: ${this.forest.seed}  style: ${this.forest.forestStyle}`, 12, 40);
      ctx.fillText(`Money: $${Math.floor(this.money)}`, 12, 60);
      ctx.fillText(`Active fire: ${this.forest.burningCount}`, 12, 80);
      ctx.fillText(`Temp: ${this.weather.temperature.toFixed(0)}°C  (radius ${this.weather.getBaseSpreadRadius().toFixed(0)}px)`, 12, 100);
      ctx.fillText(`Air Hum: ${this.weather.airHumidity.toFixed(0)}%  (ign ×${this.weather.getAirHumidityIgnitionMultiplier().toFixed(2)})`, 12, 120);
      ctx.fillText(`Fuel Hum: ${this.weather.fuelHumidity.toFixed(0)}%  (int ${this.weather.getFuelHumiditySpreadInterval().toFixed(2)}s  burn ×${this.weather.getFuelHumidityBurnSpeedModifier().toFixed(2)})`, 12, 140);
      ctx.fillText(`Fire risk: ${this.weather.getFireRisk()}`, 12, 160);
      ctx.fillText(`Wind: ${Math.round(this.weather.windStrength)} km/h (dir ${(this.weather.windAngle * 180/Math.PI).toFixed(0)}°)  (+${this.weather.getWindRadiusBonus().toFixed(0)}px)`, 12, 180);

      // Tool indicators
      ctx.font = "14px Arial";
      ctx.fillStyle = this.player?.left ? "rgba(255, 100, 100, 1)" : "rgba(255, 100, 100, 0.5)";
      ctx.fillText("[ Left-Click: CUT ]", 12, 205);
      ctx.fillStyle = this.player?.right ? "rgba(100, 180, 255, 1)" : "rgba(100, 180, 255, 0.5)";
      ctx.fillText("[ Right-Click: SPRAY ]", 12, 225);

      // Skill selection (number keys) and current selection
      ctx.font = "14px Arial";
      ctx.fillStyle = "white";
      ctx.fillText("[1] Bomber  [2] Heli  [3] Dozer  [4] Sprinkler  [5] Watch  [6] Drone  [7] Recon  [8] Crew  [9] Truck", 12, 245);
      const selectedSkill = this.selectedSkillKey ? this.skills[this.selectedSkillKey] : null;
      ctx.fillText(`Selected: ${selectedSkill ? selectedSkill.name : "None"}`, 12, 265);
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

      // Road + creek point overlays — dots + coordinates drawn in world space
      const _debugPaths = [
        { paths: this.roads,  dotColor: "rgba(255, 220, 0, 0.9)",  label: "R" },
        { paths: this.creeks, dotColor: "rgba(80, 200, 255, 0.9)", label: "C" },
      ];
      const _hasDebugPaths = _debugPaths.some(e => e.paths?.length);
      if (_hasDebugPaths) {
        const cam = this.camera;
        ctx.save();
        ctx.translate(-cam.x * cam.zoom, -cam.y * cam.zoom);
        ctx.scale(cam.zoom, cam.zoom);
        for (const { paths, dotColor } of _debugPaths) {
          if (!paths?.length) continue;
          for (const path of paths) {
            if (!path.points) continue;
            path.points.forEach((pt, i) => {
              // Dot
              ctx.beginPath();
              ctx.arc(pt.x, pt.y, 5 / cam.zoom, 0, Math.PI * 2);
              ctx.fillStyle = dotColor;
              ctx.fill();
              ctx.strokeStyle = "#000";
              ctx.lineWidth = 1 / cam.zoom;
              ctx.stroke();
              // Label
              ctx.fillStyle = "#fff";
              ctx.font = `${Math.round(11 / cam.zoom)}px Arial`;
              ctx.textAlign = "left";
              ctx.textBaseline = "bottom";
              ctx.fillText(`[${i}] ${Math.round(pt.x)},${Math.round(pt.y)}`, pt.x + 7 / cam.zoom, pt.y - 2 / cam.zoom);
            });
          }
        }
        ctx.restore();
      }
    }

    // Draw bulldozer sprite at cursor when active
    // (removed: bulldozer now runs along a world-space path)
    
    if (this.waterBomberMode) {
      ctx.fillStyle = "#fff";
      ctx.font = "13px Arial";
      ctx.fillText("(Right-click to cancel)", 12, 260);
    }

    // ── Stacked warning banners (top center, one per queued warning) ─────────
    if (this._warningQueue.length > 0) {
      const sc2 = Math.min(ctx.canvas.width / 1280, ctx.canvas.height / 720, 2);
      const bW = Math.min(ctx.canvas.width * 0.5, Math.round(540 * sc2));
      const bH = Math.max(38, Math.round(46 * sc2));
      const bGap = Math.round(6 * sc2);
      const startBannerY = Math.round(70 * sc2) + 20;
      const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 250);
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `bold ${Math.max(16, Math.round(20 * sc2))}px Arial`;
      for (let i = 0; i < this._warningQueue.length; i++) {
        const warn = this._warningQueue[i];
        const warnMatch = warn.text.match(/Warning:\s*(.*)/);
        const warnText = warnMatch ? warnMatch[1] : warn.text;
        const bX = ctx.canvas.width / 2 - bW / 2;
        const bY = startBannerY + i * (bH + bGap);
        const fade = warn.permanent ? 1 : Math.min(1, warn.timer);
        ctx.fillStyle = `rgba(160, 30, 0, ${0.9 * pulse * fade})`;
        ctx.beginPath();
        ctx.roundRect(bX, bY, bW, bH, 8);
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 110, 0, ${pulse * fade})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(bX, bY, bW, bH, 8);
        ctx.stroke();
        ctx.fillStyle = `rgba(255, 255, 255, ${fade})`;
        ctx.fillText(`⚠ ${warnText}`, ctx.canvas.width / 2, bY + bH / 2);
      }
      ctx.restore();
    }

    // ── Plain skill message (below any warnings) ──────────────────────────
    if (this.skillMessage) {
      const sc2 = Math.min(ctx.canvas.width / 1280, ctx.canvas.height / 720, 2);
      const bH = Math.max(38, Math.round(46 * sc2));
      const bGap = Math.round(6 * sc2);
      const warningsTotalH = this._warningQueue.length * (bH + bGap);
      const bannerY = Math.round(70 * sc2) + warningsTotalH;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      {
        const fade = Math.min(1, this.skillMessageTimer);
        const bW = Math.min(ctx.canvas.width * 0.45, Math.round(500 * sc2));
        const plainH = Math.max(28, Math.round(34 * sc2));
        const bX = ctx.canvas.width / 2 - bW / 2;
        ctx.fillStyle = `rgba(0, 0, 0, ${0.65 * fade})`;
        ctx.beginPath();
        ctx.roundRect(bX, bannerY, bW, plainH, 6);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 230, 150, ${fade})`;
        ctx.font = `${Math.max(13, Math.round(15 * sc2))}px Arial`;
        ctx.fillText(this.skillMessage, ctx.canvas.width / 2, bannerY + plainH / 2);
      }
      ctx.restore();
    }

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
    // _drawWindCompass is called from PlayScreen after topStatusHUD renders
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

    // Bulldozer path targeting
    if (this.bulldozerMode === "selectStart" && evt?.button === 0) {
      this.bulldozerStart = { x: worldX, y: worldY };
      this.bulldozerMode = "selectEnd";
      this._setSkillMessage("Bulldozer: click end point of cut path");
      return;
    }
    if (this.bulldozerMode === "selectEnd" && evt?.button === 0) {
      const fuelWarn = this.economyState && !this.isSkillFree() ? this._getResourceWarning("bulldozer") : null;
      if (fuelWarn) {
        this._setSkillMessage(fuelWarn);
        return;
      }
      this._executeBulldozerRun(this.bulldozerStart.x, this.bulldozerStart.y, worldX, worldY);
      this.bulldozerMode = null;
      this.bulldozerStart = null;
      return;
    }
    // Cancel bulldozer on right-click
    if (this.bulldozerMode && evt?.button === 2) {
      this.bulldozerMode = null;
      this.bulldozerStart = null;
      this._setSkillMessage("Bulldozer canceled");
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
        this.heliDropMode = false;
      }
      if (keyNum !== 3) {
        if (this.bulldozerMode) {
          this.bulldozerMode = null;
          this.bulldozerStart = null;
          this._setSkillMessage("Bulldozer canceled");
        }
        this.bulldozerActive = false;
      }
      if (keyNum !== 4) {
        this.workerCrewMode = false;
      }
      if (keyNum !== 5) {
        this.watchTowerMode = false;
      }
      if (keyNum !== 6) {
        this.droneReconMode = false;
      }
      if (keyNum !== 7) {
        this.reconPlaneMode = false;
      }
      if (keyNum !== 8) {
        this.fireCrewMode = null;
        this.fireCrewStart = null;
        this.fireCrewPreview = null;
      }
      if (keyNum !== 9) {
        this.engineTruckMode = false;
      }

      // Water Bomber (key 1): activate targeting directly
      if (keyNum === 1) {
        if (!this._isAssetUnlocked("waterBomber")) {
          this._setSkillMessage("Water Bomber not unlocked (need Air Support)");
          return;
        }
        if (this.economyState && !this.isSkillFree() && !this.economyState.isAssetAvailable("waterBomber")) {
          if (!this._autoRepairVehicle("waterBomber", "Water Bomber")) return;
        }
        if (this.waterBomberCooldown > 0) {
          this._setSkillMessage(`Water Bomber cooldown: ${this.waterBomberCooldown.toFixed(1)}s`);
          return;
        }
        // Three-state cycle: inactive → water mode → retardant mode → inactive
        if (this.waterBomberMode) {
          if (this.waterBomberUseRetardant) {
            // In retardant mode, deselect tool
            this.waterBomberMode = null;
            this.waterBomberUseRetardant = false;
            this._setSkillMessage("Water Bomber canceled");
          } else {
            // In water mode, switch to retardant
            this.waterBomberUseRetardant = true;
            const warnToggle = this._getResourceWarning("waterBomber");
            this._setSkillMessage(warnToggle ? `Water Bomber: Retardant mode — ${warnToggle}` : "Water Bomber: Retardant mode (press 1 to toggle)");
          }
          return;
        }
        // Block activation if resources are insufficient
        const warn1 = this._getResourceWarning("waterBomber");
        if (warn1) { this._setSkillMessage(warn1); return; }
        // Activate in water mode
        this.waterBomberUseRetardant = false;
        this.waterBomberMode = "selectStart";
        this._setSkillMessage("Water Bomber: Water mode (press 1 to toggle)");
        return;
      }

      // Heli Drop (key 2): three-state cycle
      if (keyNum === 2) {
        if (!this._isAssetUnlocked("heliDrop")) {
          this._setSkillMessage("Helicopter not unlocked (need Air Support)");
          return;
        }
        if (this.economyState && !this.isSkillFree() && !this.economyState.isAssetAvailable("helicopter")) {
          if (!this._autoRepairVehicle("helicopter", "Helicopter")) return;
        }
        if (this.heliDropCooldown > 0) {
          this._setSkillMessage(`Heli Drop cooldown: ${this.heliDropCooldown.toFixed(1)}s`);
          return;
        }
        // Three-state cycle: inactive → water mode → retardant mode → inactive
        if (this.heliDropMode) {
          if (this.heliDropUseRetardant) {
            // In retardant mode, deselect tool
            this.heliDropMode = false;
            this.heliDropUseRetardant = false;
            this._setSkillMessage("Helicopter canceled");
          } else {
            // In water mode, switch to retardant
            this.heliDropUseRetardant = true;
            const warnToggle3 = this._getResourceWarning("heliDrop");
            this._setSkillMessage(warnToggle3 ? `Helicopter: Retardant mode — ${warnToggle3}` : "Helicopter: Retardant mode (press 2 to toggle)");
          }
          return;
        }
        // Block activation if resources are insufficient
        const warn3 = this._getResourceWarning("heliDrop");
        if (warn3) { this._setSkillMessage(warn3); return; }
        // Activate in water mode
        this.heliDropUseRetardant = false;
        this.heliDropMode = true;
        this.heliDropMouseX = null;
        this.heliDropMouseY = null;
        this._setSkillMessage("Helicopter: Water mode (press 2 to toggle)");
        return;
      }

      // Bulldozer (key 3): two-click path targeting (like Water Bomber)
      if (keyNum === 3) {
        if (!this._isAssetUnlocked("bulldozer")) {
          this._setSkillMessage("Bulldozer not unlocked (need Ground Support)");
          return;
        }
        if (this.economyState && !this.isSkillFree() && !this.economyState.isAssetAvailable("bulldozer")) {
          if (!this._autoRepairVehicle("bulldozer", "Bulldozer")) return;
        }
        if (this.bulldozerCooldown > 0) {
          this._setSkillMessage(`Bulldozer cooldown: ${this.bulldozerCooldown.toFixed(1)}s`);
          return;
        }
        if (this.economyState && !this.isSkillFree() && !this.bulldozerMode) {
          const fuelWarn = this._getResourceWarning("bulldozer");
          if (fuelWarn) { this._setSkillMessage(fuelWarn); return; }
        }
        if (this.bulldozerMode) {
          this.bulldozerMode = null;
          this.bulldozerStart = null;
          this._setSkillMessage("Bulldozer canceled");
          return;
        }
        this.bulldozerMode = "selectStart";
        this._setSkillMessage("Bulldozer: click start point of cut path");
        return;
      }

      // Sprinkler Trailer (key 4): activate targeting mode
      if (keyNum === 4) {
        if (!this._isAssetUnlocked("sprinklerTrailer")) {
          this._setSkillMessage("Sprinkler Trailer not unlocked (need Ground Support)");
          return;
        }
        if (this.economyState && !this.isSkillFree() && !this.economyState.isAssetAvailable("sprinklerTrailer")) {
          if (!this._autoRepairVehicle("sprinklerTrailer", "Sprinkler Trailer")) return;
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
          this._setSkillMessage("Fire Watch not unlocked (need Crew)");
          return;
        }
        // If a watch tower is active and not in targeting mode, remove the oldest one
        const activeWatches = this.watchTowerZones.filter(z => z.state === "active");
        if (!this.watchTowerMode && activeWatches.length > 0) {
          const oldest = activeWatches[0];
          const idx = this.watchTowerZones.indexOf(oldest);
          if (idx !== -1) this.watchTowerZones.splice(idx, 1);
          if (this.watchTowerCharges > 0) {
            this.watchTowerMode = true;
            this._setSkillMessage("Fire Watch removed — click to place new one");
          } else {
            this._setSkillMessage("Fire Watch removed");
          }
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

      // Drone Recon (key 6): deploy drone
      if (keyNum === 6) {
        if (!this._isAssetUnlocked("droneRecon")) {
          this._setSkillMessage("Drone Recon not unlocked (need Crew)");
          return;
        }
        // If a drone is active and not in targeting mode, remove the most recent one
        if (!this.droneReconMode && this.droneReconActive?.length > 0) {
          this.droneReconActive.pop();
          this._setSkillMessage("Drone Recon recalled");
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

      // Recon Plane (key 7): reveal large area on minimap
      if (keyNum === 7) {
        if (!this._isAssetUnlocked("reconPlane")) {
          this._setSkillMessage("Recon Plane not unlocked (need Air Support)");
          return;
        }
        if (this.economyState && !this.isSkillFree() && !this.economyState.isAssetAvailable("reconPlane")) {
          if (!this._autoRepairVehicle("reconPlane", "Recon Plane")) return;
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
        // Block activation if resources are insufficient
        const warn9 = this._getResourceWarning("reconPlane");
        if (warn9) { this._setSkillMessage(warn9); return; }
        this.reconPlaneMode = true;
        this._reconPlaneModeEnterTime = performance.now();
        this._setSkillMessage("Click anywhere to deploy Recon Plane");
        return;
      }

      // Fire Crew (key 8): activate line targeting mode
      if (keyNum === 8) {
        if (!this._isAssetUnlocked("fireCrew")) {
          this._setSkillMessage("Fire Crew not unlocked (need Crew)");
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

      // Engine Truck (key 9): show status (right-click hold IS the truck)
      if (keyNum === 9) {
        if (!this._isAssetUnlocked("engineTruck")) {
          this._setSkillMessage("Fire Truck not unlocked (need Ground Support)");
          return;
        }
        const dur = Math.round(this.economyState?.assetDurability?.engineTruck ?? 100);
        if (dur <= 0) {
          this._autoRepairVehicle("engineTruck", "Fire Truck");
          return;
        }
        this._setSkillMessage(`Fire Truck: ${dur}% durability — hold right-click to suppress fires`);
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
      if (this.bulldozerMode) {
        this.bulldozerMode = null;
        this.bulldozerStart = null;
        this._setSkillMessage("Bulldozer canceled");
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
    if (k === "u") this.weather.airHumidity = Math.min(80, this.weather.airHumidity + 5);
    if (k === "j") this.weather.airHumidity = Math.max(10, this.weather.airHumidity - 5);
    if (k === "r") this.weather.fuelHumidity = Math.min(80, this.weather.fuelHumidity + 5);
    if (k === "f") this.weather.fuelHumidity = Math.max(10, this.weather.fuelHumidity - 5);

    // wind controls
    if (k === "q") this.weather.windAngle -= Math.PI / 16;
    if (k === "e") this.weather.windAngle += Math.PI / 16;
    if (k === "k") this.weather.windStrength = Math.max(1, this.weather.windStrength - 5);
    if (k === "l") this.weather.windStrength = Math.min(100, this.weather.windStrength + 5);

    // Debug toggles
    if (k === "b") this.showDebugInfo = !this.showDebugInfo;
  }

  handleKeyUp(evt) {
    // placeholder: used by PlayScreen to keep key state
  }

  _setSkillMessage(msg) {
    if (msg.startsWith("Warning:")) {
      // Push to warning queue (deduplicate by text — reset timer if already queued)
      const existing = this._warningQueue.find(w => w.text === msg);
      if (existing) {
        existing.timer = 3;
      } else {
        this._warningQueue.push({ text: msg, timer: 3 });
      }
      return;
    }
    // Don't overwrite the permanent burn warning with transient skill messages
    if (this._burnWarnPermanent) return;
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
    // Underfed cooldown penalty only applies to Fire Watch and Drone Recon (not the stamina-based fire crew)
    const fedPenalty = (this.economyState && skillId !== "fireCrew") ? this.economyState.getCooldownModifier() : 0;
    let cd;
    if (skillId === "fireWatch") cd = this.watchTowerCooldownDuration;
    else if (skillId === "fireCrew") cd = this.fireCrewCooldownDuration;
    else if (skillId === "droneRecon") cd = this.droneReconCooldownDuration;
    else return 10;
    if (this._hasUpgrade("crewRecovery")) cd *= SC.fireWatch.rechargeMultUpg;
    return cd + fedPenalty;
  }

  // ── Economy integration: real-time food consumption for crew skills ──

  _consumeCrewFood() {
    const e = this.economyState;
    if (!e || this.isSkillFree()) return;

    // Each crew skill use wears fed status — base cost from skillConfig, upgrades reduce it
    let skillId = this._lastCrewSkillId || null;
    let baseCost = SC.droneRecon.foodWear;  // default fallback
    if (skillId === "droneRecon")  baseCost = SC.droneRecon.foodWear;
    if (skillId === "fireCrew")    baseCost = SC.fireCrew.foodWear;
    if (skillId === "fireWatch")   baseCost = SC.fireWatch.foodWear;
    // Upgrades lower cost for all three
    if (this._hasUpgrade("lowerFoodCons1")) baseCost--;
    if (this._hasUpgrade("lowerFoodCons2")) baseCost--;
    baseCost = Math.max(1, baseCost);
    e.crewFedStatus = Math.max(0, e.crewFedStatus - baseCost);

    // Auto-feed: when fed drops below threshold, spend 1 food to restore
    if (e.crewFedStatus <= SC.crewFood.autoFeedThreshold && e.food > 0) {
      e.food -= 1;
      e.crewFedStatus = Math.min(100, e.crewFedStatus + SC.crewFood.foodRestorePerUnit);
    }
  }

  // ── Vehicle field repair (mirrors food auto-feed mechanic) ──
  // When a vehicle's durability hits 0, spend 1 part to restore it to 10%.
  // Returns true if the repair succeeded (part available), false if vehicle stays broken.
  _autoRepairVehicle(assetId, vehicleName) {
    const e = this.economyState;
    if (!e || this.isSkillFree()) return false;
    if (e.assetDurability[assetId] > 0) return false;
    if (e.parts > 0) {
      e.parts -= 1;
      e.assetDurability[assetId] = 100;
      this._setSkillMessage(`${vehicleName} breakdown — 1 part used, fully restored`);
      return true;
    }
    this._setSkillMessage(`${vehicleName} broken — no parts for field repair`);
    return false;
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
    if (skillId === "reconPlane") return e.hasReconPlane; // Recon Plane requires Intel Facility T2
    return true;
  }

  getBulldozerEnergyPercent() {
    // Returns run progress when running, else 1 (no bar shown)
    if (this.bulldozerRunning && this.bulldozerRunDuration > 0) {
      return 1 - Math.min(1, this.bulldozerRunTime / this.bulldozerRunDuration);
    }
    return 1;
  }

  getFireCrewEnergyPercent() {
    return this.fireCrewEnergy / this.fireCrewMaxEnergy;
  }

  // ── Economy integration: resource consumption ──
  // Returns true if resources were consumed (or free mode), false if insufficient.

  _getResourceWarning(skillId) {
    const e = this.economyState;
    if (!e || this.isSkillFree()) return null;
    if (skillId === "waterBomber") {
      const fuelCost = this._hasUpgrade("bomberFuelEff") ? SC.waterBomber.fuelCostUpgraded : SC.waterBomber.fuelCostBase;
      if (e.fuel < fuelCost) return "Warning: Water Bomber out of fuel!";
      if (this.waterBomberUseRetardant) {
        const retCost = this._hasUpgrade("bomberRetEff") ? SC.waterBomber.retardantCostUpg : SC.waterBomber.retardantCostBase;
        if (e.retardant < retCost) return "Warning: Low retardant!";
      }
    }
    if (skillId === "bulldozer") {
      if (e.fuel <= 0) return "Warning: Bulldozer out of fuel!";
    }

    if (skillId === "heliDrop") {
      const fuelCost = this._hasUpgrade("heliFuelEff") ? SC.heliDrop.fuelCostUpgraded : SC.heliDrop.fuelCostBase;
      if (e.fuel < fuelCost) return "Warning: Helicopter out of fuel!";
      if (this.heliDropUseRetardant && e.retardant < SC.heliDrop.retardantCost) return "Warning: Low retardant!";
    }
    if (skillId === "engineTruck") {
      if (e.fuel < 1) return "Warning: Engine Truck out of fuel!";
    }
    if (skillId === "reconPlane") {
      if (e.money < SC.reconPlane.moneyCost) return "Warning: Not enough money!";
    }
    return null;
  }

  _consumeResourcesForSkill(skillId) {
    const e = this.economyState;
    if (!e || this.isSkillFree()) return true;

    if (skillId === "waterBomber") {
      // Fuel per sortie
      let fuelCost = this._hasUpgrade("bomberFuelEff") ? SC.waterBomber.fuelCostUpgraded : SC.waterBomber.fuelCostBase;
      // Retardant per sortie
      let retCost = this._hasUpgrade("bomberRetEff") ? SC.waterBomber.retardantCostUpg : SC.waterBomber.retardantCostBase;
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
      // Durability wear per sortie
      const bomberWear = this._hasUpgrade("bomberDurability") ? SC.waterBomber.durabilityWearUpg : SC.waterBomber.durabilityWear;
      e.assetDurability.waterBomber = Math.max(0, e.assetDurability.waterBomber - bomberWear);
      this._autoRepairVehicle("waterBomber", "Water Bomber");
      return true;
    }

    if (skillId === "heliDrop") {
      // Fuel per deployment
      let fuelCost = this._hasUpgrade("heliFuelEff") ? SC.heliDrop.fuelCostUpgraded : SC.heliDrop.fuelCostBase;
      if (e.fuel < fuelCost) {
        this._setSkillMessage(`Not enough fuel (need ${fuelCost})`);
        return false;
      }
      if (this.heliDropUseRetardant && e.retardant < SC.heliDrop.retardantCost) {
        this._setSkillMessage(`Not enough retardant (need ${SC.heliDrop.retardantCost})`);
        return false;
      }
      e.fuel -= fuelCost;
      this.fuelConsumed += fuelCost;
      if (this.heliDropUseRetardant) { e.retardant -= SC.heliDrop.retardantCost; this.retardantConsumed += SC.heliDrop.retardantCost; }
      // Durability wear per deployment
      const heliWear = this._hasUpgrade("heliDurability") ? SC.heliDrop.durabilityWearUpg : SC.heliDrop.durabilityWear;
      e.assetDurability.helicopter = Math.max(0, e.assetDurability.helicopter - heliWear);
      this._autoRepairVehicle("helicopter", "Helicopter");
      return true;
    }

    if (skillId === "sprinklerTrailer") {
      // Durability wear per activation
      let wear = SC.sprinklerTrailer.durabilityWear;
      e.assetDurability.sprinklerTrailer = Math.max(0, e.assetDurability.sprinklerTrailer - wear);
      this._autoRepairVehicle("sprinklerTrailer", "Sprinkler Trailer");
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
      // No fuel cost — durability wear is handled per-tick in the update loop
      return true;
    }

    if (skillId === "reconPlane") {
      // Money cost per deployment
      if (e.money < SC.reconPlane.moneyCost) {
        this._setSkillMessage(`Not enough money ($${SC.reconPlane.moneyCost.toLocaleString()} needed)`);
        return false;
      }
      e.money = Math.floor(e.money - SC.reconPlane.moneyCost);
      // Durability wear per deployment
      e.assetDurability.reconPlane = Math.max(0, e.assetDurability.reconPlane - SC.reconPlane.durabilityWear);
      this._autoRepairVehicle("reconPlane", "Recon Plane");
      return true;
    }

    if (skillId === "bulldozer") {
      // Resources are drained per-second in the update loop, not upfront
      return true;
    }

    return true;
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
    const extendDist = SC.waterBomber.pathExtendDist;
    
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
    this.waterBomberCooldown = this.waterBomberCooldownDuration * (this._hasUpgrade("bomberTurnaround") ? SC.waterBomber.cooldownMultUpg : 1);
    this.waterBomberPath = { startX: x1, startY: y1, endX: x2, endY: y2, entryX, entryY, exitX, exitY };
    this.waterBomberPreview = { x1, y1, x2, y2 };
    this._setSkillMessage(this.waterBomberUseRetardant ? "Bomber incoming (retardant)!" : "Bomber incoming!");
  }

  _executeBulldozerRun(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    let finalX = x2, finalY = y2;
    if (dist > SC.bulldozer.maxPathLength && dist > 0) {
      const s = SC.bulldozer.maxPathLength / dist;
      finalX = x1 + dx * s;
      finalY = y1 + dy * s;
    }
    const pathLen = Math.min(dist, SC.bulldozer.maxPathLength);
    this.bulldozerPath = { startX: x1, startY: y1, endX: finalX, endY: finalY };
    this.bulldozerRunTime = 0;
    this.bulldozerRunDuration = Math.max(0.5, pathLen / SC.bulldozer.runSpeed);
    this.bulldozerRunning = true;
    this.bulldozerMouseX = x1;
    this.bulldozerMouseY = y1;
    let cd = this.bulldozerCooldownDuration;
    if (this._hasUpgrade("dozerRecharge")) cd *= SC.bulldozer.cooldownMultUpg;
    this.bulldozerCooldown = cd;
    this._setSkillMessage("Bulldozer clearing path...");
  }

  _applyStrafeSupression() {
    if (!this.waterBomberPath) return;
    
    const { startX: x1, startY: y1, endX: x2, endY: y2 } = this.waterBomberPath;
    const useRetardant = this.waterBomberStrafeUsedRetardant;
    
    // Apply suppression along the strafe line
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
const steps = Math.ceil(dist / SC.waterBomber.sprayStepSize);

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const targets = this.forest.grid.queryCircle(px, py, this.waterBomberStrafeRadius * (this._hasUpgrade("bomberDrop1") ? SC.waterBomber.dropRadiusMultUpg : 1) * (this._hasUpgrade("bomberDrop2") ? SC.waterBomber.dropRadiusMultUpg : 1));

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
    if (this._hasUpgrade("heliTurnaround1")) heliCD *= SC.heliDrop.cooldownMultUpg;
    if (this._hasUpgrade("heliTurnaround2")) heliCD *= SC.heliDrop.cooldownMultUpg;
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
    // Only 1 active drone allowed at a time
    if (this.droneReconActive.length >= 1) {
      this._setSkillMessage("Warning: Drone already active!");
      return;
    }
    // Economy resource check (food wear)
    if (!this._consumeResourcesForSkill("droneRecon")) return;

    // Apply drone upgrades
    let droneRadius = this.droneReconRadius;
    if (this._hasUpgrade("droneRadius1")) droneRadius += SC.droneRecon.radiusBonus1;
    if (this._hasUpgrade("droneRadius2")) droneRadius += SC.droneRecon.radiusBonus2;
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
    let radius = this.droneReconRadius;
    if (this._hasUpgrade("droneRadius1")) radius += SC.droneRecon.radiusBonus1;
    if (this._hasUpgrade("droneRadius2")) radius += SC.droneRecon.radiusBonus2;

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

    // Drone icon at center - sprite or fallback marker
    if (this.droneSprite?.complete && this.droneSprite.naturalWidth > 0) {
      const droneSize = 50;
      ctx.drawImage(this.droneSprite, d.x - droneSize / 2, d.y - droneSize / 2, droneSize, droneSize);
    } else {
      // Fallback: small rotating marker with pulsing effect
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
    }

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
    let sprinklerDuration = SC.sprinklerTrailer.duration;
    if (this._hasUpgrade("sprinklerDur")) sprinklerDuration += SC.sprinklerTrailer.durationBonusUpg;
    this.workerCrewZone = {
      x,
      y,
      startTime: this.timeSinceStart,
      duration: sprinklerDuration,
      state: "active",  // "active" | "burning"
      burnTimer: 0,
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
    if (this._hasUpgrade("engineRadius")) etRadius *= 1.35;
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
    if (this._hasUpgrade("engineRadius")) radius *= 1.35;

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
    ctx.fillStyle = "rgba(60, 140, 255, 0.9)";
    ctx.beginPath();
    ctx.arc(mouseX, mouseY, 5, 0, Math.PI * 2);
    ctx.fill();

    // Durability arc
    this._drawTruckDurabilityArc(ctx, mouseX, mouseY, radius);
  }

  _executeReconPlane(x, y) {
    // Economy resource check ($2,000 + durability)
    if (!this._consumeResourcesForSkill("reconPlane")) return;

    const rpDuration = SC.reconPlane.revealDuration;
    this.reconPlaneZones.push({
      x, y,
      revealAll: true,
      radius: this.reconPlaneRadius, // kept for fallback
      startTime: this.timeSinceStart,
      duration: rpDuration,
    });
    this.reconPlaneCooldown = this.reconPlaneCooldownDuration;
    this._setSkillMessage(`Recon Plane deployed! Full map revealed for ${rpDuration}s`);
  }

  _drawReconPlaneOverlay(ctx) {
    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;

    // Reset transform to pure canvas space
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Subtle dark tint over the whole view
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(10, 30, 70, 0.18)";
    ctx.fillRect(0, 0, cw, ch);

    // Sweep: starts from left on skill select, cycles every 1.4 s
    const sweepDuration = 1400;
    const elapsed = performance.now() - (this._reconPlaneModeEnterTime || 0);
    const t = (elapsed % sweepDuration) / sweepDuration;
    const lineX = Math.round(t * cw) || 0;

    // Fading trail
    if (lineX > 1) {
      const trailW = Math.min(60, lineX);
      const grad = ctx.createLinearGradient(lineX - trailW, 0, lineX, 0);
      grad.addColorStop(0, "rgba(80, 160, 255, 0)");
      grad.addColorStop(1, "rgba(80, 160, 255, 0.15)");
      ctx.fillStyle = grad;
      ctx.fillRect(lineX - trailW, 0, trailW, ch);
    }

    // Soft glow
    const glowGrad = ctx.createLinearGradient(lineX - 6, 0, lineX + 6, 0);
    glowGrad.addColorStop(0,   "rgba(80, 180, 255, 0)");
    glowGrad.addColorStop(0.5, "rgba(80, 180, 255, 0.35)");
    glowGrad.addColorStop(1,   "rgba(80, 180, 255, 0)");
    ctx.fillStyle = glowGrad;
    ctx.fillRect(lineX - 6, 0, 12, ch);

    // Scan line
    ctx.strokeStyle = "rgba(180, 230, 255, 1.0)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lineX, 0);
    ctx.lineTo(lineX, ch);
    ctx.stroke();

    // Tick marks
    ctx.strokeStyle = "rgba(180, 230, 255, 0.55)";
    ctx.lineWidth = 1;
    for (let y = 32; y < ch; y += 56) {
      ctx.beginPath();
      ctx.moveTo(lineX - 5, y);
      ctx.lineTo(lineX + 5, y);
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = "rgba(180, 230, 255, 0.95)";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("RECON PLANE — Click to deploy  \u2502  Right-click to cancel", cw / 2, ch - 14);
  }

  _drawReconPlaneZone(ctx, zone) {
    const elapsed = this.timeSinceStart - zone.startTime;
    const remaining = Math.max(0, zone.duration - elapsed);
    const pct = remaining / zone.duration;

    // Full-map reveal: just a small fading marker at deploy point
    if (zone.revealAll) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
      ctx.fillStyle = `rgba(100, 200, 255, ${0.3 + 0.3 * pct * pulse})`;
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, 6 + 4 * pct, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

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

    ctx.save();
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);

    // Pulsing suppression fill — matches outer dashed ring
    ctx.fillStyle = `rgba(255, 100, 50, ${0.08 + 0.06 * pulse})`;
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
    ctx.fill();

    // Outer dashed border — always full radius
    ctx.strokeStyle = `rgba(255, 120, 60, ${0.5 + 0.2 * pulse})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center dot
    ctx.fillStyle = `rgba(60, 140, 255, ${0.7 + 0.2 * pulse})`;
    ctx.beginPath();
    ctx.arc(z.x, z.y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Durability arc
    this._drawTruckDurabilityArc(ctx, z.x, z.y, z.radius);
    ctx.restore();
  }

  _drawTruckDurabilityArc(ctx, x, y, radius) {
    const durPct = Math.max(0, Math.min(1, (this.economyState?.assetDurability?.engineTruck ?? 100) / 100));
    if (durPct >= 1) return; // nothing to show at full durability

    const isExhausted = durPct <= 0;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);

    // Background track ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Filled arc proportional to remaining durability
    const startAngle = -Math.PI / 2;
    const endAngle   = startAngle + Math.PI * 2 * durPct;
    let ar, ag, ab;
    if (durPct > 0.60)      { ar = 80;  ag = 220; ab = 80; }
    else if (durPct > 0.30) { ar = 255; ag = 180; ab = 60; }
    else                    { ar = 255; ag = 80;  ab = 40; }
    const arcAlpha = isExhausted ? (0.3 + 0.4 * pulse) : 0.90;
    ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${arcAlpha})`;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    if (durPct > 0) {
      ctx.beginPath();
      ctx.arc(x, y, radius, startAngle, endAngle);
      ctx.stroke();
    }

    // Warning label when low
    if (durPct <= 0.30) {
      const warnPulse = 0.6 + 0.4 * Math.sin(performance.now() / 200);
      ctx.save();
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = `rgba(255, 80, 40, ${warnPulse})`;
      ctx.fillText(isExhausted ? 'TRUCK DAMAGED' : `DUR ${Math.round(durPct * 100)}%`, x, y - radius - 4);
      ctx.restore();
    }
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
    if (this._hasUpgrade("fireWatchSight1")) watchRadius += SC.fireWatch.revealRadiusBonus1;
    if (this._hasUpgrade("fireWatchSight2")) watchRadius += SC.fireWatch.revealRadiusBonus2;
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

    const { x, y, left } = this.player;
    // Fire crew is always the left-click tool
    let radius = this.fireCrewRadius;
    if (this._hasUpgrade("crewRadius1")) radius += SC.fireCrew.cutRadiusBonus1;
    if (this._hasUpgrade("crewRadius2")) radius += SC.fireCrew.cutRadiusBonus2;
    const maxPerTick = SC.fireCrew.maxTreesPerTick;
    let processed = 0;

    if (!left) {
      // reset timers so actions require continuous hold
      this.forest.forNearby(x, y, radius, (tree) => {
        tree.cutTimer = 0;
      });
      return;
    }

    // Block cutting when fire crew energy is depleted
    if (this.fireCrewEnergy <= 0) return;

    this.forest.forNearby(x, y, radius, (tree) => {
      if (processed >= maxPerTick) return false;

      if (tree.state === "normal" || tree.state === "wet") {
        tree.cutTimer += dt;
        let cutThreshold = this.fireCrewCutTime;
        if (this._hasUpgrade("fasterCutting")) cutThreshold *= SC.fireCrew.cutTimeMultUpg;
        if (tree.cutTimer >= cutThreshold) {
          tree.wasCut = true;
          this.cutPositions.push({ x: tree.x, y: tree.y });
          this.forest.removeTree(tree);
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
    let radius = skill ? skill.radius : 320;
    if (this._hasUpgrade("fireWatchSight1")) radius += SC.fireWatch.revealRadiusBonus1;
    if (this._hasUpgrade("fireWatchSight2")) radius += SC.fireWatch.revealRadiusBonus2;

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
      ctx.strokeStyle = "rgba(255, 200, 0, 0.5)";
    } else if (state === "burning") {
      ctx.strokeStyle = "rgba(255, 102, 0, 0.5)";
    }
    
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Center: sprite or fallback circle
    if (this.watchTowerSprite?.complete && this.watchTowerSprite.naturalWidth > 0) {
      const watchTowerWidth = 80;
      const watchTowerHeight = 60;
      ctx.globalAlpha = state === "burning" ? 0.6 : 1.0;
      ctx.drawImage(this.watchTowerSprite, x - watchTowerWidth / 2, y - watchTowerHeight / 2, watchTowerWidth, watchTowerHeight);
      ctx.globalAlpha = 1.0;
    } else {
      if (state === "active") {
        ctx.fillStyle = "rgba(255, 200, 0, 0.8)";
      } else if (state === "burning") {
        ctx.fillStyle = "rgba(255, 100, 0, 1)";
      }
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();

      const strokeColor = state === "active" ? "rgba(255, 220, 100, 0.9)" : "rgba(255, 150, 0, 1)";
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawSprinklerSprite(ctx) {
    if (!this.workerCrewZone || !this.sprinklerSprite?.complete || !this.sprinklerSprite.naturalWidth) return;

    const { x, y } = this.workerCrewZone;
    const sprinklerWidth = 55;
    const sprinklerHeight = 60;
    ctx.drawImage(this.sprinklerSprite, x - sprinklerWidth / 2, y - sprinklerHeight / 2, sprinklerWidth, sprinklerHeight);
  }

  // ── Settlement system ────────────────────────────────────────────────────

  /**
   * Place settlements at the outer corners of their designated quadrants.
   * Called once in start() after forest.generate().
   */
  _initializeSettlements() {
    this.settlements = [];
    this.settlementFailed = false;
    this._settlementCheckTimer = 0;

    const defs = this.mission.settlements;
    if (!defs || defs.length === 0) return;

    // Quadrant outer corners — lerp toward map center via cornerOffset
    const mapCenterX = this.forest.width / 2;
    const mapCenterY = this.forest.height / 2;
    const quadrantCorners = {
      NW: { cornerX: 0,                  cornerY: 0                  },
      NE: { cornerX: this.forest.width,  cornerY: 0                  },
      SW: { cornerX: 0,                  cornerY: this.forest.height },
      SE: { cornerX: this.forest.width,  cornerY: this.forest.height },
    };

    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      const corner = quadrantCorners[def.quadrant];
      if (!corner) continue;

      // Position: centerOffset {x,y} = pixel offset from quadrant center (takes priority)
      //           cornerOffset 0 = outer corner, 1 = map center (default 0.5)
      let pos;
      if (def.centerOffset) {
        const quadCX = corner.cornerX + (mapCenterX - corner.cornerX) * 0.5;
        const quadCY = corner.cornerY + (mapCenterY - corner.cornerY) * 0.5;
        pos = { x: quadCX + (def.centerOffset.x ?? 0), y: quadCY + (def.centerOffset.y ?? 0) };
      } else {
        const t = def.cornerOffset ?? 0.5;
        pos = {
          x: corner.cornerX + (mapCenterX - corner.cornerX) * t,
          y: corner.cornerY + (mapCenterY - corner.cornerY) * t,
        };
      }

      const radius = def.radius ?? 150;
      const rSq = radius * radius;

      this.settlements.push({
        x: pos.x,
        y: pos.y,
        radius,
        quadrant: def.quadrant,
        name: def.name ?? `Settlement ${String.fromCharCode(65 + i)}`,
        sprite: def.sprite ?? "settlement",
        totalTrees: 0,
        burnedTrees: 0,
        destroyed: false,
      });
    }
  }

  /**
   * Ignite trees for a timed fire start entry.
   * Supports patterns: "random", "position", "quadrant", "center", "random quadrant".
   *
   * For position/quadrant/center, radius defaults to 25 if absent (same as fireStartQuadrants default behavior).
   * For random/random quadrant, it chooses a random target and ignites a radius around it (default 25).
   */
  _igniteTimedFireStart(entry) {
    const count   = entry.count   ?? 1;
    const pattern = entry.pattern ?? "random";
    const radius  = entry.radius ?? 25;

    if (pattern === "position") {
      const nearby = [...this.forest.grid.queryCircle(entry.x, entry.y, radius)]
        .filter(t => t.state === "normal");
      for (const tree of nearby) this.forest.setState(tree, "burning");
      if (nearby.length === 0) this.forest.igniteRandom(count); // fallback

    } else if (pattern === "quadrant") {
      const q       = entry.quadrant ?? "NW";
      const cornerX = q.includes("E") ? this.forest.width  : 0;
      const cornerY = q.includes("S") ? this.forest.height : 0;
      let cx, cy;

      if (entry.centerOffset) {
        const mapCenterX = this.forest.width / 2;
        const mapCenterY = this.forest.height / 2;
        const quadCX = cornerX + (mapCenterX - cornerX) * 0.5;
        const quadCY = cornerY + (mapCenterY - cornerY) * 0.5;
        cx = quadCX + (entry.centerOffset.x ?? 0);
        cy = quadCY + (entry.centerOffset.y ?? 0);
      } else {
        const t = entry.cornerOffset ?? 0.5;
        cx = cornerX + (this.forest.width  / 2 - cornerX) * t;
        cy = cornerY + (this.forest.height / 2 - cornerY) * t;
      }

      const nearby = [...this.forest.grid.queryCircle(cx, cy, radius)]
        .filter(t => t.state === "normal");
      for (const tree of nearby) this.forest.setState(tree, "burning");
      if (nearby.length === 0) this.forest.igniteRandom(count);

    } else if (pattern === "center") {
      const cx = this.forest.width / 2;
      const cy = this.forest.height / 2;
      const nearby = [...this.forest.grid.queryCircle(cx, cy, radius)]
        .filter(t => t.state === "normal");
      for (const tree of nearby) this.forest.setState(tree, "burning");
      if (nearby.length === 0) this.forest.igniteRandom(count);

    } else if (pattern === "random quadrant") {
      const allowed = entry.quadrants ?? ["NW", "NE", "SW", "SE"];
      const q = allowed[Math.floor(Math.random() * allowed.length)];
      const cornerX = q.includes("E") ? this.forest.width  : 0;
      const cornerY = q.includes("S") ? this.forest.height : 0;
      const mapCenterX = this.forest.width / 2;
      const mapCenterY = this.forest.height / 2;
      const cx = cornerX + (mapCenterX - cornerX) * 0.5;
      const cy = cornerY + (mapCenterY - cornerY) * 0.5;

      const nearby = [...this.forest.grid.queryCircle(cx, cy, radius)]
        .filter(t => t.state === "normal");
      for (const tree of nearby) this.forest.setState(tree, "burning");
      if (nearby.length === 0) this.forest.igniteRandom(count);

    } else {
      // "random" (default)
      const rx = Math.random() * this.forest.width;
      const ry = Math.random() * this.forest.height;
      const nearby = [...this.forest.grid.queryCircle(rx, ry, radius)]
        .filter(t => t.state === "normal");
      for (const tree of nearby) this.forest.setState(tree, "burning");
      if (nearby.length === 0) this.forest.igniteRandom(count);
    }

    // Thematic mid-mission fire alert (skipped if a permanent burn warning is pinned)
    if (!this._burnWarnPermanent) {
      const _timedAlerts = [
        "Warning: 🔥 New ignition detected!",
        "Warning: 🔥 Spot fire — a new sector is ablaze!",
        "Warning: 🔥 Flare-up reported — reposition assets!",
        "Warning: 🔥 Fire spreading to a new location!",
        "Warning: 🔥 Another ignition confirmed!",
        "Warning: 🔥 Fire crew — new fire on the line!",
      ];
      this._setSkillMessage(_timedAlerts[Math.floor(Math.random() * _timedAlerts.length)]);
    }
  }

  /**
   * Update settlement burn counts and check for destruction (≥50% trees burned).
   * Called on a 0.5s timer from update().
   */
  _checkSettlements() {
    for (const s of this.settlements) {
      if (s.destroyed) continue;
      const rSq = s.radius * s.radius;
      let total = 0;
      let burned = 0;
      for (const tree of this.forest.trees) {
        const dx = tree.x - s.x;
        const dy = tree.y - s.y;
        if (dx * dx + dy * dy > rSq) continue;
        tree.inSettlement = true;
        total++;
        if (tree.state === "burnt" || tree.state === "burning") burned++;
      }
      s.totalTrees = total;
      s.burnedTrees = burned;
      if (total > 0 && burned / total >= 0.50) {
        s.destroyed = true;
        this.settlementFailed = true;
        this.over = true;
        this.saved = this.forest.normalCount;
      }
    }
  }

  /**
   * Draw settlement zones in world space (called inside the camera transform).
   */

  _drawSettlementSprites(ctx) {
    const inAnyVisibilityZone = (x, y) => {
      if (!this.forest.visibilityZones || !this.forest.visibilityZones.length) return false;
      for (const zone of this.forest.visibilityZones) {
        const dx = x - zone.x, dy = y - zone.y;
        if (dx * dx + dy * dy <= zone.radius * zone.radius) return true;
      }
      return false;
    };

    for (const s of this.settlements) {
      const isBurning = s.burnedTrees > 0;
      let activeKey = s.sprite ?? "settlement";
      if (isBurning) {
        const burningKey = s.burningSprite ?? (s.sprite ? s.sprite + "_burning" : null);
        const bSprite = burningKey ? this.settlementSprites?.[burningKey] : null;
        if (bSprite?.complete && bSprite.naturalWidth > 0) activeKey = burningKey;
      }
      const sSprite = this.settlementSprites?.[activeKey] ?? this.settlementSprite;
      let alphaSet = false;
      if (inAnyVisibilityZone(s.x, s.y)) {
        ctx.globalAlpha = 0.40;
        alphaSet = true;
      }
      if (sSprite?.complete && sSprite.naturalWidth > 0) {
        const nw = sSprite.naturalWidth;
        const nh = sSprite.naturalHeight;
        const imgW = 600;
        const imgH = imgW * (nh / nw);
        ctx.drawImage(sSprite, s.x - imgW / 2, s.y - imgH / 2, imgW, imgH);
      } else {
        ctx.fillStyle = s.destroyed ? "rgba(255, 80, 80, 1)" : "rgba(255, 220, 60, 1)";
        ctx.beginPath();
        ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      if (alphaSet) ctx.globalAlpha = 1.0;
    }
  }

  _drawSettlementOverlays(ctx) {
    for (const s of this.settlements) {
      const burnPct = s.totalTrees > 0 ? s.burnedTrees / s.totalTrees : 0;
      const inDanger = !s.destroyed && burnPct > 0.1;

      // Dashed zone border over trees
      ctx.strokeStyle = s.destroyed
        ? "rgba(255, 60, 60, 0.9)"
        : inDanger
          ? "rgba(255, 160, 0, 0.9)"
          : "rgba(255, 220, 60, 0.75)";
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Name label above zone
      ctx.fillStyle = s.destroyed ? "#ff7777" : "#ffee44";
      ctx.font = "bold 14px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(s.name, s.x, s.y - s.radius - 5);

      // Status label inside zone
      if (s.destroyed) {
        ctx.fillStyle = "#8f836d70";
        ctx.font = "bold 13px Arial";
        ctx.textBaseline = "top";
        ctx.fillText("DESTROYED", s.x, s.y + 10);
      } else if (inDanger) {
        ctx.fillStyle = "#fae2b393";
        ctx.font = "bold 12px Arial";
        ctx.textBaseline = "top";
        ctx.fillText(`${Math.round(burnPct * 100)}% burned`, s.x, s.y + 10);
      }
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  /** Lazily build a tileable road texture and return a CanvasPattern. Uses roadtexture.png if loaded, else procedural fallback. */
  _getRoadPattern(ctx) {
    if (this._roadPattern) return this._roadPattern;
    // Use image texture if available — scale it so it tiles every ~30 world units
    if (this.roadTextureSprite?.complete && this.roadTextureSprite.naturalWidth > 0) {
      const pat = ctx.createPattern(this.roadTextureSprite, "repeat");
      const desiredWorldTile = 60; // world units per tile (road width ≈ 35, so ~1 tile across)
      const sx = desiredWorldTile / this.roadTextureSprite.naturalWidth;
      const sy = desiredWorldTile / this.roadTextureSprite.naturalHeight;
      pat.setTransform(new DOMMatrix([sx, 0, 0, sy, 0, 0]));
      this._roadPattern = pat;
      return this._roadPattern;
    }
    const size = 256;
    // Draw noise on a smaller canvas, then scale up blurred onto the final tile
    const noiseSize = 128;
    const noise = document.createElement("canvas");
    noise.width = noiseSize; noise.height = noiseSize;
    const nc = noise.getContext("2d");

    // Deterministic pseudo-random (always same texture)
    let seed = 12345;
    const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };

    // Base dirt colour
    nc.fillStyle = "#bca076";
    nc.fillRect(0, 0, noiseSize, noiseSize);

    // Dense single-pixel noise
    for (let i = 0; i < 5500; i++) {
      const x = rng() * noiseSize, y = rng() * noiseSize;
      const a = 0.05 + rng() * 0.13;
      nc.fillStyle = rng() > 0.5 ? `rgba(255,235,180,${a})` : `rgba(50,25,4,${a})`;
      nc.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    }

    // Grit flecks
    for (let i = 0; i < 500; i++) {
      const x = rng() * noiseSize, y = rng() * noiseSize;
      const rx = 0.15 + rng() * 0.5, ry = 0.1 + rng() * 0.35;
      const a = 0.07 + rng() * 0.13;
      nc.fillStyle = rng() > 0.5 ? `rgba(245,215,150,${a})` : `rgba(55,30,6,${a})`;
      nc.beginPath();
      nc.ellipse(x, y, rx, ry, rng() * Math.PI, 0, Math.PI * 2);
      nc.fill();
    }

    // Composite onto the final canvas with a blur filter to smooth everything to fine dust
    const oc = document.createElement("canvas");
    oc.width = size; oc.height = size;
    const c = oc.getContext("2d");
    c.filter = "blur(0.6px)";
    // Tile the noise 2×2 to fill the larger canvas (avoids edge seams from blur)
    c.drawImage(noise, 0,        0,        size / 2, size / 2);
    c.drawImage(noise, size / 2, 0,        size / 2, size / 2);
    c.drawImage(noise, 0,        size / 2, size / 2, size / 2);
    c.drawImage(noise, size / 2, size / 2, size / 2, size / 2);
    c.filter = "none";

    this._roadPattern = ctx.createPattern(oc, "repeat");
    return this._roadPattern;
  }

  _getCreekFoamPattern(ctx) {
    if (this._creekFoamPattern) return this._creekFoamPattern;

    // ── Foam/turbulence palette ───────────────────────────────────────────────
    const FOAM = {
      worldTileSize: 20, // smaller = more frequent foam specks
    };
    // ─────────────────────────────────────────────────────────────────────────

    const size = 128;
    const oc = document.createElement("canvas");
    oc.width = size; oc.height = size;
    const c = oc.getContext("2d");

    let seed = 77531;
    const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };

    // Short horizontal white streaks simulating broken water surface
    for (let i = 0; i < 38; i++) {
      const x = rng() * size, y = rng() * size;
      const w = 1.5 + rng() * 5.5;
      const h = 0.3 + rng() * 0.7;
      const a = 0.08 + rng() * 0.18;
      c.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      c.fillRect(x, y, w, h);
    }

    // Tiny foam dots
    for (let i = 0; i < 120; i++) {
      const x = rng() * size, y = rng() * size;
      const r = 0.3 + rng() * 0.9;
      const a = 0.06 + rng() * 0.14;
      c.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }

    const final = document.createElement("canvas");
    final.width = size; final.height = size;
    const fc = final.getContext("2d");
    fc.filter = "blur(0.4px)";
    fc.drawImage(oc, 0, 0);
    fc.filter = "none";

    this._creekFoamPattern = ctx.createPattern(final, "repeat");
    const s = FOAM.worldTileSize / size;
    this._creekFoamPattern.setTransform(new DOMMatrix([s, 0, 0, s, 0, 0]));
    return this._creekFoamPattern;
  }

  _getCreekRockPattern(ctx) {
    if (this._creekRockPattern) return this._creekRockPattern;

    // ── Rocky bank palette ────────────────────────────────────────────────────
    const ROCK = {
      base:        "#7a6a5833",      // mid-tone wet gravel base
      light:       [95, 78, 55], // pale dry stone highlights
      dark:        [42,  34,  26],  // deep shadow between rocks
      worldTileSize: 18,            // smaller = tighter pebble pattern
    };
    // ─────────────────────────────────────────────────────────────────────────

    const size = 128;
    const oc = document.createElement("canvas");
    oc.width = size; oc.height = size;
    const c = oc.getContext("2d");

    c.fillStyle = ROCK.base;
    c.fillRect(0, 0, size, size);

    let seed = 98765;
    const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0xffffffff; };

    // Individual pebble shapes
    const [lR, lG, lB] = ROCK.light;
    const [dR, dG, dB] = ROCK.dark;
    for (let i = 0; i < 220; i++) {
      const x = rng() * size, y = rng() * size;
      const rx = 1.5 + rng() * 4.5, ry = 1.0 + rng() * 3.0;
      const angle = rng() * Math.PI;
      const a = 0.25 + rng() * 0.45;
      const bright = rng() > 0.38;
      c.fillStyle = bright ? `rgba(${lR},${lG},${lB},${a})` : `rgba(${dR},${dG},${dB},${a})`;
      c.beginPath();
      c.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
      c.fill();
    }

    // Fine grit over the pebbles
    for (let i = 0; i < 1200; i++) {
      const a = 0.08 + rng() * 0.16;
      c.fillStyle = rng() > 0.5 ? `rgba(${lR},${lG},${lB},${a})` : `rgba(${dR},${dG},${dB},${a})`;
      c.fillRect(Math.floor(rng() * size), Math.floor(rng() * size), 1, 1);
    }

    const final = document.createElement("canvas");
    final.width = size; final.height = size;
    const fc = final.getContext("2d");
    fc.filter = "blur(0.5px)";
    fc.drawImage(oc, 0, 0);
    fc.filter = "none";

    this._creekRockPattern = ctx.createPattern(final, "repeat");
    const s = ROCK.worldTileSize / size;
    this._creekRockPattern.setTransform(new DOMMatrix([s, 0, 0, s, 0, 0]));
    return this._creekRockPattern;
  }

  // Draws a smooth curve through pts[] using midpoints as bezier endpoints.
  // Produces rounded joints instead of sharp corners at each waypoint.
  _buildSmoothPath(ctx, pts) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
      return;
    }
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  }

  // Tessellates the same smooth curve used by _buildSmoothPath into dense
  // sample points so that tree clearance matches the rendered curvature.
  // stepSize controls max distance between samples (smaller = more accurate).
  _tessellateSmooth(pts, stepSize = 4) {
    if (pts.length < 2) return pts;
    if (pts.length === 2) return pts;
    const out = [{ x: pts[0].x, y: pts[0].y }];
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2;
      const my = (pts[i].y + pts[i + 1].y) / 2;
      // Sample the quadratic bezier: prev point → control pts[i] → midpoint
      const p0 = out[out.length - 1];
      const cx = pts[i].x, cy = pts[i].y;
      const p2x = mx, p2y = my;
      const dx = p2x - p0.x, dy = p2y - p0.y;
      const segs = Math.max(1, Math.ceil(Math.hypot(dx, dy) / stepSize));
      for (let s = 1; s <= segs; s++) {
        const t = s / segs;
        const it = 1 - t;
        out.push({
          x: it * it * p0.x + 2 * it * t * cx + t * t * p2x,
          y: it * it * p0.y + 2 * it * t * cy + t * t * p2y,
        });
      }
    }
    // Final straight segment to last point
    out.push({ x: pts[pts.length - 1].x, y: pts[pts.length - 1].y });
    return out;
  }

  _drawTerrainFeatures(ctx) {
    // Roads: dark edge → textured dirt surface
    for (const road of this.roads) {
      if (!road.points || road.points.length < 2) continue;
      const w = road.width ?? 35;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Edge / border
      ctx.strokeStyle = "#7a5c304b";
      ctx.lineWidth = w + 8;
      this._buildSmoothPath(ctx, road.points);
      ctx.stroke();

      // Textured dirt surface
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = this._getRoadPattern(ctx);
      ctx.lineWidth = w;
      this._buildSmoothPath(ctx, road.points);
      ctx.stroke();

      // Subtle wheel ruts — two thin dark lines offset inward
      const rut = Math.max(2, w * 0.22);
      ctx.strokeStyle = "rgba(60,35,10,0.22)";
      ctx.lineWidth = Math.max(2, w * 0.13);
      for (const sign of [-1, 1]) {
        const pts = road.points;
        // Build offset points then draw as a smooth curve
        const offsetPts = pts.map((pt, i) => {
          const prev = pts[i - 1] ?? pts[i];
          const next = pts[i + 1] ?? pts[i];
          const tx = next.x - prev.x, ty = next.y - prev.y;
          const len = Math.sqrt(tx * tx + ty * ty) || 1;
          const nx = -ty / len, ny = tx / len;
          return { x: pt.x + nx * rut * sign, y: pt.y + ny * rut * sign };
        });
        this._buildSmoothPath(ctx, offsetPts);
        ctx.stroke();
      }

      ctx.restore();
    }
    // Creeks: rocky stone edges → dark water channel → deep center shadow
    // ── Creek stroke colours ─────────────────────────────────────────────────
    const CREEK_WATER  = "#0e1e28";              // dark water channel fill
    const CREEK_DEEP   = "rgba(8, 14, 20, 0.7)"; // deep shadow at the very center
    // ─────────────────────────────────────────────────────────────────────────
    for (const creek of this.creeks) {
      if (!creek.points || creek.points.length < 2) continue;
      const w = creek.width ?? 12;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const buildPath = () => this._buildSmoothPath(ctx, creek.points);

      // Rocky stone bank (widest — edges show through on both sides)
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = this._getCreekRockPattern(ctx);
      ctx.lineWidth = w + 8;
      buildPath(); ctx.stroke();

      // Dark water channel (covers rocky center, leaving rocky edges visible)
      ctx.strokeStyle = CREEK_WATER;
      ctx.lineWidth = w * 0.62;
      buildPath(); ctx.stroke();

      // Deep shadow at the very center
      ctx.strokeStyle = CREEK_DEEP;
      ctx.lineWidth = Math.max(1, w * 0.22);
      buildPath(); ctx.stroke();

      // White foam / disturbed water surface
      ctx.strokeStyle = this._getCreekFoamPattern(ctx);
      ctx.lineWidth = w * 0.58;
      buildPath(); ctx.stroke();

      ctx.restore();
    }
  }

  _drawMiniMap(ctx) {
    const baseW = 529;
    const baseH = 353;
    const s = this._miniMapScale;
    const miniW = Math.round(baseW * s);
    const miniH = Math.round(baseH * s);
    const padding = 10;
    const x = padding;
    const y = ctx.canvas.height - miniH - padding;

    // ── Minimap panel ───────────────────────────────────────────────────────

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x, y, miniW, miniH);
    ctx.strokeStyle = "white";
    ctx.strokeRect(x, y, miniW, miniH);

    // ── +/- resize buttons (top-right corner of panel) ──────────────────────
    const btnSize = 22;
    const btnGap = 3;
    const btnMinusX = x + miniW - btnSize * 2 - btnGap - 4;
    const btnPlusX  = x + miniW - btnSize - 4;
    const btnY = y + 3;
    const btnFocusX = btnMinusX - btnSize - btnGap * 2;
    this._miniMapButtons = [
      { x: btnMinusX, y: btnY, w: btnSize, h: btnSize, action: () => { this._miniMapScale = Math.max(0.5, this._miniMapScale - 0.15); localStorage.setItem('fb_minimapScale', String(this._miniMapScale)); } },
      { x: btnPlusX,  y: btnY, w: btnSize, h: btnSize, action: () => { this._miniMapScale = Math.min(1.6, this._miniMapScale + 0.15); localStorage.setItem('fb_minimapScale', String(this._miniMapScale)); } },
      { x: btnFocusX, y: btnY, w: btnSize, h: btnSize, action: () => { this._miniMapFocusZoom = !this._miniMapFocusZoom; localStorage.setItem('fb_minimapFocus', String(this._miniMapFocusZoom)); } },
    ];
    for (const btn of this._miniMapButtons) {
      const isFocusBtn = btn === this._miniMapButtons[2];
      const focusOn = isFocusBtn && this._miniMapFocusZoom;
      // Drop shadow
      ctx.fillStyle = "rgba(0,0,0,0.8)";
      ctx.fillRect(btn.x + 2, btn.y + 2, btn.w, btn.h);
      // Background — much brighter
      if (isFocusBtn) {
        ctx.fillStyle = focusOn ? "#0088ff" : "#555555";
      } else {
        ctx.fillStyle = "#666666";
      }
      ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
      // Top highlight
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(btn.x, btn.y, btn.w, Math.ceil(btn.h * 0.35));
      // Border — bright and thick
      ctx.strokeStyle = isFocusBtn
        ? (focusOn ? "#00ffff" : "#bbbbdd")
        : "#ddddee";
      ctx.lineWidth = 2.5;
      ctx.strokeRect(btn.x + 1, btn.y + 1, btn.w - 2, btn.h - 2);
      // Label — very bright
      ctx.fillStyle = isFocusBtn && focusOn ? "#00ffff" : "#ffffff";
      ctx.font = `bold ${Math.round(btnSize * 0.75)}px Arial`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      let label;
      if (btn === this._miniMapButtons[0]) label = "−";
      else if (btn === this._miniMapButtons[1]) label = "+";
      else label = this._miniMapFocusZoom ? "⊙" : "⊞";
      ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
    }

    // ── Compute zoomed view bounds from revealed zones ───────────────────────
    // Collect all reveal circles
    const revealCircles = [];
    let revealAll = false;
    for (const zone of this.watchTowerZones) {
      if (zone.state !== "active") continue;
      revealCircles.push({ x: zone.x, y: zone.y, r: zone.radius });
    }
    for (const d of this.droneReconActive) {
      revealCircles.push({ x: d.x, y: d.y, r: d.radius });
    }
    for (const zone of this.reconPlaneZones) {
      if (zone.revealAll) { revealAll = true; break; }
      revealCircles.push({ x: zone.x, y: zone.y, r: zone.radius });
    }

    // Determine world-space view rect: zoom into revealed area when possible
    let viewMinX = 0, viewMinY = 0, viewMaxX = this.forest.width, viewMaxY = this.forest.height;
    const useZoom = !this.showDebugInfo && !revealAll && revealCircles.length > 0 && this._miniMapFocusZoom;
    if (useZoom) {
      // Camera viewport bounds in world space
      const vpCenterX = this.camera.x + (ctx.canvas.width  / this.camera.zoom) / 2;
      const vpCenterY = this.camera.y + (ctx.canvas.height / this.camera.zoom) / 2;
      const vpLeft   = this.camera.x;
      const vpRight  = this.camera.x + ctx.canvas.width  / this.camera.zoom;
      const vpTop    = this.camera.y;
      const vpBottom = this.camera.y + ctx.canvas.height / this.camera.zoom;

      // Prefer circles whose centre is inside the viewport; fall back to all circles
      const inViewport = revealCircles.filter(
        c => c.x >= vpLeft && c.x <= vpRight && c.y >= vpTop && c.y <= vpBottom
      );
      const focusCircles = inViewport.length > 0 ? inViewport : revealCircles;

      let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
      for (const c of focusCircles) {
        bMinX = Math.min(bMinX, c.x - c.r);
        bMinY = Math.min(bMinY, c.y - c.r);
        bMaxX = Math.max(bMaxX, c.x + c.r);
        bMaxY = Math.max(bMaxY, c.y + c.r);
      }
      // Also include the camera viewport center so the zoomed view tracks where the player is looking
      bMinX = Math.min(bMinX, vpCenterX);
      bMinY = Math.min(bMinY, vpCenterY);
      bMaxX = Math.max(bMaxX, vpCenterX);
      bMaxY = Math.max(bMaxY, vpCenterY);
      // Add padding around the visible area (15% of the larger span)
      const span = Math.max(bMaxX - bMinX, bMaxY - bMinY);
      const pad = span * 0.15;
      viewMinX = Math.max(0, bMinX - pad);
      viewMinY = Math.max(0, bMinY - pad);
      viewMaxX = Math.min(this.forest.width,  bMaxX + pad);
      viewMaxY = Math.min(this.forest.height, bMaxY + pad);
      // Maintain minimap aspect ratio by expanding the shorter axis
      const worldW = viewMaxX - viewMinX;
      const worldH = viewMaxY - viewMinY;
      const miniAspect = miniW / miniH;
      const worldAspect = worldW / worldH;
      if (worldAspect > miniAspect) {
        // Too wide — expand height
        const extra = (worldW / miniAspect - worldH) / 2;
        viewMinY = Math.max(0, viewMinY - extra);
        viewMaxY = Math.min(this.forest.height, viewMaxY + extra);
      } else {
        // Too tall — expand width
        const extra = (worldH * miniAspect - worldW) / 2;
        viewMinX = Math.max(0, viewMinX - extra);
        viewMaxX = Math.min(this.forest.width, viewMaxX + extra);
      }
    }

    const viewW_world = viewMaxX - viewMinX;
    const viewH_world = viewMaxY - viewMinY;
    const scaleX = miniW / viewW_world;
    const scaleY = miniH / viewH_world;
    const avgScale = (scaleX + scaleY) / 2;

    // World → minimap panel coordinate helpers
    const toMX = (wx) => x + (wx - viewMinX) * scaleX;
    const toMY = (wy) => y + (wy - viewMinY) * scaleY;

    // ── Reveal check ─────────────────────────────────────────────────────────
    const isRevealed = (worldX, worldY) => {
      if (revealAll) return true;
      for (const c of revealCircles) {
        const dx = worldX - c.x, dy = worldY - c.y;
        if (dx * dx + dy * dy <= c.r * c.r) return true;
      }
      return false;
    };

    // ── Draw content ─────────────────────────────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, miniW, miniH);
    ctx.clip();

    if (!this.showDebugInfo) {
      // Fog base
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.fillRect(x, y, miniW, miniH);

      // Punch holes for revealed zones
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(255,255,255,1)";
      if (revealAll) {
        ctx.fillRect(x, y, miniW, miniH);
      } else {
        for (const c of revealCircles) {
          const r = c.r * avgScale;
          ctx.beginPath();
          ctx.arc(toMX(c.x), toMY(c.y), r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "source-over";
    }

    // Roads and creeks — always visible
    for (const road of this.roads) {
      if (!road.points || road.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = "rgba(200, 169, 110, 0.9)";
      ctx.lineWidth = Math.max(1.5, (road.width ?? 35) * scaleX);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      this._buildSmoothPath(ctx, road.points.map(p => ({ x: toMX(p.x), y: toMY(p.y) })));
      ctx.stroke();
      ctx.restore();
    }
    for (const creek of this.creeks) {
      if (!creek.points || creek.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = "rgba(61, 130, 170, 0.9)";
      ctx.lineWidth = Math.max(1, (creek.width ?? 12) * scaleX);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      this._buildSmoothPath(ctx, creek.points.map(p => ({ x: toMX(p.x), y: toMY(p.y) })));
      ctx.stroke();
      ctx.restore();
    }

    // Cut positions — revealed zones only
    for (let i = 0; i < this.cutPositions.length; i++) {
      const t = this.cutPositions[i];
      if (!this.showDebugInfo && !isRevealed(t.x, t.y)) continue;
      ctx.fillStyle = "rgba(180,140,70,0.85)";
      ctx.fillRect(toMX(t.x) - 1, toMY(t.y) - 1, 3, 3);
    }

    // Burning trees — revealed zones only
    for (let i = 0; i < this.forest.trees.length; i++) {
      const t = this.forest.trees[i];
      if (t.state !== "burning") continue;
      if (!this.showDebugInfo && !isRevealed(t.x, t.y)) continue;
      ctx.fillStyle = "rgba(255,130,0,0.9)";
      ctx.fillRect(toMX(t.x), toMY(t.y), 2, 2);
    }

    // ── Targeting overlays — only visible in unfogged areas ──────────────────
    ctx.save();
    // Clip to revealed areas (or entire panel when everything is visible)
    if (!revealAll && !this.showDebugInfo && revealCircles.length > 0) {
      ctx.beginPath();
      for (const c of revealCircles) {
        ctx.arc(toMX(c.x), toMY(c.y), c.r * avgScale, 0, Math.PI * 2);
      }
      ctx.clip();
    } else if (!revealAll && !this.showDebugInfo && revealCircles.length === 0) {
      // Nothing revealed — skip all targeting overlays
      ctx.restore();
    } else {
      // revealAll or debug — targeting visible everywhere; no clip needed
    }

    if (revealAll || this.showDebugInfo || revealCircles.length > 0) {
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.5;

      // ── Active placed zones ──────────────────────────────────────────────

      // Drone recon active zones (cyan)
      ctx.strokeStyle = "rgba(0,200,255,0.75)";
      for (const d of this.droneReconActive) {
        ctx.beginPath();
        ctx.arc(toMX(d.x), toMY(d.y), d.radius * avgScale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Watch tower zone radii (yellow active / orange burning)
      for (const zone of this.watchTowerZones) {
        ctx.strokeStyle = zone.state === "active" ? "rgba(255,200,0,0.65)" : "rgba(255,100,0,0.65)";
        ctx.beginPath();
        ctx.arc(toMX(zone.x), toMY(zone.y), zone.radius * avgScale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Recon plane reveal zones (purple)
      ctx.strokeStyle = "rgba(180,100,255,0.6)";
      for (const zone of this.reconPlaneZones) {
        if (zone.revealAll) continue;
        ctx.beginPath();
        ctx.arc(toMX(zone.x), toMY(zone.y), zone.radius * avgScale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Engine truck zone (red-orange, active while spraying)
      if (this.engineTruckZone) {
        ctx.strokeStyle = "rgba(255,80,40,0.75)";
        ctx.beginPath();
        ctx.arc(toMX(this.engineTruckZone.x), toMY(this.engineTruckZone.y), this.engineTruckZone.radius * avgScale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Worker crew active zone (blue)
      if (this.workerCrewZone) {
        ctx.strokeStyle = "rgba(100,150,255,0.65)";
        ctx.beginPath();
        ctx.arc(toMX(this.workerCrewZone.x), toMY(this.workerCrewZone.y), this.workerCrewRadius * avgScale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // ── Targeting previews (while player is aiming) ──────────────────────
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1;

      // Drone recon targeting preview
      if (this.droneReconMode) {
        let r = this.droneReconRadius;
        if (this._hasUpgrade("droneRadius1")) r += (SC.droneRecon?.radiusBonus1 ?? 0);
        if (this._hasUpgrade("droneRadius2")) r += (SC.droneRecon?.radiusBonus2 ?? 0);
        ctx.strokeStyle = "rgba(0,200,255,0.5)";
        ctx.beginPath();
        ctx.arc(toMX(this.droneReconMouseX), toMY(this.droneReconMouseY), r * avgScale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Watch tower targeting preview
      if (this.watchTowerMode) {
        const wtSkill = this.skills[5];
        let wtRadius = wtSkill ? wtSkill.radius : 320;
        if (this._hasUpgrade("fireWatchSight1")) wtRadius += SC.fireWatch.revealRadiusBonus1;
        if (this._hasUpgrade("fireWatchSight2")) wtRadius += SC.fireWatch.revealRadiusBonus2;
        ctx.strokeStyle = "rgba(255,200,0,0.5)";
        ctx.beginPath();
        ctx.arc(toMX(this.watchTowerMouseX), toMY(this.watchTowerMouseY), wtRadius * avgScale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Heli drop targeting preview (green)
      if (this.heliDropMode) {
        let r = this.heliDropRadius;
        ctx.strokeStyle = "rgba(60,220,80,0.5)";
        ctx.beginPath();
        ctx.arc(toMX(this.heliDropMouseX ?? this.player?.x ?? 0), toMY(this.heliDropMouseY ?? this.player?.y ?? 0), r * avgScale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Worker crew / sprinkler trailer targeting preview (blue)
      if (this.workerCrewMode) {
        let r = this.workerCrewRadius;
        if (this._hasUpgrade("sprinklerRadius")) r = 72 * 1.3;
        ctx.strokeStyle = "rgba(100,150,255,0.5)";
        ctx.beginPath();
        ctx.arc(toMX(this.workerCrewMouseX ?? this.player?.x ?? 0), toMY(this.workerCrewMouseY ?? this.player?.y ?? 0), r * avgScale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Water bomber — target area circles + strafe line
      if (this.waterBomberMode) {
        const useRet = this.waterBomberUseRetardant;
        const strokeCol = useRet ? "rgba(255,140,60,0.75)" : "rgba(100,180,255,0.75)";
        let strafeR = this.waterBomberStrafeRadius;
        if (this._hasUpgrade("bomberDrop1")) strafeR *= 1.25;
        if (this._hasUpgrade("bomberDrop2")) strafeR *= 1.25;
        const maxStrafeDist = strafeR * 3;

        // Determine start and end world positions
        const sx = this.waterBomberStart?.x ?? this.player?.x ?? 0;
        const sy = this.waterBomberStart?.y ?? this.player?.y ?? 0;
        let ex = this.player?.x ?? sx;
        let ey = this.player?.y ?? sy;
        if (this.waterBomberStart) {
          const ddx = ex - sx, ddy = ey - sy;
          const ddist = Math.sqrt(ddx * ddx + ddy * ddy);
          if (ddist > maxStrafeDist) {
            const sc = maxStrafeDist / ddist;
            ex = sx + ddx * sc;
            ey = sy + ddy * sc;
          }
        }

        ctx.strokeStyle = strokeCol;
        ctx.setLineDash([3, 3]);
        ctx.lineWidth = 1;

        // Target area circle at start point
        ctx.beginPath();
        ctx.arc(toMX(sx), toMY(sy), strafeR * avgScale, 0, Math.PI * 2);
        ctx.stroke();

        // If start is locked in, draw end circle and the strafe line
        if (this.waterBomberStart) {
          ctx.beginPath();
          ctx.arc(toMX(ex), toMY(ey), strafeR * avgScale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([5, 3]);
          ctx.beginPath();
          ctx.moveTo(toMX(sx), toMY(sy));
          ctx.lineTo(toMX(ex), toMY(ey));
          ctx.stroke();
        }

        ctx.setLineDash([]);
        // Center dot at start
        ctx.fillStyle = strokeCol;
        ctx.beginPath();
        ctx.arc(toMX(sx), toMY(sy), 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.setLineDash([]);
    }

    ctx.restore();

    ctx.restore();

    // ── Overlays (clipped to panel) ──────────────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, miniW, miniH);
    ctx.clip();

    // Viewport box
    const vpW = (ctx.canvas.width  / this.camera.zoom) * scaleX;
    const vpH = (ctx.canvas.height / this.camera.zoom) * scaleY;
    const vpX = toMX(this.camera.x);
    const vpY = toMY(this.camera.y);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1;
    ctx.strokeRect(vpX, vpY, vpW, vpH);

    // Player marker
    ctx.fillStyle = "cyan";
    ctx.beginPath();
    ctx.arc(toMX(this.player.x), toMY(this.player.y), 3, 0, Math.PI * 2);
    ctx.fill();

    // Settlement markers
    for (const s of this.settlements) {
      const sr = Math.max(3, s.radius * avgScale);
      ctx.strokeStyle = s.destroyed ? "rgba(255, 60, 60, 0.9)" : "rgba(255, 220, 60, 0.85)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(toMX(s.x), toMY(s.y), sr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = s.destroyed ? "rgba(255, 80, 80, 1)" : "rgba(255, 220, 60, 1)";
      ctx.beginPath();
      ctx.arc(toMX(s.x), toMY(s.y), 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fire Watch center points
    for (const zone of this.watchTowerZones) {
      ctx.fillStyle = zone.state === "active" ? "rgba(255, 200, 0, 1)" : "rgba(255, 100, 0, 1)";
      ctx.beginPath();
      ctx.arc(toMX(zone.x), toMY(zone.y), 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Zoom indicator — show when zoomed in
    if (useZoom) {
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.font = "10px Arial";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText(`×${(this.forest.width / viewW_world).toFixed(1)}`, x + miniW - 4, y + miniH - 3);
    }

    ctx.restore();
  }

  _drawActionRadiusIndicator(ctx) {
    if (!this.player) return;

    const { x, y, left, right } = this.player;

    // Determine if we should show radius: either holding down a button OR bulldozer is active (selected via key 3)
    const isBulldozerSelected = this.bulldozerActive;
    const isActivelyUsing = left || right;
    
    if (!isActivelyUsing && !isBulldozerSelected) return;

    // Use actual skill radii
    let radius;
    let isDozers = false;
    
    if (isBulldozerSelected || left) {
      isDozers = true;
      radius = this.bulldozerActive ? (this._hasUpgrade("dozerLineWidth") ? 32 : 24) : this.fireCrewRadius;
      if (!this.bulldozerActive && !isBulldozerSelected) {
        if (this._hasUpgrade("crewRadius1")) radius += 2;
        if (this._hasUpgrade("crewRadius2")) radius += 2;
      }
    } else if (right) {
      radius = this.engineTruckRadius;
      if (this._hasUpgrade("engineRadius")) radius *= 1.35;
    }

    // Determine action type and color
    let actionColor;
    let actionType;
    
    if (isDozers) {
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
    ctx.strokeStyle = isDozers ? "rgba(255, 100, 100, 0.8)" : "rgba(100, 180, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw center crosshair
    ctx.strokeStyle = isDozers ? "rgba(255, 100, 100, 0.6)" : "rgba(100, 180, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 8);
    ctx.stroke();

    // Highlight affected trees (only when actively using, not just when selected)
    if (isActivelyUsing) {
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
      
      const spriteWidth = 270 * this.camera.zoom;
      const spriteHeight = 300 * this.camera.zoom;
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

    // Draw helicopter with rectangular sprite
    const heloWidth = 180 * this.camera.zoom;
    const heloHeight = 230 * this.camera.zoom;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.translate(screenX, screenY);
    ctx.rotate(rotation);

    // Draw helicopter sprite (rectangular)
    if (this.heloSprite) {
      ctx.drawImage(this.heloSprite, -heloWidth / 2, -heloHeight / 2, heloWidth, heloHeight);
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

    // Use actual skill radius for search
    let radius;
    if (this.player.left) {
      radius = this.bulldozerActive ? (this._hasUpgrade("dozerLineWidth") ? 32 : 24) : this.fireCrewRadius;
      if (!this.bulldozerActive) {
        if (this._hasUpgrade("crewRadius1")) radius += 2;
        if (this._hasUpgrade("crewRadius2")) radius += 2;
      }
    } else {
      radius = this.engineTruckRadius;
      if (this._hasUpgrade("engineRadius")) radius *= 1.35;
    }
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

      if (this.player.left && (tree.state === "normal" || tree.state === "wet")) {
        const cutThreshold = this.bulldozerActive
          ? (this._hasUpgrade("dozerSpeed") ? this.bulldozerCutTime * 0.6 : this.bulldozerCutTime)
          : (this._hasUpgrade("fasterCutting") ? this.fireCrewCutTime * 0.6 : this.fireCrewCutTime);
        const p = Math.min(1, (tree.cutTimer ?? 0) / cutThreshold);
        if (dist < bestDist) {
          bestDist = dist;
          best = tree;
          action = "Cutting";
          progress = p;
        }
      }

      if (this.player.right && (tree.state === "normal" || tree.state === "burning")) {
        const sprayThreshold = this._hasUpgrade("engineSuppression")
          ? this.engineTruckSprayTime * 0.65
          : this.engineTruckSprayTime;
        const p = Math.min(1, (tree.sprayTimer ?? 0) / sprayThreshold);
        if (dist < bestDist) {
          bestDist = dist;
          best = tree;
          action = "Spraying";
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

    ctx.fillStyle = action === "Spraying" ? "#5cf" : "#c55";
    ctx.fillRect(bx, by, barW * progress, barH);

    ctx.strokeStyle = "white";
    ctx.strokeRect(bx, by, barW, barH);
  }

  _drawWindCompass(ctx) {
    // Wind compass in the top-right corner
    const scale = Math.min(ctx.canvas.width / 1280, ctx.canvas.height / 720, 2);
    const compassRadius = Math.round(38 * scale);
    const margin = Math.round(14 * scale);
    const compassX = ctx.canvas.width - compassRadius - margin;
    const compassY = compassRadius + margin;
    const letterDistance = compassRadius - Math.round(9 * scale);

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
    ctx.fillText("N", compassX, compassY - letterDistance);
    // S (bottom)
    ctx.fillText("S", compassX, compassY + letterDistance);
    // E (right)
    ctx.textAlign = "left";
    ctx.fillText("E", compassX + letterDistance, compassY);
    // W (left)
    ctx.textAlign = "right";
    ctx.fillText("W", compassX - letterDistance, compassY);

    // Draw wind direction arrow
    // Wind angle is already in radians (0 = east/right, π/2 = south/down, π = west/left, 3π/2 = north/up)
    // Add π/2 to convert to compass convention (0 = north/up)
    const windAngle = this.weather.windAngle + Math.PI / 2;
    const arrowLength = compassRadius - Math.round(10 * scale);
    const arrowEndX = compassX + Math.sin(windAngle) * arrowLength;
    const arrowEndY = compassY - Math.cos(windAngle) * arrowLength;

    // Draw arrow line
    ctx.strokeStyle = "rgba(100, 200, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(compassX, compassY);
    ctx.lineTo(arrowEndX, arrowEndY);
    ctx.stroke();

    // Draw arrowhead
    const arrowSize = Math.round(6 * scale);
    const angle1 = windAngle + (Math.PI * 0.85);
    const angle2 = windAngle - (Math.PI * 0.85);

    ctx.fillStyle = "rgba(100, 200, 255, 0.9)";
    ctx.beginPath();
    ctx.moveTo(arrowEndX, arrowEndY);
    ctx.lineTo(arrowEndX + Math.sin(angle1) * arrowSize, arrowEndY - Math.cos(angle1) * arrowSize);
    ctx.lineTo(arrowEndX + Math.sin(angle2) * arrowSize, arrowEndY - Math.cos(angle2) * arrowSize);
    ctx.closePath();
    ctx.fill();

    // Wind speed label below compass
    ctx.fillStyle = "#99ccff";
    ctx.font = `${Math.max(10, Math.round(12 * scale))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(`${Math.round(this.weather.windStrength)} km/h`, compassX, compassY + compassRadius + Math.round(4 * scale));

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
        warnText = warn.includes("retardant") ? "Out of Retardant" : "Water Bomber out of Fuel";
        if (this.waterBomberStart) {
          cx = this.player.x;
          cy = this.player.y;
        }
      }
    }
    // Bulldozer targeting
    else if (this.bulldozerMode) {
      const warn = this._getResourceWarning("bulldozer");
      if (warn) {
        warnText = "Bulldozer out of Fuel";
        cx = this.bulldozerMouseX ?? (this.player?.x ?? 0);
        cy = this.bulldozerMouseY ?? (this.player?.y ?? 0);
      }
    }
    // Heli Drop targeting
    else if (this.heliDropMode) {
      const warn = this._getResourceWarning("heliDrop");
      if (warn) {
        warnText = warn.includes("retardant") ? "Out of Retardant" : "Helicopter out of Fuel";
        cx = this.heliDropMouseX ?? cx;
        cy = this.heliDropMouseY ?? cy;
      }
    }
    // Engine Truck targeting
    else if (this.engineTruckMode) {
      if (e.fuel < 1) {
        warnText = "Engine Truck out of Fuel";
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

  _drawBulldozerOverlay(ctx) {
    const cutR = this._hasUpgrade("dozerLineWidth") ? SC.bulldozer.cutRadiusUpg : SC.bulldozer.cutRadius;
    const maxLen = SC.bulldozer.maxPathLength;

    // Colors: earthy amber/brown theme
    const fillCol  = "rgba(210, 160, 60, 0.18)";
    const strokeCol = "rgba(230, 180, 80, 0.85)";
    const strokeCol2 = "rgba(230, 180, 80, 0.55)";

    // Start point selection — show targeting circle at current mouse world pos
    if (!this.bulldozerStart && this.bulldozerMode === "selectStart") {
      const x = this.bulldozerMouseX ?? this.player.x;
      const y = this.bulldozerMouseY ?? this.player.y;
      ctx.fillStyle = fillCol;
      ctx.beginPath();
      ctx.arc(x, y, cutR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, cutR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = strokeCol2;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y);
      ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10);
      ctx.stroke();
      return;
    }

    if (!this.bulldozerStart) return;

    // End point selection — draw path line + clamped end circle
    const x1 = this.bulldozerStart.x;
    const y1 = this.bulldozerStart.y;
    let x2 = this.bulldozerMouseX ?? this.player.x;
    let y2 = this.bulldozerMouseY ?? this.player.y;
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxLen && dist > 0) {
      const s = maxLen / dist;
      x2 = x1 + dx * s;
      y2 = y1 + dy * s;
    }

    // Path line
    ctx.strokeStyle = "rgba(230, 190, 90, 0.8)";
    ctx.lineWidth = cutR * 2;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";

    ctx.strokeStyle = "rgba(230, 190, 90, 0.85)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Start circle
    ctx.fillStyle = fillCol;
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x1, y1, cutR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x1, y1, cutR, 0, Math.PI * 2); ctx.stroke();

    // End circle
    ctx.strokeStyle = strokeCol2;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x2, y2, cutR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x2, y2, cutR, 0, Math.PI * 2); ctx.stroke();

    // Distance label
    const clampedDist = Math.min(dist, maxLen);
    const mx = (x1 + x2) / 2;
    const my = Math.min(y1, y2) - cutR - 6;
    ctx.fillStyle = "rgba(230, 180, 80, 0.9)";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${Math.round(clampedDist)}m`, mx, my);
  }

  _drawBulldozerRunWorld(ctx) {
    if (!this.bulldozerPath) return;
    const { startX, startY, endX, endY } = this.bulldozerPath;
    const progX = this.bulldozerMouseX ?? startX;
    const progY = this.bulldozerMouseY ?? startY;
    const cutR = this._hasUpgrade("dozerLineWidth") ? SC.bulldozer.cutRadiusUpg : SC.bulldozer.cutRadius;

    // Draw cleared swath so far (progress)
    const dx = progX - startX, dy = progY - startY;
    const done = Math.sqrt(dx * dx + dy * dy);
    if (done > 0) {
      ctx.strokeStyle = "rgba(180, 130, 60, 0.35)";
      ctx.lineWidth = cutR * 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(progX, progY);
      ctx.stroke();
      ctx.lineCap = "butt";
    }

    // Draw remaining path (dotted, dimmer)
    const remDx = endX - progX, remDy = endY - progY;
    const rem = Math.sqrt(remDx * remDx + remDy * remDy);
    if (rem > 82) {
      ctx.strokeStyle = "rgba(230, 190, 90, 0.4)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(progX, progY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw bulldozer sprite at current position
    if (this.bulldozerSprite && this.bulldozerSprite.complete) {
      const sz = 92;
      const fullDx = endX - startX, fullDy = endY - startY;
      const fullDist = Math.sqrt(fullDx * fullDx + fullDy * fullDy);
      const angle = fullDist > 0 ? Math.atan2(fullDy, fullDx) : 0;
      ctx.save();
      ctx.translate(progX, progY);
      ctx.rotate(angle);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.bulldozerSprite, -sz / 2, -sz / 2, sz, sz);
      ctx.restore();
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

    const { x, y, state } = this.workerCrewZone;
    const isBurning = state === "burning";

    if (isBurning) {
      // Burning: show orange/red pulsing fire overlay
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      ctx.fillStyle = `rgba(255, 80, 20, ${0.15 + 0.1 * pulse})`;
      ctx.beginPath();
      ctx.arc(x, y, this.workerCrewRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 100, 30, ${0.6 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(x, y, this.workerCrewRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = `rgba(255, 120, 40, ${0.7 + 0.3 * pulse})`;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    const elapsed = this.timeSinceStart - this.workerCrewZone.startTime;
    const progress = Math.min(1, elapsed / this.workerCrewZone.duration);
    
    // Fade visual over time
    const opacity = Math.max(0.1, 1 - progress * 0.5);

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

  _drawFireCrewActiveCursor(ctx) {
    const x = this.player?.x ?? 0;
    const y = this.player?.y ?? 0;
    const energyPct = this.fireCrewEnergy / this.fireCrewMaxEnergy;
    const isLow = energyPct <= 0.3;
    const isExhausted = this.fireCrewEnergy <= 0;

    // Full display radius for the dashed range ring
    let displayRadius = this.fireCrewRadius;
    if (this._hasUpgrade("crewRadius1")) displayRadius += 2;
    if (this._hasUpgrade("crewRadius2")) displayRadius += 2;

    ctx.save();
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);

    // Outer dashed ring — always visible
    ctx.strokeStyle = `rgba(255, 180, 80, 0.5)`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(x, y, displayRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Stamina arc — only shown when stamina is not full
    if (energyPct < 1) {
      // Background track ring (faint)
      ctx.strokeStyle = `rgba(255, 255, 255, 0.15)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, displayRadius, 0, Math.PI * 2);
      ctx.stroke();

      // Filled arc proportional to remaining stamina
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + Math.PI * 2 * energyPct;
      let ar, ag, ab;
      if (energyPct > 0.6)      { ar = 80;  ag = 220; ab = 80; }
      else if (energyPct > 0.3) { ar = 255; ag = 180; ab = 60; }
      else if (energyPct > 0)   { ar = 255; ag = 80;  ab = 40; }
      else                      { ar = 200; ag = 40;  ab = 40; }
      const arcAlpha = isExhausted ? (0.3 + 0.4 * pulse) : 0.9;
      ctx.strokeStyle = `rgba(${ar}, ${ag}, ${ab}, ${arcAlpha})`;
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.beginPath();
      if (energyPct > 0) {
        ctx.arc(x, y, displayRadius, startAngle, endAngle);
        ctx.stroke();
      }
    }

    // Warning label above cursor when low
    if (isLow) {
      const warnPulse = 0.6 + 0.4 * Math.sin(performance.now() / 200);
      const label = isExhausted ? "EXHAUSTED" : "LOW STAMINA";
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      const labelY = y - displayRadius - 8;
      ctx.fillStyle = `rgba(0, 0, 0, ${0.6 * warnPulse})`;
      ctx.fillText(label, x + 1, labelY + 1);
      ctx.fillStyle = isExhausted
        ? `rgba(255, 80, 80, ${warnPulse})`
        : `rgba(255, 160, 60, ${warnPulse})`;
      ctx.fillText(label, x, labelY);
    }

    ctx.restore();
  }

  _drawWindSpreadVisualization(ctx) {
    // Draw wind direction spread indicators on burning trees
    const burning = this.forest.trees.filter((t) => t.state === "burning");
    const baseRadius = this.weather.getBaseSpreadRadius();
    const windBonus = this.weather.getWindRadiusBonus();
    
    for (const tree of burning) {
      for (let layer = 0; layer < 3; layer++) {
        const layerOpacity = 0.03 * (1 - layer / 3);
        ctx.fillStyle = `rgba(100, 80, 60, ${layerOpacity})`;
        ctx.beginPath();
        
        const layerOffset = layer * 3;
        // Teardrop wind shape parameters
        const windShapeFactor = windBonus > 0 ? Math.min(windBonus / (baseRadius + windBonus), 0.5) : 0;
        const minRadius = baseRadius * (1 - windShapeFactor);
        const maxRadius = baseRadius + windBonus;
        
        for (let angle = 0; angle <= Math.PI * 2; angle += Math.PI / 24) {
          // Use the same directional wind factor as spread logic
          const dirFactor = this.weather.getDirectionalWindFactor(angle);
          let radius = minRadius + (maxRadius - minRadius) * dirFactor;
          
          // Add waviness
          const waveAmount = Math.sin(angle * 4 + layer * Math.PI / 3) * 3;
          radius += waveAmount + layerOffset;
          
          const x = tree.x + Math.cos(angle) * radius;
          const y = tree.y - Math.sin(angle) * radius;
          
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
        
        // Teardrop wind shape parameters (same as fill)
        const dbgWindShapeFactor = windBonus > 0 ? Math.min(windBonus / (baseRadius + windBonus), 0.5) : 0;
        const dbgMinRadius = baseRadius * (1 - dbgWindShapeFactor);
        const dbgMaxRadius = baseRadius + windBonus;
        
        for (let angle = 0; angle <= Math.PI * 2; angle += Math.PI / 32) {
          const dirFactor = this.weather.getDirectionalWindFactor(angle);
          const radius = dbgMinRadius + (dbgMaxRadius - dbgMinRadius) * dirFactor;
          
          const x = tree.x + Math.cos(angle) * radius;
          const y = tree.y - Math.sin(angle) * radius;
          
          if (angle === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
}
