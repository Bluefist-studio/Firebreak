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

    // Pre-compute button row metrics to size the background to fit all elements
    const btnH = Math.max(20, Math.round(22 * scale));
    const btnW = Math.max(28, Math.round(30 * scale));
    const gap = Math.round(4 * scale);
    const clockFont = `${Math.max(11, Math.round(14 * scale))}px Arial`;
    const btnFont = `bold ${Math.max(10, Math.round(12 * scale))}px Arial`;

    const ps = this.playScreen;
    const speeds = ps?.speedLevels || [1, 2, 3, 5];
    const currentSpeed = ps?.gameSpeed || 1;
    const elapsed = this.gameState.timeSinceStart || 0;
    const mins = Math.floor(elapsed / 60);
    const secs = Math.floor(elapsed % 60);
    const clock = `${mins}:${secs.toString().padStart(2, '0')}`;

    ctx.font = clockFont;
    const speedText = currentSpeed === 0 ? ' PAUSED' : currentSpeed > 1 ? ` x${currentSpeed}` : '';
    const clockLabel = `${clock}${speedText}`;
    const clockW = ctx.measureText(clockLabel).width + Math.round(16 * scale);

    ctx.font = btnFont;
    const esW = Math.max(28, ctx.measureText('ES').width + Math.round(14 * scale));
    const cdW = Math.max(28, ctx.measureText('CD').width + Math.round(14 * scale));

    // Full row width: [<<] [<] [||] clock [>] [>>] [ES] [CD]
    const totalW = btnW * 5 + gap * 5 + clockW + esW + gap + cdW + gap;
    const bgPad = Math.round(12 * scale);
    const bgWidth = Math.max(totalW + bgPad * 2, boxWidth);
    const bgStartX = centerX - bgWidth / 2;
    // Cover just the two top rows (status text + clock/buttons row)
    const bgH = boxHeight + Math.round(8 * scale) + btnH + Math.round(6 * scale);
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(bgStartX, topY, bgWidth, bgH);

    ctx.font = `${Math.max(12, Math.round(16 * scale))}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#CCCCCC";
    
    const textY = topY + boxHeight / 2;
    const _mission = this.gameState.mission;
    const _isEndless = _mission?.id === "fire_season";
    const dayLabel = _isEndless
      ? `Day ${this.gameState.currentDay}`
      : (_mission?.name ?? "Mission");

    // Calculate live burn percentage (only fully burnt trees)
    const forest = this.gameState.forest;
    const totalTrees = forest.treeCount || 1;
    const burnPct = ((forest.burntCount || 0) / totalTrees * 100).toFixed(1);

    const weather = this.gameState.weather;
    const weatherStr = weather
      ? `  |  ${weather.temperature}°C  AH:${weather.airHumidity}%  FH:${weather.fuelHumidity}%`
      : '';

    const info = [
      dayLabel,
      `Burnt: ${burnPct}%`,
      `Fire: ${forest.burningCount}`
    ];

    const text = info.join("  |  ") + weatherStr;
    ctx.fillText(text, centerX, textY);

    // ── Clock + speed controls row below the status bar ──
    const clockY = topY + boxHeight + Math.round(4 * scale);
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
    rowX += btnW + gap;

    // [ES] — edge scroll toggle
    const esOn = ps?.edgeScrollEnabled ?? false;
    const esLabel = 'ES';
    ctx.font = btnFont;
    ctx.fillStyle = esOn ? "rgba(30, 90, 30, 0.75)" : "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(rowX, clockY, esW, btnH);
    ctx.strokeStyle = esOn ? "rgba(80, 200, 80, 0.65)" : "rgba(100, 100, 100, 0.3)";
    ctx.lineWidth = esOn ? 1.5 : 1;
    ctx.strokeRect(rowX, clockY, esW, btnH);
    ctx.fillStyle = esOn ? "#88ee88" : "#888";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(esLabel, rowX + esW / 2, clockY + btnH / 2);
    this._clockButtons.push({ x: rowX, y: clockY, w: esW, h: btnH, action: () => {
      if (ps) {
        ps.edgeScrollEnabled = !ps.edgeScrollEnabled;
        localStorage.setItem('fb_edgeScroll', ps.edgeScrollEnabled ? '1' : '0');
      }
    }});
    rowX += esW + gap;

    // [CD] — cursor drift toggle
    const cdOn = ps?.cursorDriftEnabled ?? false;
    const cdLabel = 'CD';
    ctx.font = btnFont;
    ctx.fillStyle = cdOn ? "rgba(30, 60, 110, 0.80)" : "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(rowX, clockY, cdW, btnH);
    ctx.strokeStyle = cdOn ? "rgba(80, 150, 255, 0.70)" : "rgba(100, 100, 100, 0.3)";
    ctx.lineWidth = cdOn ? 1.5 : 1;
    ctx.strokeRect(rowX, clockY, cdW, btnH);
    ctx.fillStyle = cdOn ? "#88bbff" : "#888";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(cdLabel, rowX + cdW / 2, clockY + btnH / 2);
    this._clockButtons.push({ x: rowX, y: clockY, w: cdW, h: btnH, action: () => {
      if (ps) {
        ps.cursorDriftEnabled = !ps.cursorDriftEnabled;
        localStorage.setItem('fb_cursorDrift', ps.cursorDriftEnabled ? '1' : '0');
      }
    }});
    rowX += cdW + gap;

    // Mission countdown timer (winCondition: "timer")
    const mt = this.gameState.missionTimer;
    if (mt !== null) {
      const timerM   = Math.floor(mt / 60);
      const timerS   = Math.ceil(mt % 60);
      const timerStr = `Hold: ${timerM}:${timerS.toString().padStart(2, '0')}`;
      const timerColor = mt <= 30 ? "#ff4444" : mt <= 60 ? "#ffcc44" : "#44ee88";
      ctx.font = clockFont;
      const timerW = ctx.measureText(timerStr).width + Math.round(16 * scale);
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(rowX, clockY, timerW, btnH);
      ctx.strokeStyle = timerColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(rowX, clockY, timerW, btnH);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const pulse = mt <= 30 ? 0.65 + 0.35 * Math.sin(performance.now() / 250) : 1;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = timerColor;
      ctx.fillText(timerStr, rowX + timerW / 2, clockY + btnH / 2);
      ctx.globalAlpha = 1;
    }
  }
}


