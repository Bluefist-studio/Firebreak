/**
 * HelpTooltipsModal
 * Displays helpful tooltips for player controls and mechanics
 * Located on the left-center of the screen
 * Can be toggled with "i" key
 */
export class HelpTooltipsModal {
  static STORAGE_KEY = "firebreak_help_modal_open";

  constructor() {
    this.isOpen = this._loadIsOpen();
    this.currentTipIndex = 0;
    this.canvasHeight = 720; // Default, will be updated in render
    this.canvasWidth = 1280; // Default, will be updated in render
    
    // Help tips for different game mechanics
    this.tips = [
      {
        title: "Movement",
        content: "Use WASD keys to move the camera around the map."
      },
      {
        title: "Cutting Trees",
        content: "LEFT CLICK and drag to cut trees.\nCutting creates a firebreak to stop fire spread."
      },
      {
        title: "Spraying Water",
        content: "RIGHT CLICK and drag to spray water on trees.\nWet trees (blue) are suppressed which stops fire spread."
      },
      {
        title: "Water Bomber [1]",
        content: "Press [1] to select, then click start and end points for a strafe run.\nPress [1] again while targeting to toggle Water / Retardant mode.\nRetardant costs extra but suppression lasts much longer. Cooldown: 8s."
      },
      {
        title: "Heli Drop [2]",
        content: "Press [2] to select, then click a location to drop suppressant.\nPress [2] again while targeting to toggle Water / Retardant mode.\nRetardant costs extra but suppression lasts much longer. Cooldown: 4s."
      },
      {
        title: "Bulldozer [3]",
        content: "Press [3] to activate, then click a start point and an end point to carve a firebreak.\nThe dozer travels the path automatically, cutting all trees in its swath.\nDrains fuel and durability per second while running. Cooldown: 8s."
      },
      {
        title: "Sprinkler Trailer [4]",
        content: "Press [4] to select, then click to deploy a sprinkler zone.\nCreates a high-humidity area that slows fire spread for 10 seconds. Cooldown: 12s."
      },
      {
        title: "Fire Watch [5]",
        content: "Press [5] to select, then click to place a watch tower.\nReveals a large fog-of-war area on the minimap. Cooldown: 10s."
      },
      {
        title: "Drone Recon [6]",
        content: "Press [6] to select, then click to deploy a drone.\nDrone reveals fog of war in a radius and can be repositioned. Lasts 45 seconds."
      },
      {
        title: "Recon Plane [7]",
        content: "Press [7] to select, then click to call in a recon pass.\nReveals the entire map for 8 seconds. Costs $200. Cooldown: 20s."
      },
      {
        title: "Fire Crew [8]",
        content: "Hold LEFT CLICK to deploy your fire crew to cut trees.\nPress [8] to check crew stamina. Stamina drains while cutting and recharges when idle.\nCrew performance drops if underfed."
      },
      {
        title: "Fire Truck [9]",
        content: "Hold RIGHT CLICK to use the fire truck to spray water.\nPress [9] to check truck durability. Durability wears with use — repair at base between missions."
      },
      {
        title: "Fire Control Modal",
        content: "Click the header (top-left) to open the Fire Control Modal.\nAdjust weather, fire spread, and tree properties in real-time."
      },
      {
        title: "Toggle Help",
        content: "Press [I] anytime to open/close this help panel. Good luck!"
      }
    ];
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this._saveIsOpen();
  }

  open() {
    this.isOpen = true;
    this.currentTipIndex = 0;
    this._saveIsOpen();
  }

  close() {
    this.isOpen = false;
    this._saveIsOpen();
  }

  _loadIsOpen() {
    try {
      const stored = window.localStorage.getItem(HelpTooltipsModal.STORAGE_KEY);
      if (stored === null) return true;
      return stored === "true";
    } catch {
      return true;
    }
  }

  _saveIsOpen() {
    try {
      window.localStorage.setItem(HelpTooltipsModal.STORAGE_KEY, this.isOpen ? "true" : "false");
    } catch {
      // Ignore storage errors (e.g., private mode)
    }
  }

  nextTip() {
    if (this.currentTipIndex < this.tips.length - 1) {
      this.currentTipIndex++;
    }
  }

  previousTip() {
    if (this.currentTipIndex > 0) {
      this.currentTipIndex--;
    }
  }

