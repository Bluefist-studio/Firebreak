/**
 * PreMissionScreen — mission briefing shown before gameplay begins.
 * Displays weather forecast, terrain info, available assets, and resource summary.
 * Weather detail depends on purchased upgrades (weatherForecast, betterForecast, perfectForecast).
 */
export class PreMissionScreen {
  constructor({ economyState, onStart, onBack }) {
    this.economy = economyState;
    this.onStart = onStart;
    this.onBack = onBack;

    this.mission = null;
    this.gameMode = null;
    this.modePayload = null; // Stores full payload to pass through to play screen

    // Hover state
    this.isStartHover = false;
    this.isBackHover = false;
    this._startBtn = null;
    this._backBtn = null;
  }

  onEnter(payload) {
    this.mission = payload?.mission ?? null;
    this.gameMode = payload?.gameMode ?? null;
    this.modePayload = payload ?? {};
    this.isStartHover = false;
    this.isBackHover = false;
  }

  update() {}

  render(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const scale = Math.min(w / 1280, h / 720, 2);

    // Dark background
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);

    // ── Title ──
    const titleY = Math.round(40 * scale);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.max(22, Math.round(32 * scale))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("Mission Briefing", w / 2, titleY);

    if (!this.mission) {
      this._drawButtons(ctx, w, h, scale);
      return;
    }

    const mission = this.mission;

    // ── Layout: two columns ──
    const colW = Math.max(300, Math.round(460 * scale));
    const gapBetween = Math.max(20, Math.round(40 * scale));
    const totalColW = colW * 2 + gapBetween;
    const leftX = (w - totalColW) / 2;
    const rightX = leftX + colW + gapBetween;
    let leftY = titleY + Math.round(60 * scale);
    let rightY = leftY;

