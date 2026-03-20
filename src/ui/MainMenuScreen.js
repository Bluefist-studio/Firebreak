export class MainMenuScreen {
  constructor({ backgroundImage, onNavigate }) {
    this.backgroundImage = backgroundImage;
    this.onNavigate = onNavigate;

    // Hover state (for button hover highlighting)
    this.isPlayHover = false;
  }

  update() {}

  render(ctx) {
    if (this.backgroundImage && this.backgroundImage.complete && this.backgroundImage.naturalWidth) {
      ctx.drawImage(this.backgroundImage, 0, 0, ctx.canvas.width, ctx.canvas.height);
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    const w = 260;
    const h = 60;
    const x = ctx.canvas.width / 2 - w / 2;
    const y = 240;

    const isHovered = this.isPlayHover;

    const drawButton = (x, y, w, h, label) => {
      // Blurred glow behind the button
      ctx.save();
      ctx.filter = "blur(8px)";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(16, 16, 16, 0.8)";
      ctx.fillStyle = isHovered ? "rgba(255, 120, 0, 0.45)" : "rgba(255, 140, 0, 0.25)";
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 14);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Main button
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(16, 16, 16, 0.95)";
      ctx.fillStyle = isHovered ? "rgba(0, 0, 0, 0.55)" : "rgba(0, 0, 0, 0.35)";
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 12);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = "white";
      ctx.font = "24px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + w / 2, y + h / 2);
    };

    drawButton(x, y, w, h, "Play");
  }

  handlePointerDown(x, y, evt) {
    const canvas = evt?.target;
    const w = 260;
    const h = 60;
    const bx = (canvas?.width ?? 1280) / 2 - w / 2;
    const by = 240;
    if (x >= bx && x <= bx + w && y >= by && y <= by + h) {
      this.onNavigate?.("region");
    }
  }

  handlePointerMove(x, y, evt) {
    const canvas = evt?.target;
    const w = 260;
    const h = 60;
    const bx = (canvas?.width ?? 1280) / 2 - w / 2;
    const by = 240;
    this.isPlayHover = x >= bx && x <= bx + w && y >= by && y <= by + h;
  }

  handleKeyDown(evt) {
    if (evt.key === "Enter") {
      this.onNavigate?.("region");
    }
  }
}