  render(ctx) {
    if (!this.isOpen) return;

    // Store canvas dimensions for use in handlePointerDown
    this.canvasHeight = ctx.canvas.height;
    this.canvasWidth = ctx.canvas.width;

    const tip = this.tips[this.currentTipIndex];
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const scale = Math.min(canvasWidth / 1280, canvasHeight / 720, 2);

    const padding = Math.max(8, Math.round(10 * scale));
    const titleFontSize = Math.max(14, Math.round(18 * scale));
    const contentFontSize = Math.max(12, Math.round(14 * scale));
    const lineHeight = Math.max(16, Math.round(18 * scale));
    const modalWidth = Math.min(450, Math.round(350 * scale));
    const modalHeight = Math.min(280, Math.round(225 * scale));
    const buttonHeight = Math.max(30, Math.round(40 * scale));
    const buttonWidth = Math.max(80, Math.round(100 * scale));
    const spacing = Math.max(8, Math.round(10 * scale));

    // Calculate modal height based on content
    ctx.font = `${contentFontSize}px Arial`;
    const lines = tip.content.split("\n");
    const contentHeight = lines.length * lineHeight;
    const counterHeight = 20;  // Space for counter
    const hintHeight = 20;     // Space for close hint
    

    // Position: left-center (aligned to whole pixels for crisp border)
    const modalX = padding;
    const modalY = Math.round((canvasHeight - modalHeight) / 2);

    // Draw background (glass blur style)
    ctx.save();
    ctx.filter = "blur(4px)";
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(modalX, modalY, modalWidth, modalHeight);
    ctx.restore();

    // Draw border (match Fire Control modal)
    ctx.strokeStyle = "#0af";
    ctx.lineWidth = 2;
    ctx.strokeRect(modalX, modalY, modalWidth, modalHeight);

    // Draw title
    ctx.fillStyle = "rgba(100, 200, 255, 1)";
    ctx.font = `bold ${titleFontSize}px Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const maxTextWidth = modalWidth - padding * 2;
    ctx.fillText(tip.title, modalX + padding, modalY + 2 + titleFontSize, maxTextWidth);

    // Draw separator line
    ctx.strokeStyle = "#0af";
    ctx.lineWidth = 1;
    const separatorY = modalY + padding + titleFontSize + spacing;
    ctx.beginPath();
    ctx.moveTo(modalX + padding, separatorY);
    ctx.lineTo(modalX + modalWidth - padding, separatorY);
    ctx.stroke();

    // Draw content text (wrap to fit)
    ctx.fillStyle = "rgba(200, 200, 200, 1)";
    ctx.font = `${contentFontSize}px Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let currentY = separatorY + spacing + lineHeight;
    const wrappedLines = [];
    for (const line of lines) {
      wrappedLines.push(...this._wrapText(ctx, line, maxTextWidth));
    }
    for (const line of wrappedLines) {
      ctx.fillText(line, modalX + padding, currentY);
      currentY += lineHeight;
    }

    // Draw navigation buttons
    const buttonsY = modalY + modalHeight - buttonHeight - padding;
    const buttonY = buttonsY;
    const prevButtonX = modalX + padding;
    const nextButtonX = modalX + modalWidth - padding - buttonWidth;

    // Previous button
    this._drawButton(ctx, prevButtonX, buttonY, buttonWidth, buttonHeight, "PREV", this.currentTipIndex > 0);

    // Next button
    this._drawButton(ctx, nextButtonX, buttonY, buttonWidth, buttonHeight, "NEXT", this.currentTipIndex < this.tips.length - 1);

    // Draw tip counter below buttons
    ctx.fillStyle = "rgba(150, 150, 150, 1)";
    ctx.font = `12px Arial`;
    const counterText = `${this.currentTipIndex + 1}/${this.tips.length}`;
    ctx.textAlign = "center";
    const centerX = modalX + modalWidth / 2;
    const counterY = buttonY + buttonHeight - 8;
    ctx.fillText(counterText, centerX, counterY);

    // Draw close hint at bottom
    ctx.fillStyle = "rgba(150, 150, 150, 0.8)";
    ctx.font = `11px Arial`;
    ctx.fillText("Press [I] to close", centerX, modalY + modalHeight - 10);
    ctx.textAlign = "left";
  }

  _drawButton(ctx, x, y, width, height, text, enabled) {
    // Button background (glass blur)
    ctx.save();
    ctx.filter = "blur(3px)";
    ctx.fillStyle = enabled ? "rgba(255, 140, 0, 0.4)" : "rgba(70, 70, 90, 0.35)";
    ctx.fillRect(x, y, width, height);
    ctx.restore();

    // Button border
    ctx.strokeStyle = enabled ? "rgba(255, 205, 140, 0.9)" : "rgba(100, 100, 110, 0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Button text
    ctx.fillStyle = enabled ? "rgba(255, 255, 255, 1)" : "rgba(150, 150, 150, 0.5)";
    ctx.font = `bold 12px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + width / 2, y + height / 2);
    ctx.textAlign = "left";
  }

  _wrapText(ctx, text, maxWidth) {
    const words = text.split(" ");
    const lines = [];
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const { width } = ctx.measureText(testLine);
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  handlePointerDown(x, y) {
    if (!this.isOpen) return;

    const canvasWidth = this.canvasWidth || 1280;
    const canvasHeight = this.canvasHeight || 720;
    const scale = Math.min(canvasWidth / 1280, canvasHeight / 720, 2);

    const padding = Math.max(8, Math.round(10 * scale));
    const modalWidth = Math.min(450, Math.round(350 * scale));
    const modalHeight = Math.min(280, Math.round(225 * scale));
    const buttonHeight = Math.max(30, Math.round(40 * scale));
    const buttonWidth = Math.max(80, Math.round(100 * scale));

    const modalX = padding;
    const modalY = Math.round((canvasHeight - modalHeight) / 2);

    // Check if click is on next button (right side)
    const nextButtonX = modalX + modalWidth - padding - buttonWidth;
    const buttonsY = modalY + modalHeight - buttonHeight - padding;
    
    if (
      x >= nextButtonX &&
      x <= nextButtonX + buttonWidth &&
      y >= buttonsY &&
      y <= buttonsY + buttonHeight &&
      this.currentTipIndex < this.tips.length - 1
    ) {
      this.nextTip();
      return true;
    }

    // Check if click is on previous button (left side)
    const prevButtonX = modalX + padding;
    if (
      x >= prevButtonX &&
      x <= prevButtonX + buttonWidth &&
      y >= buttonsY &&
      y <= buttonsY + buttonHeight &&
      this.currentTipIndex > 0
    ) {
      this.previousTip();
      return true;
    }

    return false;
  }
}
