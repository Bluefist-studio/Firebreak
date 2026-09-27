export class LevelCompleteScreen {
  constructor({ onContinue, onReturnToMenu }) {
    this.onContinue = onContinue;
    this.onReturnToMenu = onReturnToMenu;
    this.levelData = null;
    
    // Button dimensions
    this.buttonWidth = 200;
    this.buttonHeight = 50;
    this.buttonSpacing = 30;
    
    // Buttons: { label, x, y, width, height, callback }
    this.buttons = [];
  }

  onEnter(payload) {
    // payload contains: { mission, saved, burntCount, reward, fallbackGrant }
    this.levelData = payload;
    this._snapshot = null;

    // Buttons will be positioned at render-time based on actual canvas dimensions.
    this.buttons = [];
    this._contentLy = null;
  }

  update(dt) {
    // No update needed
  }

  render(ctx) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    // Capture a snapshot of the game frame on first render to show behind the overlay
    if (!this._snapshot) {
      this._snapshot = document.createElement('canvas');
      this._snapshot.width = width;
      this._snapshot.height = height;
      this._snapshot.getContext('2d').drawImage(ctx.canvas, 0, 0);
    }

    // Draw game snapshot behind the overlay
    ctx.drawImage(this._snapshot, 0, 0, width, height);

    // Darker semi-transparent overlay for better readability
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, width, height);
    
    // Title
    const isFailed = this.levelData?.isFailed;
    const isEndless = this.levelData?.isEndless ?? false;
    const currentDay = this.levelData?.currentDay ?? 0;

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    if (isEndless) {
      ctx.fillText(isFailed ? `Day ${currentDay + 1} — Season Over!` : `Day ${currentDay + 1} Survived!`, width / 2, 80);
    } else {
      ctx.fillText(isFailed ? "Mission Failed" : "Level Complete!", width / 2, 80);
    }
    
    // Stats
    if (this.levelData) {
      const missionName = this.levelData.mission?.name || "Training Grounds";
      const saved = this.levelData.saved || 0;
      const burnt = this.levelData.burntCount || 0;
      const burnPct = this.levelData.burnPercent ?? 0;
      const reward = this.levelData.reward || 0;

      let ly = 150; // running Y cursor

      ctx.fillStyle = "#e8e8e8";
      ctx.font = "24px Arial";
      ctx.fillText(`Mission: ${missionName}`, width / 2, ly); ly += 50;
      ctx.fillText(`Trees Saved: ${saved}`, width / 2, ly); ly += 50;
      ctx.fillText(`Trees Burnt: ${burnt} (${burnPct}%)`, width / 2, ly); ly += 50;

      // Settlement status
      const settlements = this.levelData.settlements ?? [];
      if (settlements.length > 0) {
        const safe = settlements.filter(s => !s.destroyed).length;
        ctx.font = "bold 22px Arial";
        ctx.fillStyle = safe === settlements.length ? "#8f8" : safe === 0 ? "#f44" : "#fa0";
        ctx.fillText(`Settlements protected: ${safe} / ${settlements.length}`, width / 2, ly); ly += 35;
        for (const s of settlements) {
          ctx.font = "18px Arial";
          ctx.fillStyle = s.destroyed ? "#f77" : "#8f8";
          ctx.fillText(`  ${s.name}: ${s.destroyed ? "DESTROYED" : "Safe"}`, width / 2, ly); ly += 28;
        }
        ly += 10;
      }

      if (isFailed) {
        ctx.fillStyle = "#f44";
        ctx.font = "bold 26px Arial";
        if (this.levelData.settlementFailed) {
          ctx.fillText("A settlement was destroyed!", width / 2, ly); ly += 40;
        } else {
          const failThreshold = this.levelData.mission?.failBurnPercent ?? 0;
          ctx.fillText(`Too much forest lost! (limit: ${failThreshold}%)`, width / 2, ly); ly += 40;
        }
        if (isEndless) {
          const seasonRewardsTotal = this.levelData?.seasonRewardsTotal ?? 0;
          if (seasonRewardsTotal > 0) {
            ctx.fillStyle = "#88ccff";
            ctx.font = "bold 24px Arial";
            ctx.fillText(`Season Total Earned: $${seasonRewardsTotal.toLocaleString()}`, width / 2, ly); ly += 38;
          } else {
            ctx.fillStyle = "#aaa";
            ctx.font = "22px Arial";
            ctx.fillText("No reward earned.", width / 2, ly); ly += 40;
          }
        } else {
          ctx.fillStyle = "#aaa";
          ctx.font = "22px Arial";
          ctx.fillText("No reward earned.", width / 2, ly); ly += 40;
        }
      }

      if (!isFailed && reward > 0) {
        ctx.fillStyle = "#4CAF50";
        ctx.font = "bold 28px Arial";
        ctx.fillText(`Reward: $${reward.toLocaleString()}`, width / 2, ly); ly += 38;

        if (isEndless) {
          const seasonRewardsTotal = this.levelData?.seasonRewardsTotal ?? 0;
          if (seasonRewardsTotal > 0) {
            ctx.fillStyle = "#88ccff";
            ctx.font = "18px Arial";
            ctx.fillText(`Season Total: $${seasonRewardsTotal.toLocaleString()}`, width / 2, ly); ly += 30;
          }
        }
        ly += 7;
      }

      const fallback = this.levelData.fallbackGrant || 0;
      if (fallback > 0) {
        ctx.fillStyle = "#FFD54F";
        ctx.font = "bold 22px Arial";
        ctx.fillText(`Government Funding: +$${fallback.toLocaleString()}`, width / 2, ly); ly += 40;
      }

      const foodWear = this.levelData.foodWear || 0;
      const fuelConsumed = this.levelData.fuelConsumed || 0;
      const retardantConsumed = this.levelData.retardantConsumed || 0;

      // Resource consumption section
      if (fuelConsumed > 0 || retardantConsumed > 0 || foodWear > 0) {
        ly += 10;
        ctx.fillStyle = "#aaa";
        ctx.font = "bold 22px Arial";
        ctx.fillText("— Resource Usage —", width / 2, ly); ly += 35;
      }

      if (fuelConsumed > 0) {
        ctx.fillStyle = "#f90";
        ctx.font = "22px Arial";
        ctx.fillText(`Fuel consumed: ${Math.floor(fuelConsumed)}`, width / 2, ly); ly += 30;
      }

      if (retardantConsumed > 0) {
        ctx.fillStyle = "#f44";
        ctx.font = "22px Arial";
        ctx.fillText(`Retardant used: ${Math.floor(retardantConsumed)}`, width / 2, ly); ly += 30;
      }

      if (foodWear > 0) {
        ctx.fillStyle = "#ff9944";
        ctx.font = "22px Arial";
        ctx.fillText(`Food consumed by crew: ${Math.floor(foodWear)}`, width / 2, ly); ly += 30;
      }

      // Fire Season: next-day weather forecast
      if (isEndless && !isFailed) {
        const nextDayMission = this.levelData?.nextDayMission ?? null;
        const economy = this.levelData?.economy ?? null;

        if (nextDayMission) {
          ly += 10;
          ly = this._drawWeatherForecast(ctx, width, ly, nextDayMission, economy);
        }
      }

      // Fire Season: season-wide resource totals on the Season Over screen
      if (isEndless && isFailed) {
        const sFuel = this.levelData?.seasonFuelConsumed ?? 0;
        const sRetardant = this.levelData?.seasonRetardantConsumed ?? 0;
        const sFood = this.levelData?.seasonFoodWear ?? 0;
        if (sFuel > 0 || sRetardant > 0 || sFood > 0) {
          ly += 10;
          ctx.fillStyle = "#aaa";
          ctx.font = "bold 20px Arial";
          ctx.textAlign = "center";
          ctx.fillText("— Season Resource Usage —", width / 2, ly); ly += 32;
          if (sFuel > 0) {
            ctx.fillStyle = "#f90";
            ctx.font = "20px Arial";
            ctx.fillText(`Total Fuel: ${Math.floor(sFuel)}`, width / 2, ly); ly += 28;
          }
          if (sRetardant > 0) {
            ctx.fillStyle = "#f44";
            ctx.font = "20px Arial";
            ctx.fillText(`Total Retardant: ${Math.floor(sRetardant)}`, width / 2, ly); ly += 28;
          }
          if (sFood > 0) {
            ctx.fillStyle = "#ff9944";
            ctx.font = "20px Arial";
            ctx.fillText(`Total Food consumed: ${Math.floor(sFood)}`, width / 2, ly); ly += 28;
          }
        }
      }

      this._contentLy = ly;
    }
    
    // Draw buttons
    const centerX = width / 2;
    const btnY = this._contentLy != null ? Math.max(this._contentLy + 24, height * 0.62) : height * 0.62;
    this.buttons = [];

    if (isEndless && !isFailed) {
      // Primary: advance to next day
      this.buttons.push({
        label: "Next Day \u2192",
        x: centerX - this.buttonWidth / 2,
        y: btnY,
        width: this.buttonWidth,
        height: this.buttonHeight,
        primary: true,
        callback: () => this.onContinue?.(),
      });
      // Secondary: end season and return
      this.buttons.push({
        label: "End Season",
        x: centerX - this.buttonWidth / 2,
        y: btnY + this.buttonHeight + this.buttonSpacing,
        width: this.buttonWidth,
        height: this.buttonHeight,
        primary: false,
        callback: () => this.onReturnToMenu?.(),
      });
    } else {
      this.buttons.push({
        label: isEndless ? "End Season" : "Return to Base",
        x: centerX - this.buttonWidth / 2,
        y: btnY,
        width: this.buttonWidth,
        height: this.buttonHeight,
        primary: true,
        callback: () => this.onReturnToMenu?.(),
      });
    }

    for (const button of this.buttons) {
      ctx.fillStyle = button.primary ? "#4CAF50" : "#555";
      ctx.fillRect(button.x, button.y, button.width, button.height);

      ctx.strokeStyle = button.primary ? "#ffffff" : "#888";
      ctx.lineWidth = 2;
      ctx.strokeRect(button.x, button.y, button.width, button.height);

      ctx.fillStyle = button.primary ? "#ffffff" : "#bbb";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(button.label, button.x + button.width / 2, button.y + button.height / 2);
    }
  }

  _drawWeatherForecast(ctx, width, startY, mission, economy) {
    const weather = mission.weather || {};
    const cx = width / 2;
    let ly = startY;
    const lineH = 26;

    const hasWeatherForecast = economy?.upgrades?.has("weatherForecast");
    const hasBetterForecast = economy?.upgrades?.has("betterForecast");
    const hasPerfectForecast = economy?.upgrades?.has("perfectForecast");

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    ly += 10;
    ctx.fillStyle = "#aaa";
    ctx.font = "bold 22px Arial";
    ctx.fillText("— Next Day Forecast —", width / 2, ly); ly += 35;

    if (!hasWeatherForecast && !hasBetterForecast && !hasPerfectForecast) {
      ctx.fillStyle = "#888";
      ctx.font = "16px Arial";
      ctx.fillText("No weather intel available.", cx, ly); ly += lineH;
      ctx.fillStyle = "#666";
      ctx.font = "italic 13px Arial";
      ctx.fillText("(Unlock Weather Forecast at Intel Facility)", cx, ly); ly += lineH;
    } else {
      ctx.font = "18px Arial";

      // Temperature
      const temp = weather.temperature ?? 22;
      if (hasPerfectForecast) {
        ctx.fillStyle = temp >= 30 ? "#f44" : temp >= 24 ? "#fa0" : "#8f8";
        ctx.fillText(`Temperature: ${temp}°C`, cx, ly);
      } else {
        const desc = temp >= 30 ? "Very Hot" : temp >= 24 ? "Hot" : temp >= 18 ? "Warm" : "Cool";
        ctx.fillStyle = temp >= 30 ? "#f44" : temp >= 24 ? "#fa0" : "#8f8";
        ctx.fillText(`Temperature: ${desc}`, cx, ly);
      }
      ly += lineH;

      // Humidity
      const airHum = weather.airHumidity ?? 40;
      const fuelHum = weather.fuelHumidity ?? 50;
      if (hasPerfectForecast) {
        ctx.fillStyle = airHum <= 20 ? "#f44" : airHum <= 35 ? "#fa0" : "#8f8";
        ctx.fillText(`Air Humidity: ${airHum}%`, cx, ly); ly += lineH;
        ctx.fillStyle = fuelHum <= 20 ? "#f44" : fuelHum <= 35 ? "#fa0" : "#8f8";
        ctx.fillText(`Fuel Humidity: ${fuelHum}%`, cx, ly);
      } else {
        const airDesc = airHum <= 20 ? "Very Dry" : airHum <= 35 ? "Dry" : airHum <= 55 ? "Moderate" : "Humid";
        const fuelDesc = fuelHum <= 20 ? "Very Dry" : fuelHum <= 35 ? "Dry" : fuelHum <= 55 ? "Moderate" : "Humid";
        ctx.fillStyle = airHum <= 20 ? "#f44" : airHum <= 35 ? "#fa0" : "#8f8";
        ctx.fillText(`Air Humidity: ${airDesc}`, cx, ly); ly += lineH;
        ctx.fillStyle = fuelHum <= 20 ? "#f44" : fuelHum <= 35 ? "#fa0" : "#8f8";
        ctx.fillText(`Fuel Humidity: ${fuelDesc}`, cx, ly);
      }
      ly += lineH;

      // Wind
      const windStr = weather.windStrength ?? 0;
      const windColor = windStr >= 60 ? "#f44" : windStr >= 30 ? "#fa0" : "#8f8";
      const windDesc = windStr >= 60 ? "Strong" : windStr >= 30 ? "Moderate" : windStr >= 10 ? "Light" : "Calm";
      const dirNames = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"];
      const angle = weather.windAngle ?? 0;
      const normalAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const dirIdx = Math.round(normalAngle / (Math.PI / 4)) % 8;

      ctx.fillStyle = windColor;
      if (hasPerfectForecast) {
        ctx.fillText(`Wind: ${Math.round(windStr)} km/h from ${dirNames[dirIdx]}`, cx, ly);
      } else if (hasBetterForecast) {
        ctx.fillText(`Wind: ${windDesc} from ${dirNames[dirIdx]}`, cx, ly);
      } else {
        ctx.fillText(`Wind: ${windDesc}`, cx, ly);
      }
      ly += lineH;

      if (weather.randomizeWind && (hasBetterForecast || hasPerfectForecast)) {
        ctx.fillStyle = "#ff8";
        ctx.font = "italic 14px Arial";
        ctx.fillText("Wind direction may shift at mission start", cx, ly);
        ly += lineH;
      }

      if (hasPerfectForecast) {
        const fireCount = mission.fireStartCount || 1;
        ctx.fillStyle = "#faa";
        ctx.font = "16px Arial";
        ctx.fillText(`Expected ignition points: ${fireCount}`, cx, ly);
        ly += lineH;
      }
    }

    return ly;
  }

  handlePointerDown(x, y, evt) {
    for (const button of this.buttons) {
      if (
        x >= button.x &&
        x <= button.x + button.width &&
        y >= button.y &&
        y <= button.y + button.height
      ) {
        button.callback?.();
        return;
      }
    }
  }

  handlePointerMove(x, y, evt) {
    // Could add hover effects here if desired
  }

  handlePointerUp(x, y, evt) {
    // Not needed
  }

  handleKeyDown(evt) {
    // Could add keyboard shortcuts (e.g., Enter for Continue)
  }

  handleKeyUp(evt) {
    // Not needed
  }
}
