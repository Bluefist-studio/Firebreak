export class TitleScreen {
  constructor({ backgroundImage, onStart }) {
    this.backgroundImage = backgroundImage;
    this.onStart = onStart;
  }

  update() {}

  render(ctx) {
    if (this.backgroundImage && this.backgroundImage.complete && this.backgroundImage.naturalWidth) {
      ctx.drawImage(this.backgroundImage, 0, 0, ctx.canvas.width, ctx.canvas.height);
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.font = "20px Arial";
    ctx.fillText("Click or press Enter to continue", ctx.canvas.width / 2, ctx.canvas.height - 40);
  }

  handlePointerDown() {
    this.onStart?.();
  }

  handleKeyDown(evt) {
    if (evt.key === "Enter") {
      this.onStart?.();
    }
  }
}