    // ── Left Column: Mission Info + Weather ──
    leftY = this._drawPanel(ctx, leftX, leftY, colW, scale, "Mission Info", (px, py) => {
      let y = py;
      const lineH = Math.round(24 * scale);

      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.max(14, Math.round(18 * scale))}px Arial`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(mission.name, px + 14, y);
      y += lineH + 4;

      ctx.fillStyle = "#ccc";
      ctx.font = `${Math.max(11, Math.round(13 * scale))}px Arial`;
      ctx.fillText(mission.description || "", px + 14, y);
      y += lineH;

      // Difficulty
      const diffColors = { easy: "#4CAF50", medium: "#FFC107", hard: "#FF9800", "very hard": "#f44336" };
      const diff = mission.difficulty || "medium";
      ctx.fillStyle = diffColors[diff] || "#ccc";
      ctx.font = `bold ${Math.max(12, Math.round(14 * scale))}px Arial`;
      ctx.fillText(`Difficulty: ${diff.charAt(0).toUpperCase() + diff.slice(1)}`, px + 14, y);
      y += lineH;

      // Reward
      const reward = mission.missionReward || 0;
      ctx.fillStyle = "#4CAF50";
      ctx.font = `${Math.max(12, Math.round(14 * scale))}px Arial`;
      ctx.fillText(`Reward: $${reward.toLocaleString()}`, px + 14, y);
      y += lineH;

      // Terrain
      ctx.fillStyle = "#ddd";
      ctx.font = `${Math.max(11, Math.round(13 * scale))}px Arial`;
      ctx.fillText(`Map: ${mission.width}x${mission.height}  |  Trees: ${(mission.treeCount || 0).toLocaleString()}`, px + 14, y);
      y += lineH;

      // Failure condition
      const failPct = mission.failBurnPercent;
      if (failPct != null && failPct < 100) {
        ctx.fillStyle = "#f44";
        ctx.font = `bold ${Math.max(12, Math.round(14 * scale))}px Arial`;
        ctx.fillText(`Fail condition: ${failPct}% forest destroyed`, px + 14, y);
        y += lineH;
      }

      return y;
    });

    leftY += Math.round(16 * scale);

    // ── Weather Forecast Panel ──
    leftY = this._drawPanel(ctx, leftX, leftY, colW, scale, "Weather Forecast", (px, py) => {
      let y = py;
      const lineH = Math.round(24 * scale);
      const weather = mission.weather || {};

      const hasWeatherForecast = this.economy?.upgrades?.has("weatherForecast");
      const hasBetterForecast = this.economy?.upgrades?.has("betterForecast");
      const hasPerfectForecast = this.economy?.upgrades?.has("perfectForecast");

      ctx.font = `${Math.max(12, Math.round(14 * scale))}px Arial`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      if (!hasWeatherForecast && !hasBetterForecast && !hasPerfectForecast) {
        // No upgrades — vague descriptors only
        ctx.fillStyle = "#aaa";
        ctx.fillText("No weather intel available.", px + 14, y);
        y += lineH;
        ctx.fillStyle = "#888";
        ctx.font = `${Math.max(10, Math.round(12 * scale))}px Arial`;
        ctx.fillText("(Unlock Weather Forecast at Intel Facility)", px + 14, y);
        y += lineH;
      } else {
        // Temperature
        const temp = weather.temperature ?? 22;
        if (hasPerfectForecast) {
          ctx.fillStyle = temp >= 30 ? "#f44" : temp >= 24 ? "#fa0" : "#8f8";
          ctx.fillText(`Temperature: ${temp}°C`, px + 14, y);
        } else if (hasWeatherForecast) {
          const desc = temp >= 30 ? "Very Hot" : temp >= 24 ? "Hot" : temp >= 18 ? "Warm" : "Cool";
          ctx.fillStyle = temp >= 30 ? "#f44" : temp >= 24 ? "#fa0" : "#8f8";
          ctx.fillText(`Temperature: ${desc}`, px + 14, y);
        }
        y += lineH;

        // Humidity
        const hum = weather.humidity ?? 40;
        if (hasPerfectForecast) {
          ctx.fillStyle = hum <= 20 ? "#f44" : hum <= 35 ? "#fa0" : "#8f8";
          ctx.fillText(`Humidity: ${hum}%`, px + 14, y);
        } else if (hasWeatherForecast) {
          const desc = hum <= 20 ? "Very Dry" : hum <= 35 ? "Dry" : hum <= 55 ? "Moderate" : "Humid";
          ctx.fillStyle = hum <= 20 ? "#f44" : hum <= 35 ? "#fa0" : "#8f8";
          ctx.fillText(`Humidity: ${desc}`, px + 14, y);
        }
        y += lineH;

        // Wind
        const windStr = weather.windStrength ?? 0;
        if (hasPerfectForecast) {
          const dirNames = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
          const angle = weather.windAngle ?? 0;
          const idx = Math.round(((angle % 360 + 360) % 360) / 45) % 8;
          const windColor = windStr >= 0.5 ? "#f44" : windStr >= 0.3 ? "#fa0" : "#8f8";
          ctx.fillStyle = windColor;
          ctx.fillText(`Wind: ${(windStr * 100).toFixed(0)}% from ${dirNames[idx]}`, px + 14, y);
        } else if (hasBetterForecast) {
          const desc = windStr >= 0.5 ? "Strong" : windStr >= 0.3 ? "Moderate" : windStr >= 0.1 ? "Light" : "Calm";
          const dirNames = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
          const angle = weather.windAngle ?? 0;
          const idx = Math.round(((angle % 360 + 360) % 360) / 45) % 8;
          const windColor = windStr >= 0.5 ? "#f44" : windStr >= 0.3 ? "#fa0" : "#8f8";
          ctx.fillStyle = windColor;
          ctx.fillText(`Wind: ${desc}, direction ${dirNames[idx]}`, px + 14, y);
        } else if (hasWeatherForecast) {
          const desc = windStr >= 0.5 ? "Strong" : windStr >= 0.3 ? "Moderate" : windStr >= 0.1 ? "Light" : "Calm";
          const windColor = windStr >= 0.5 ? "#f44" : windStr >= 0.3 ? "#fa0" : "#8f8";
          ctx.fillStyle = windColor;
          ctx.fillText(`Wind: ${desc}`, px + 14, y);
        }
        y += lineH;

        // Randomized wind warning
        if (weather.randomizeWind && (hasBetterForecast || hasPerfectForecast)) {
          ctx.fillStyle = "#ff8";
          ctx.font = `italic ${Math.max(10, Math.round(12 * scale))}px Arial`;
          ctx.fillText("Wind may shift during the mission", px + 14, y);
          y += lineH;
        }

        // Fire start pattern (perfect forecast only)
        if (hasPerfectForecast) {
          ctx.fillStyle = "#faa";
          ctx.font = `${Math.max(11, Math.round(13 * scale))}px Arial`;
          const fireCount = mission.fireStartCount || 1;
          const pattern = mission.fireStartPattern || "center";
          const patternDesc = {
            center: "center of map",
            "random quadrant": "one random quadrant",
            "random quadrants": "multiple random quadrants",
            quadrant: "specific quadrants",
            random: "random locations",
          };
          ctx.fillText(`Fires: ${fireCount} starting at ${patternDesc[pattern] || pattern}`, px + 14, y);
          y += lineH;
        }
      }

      return y;
    });

    // ── Right Column: Available Assets + Resources ──
    rightY = this._drawPanel(ctx, rightX, rightY, colW, scale, "Available Assets", (px, py) => {
      let y = py;
      const lineH = Math.round(22 * scale);
      const e = this.economy;

      const assets = [
        { name: "Fire Crew", unlocked: e?.hasFireCrew, type: "crew" },
        { name: "Fire Watch", unlocked: e?.hasFireWatch, type: "crew" },
        { name: "Fire Truck", unlocked: e?.hasEngineTruck, id: "engineTruck" },
        { name: "Sprinkler Trailer", unlocked: e?.hasSprinklerTrailer, id: "sprinklerTrailer" },
        { name: "Helicopter", unlocked: e?.hasHelicopter, id: "helicopter" },
        { name: "Bulldozer", unlocked: e?.hasBulldozer, id: "bulldozer" },
        { name: "Drone Recon", unlocked: e?.hasDroneRecon, type: "crew" },
        { name: "Water Bomber", unlocked: e?.hasWaterBomber, id: "waterBomber" },
        { name: "Recon Plane", unlocked: e?.hasReconPlane, id: "reconPlane" },
      ];

      ctx.font = `${Math.max(11, Math.round(13 * scale))}px Arial`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      for (const asset of assets) {
        if (asset.skip) continue;
        const unlocked = asset.unlocked ?? false;
        let status = "";
        let color = "#666";

        if (!unlocked) {
          status = "Locked";
          color = "#777";
        } else if (asset.type === "crew") {
          const fed = e?.crewFedStatus ?? 100;
          status = fed > 0 ? `Ready (Crew ${fed}%)` : "Crew Unavailable";
          color = fed > 50 ? "#8f8" : fed > 0 ? "#ff8" : "#f44";
        } else if (asset.id) {
          const dur = e?.assetDurability?.[asset.id] ?? 100;
          status = dur > 0 ? `${dur}/100 durability` : "Broken — repair at base";
          color = dur > 50 ? "#8f8" : dur > 25 ? "#ff8" : dur > 0 ? "#fa0" : "#f44";
        }

        // Bullet + name
        ctx.fillStyle = unlocked ? "#eee" : "#777";
        ctx.fillText(`${unlocked ? "●" : "○"} ${asset.name}`, px + 14, y);

        // Status right-aligned
        ctx.fillStyle = color;
        ctx.textAlign = "right";
        ctx.fillText(status, px + colW - 14, y);
        ctx.textAlign = "left";

        y += lineH;
      }

      return y;
    });

    rightY += Math.round(16 * scale);

    // ── Resource Summary Panel ──
    rightY = this._drawPanel(ctx, rightX, rightY, colW, scale, "Resources", (px, py) => {
      let y = py;
      const lineH = Math.round(22 * scale);
      const e = this.economy;

      ctx.font = `${Math.max(12, Math.round(14 * scale))}px Arial`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      const resources = [
        { label: "Money", value: `$${(e?.money ?? 0).toLocaleString()}`, color: "#FFD54F" },
        { label: "Fuel", value: `${e?.fuel ?? 0} / ${e?.fuelCap ?? 0}`, color: "#f90", warn: (e?.fuel ?? 0) < 5 },
        { label: "Retardant", value: `${e?.retardant ?? 0} / ${e?.retardantCap ?? 0}`, color: "#f44", warn: (e?.retardant ?? 0) < 3 },
        { label: "Food", value: `${e?.food ?? 0} / ${e?.foodCap ?? 0}`, color: "#4c4", warn: (e?.food ?? 0) < 3 },
        { label: "Parts", value: `${e?.parts ?? 0} / ${e?.partsCap ?? 0}`, color: "#88f" },
      ];

      for (const r of resources) {
        ctx.fillStyle = "#eee";
        ctx.fillText(r.label + ":", px + 14, y);
        ctx.fillStyle = r.color;
        ctx.textAlign = "right";
        ctx.fillText(r.value, px + colW - 14, y);
        // Low resource warning
        if (r.warn) {
          ctx.fillStyle = "#ff4400";
          ctx.font = `bold ${Math.max(10, Math.round(12 * scale))}px Arial`;
          ctx.fillText(" ⚠ LOW", px + colW - 14 - ctx.measureText(r.value).width - 8, y);
          ctx.font = `${Math.max(12, Math.round(14 * scale))}px Arial`;
        }
        ctx.textAlign = "left";
        y += lineH;
      }

      // Crew readiness
      const fed = e?.crewFedStatus ?? 100;
      ctx.fillStyle = "#eee";
      ctx.fillText("Crew Readiness:", px + 14, y);
      ctx.fillStyle = fed >= 76 ? "#8f8" : fed >= 51 ? "#ff8" : fed >= 1 ? "#f88" : "#f44";
      ctx.textAlign = "right";
      ctx.fillText(`${fed}%`, px + colW - 14, y);
      ctx.textAlign = "left";
      y += lineH;

      return y;
    });

    // ── Buttons ──
    this._drawButtons(ctx, w, h, scale);
  }

  // ── Panel helper ──
  _drawPanel(ctx, x, y, colW, scale, title, drawContent) {
    const titleH = Math.round(30 * scale);
    const padY = Math.round(12 * scale);

    const contentStartY = y + titleH + padY;

    // Measure pass: draw off-screen to calculate height
    ctx.save();
    ctx.globalAlpha = 0;
    const contentEndY = drawContent(x, contentStartY);
    ctx.restore();
    const panelH = (contentEndY - y) + padY;

    // Panel background
    ctx.fillStyle = "rgba(40, 25, 10, 0.95)";
    ctx.strokeStyle = "rgba(255, 140, 40, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, colW, panelH, 10);
    ctx.fill();
    ctx.stroke();

    // Title bar
    ctx.fillStyle = "rgba(255, 140, 40, 0.15)";
    ctx.beginPath();
    ctx.roundRect(x, y, colW, titleH, [10, 10, 0, 0]);
    ctx.fill();

    ctx.fillStyle = "#ffb060";
    ctx.font = `bold ${Math.max(12, Math.round(15 * scale))}px Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(title, x + 14, y + 6);

    // Draw content over the panel
    drawContent(x, contentStartY);
    return y + panelH;
  }

