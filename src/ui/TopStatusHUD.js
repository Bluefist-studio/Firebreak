/**
 * TopStatusHUD
 * Single row at top center of screen + clock/speed controls below
 */
export class TopStatusHUD {
  constructor({ gameState, playScreen }) {
    this.gameState = gameState;
    this.playScreen = playScreen;
    this._clockButtons = []; // populated during render for hit testing
  }

  handlePointerDown(x, y) {
    for (const btn of this._clockButtons) {
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        btn.action();
        return true;
      }
    }
    return false;
  }

  render(ctx) {
    const viewport = this.gameState.viewport;
    const centerX = viewport.width / 2;
    const topY = 0;
    const scale = Math.min(viewport.width / 1280, viewport.height / 720, 2);

    const boxHeight = Math.max(30, Math.round(35 * scale));
    const boxWidth = Math.min(viewport.width - 80, Math.round(700 * scale));
    const padding = Math.max(8, Math.round(10 * scale));

    // Draw background centered
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(centerX - boxWidth / 2, topY, boxWidth, boxHeight);

    ctx.font = `${Math.max(12, Math.round(16 * scale))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#CCCCCC";
    
    const textY = topY + boxHeight / 2;
    const dayLabel = this.gameState.currentDay === 0 ? "Training Day" : `Day ${this.gameState.currentDay}`;

    // Show the correct money source: economyState.money when available, gameState.money otherwise
    const eco = this.gameState.economyState;
    const displayMoney = eco ? eco.money : Math.floor(this.gameState.money);

    // Calculate live burn percentage (only fully burnt trees)
    const forest = this.gameState.forest;
    const totalTrees = forest.treeCount || 1;
    const burnPct = ((forest.burntCount || 0) / totalTrees * 100).toFixed(1);

    const info = [
      dayLabel,
      `$${displayMoney.toLocaleString()}`,
      `Burnt: ${burnPct}%`,
      `Fire: ${forest.burningCount}`,
      `${this.gameState.weather.temperature}°C`,
      `${this.gameState.weather.humidity}%`,
      `${(this.gameState.weather.windStrength * 10).toFixed(1)} km/h`
    ];

    // Show economy resources when not using free skills
    if (eco && !this.gameState.isSkillFree()) {
      info.push(`Fuel: ${eco.fuel}`, `Ret: ${eco.retardant}`, `Food: ${eco.food} (${eco.crewFedStatus}% Fed)`);
    }
    
    const text = info.join("  |  ");
    ctx.fillText(text, centerX, textY);

    // ── Clock + speed controls row below the status bar ──
    const ps = this.playScreen;
    const speeds = ps?.speedLevels || [1, 2, 3, 5];
    const currentSpeed = ps?.gameSpeed || 1;
    const elapsed = this.gameState.timeSinceStart || 0;
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    const clock = `${mins}:${secs.toString().padStart(2, '0')}`;

    const clockY = topY + boxHeight + Math.round(4 * scale);
    const btnH = Math.max(20, Math.round(22 * scale));
    const btnW = Math.max(28, Math.round(30 * scale));
    const gap = Math.round(4 * scale);
    const clockFont = `${Math.max(11, Math.round(14 * scale))}px Arial`;
    const btnFont = `bold ${Math.max(10, Math.round(12 * scale))}px Arial`;

    // Measure clock text width for centering
    ctx.font = clockFont;
    const speedText = currentSpeed === 0 ? ' PAUSED' : currentSpeed > 1 ? ` x${currentSpeed}` : '';
    const clockLabel = `${clock}${speedText}`;
    const clockW = ctx.measureText(clockLabel).width + Math.round(16 * scale);

    // Total row width: [<<] [<] [||] clock [>] [>>]
    const totalW = btnW * 5 + gap * 5 + clockW;
    let rowX = centerX - totalW / 2;

    this._clockButtons = [];

    const currentIdx = speeds.indexOf(currentSpeed);

    // Helper to draw a button
    const drawBtn = (x, label, enabled, action) => {
      ctx.fillStyle = enabled ? "rgba(0, 0, 0, 0.5)" : "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(x, clockY, btnW, btnH);
      ctx.strokeStyle = enabled ? "rgba(200, 200, 200, 0.4)" : "rgba(100, 100, 100, 0.2)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, clockY, btnW, btnH);
      ctx.font = btnFont;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = enabled ? "#ddd" : "#666";
      ctx.fillText(label, x + btnW / 2, clockY + btnH / 2);
      this._clockButtons.push({ x, y: clockY, w: btnW, h: btnH, action });
    };

    // [<<] — min speed
    drawBtn(rowX, "\u00AB", currentIdx > 0, () => {
      if (ps && currentIdx > 0) ps.gameSpeed = speeds[0];
    });
    rowX += btnW + gap;

    // [<] — slower
    drawBtn(rowX, "\u2039", currentIdx > 0, () => {
      if (ps && currentIdx > 0) ps.gameSpeed = speeds[currentIdx - 1];
    });
    rowX += btnW + gap;

    // [||] — pause / resume
    const isPaused = ps?.gameSpeed === 0;
    drawBtn(rowX, isPaused ? "\u25B6" : "\u23F8", true, () => {
      if (!ps) return;
      if (ps.gameSpeed === 0) {
        ps.gameSpeed = ps._prePauseSpeed || 1;
      } else {
        ps._prePauseSpeed = ps.gameSpeed;
        ps.gameSpeed = 0;
      }
    });
    rowX += btnW + gap;

    // Clock display
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(rowX, clockY, clockW, btnH);
    ctx.strokeStyle = "rgba(200, 200, 200, 0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(rowX, clockY, clockW, btnH);
    ctx.font = clockFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = currentSpeed === 0 ? "#ff6644" : currentSpeed > 1 ? "#ffcc44" : "#ccc";
    ctx.fillText(clockLabel, rowX + clockW / 2, clockY + btnH / 2);
    rowX += clockW + gap;

    // [>] — faster
    drawBtn(rowX, "\u203A", currentIdx < speeds.length - 1, () => {
      if (ps && currentIdx < speeds.length - 1) ps.gameSpeed = speeds[currentIdx + 1];
    });
    rowX += btnW + gap;

    // [>>] — max speed
    drawBtn(rowX, "\u00BB", currentIdx < speeds.length - 1, () => {
      if (ps && currentIdx < speeds.length - 1) ps.gameSpeed = speeds[speeds.length - 1];
    });

    // ── Underfed warning below clock row ──
    const warningY = clockY + btnH + Math.round(4 * scale);
    if (eco && !this.gameState.isSkillFree()) {
      const fedPenalty = eco.getCooldownModifier();
      if (fedPenalty >= 10) {
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 300);
        ctx.fillStyle = `rgba(255, 50, 50, ${pulse})`;
        ctx.font = `bold ${Math.max(12, Math.round(16 * scale))}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText(`\u26a0 CREW STARVING \u2014 Cooldowns +${fedPenalty}s (Feed: ${eco.crewFedStatus}%)`, centerX, warningY + Math.round(10 * scale));
      } else if (fedPenalty > 0) {
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 500);
        ctx.fillStyle = `rgba(255, 160, 40, ${pulse})`;
        ctx.font = `bold ${Math.max(11, Math.round(14 * scale))}px Arial`;
        ctx.textAlign = "center";
        ctx.fillText(`\u26a0 Crew Underfed \u2014 Cooldowns +${fedPenalty}s (Feed: ${eco.crewFedStatus}%)`, centerX, warningY + Math.round(10 * scale));
      }
    }
  }
}
