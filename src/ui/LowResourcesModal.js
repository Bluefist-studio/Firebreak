/**
 * LowResourcesModal
 * Shows a warning when player tries to start mission with low resources
 * Centered modal with "Continue" and "Cancel" buttons
 */
export class LowResourcesModal {
  constructor() {
    this.isOpen = false;
    this.warnings = [];
    this.onContinue = null;
    this.onCancel = null;
    this.continueBtn = null;
    this.cancelBtn = null;
    this.mouseX = -1;
    this.mouseY = -1;
  }

  show(warnings, onContinue, onCancel) {
    this.warnings = warnings;
    this.onContinue = onContinue;
    this.onCancel = onCancel;
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
    this.warnings = [];
  }

  render(ctx) {
    if (!this.isOpen) return;

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const scale = Math.min(canvasWidth / 1280, canvasHeight / 720, 2);

    const padding = Math.max(10, Math.round(12 * scale));
    const titleFontSize = Math.max(16, Math.round(20 * scale));
    const contentFontSize = Math.max(12, Math.round(14 * scale));
    const lineHeight = Math.max(18, Math.round(20 * scale));
    const modalWidth = Math.max(400, Math.round(500 * scale));
    const buttonHeight = Math.max(35, Math.round(45 * scale));
    const buttonWidth = Math.max(100, Math.round(130 * scale));

    // Modal positioned center
    const modalX = Math.round((canvasWidth - modalWidth) / 2);
    const modalY = Math.round((canvasHeight - 250 * scale) / 2);
    const modalHeight = Math.round(250 * scale);

    // Darken background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw modal box
    ctx.fillStyle = "rgba(30, 30, 40, 0.95)";
    ctx.fillRect(modalX, modalY, modalWidth, modalHeight);

    // Draw border
    ctx.strokeStyle = "#ff4400";
    ctx.lineWidth = 3;
    ctx.strokeRect(modalX, modalY, modalWidth, modalHeight);

    // Draw title
    ctx.fillStyle = "#ff4400";
    ctx.font = `bold ${titleFontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("⚠ LOW RESOURCES", modalX + modalWidth / 2, modalY + padding);

    // Draw separator
    ctx.strokeStyle = "#ff4400";
    ctx.lineWidth = 1;
    const separatorY = modalY + padding + titleFontSize + padding;
    ctx.beginPath();
    ctx.moveTo(modalX + padding, separatorY);
    ctx.lineTo(modalX + modalWidth - padding, separatorY);
    ctx.stroke();

    // Draw warnings
    ctx.fillStyle = "#ffccaa";
    ctx.font = `${contentFontSize}px Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    let currentY = separatorY + padding + lineHeight;
    for (const warning of this.warnings) {
      ctx.fillText(warning, modalX + padding + 20, currentY);
      currentY += lineHeight;
    }

    // Draw "Continue anyway?" text
    ctx.fillStyle = "#aaaaaa";
    ctx.font = `italic ${contentFontSize}px Arial`;
    currentY += padding;
    ctx.textAlign = "center";
    ctx.fillText("Continue anyway?", modalX + modalWidth / 2, currentY);

    // Button positions
    const buttonsY = modalY + modalHeight - buttonHeight - padding;
    const cancelX = modalX + padding + 20;
    const continueX = modalX + modalWidth - buttonWidth - padding - 20;

    // Store button rects for hit testing
    this.cancelBtn = { x: cancelX, y: buttonsY, w: buttonWidth, h: buttonHeight };
    this.continueBtn = { x: continueX, y: buttonsY, w: buttonWidth, h: buttonHeight };

    // Draw buttons
    this._drawButton(ctx, cancelX, buttonsY, buttonWidth, buttonHeight, "Cancel", this._isButtonHovered(this.cancelBtn));
    this._drawButton(ctx, continueX, buttonsY, buttonWidth, buttonHeight, "Continue", this._isButtonHovered(this.continueBtn));
  }

  handlePointerMove(x, y) {
    if (!this.isOpen) return;
    this.mouseX = x;
    this.mouseY = y;
  }
  _isButtonHovered(buttonRect) {
    return this.mouseX >= buttonRect.x && this.mouseX <= buttonRect.x + buttonRect.w &&
           this.mouseY >= buttonRect.y && this.mouseY <= buttonRect.y + buttonRect.h;
  }
  _drawButton(ctx, x, y, w, h, label, isHovered) {
    // Button background
    if (isHovered) {
      ctx.fillStyle = "#ff6600";
    } else {
      ctx.fillStyle = "#ff4400";
    }
    ctx.fillRect(x, y, w, h);

    // Button border
    ctx.strokeStyle = isHovered ? "#ff8844" : "#ffaa66";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Button text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  _isMouseOver(x, y, w, h) {
    // Basic hover check - would need mouse tracking in PreMissionScreen
    return false;
  }

  handlePointerDown(x, y) {
    if (!this.isOpen) return false;

    if (this._hitTest(x, y, this.continueBtn)) {
      this.onContinue?.();
      this.close();
      return true;
    }
    if (this._hitTest(x, y, this.cancelBtn)) {
      this.onCancel?.();
      this.close();
      return true;
    }
    return false;
  }

  _hitTest(x, y, rect) {
    return rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }
}
