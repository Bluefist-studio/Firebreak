export class FireControlModal {
  constructor({ gameState }) {
    this.gameState = gameState;
    this.isOpen = true; // Always visible now
    this.isExpanded = false; // Toggle between collapsed/expanded

    // Control state
    this.controls = {
      temperature: gameState.weather.temperature,
      airHumidity: gameState.weather.airHumidity,
      fuelHumidity: gameState.weather.fuelHumidity,
      windAngle: gameState.weather.windAngle,
      windStrength: gameState.weather.windStrength,
    };

    this.buttons = [];
    this.hoveredButtonIndex = -1;
    this._buildButtons();
  }

  _buildButtons() {
    const startX = 10;
    const startY = 30;
    const rowHeight = 28;
    let y = startY;

    this.buttons = [
      // Temperature row
      {
        label: "Temperature:",
        key: "temperature",
        inc: -1,
        x: startX + 120,
        y: y,
        width: 24,
        height: 20,
        side: "minus",
        row: 0,
      },
      {
        label: "Temperature:",
        key: "temperature",
        inc: 1,
        x: startX + 195,
        y: y,
        width: 24,
        height: 20,
        side: "plus",
        row: 0,
      },
      // Air Humidity row
      {
        label: "Air Humidity:",
        key: "airHumidity",
        inc: -5,
        x: startX + 120,
        y: (y += rowHeight),
        width: 24,
        height: 20,
        side: "minus",
        row: 1,
      },
      {
        label: "Air Humidity:",
        key: "airHumidity",
        inc: 5,
        x: startX + 195,
        y: y,
        width: 24,
        height: 20,
        side: "plus",
        row: 1,
      },
      // Fuel Humidity row
      {
        label: "Fuel Humidity:",
        key: "fuelHumidity",
        inc: -5,
        x: startX + 120,
        y: (y += rowHeight),
        width: 24,
        height: 20,
        side: "minus",
        row: 2,
      },
      {
        label: "Fuel Humidity:",
        key: "fuelHumidity",
        inc: 5,
        x: startX + 195,
        y: y,
        width: 24,
        height: 20,
        side: "plus",
        row: 2,
      },
      // Wind Angle row
      {
        label: "Wind Angle:",
        key: "windAngle",
        inc: -10,
        x: startX + 120,
        y: (y += rowHeight),
        width: 24,
        height: 20,
        side: "minus",
        row: 3,
      },
      {
        label: "Wind Angle:",
        key: "windAngle",
        inc: 10,
        x: startX + 195,
        y: y,
        width: 24,
        height: 20,
        side: "plus",
        row: 3,
      },
      // Wind Strength row
      {
        label: "Wind Strength:",
        key: "windStrength",
        inc: -5,
        x: startX + 120,
        y: (y += rowHeight),
        width: 24,
        height: 20,
        side: "minus",
        row: 4,
      },
      {
        label: "Wind Strength:",
        key: "windStrength",
        inc: 5,
        x: startX + 195,
        y: y,
        width: 24,
        height: 20,
        side: "plus",
        row: 4,
      },
    ];
  }

  _getConstraints(key) {
    const constraints = {
      temperature: { min: -10, max: 50 },
      airHumidity: { min: 10, max: 80 },
      fuelHumidity: { min: 10, max: 80 },
      windAngle: { min: 0, max: 360 },
      windStrength: { min: 1, max: 100 },
    };
    return constraints[key] || { min: 0, max: 100 };
  }

  handlePointerDown(x, y) {
    if (!this.isOpen) return;

    // Check if clicking on header (toggle expand/collapse)
    if (x >= 10 && x <= 240 && y >= 5 && y <= 25) {
      this.isExpanded = !this.isExpanded;
      return;
    }

    // Only process button clicks if expanded
    if (!this.isExpanded) return;

    // Check buttons
    for (let i = 0; i < this.buttons.length; i++) {
      const btn = this.buttons[i];
      if (
        x >= btn.x &&
        x <= btn.x + btn.width &&
        y >= btn.y &&
        y <= btn.y + btn.height
      ) {
        this.hoveredButtonIndex = i;
        this._adjustValue(btn.key, btn.inc);
        break;
      }
    }
  }

  handlePointerMove(x, y) {
    if (!this.isOpen || !this.isExpanded) {
      this.hoveredButtonIndex = -1;
      return;
    }

    // Highlight buttons when hovered
    this.hoveredButtonIndex = -1;
    for (let i = 0; i < this.buttons.length; i++) {
      const btn = this.buttons[i];
      if (
        x >= btn.x &&
        x <= btn.x + btn.width &&
        y >= btn.y &&
        y <= btn.y + btn.height
      ) {
        this.hoveredButtonIndex = i;
        break;
      }
    }
  }

  _adjustValue(key, delta) {
    let newValue = this.controls[key] + delta;
    
    // Normalize wind angle to stay in 0-360 range smoothly (before constraints)
    if (key === "windAngle") {
      newValue = ((newValue % 360) + 360) % 360;
    } else {
      const constraints = this._getConstraints(key);
      newValue = Math.max(constraints.min, Math.min(constraints.max, newValue));
    }
    
    this.controls[key] = newValue;

    // Apply to game state
    if (key === "temperature") {
      this.gameState.weather.temperature = newValue;
    } else if (key === "airHumidity") {
      this.gameState.weather.airHumidity = newValue;
    } else if (key === "fuelHumidity") {
      this.gameState.weather.fuelHumidity = newValue;
    } else if (key === "windAngle") {
      this.gameState.weather.windAngle = newValue;
    } else if (key === "windStrength") {
      // Also update _baseWindStrength so WeatherSystem.update() doesn't overwrite this value
      const currentIncrease = Math.floor((this.gameState.weather._elapsed || 0) / 600) * 10;
      this.gameState.weather._baseWindStrength = Math.max(1, newValue - currentIncrease);
      this.gameState.weather.windStrength = newValue;
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
  }

  render(ctx) {
    if (!this.isOpen) return;

    const boxX = 10;
    const boxY = 5;

    if (!this.isExpanded) {
      // Collapsed tab - just show header
      const boxWidth = 240;
      const boxHeight = 30;

      ctx.save();
      ctx.filter = "blur(3px)";
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
      ctx.restore();

      ctx.strokeStyle = "#0af";
      ctx.lineWidth = 2;
      ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

      // Title with expand arrow
      ctx.fillStyle = "#0af";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "left";
      ctx.fillText("▶ Fire Control", boxX + 8, boxY + 14);

      return;
    }

    // Expanded panel
    const boxWidth = 240;
    const boxHeight = 190;

    ctx.save();
    ctx.filter = "blur(3px)";
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
    ctx.restore();

    ctx.strokeStyle = "#0af";
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // Title with collapse arrow (clickable header)
    ctx.fillStyle = "#0af";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "left";
    ctx.fillText("▼ Fire Control", boxX + 8, boxY + 14);

    // Render control rows
    ctx.font = "11px monospace";
    const rowsToRender = [
      {
        label: "Temperature:",
        key: "temperature",
        minusBtn: this.buttons[0],
        plusBtn: this.buttons[1],
        format: (v) => `${v.toFixed(0)}°`,
      },
      {
        label: "Air Humidity:",
        key: "airHumidity",
        minusBtn: this.buttons[2],
        plusBtn: this.buttons[3],
        format: (v) => `${v.toFixed(0)}%`,
      },
      {
        label: "Fuel Humidity:",
        key: "fuelHumidity",
        minusBtn: this.buttons[4],
        plusBtn: this.buttons[5],
        format: (v) => `${v.toFixed(0)}%`,
      },
      {
        label: "Wind Angle:",
        key: "windAngle",
        minusBtn: this.buttons[6],
        plusBtn: this.buttons[7],
        format: (v) => `${v.toFixed(0)}°`,
      },
      {
        label: "Wind Strength:",
        key: "windStrength",
        minusBtn: this.buttons[8],
        plusBtn: this.buttons[9],
        format: (v) => `${Math.round(v)} km/h`,
      },
    ];

    let y = boxY + 28;
    for (const row of rowsToRender) {
      // Label
      ctx.fillStyle = "#aaa";
      ctx.textAlign = "left";
      ctx.fillText(row.label, boxX + 12, y + 14);

      // Minus button
      const minusHovered = this.hoveredButtonIndex === row.minusBtn.row * 2;
      ctx.fillStyle = minusHovered ? "rgba(64, 64, 64, 0.9)" : "rgba(32, 32, 32, 0.85)";
      ctx.fillRect(row.minusBtn.x, row.minusBtn.y, row.minusBtn.width, row.minusBtn.height);
      ctx.strokeStyle = minusHovered ? "rgba(255, 160, 0, 0.95)" : "rgba(16, 128, 255, 0.8)";
      ctx.lineWidth = 1;
      ctx.strokeRect(row.minusBtn.x, row.minusBtn.y, row.minusBtn.width, row.minusBtn.height);
      ctx.fillStyle = minusHovered ? "rgba(255, 200, 120, 1)" : "#0af";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("−", row.minusBtn.x + row.minusBtn.width / 2, row.minusBtn.y + row.minusBtn.height / 2);

      // Value
      ctx.fillStyle = "#0af";
      ctx.textAlign = "center";
      const valueStr = row.format(this.controls[row.key]);
      ctx.fillText(valueStr, boxX + 170, y + 14);

      // Plus button
      const plusHovered = this.hoveredButtonIndex === row.plusBtn.row * 2 + 1;
      ctx.fillStyle = plusHovered ? "rgba(64, 64, 64, 0.9)" : "rgba(32, 32, 32, 0.85)";
      ctx.fillRect(row.plusBtn.x, row.plusBtn.y, row.plusBtn.width, row.plusBtn.height);
      ctx.strokeStyle = plusHovered ? "rgba(255, 160, 0, 0.95)" : "rgba(16, 128, 255, 0.8)";
      ctx.lineWidth = 1;
      ctx.strokeRect(row.plusBtn.x, row.plusBtn.y, row.plusBtn.width, row.plusBtn.height);
      ctx.fillStyle = plusHovered ? "rgba(255, 200, 120, 1)" : "#0af";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("+", row.plusBtn.x + row.plusBtn.width / 2, row.plusBtn.y + row.plusBtn.height / 2);

      y += 28;
    }

    // Fire risk indicator
    ctx.fillStyle = "#aaa";
    ctx.font = "10px monospace";
    ctx.textAlign = "left";
    ctx.fillText(`Risk: ${this.gameState.weather.getFireRisk()}`, boxX + 12, boxY + boxHeight - 8);
  }
}
