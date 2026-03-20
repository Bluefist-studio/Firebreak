/**
 * TopStatusHUD
 * Single row at top center of screen
 */
export class TopStatusHUD {
  constructor({ gameState }) {
    this.gameState = gameState;
  }

  render(ctx) {
    const viewport = this.gameState.viewport;
    const centerX = viewport.width / 2;
    const topY = 0;
    
    const boxHeight = 35;
    const boxWidth = 700;
    const padding = 10;

    // Draw background centered
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(centerX - boxWidth / 2, topY, boxWidth, boxHeight);

    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#CCCCCC";
    
    const textY = topY + boxHeight / 2;
    const dayLabel = this.gameState.currentDay === 0 ? "Training Day" : `Day ${this.gameState.currentDay}`;
    const info = [
      dayLabel,
      `$ ${this.gameState.money}`,
      `Fire: ${this.gameState.forest.burningCount}`,
      `${this.gameState.weather.temperature}°C`,
      `${this.gameState.weather.humidity}%`,
      `${(this.gameState.weather.windStrength * 10).toFixed(1)} km/h`
    ];
    
    const text = info.join("  |  ");
    ctx.fillText(text, centerX, textY);
  }
}
