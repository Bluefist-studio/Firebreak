export class RegionMapScreen {
  constructor({ backgroundImage, missions, onSelectMission, onBack }) {
    this.backgroundImage = backgroundImage;
    this.missions = missions;
    this.onSelectMission = onSelectMission;
    this.onBack = onBack;
    this.selectedIndex = -1; // No mission selected by default

    // Pointer hover state for list items
    this.hoveredIndex = -1;
    this.isBackHover = false;
  }

  update() {}

  render(ctx) {
    if (this.backgroundImage && this.backgroundImage.complete && this.backgroundImage.naturalWidth) {
      ctx.drawImage(this.backgroundImage, 0, 0, ctx.canvas.width, ctx.canvas.height);
    } else {
      ctx.fillStyle = "#0b1";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }


    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const scale = Math.min(width / 1280, height / 720, 2);

    // Back button
    const backX = Math.round(20 * scale);
    const backY = Math.round(20 * scale);
    const backW = Math.max(80, Math.round(110 * scale));
    const backH = Math.max(28, Math.round(38 * scale));
    const backHovered = this.isBackHover;

    ctx.save();
    ctx.filter = "blur(6px)";
    ctx.fillStyle = backHovered ? "rgba(255, 140, 0, 0.45)" : "rgba(255, 140, 0, 0.25)";
    ctx.strokeStyle = backHovered ? "rgba(16, 16, 16, 0.9)" : "rgba(16, 16, 16, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(backX, backY, backW, backH, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Back", backX + backW / 2, backY + backH / 2);

    const startY = Math.round(height * 0.25);
    const itemHeight = Math.max(56, Math.round(70 * scale));

    const drawListItem = (x, y, w, h, label, description, isSelected, isHovered) => {
      const glowOpacity = isHovered ? 0.55 : 0.3;
      const bgOpacity = isSelected ? 0.55 : isHovered ? 0.45 : 0.35;
      const borderOpacity = isHovered ? 0.95 : 0.85;

      // Blurred glow behind item
      ctx.save();
      ctx.filter = "blur(8px)";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(16, 16, 16, 0.75)";
      ctx.fillStyle = `rgba(255, 140, 0, ${glowOpacity})`;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 14);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Main item background
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(16, 16, 16, ${borderOpacity})`;
      ctx.fillStyle = `rgba(0, 0, 0, ${bgOpacity})`;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 12);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = "white";
      ctx.font = "20px Arial";
      ctx.textAlign = "left";
      ctx.fillText(label, x + 20, y + 28);
      ctx.font = "16px Arial";
      ctx.fillText(description, x + 20, y + 50);
    };

    const itemX = Math.round(Math.max(40, 200 * scale));
    const itemWidth = Math.round(width - itemX * 2);

    this.missions.forEach((mission, idx) => {
      const y = startY + idx * (itemHeight + 8);
      const isSelected = idx === this.selectedIndex;
      const isHovered = idx === this.hoveredIndex;
      drawListItem(itemX, y, itemWidth, itemHeight, mission.name, mission.description, isSelected, isHovered);
    });

  }

  handlePointerDown(x, y, evt) {
    const canvas = evt?.target;
    const width = canvas?.width ?? 1280;
    const height = canvas?.height ?? 720;
    const scale = Math.min(width / 1280, height / 720, 2);

    // Back button bounds
    const backX = Math.round(20 * scale);
    const backY = Math.round(20 * scale);
    const backW = Math.max(80, Math.round(110 * scale));
    const backH = Math.max(28, Math.round(38 * scale));
    if (x >= backX && x <= backX + backW && y >= backY && y <= backY + backH) {
      this.onBack?.();
      return;
    }

    const startY = Math.round(height * 0.25);
    const itemHeight = Math.max(56, Math.round(70 * scale));
    const itemX = Math.round(Math.max(40, 200 * scale));
    const itemEndX = width - itemX;

    this.missions.forEach((mission, idx) => {
      const itemY = startY + idx * (itemHeight + Math.round(8 * scale));
      if (x >= itemX && x <= itemEndX && y >= itemY && y <= itemY + itemHeight) {
        this.selectedIndex = idx;
        this.onSelectMission?.(mission);
      }
    });
  }

  handlePointerMove(x, y, evt) {
    const canvas = evt?.target;
    const width = canvas?.width ?? 1280;
    const height = canvas?.height ?? 720;
    const scale = Math.min(width / 1280, height / 720, 2);

    // Back button bounds (scaled)
    const backX = Math.round(20 * scale);
    const backY = Math.round(20 * scale);
    const backW = Math.max(80, Math.round(110 * scale));
    const backH = Math.max(28, Math.round(38 * scale));
    this.isBackHover = x >= backX && x <= backX + backW && y >= backY && y <= backY + backH;

    const startY = Math.round(height * 0.25);
    const itemHeight = Math.max(56, Math.round(70 * scale));
    const itemX = Math.round(Math.max(40, 200 * scale));
    const itemEndX = width - itemX;

    let foundIndex = -1;
    this.missions.forEach((_, idx) => {
      const itemY = startY + idx * (itemHeight + Math.round(8 * scale));
      if (x >= itemX && x <= itemEndX && y >= itemY && y <= itemY + itemHeight) {
        foundIndex = idx;
      }
    });

    this.hoveredIndex = foundIndex;
  }

  handleKeyDown(evt) {
    if (evt.key === "Escape") {
      this.onBack?.();
      return;
    }

    if (evt.key === "s") {
      if (this.selectedIndex < 0) {
        this.selectedIndex = 0;
      } else {
        this.selectedIndex = Math.min(this.missions.length - 1, this.selectedIndex + 1);
      }
    }
    if (evt.key === "w") {
      if (this.selectedIndex < 0) {
        this.selectedIndex = this.missions.length - 1;
      } else {
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      }
    }
    if (evt.key === "Enter" && this.selectedIndex >= 0) {
      this.onSelectMission?.(this.missions[this.selectedIndex]);
    }
  }
}
