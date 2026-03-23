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

    // Semi-transparent overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, width, height);
    
    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center";
    const isFailed = this.levelData?.isFailed;
    ctx.fillText(isFailed ? "Mission Failed" : "Level Complete!", width / 2, 80);
    
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

      if (isFailed) {
        ctx.fillStyle = "#f44";
        ctx.font = "bold 26px Arial";
        const failThreshold = this.levelData.mission?.failBurnPercent ?? 0;
        ctx.fillText(`Too much forest lost! (limit: ${failThreshold}%)`, width / 2, ly); ly += 40;
        ctx.fillStyle = "#aaa";
        ctx.font = "22px Arial";
        ctx.fillText("No reward earned.", width / 2, ly); ly += 40;
      }

      if (!isFailed && reward > 0) {
        ctx.fillStyle = "#4CAF50";
        ctx.font = "bold 28px Arial";
        ctx.fillText(`Reward: $${reward.toLocaleString()}`, width / 2, ly); ly += 45;
      }

      const fallback = this.levelData.fallbackGrant || 0;
      if (fallback > 0) {
        ctx.fillStyle = "#FFD54F";
        ctx.font = "bold 22px Arial";
        ctx.fillText(`Government Funding: +$${fallback.toLocaleString()}`, width / 2, ly); ly += 40;
      } else if (reward > 0) {
        ctx.fillStyle = "#888";
        ctx.font = "18px Arial";
        ctx.fillText("Government funding available if funds run low", width / 2, ly); ly += 35;
      }

      const foodWear = this.levelData.foodWear || 0;
      const fuelConsumed = this.levelData.fuelConsumed || 0;
      const retardantConsumed = this.levelData.retardantConsumed || 0;

      // Resource consumption section
      if (fuelConsumed > 0 || retardantConsumed > 0 || foodWear > 0) {
        ly += 10;
        ctx.fillStyle = "#aaa";
        ctx.font = "bold 20px Arial";
        ctx.fillText("— Resource Usage —", width / 2, ly); ly += 35;
      }

      if (fuelConsumed > 0) {
        ctx.fillStyle = "#f90";
        ctx.font = "22px Arial";
        ctx.fillText(`Fuel consumed: ${fuelConsumed}`, width / 2, ly); ly += 30;
      }

      if (retardantConsumed > 0) {
        ctx.fillStyle = "#f44";
        ctx.font = "22px Arial";
        ctx.fillText(`Retardant used: ${retardantConsumed}`, width / 2, ly); ly += 30;
      }

      if (foodWear > 0) {
        ctx.fillStyle = "#ff9944";
        ctx.font = "22px Arial";
        ctx.fillText(`Food consumed by crew: ${foodWear}`, width / 2, ly); ly += 30;
      }
    }
    
    // Draw buttons — on failure only show Return to Base
    const centerX = width / 2;
    const centerY = height / 2;
    const btnY = centerY;
    this.buttons = [];

    this.buttons.push({
      label: "Return to Base",
      x: centerX - this.buttonWidth / 2,
      y: btnY,
      width: this.buttonWidth,
      height: this.buttonHeight,
      callback: () => this.onReturnToMenu?.(),
    });

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
