const DIFFICULTY_RANK = {
  "increasing difficulty": 1,
  "very easy": 2,
  "easy": 3,
  "moderate": 4,
  "challenging": 5,
  "hard": 6,
  "very hard": 7,
  "extreme": 8,
  // undefined/unknown difficulty sorts first (rank 0 via ?? 0)
};

export class RegionMapScreen {
  constructor({ backgroundImage, missions, onSelectMission, onBack, economyState }) {
    this.backgroundImage = backgroundImage;
    this.economyState = economyState;
    // Sort missions by difficulty ascending; unknown difficulty goes last
    this.missions = [...missions].sort((a, b) => {
      const ra = DIFFICULTY_RANK[a.difficulty?.toLowerCase()] ?? 0;
      const rb = DIFFICULTY_RANK[b.difficulty?.toLowerCase()] ?? 0;
      return ra - rb;
    });
    this.onSelectMission = onSelectMission;
    this.onBack = onBack;
    this.selectedIndex = -1; // No mission selected by default

    // Pointer hover state for list items
    this.hoveredIndex = -1;
    this.isBackHover = false;

    // Scroll state
    this.scrollY = 0; // pixels scrolled down
    this._listStartY = 0;
    this._listEndY = 0;
    this._maxScrollY = 0;
  }

  update() {}

  onEnter() {
    this.scrollY = 0;
    this.hoveredIndex = -1;
  }

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

    const difficultyColors = {
      "very easy":           "#66BB6A",
      "easy":                "#4CAF50",
      "moderate":            "#FFC107",
      "challenging":         "#FF9800",
      "hard":                "#EF5350",
      "very hard":           "#f44336",
      "extreme":             "#B71C1C",
      "increasing difficulty": "#CE93D8",
    };

    const drawListItem = (x, y, w, h, label, description, difficulty, isSelected, isHovered, isCompleted, bestDay = null) => {
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

      // Mission name
      ctx.fillStyle = "white";
      ctx.font = "20px Arial";
      ctx.textAlign = "left";
      ctx.fillText(label, x + 20, y + 28);

      // Description
      ctx.font = "16px Arial";
      ctx.fillText(description, x + 20, y + 50);

      // Difficulty badge — right-aligned
      if (difficulty) {
        const diffKey = difficulty.toLowerCase();
        const diffColor = difficultyColors[diffKey] || "#aaa";
        const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        ctx.font = "bold 13px Arial";
        ctx.textAlign = "right";
        ctx.fillStyle = diffColor;
        ctx.fillText(diffLabel, x + w - 20, y + 28);
      }

      // Completed badge
      if (isCompleted) {
        ctx.font = "bold 13px Arial";
        ctx.textAlign = "right";
        ctx.fillStyle = "#66BB6A";
        const completedText = bestDay != null ? `\u2713 Best: Day ${bestDay}` : "\u2713 Completed";
        ctx.fillText(completedText, x + w - 20, y + 50);
      }
    };

    const itemX = Math.round(Math.max(40, 200 * scale));
    const itemWidth = Math.round(width - itemX * 2);
    const itemGap = Math.round(8 * scale);
    const totalListH = this.missions.length * (itemHeight + itemGap);

    // List viewport: from startY to near bottom
    const listEndY = height - Math.round(30 * scale);
    this._listStartY = startY;
    this._listEndY = listEndY;
    this._maxScrollY = Math.max(0, totalListH - (listEndY - startY));
    this.scrollY = Math.min(this.scrollY, this._maxScrollY);

    // Clip to list area
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, startY, width, listEndY - startY);
    ctx.clip();

    this.missions.forEach((mission, idx) => {
      const y = startY + idx * (itemHeight + itemGap) - this.scrollY;
      // Skip fully off-screen items
      if (y + itemHeight < startY || y > listEndY) return;
      const isSelected = idx === this.selectedIndex;
      const isHovered = idx === this.hoveredIndex;
      const isCompleted = this.economyState?.isMissionComplete(mission.id) ?? false;
      const bestDay = mission.id === "fire_season" ? (this.economyState?.getMissionBestDay(mission.id) ?? null) : null;
      drawListItem(itemX, y, itemWidth, itemHeight, mission.name, mission.description, mission.difficulty, isSelected, isHovered, isCompleted, bestDay);
    });

    ctx.restore();

    // Scroll indicator bar
    if (this._maxScrollY > 0) {
      const barX = width - Math.round(10 * scale);
      const barH = listEndY - startY;
      const thumbH = Math.max(30, barH * (barH / totalListH));
      const thumbY = startY + (this.scrollY / this._maxScrollY) * (barH - thumbH);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(barX - 4, startY, 4, barH);
      ctx.fillStyle = "rgba(255,200,80,0.65)";
      ctx.beginPath();
      ctx.roundRect(barX - 4, thumbY, 4, thumbH, 2);
      ctx.fill();
    }
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
    const listEndY = height - Math.round(30 * scale);
    // Ignore clicks outside list area
    if (y < startY || y > listEndY) return;
    const itemHeight = Math.max(56, Math.round(70 * scale));
    const itemGap = Math.round(8 * scale);
    const itemX = Math.round(Math.max(40, 200 * scale));
    const itemEndX = width - itemX;

    this.missions.forEach((mission, idx) => {
      const itemY = startY + idx * (itemHeight + itemGap) - this.scrollY;
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
    const listEndY = height - Math.round(30 * scale);
    const itemHeight = Math.max(56, Math.round(70 * scale));
    const itemGap = Math.round(8 * scale);
    const itemX = Math.round(Math.max(40, 200 * scale));
    const itemEndX = width - itemX;

    let foundIndex = -1;
    if (y >= startY && y <= listEndY) {
      this.missions.forEach((_, idx) => {
        const itemY = startY + idx * (itemHeight + itemGap) - this.scrollY;
        if (x >= itemX && x <= itemEndX && y >= itemY && y <= itemY + itemHeight) {
          foundIndex = idx;
        }
      });
    }

    this.hoveredIndex = foundIndex;
  }

  handleWheel(evt) {
    const scrollAmount = evt.deltaY ?? 0;
    this.scrollY = Math.max(0, Math.min(this._maxScrollY, this.scrollY + scrollAmount * 0.5));
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