  // ── Buttons ──
  _drawButtons(ctx, w, h, scale) {
    const btnW = Math.max(160, Math.round(220 * scale));
    const btnH = Math.max(40, Math.round(52 * scale));
    const btnGap = Math.max(20, Math.round(30 * scale));
    const btnY = h - btnH - Math.round(30 * scale);

    // Back button (left)
    const backX = w / 2 - btnW - btnGap / 2;
    this._backBtn = { x: backX, y: btnY, w: btnW, h: btnH };
    this._drawBtn(ctx, backX, btnY, btnW, btnH, "Back", this.isBackHover, scale, "#E67E22", "#A0522D");

    // Start button (right)
    const startX = w / 2 + btnGap / 2;
    this._startBtn = { x: startX, y: btnY, w: btnW, h: btnH };
    this._drawBtn(ctx, startX, btnY, btnW, btnH, "Start Mission", this.isStartHover, scale, "#E67E22", "#A0522D");
  }

  _drawBtn(ctx, x, y, w, h, label, hovered, scale, baseColor, darkColor) {
    // Glow on hover
    if (hovered) {
      ctx.save();
      ctx.filter = "blur(8px)";
      ctx.fillStyle = baseColor + "55";
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 12);
      ctx.fill();
      ctx.restore();
    }

    ctx.fillStyle = hovered ? baseColor + "dd" : darkColor + "cc";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.max(14, Math.round(18 * scale))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  // ── Input ──
  _hitTest(x, y, rect) {
    return rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  handlePointerDown(x, y) {
    if (this._hitTest(x, y, this._startBtn)) {
      this.onStart?.(this.modePayload);
      return;
    }
    if (this._hitTest(x, y, this._backBtn)) {
      this.onBack?.();
      return;
    }
  }

  handlePointerMove(x, y) {
    this.isStartHover = this._hitTest(x, y, this._startBtn);
    this.isBackHover = this._hitTest(x, y, this._backBtn);
  }

  handleKeyDown(evt) {
    if (evt.key === "Enter") {
      this.onStart?.(this.modePayload);
    }
    if (evt.key === "Escape") {
      this.onBack?.();
    }
  }
}
