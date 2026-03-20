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
    // payload contains: { mission, saved, burntCount }
    this.levelData = payload;
    
    // Calculate button positions (centered)
    const centerX = 640; // Assuming 1280px width
    const centerY = 450; // Assuming 720px height
    
    // Calculate total width needed for both buttons with spacing
    const totalWidth = this.buttonWidth + this.buttonSpacing + this.buttonWidth;
    const startX = centerX - totalWidth / 2;
    
    this.buttons = [
      {
        label: "Continue",
        x: startX,
        y: centerY,
        width: this.buttonWidth,
        height: this.buttonHeight,
        callback: () => this.onContinue?.(),
      },
      {
        label: "Return to Menu",
        x: startX + this.buttonWidth + this.buttonSpacing,
        y: centerY,
        width: this.buttonWidth,
        height: this.buttonHeight,
        callback: () => this.onReturnToMenu?.(),
      },
    ];
  }

  update(dt) {
    // No update needed
  }

  render(ctx) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    
    // Semi-transparent overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, width, height);
    
    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Level Complete!", width / 2, 80);
    
    // Stats
    if (this.levelData) {
      ctx.fillStyle = "#e8e8e8";
      ctx.font = "24px Arial";
      const missionName = this.levelData.mission?.name || "Training Grounds";
      const saved = this.levelData.saved || 0;
      const burnt = this.levelData.burntCount || 0;
      
      ctx.fillText(`Mission: ${missionName}`, width / 2, 150);
      ctx.fillText(`Trees Saved: ${saved}`, width / 2, 200);
      ctx.fillText(`Trees Burnt: ${burnt}`, width / 2, 250);
    }
    
    // Draw buttons
    for (const button of this.buttons) {
      // Button background
      ctx.fillStyle = "#4CAF50";
      ctx.fillRect(button.x, button.y, button.width, button.height);
      
      // Button border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(button.x, button.y, button.width, button.height);
      
      // Button text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(button.label, button.x + button.width / 2, button.y + button.height / 2);
    }
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
