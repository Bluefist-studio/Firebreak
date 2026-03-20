export class SkillHotbarHUD {
  constructor({ gameState }) {
    this.gameState = gameState;
    
    // HUD positioning
    this.padding = 10;
    this.buttonSize = 60;
    this.gap = 8;
    this.bottomMargin = 15;
    
    // Calculate total width needed for 5 buttons
    this.totalWidth = (this.buttonSize * 5) + (this.gap * 4);
    
    // Skill display order (1-5)
    this.skillKeys = [1, 2, 3, 4, 5];
    
    // Cooldown durations map
    this.cooldownDurations = {
      1: { duration: 8, key: 'waterBomberCooldown' },
      2: { duration: 0, key: null }, // Bulldozer uses energy system
      3: { duration: 4, key: 'heliDropCooldown' },
      4: { duration: 12, key: 'workerCrewCooldown' },
      5: { duration: 10, key: 'watchTowerCooldown' },
    };
  }

  handlePointerDown(x, y) {
    // Check if click is on any skill button
    const canvasWidth = this.gameState.viewport.width || 1280;
    const canvasHeight = this.gameState.viewport.height || 720;
    
    // Calculate HUD position (centered at bottom)
    const hudX = (canvasWidth - this.totalWidth) / 2;
    const hudY = canvasHeight - this.buttonSize - this.bottomMargin;
    
    for (let i = 0; i < this.skillKeys.length; i++) {
      const skillKey = this.skillKeys[i];
      const buttonX = hudX + (i * (this.buttonSize + this.gap));
      const buttonY = hudY;
      
      if (x >= buttonX && x < buttonX + this.buttonSize &&
          y >= buttonY && y < buttonY + this.buttonSize) {
        // Activate the skill
        this.activateSkill(skillKey);
        return true;
      }
    }
    return false;
  }

  activateSkill(skillKey) {
    // Cancel all other active skills first
    if (skillKey !== 1) {
      this.gameState.waterBomberMode = null;
      this.gameState.waterBomberStart = null;
      this.gameState.waterBomberPreview = null;
    }
    if (skillKey !== 2) {
      this.gameState.bulldozerActive = false;
    }
    if (skillKey !== 3) {
      this.gameState.heliDropMode = false;
    }
    if (skillKey !== 4) {
      this.gameState.workerCrewMode = false;
    }
    if (skillKey !== 5) {
      this.gameState.watchTowerMode = false;
    }

    // Water Bomber (key 1): activate targeting directly
    if (skillKey === 1) {
      if (this.gameState.waterBomberCooldown > 0) {
        this.gameState.skillMessage = `Water Bomber cooldown: ${this.gameState.waterBomberCooldown.toFixed(1)}s`;
        this.gameState.skillMessageTimer = 2;
        return;
      }
      const bomberCost = this.gameState.getSkillCost(this.gameState.skills[1]);
      if (this.gameState.money < bomberCost) {
        this.gameState.skillMessage = "Not enough money";
        this.gameState.skillMessageTimer = 2;
        return;
      }
      this.gameState.waterBomberMode = "selectStart";
      this.gameState.skillMessage = "Click start point for strafe";
      this.gameState.skillMessageTimer = 2;
      return;
    }

    // Bulldozer (key 2): toggle active mode with energy
    if (skillKey === 2) {
      if (this.gameState.bulldozerEnergy <= 0) {
        this.gameState.skillMessage = "Bulldozer out of energy";
        this.gameState.skillMessageTimer = 2;
        return;
      }
      const bulldozerCost = this.gameState.getSkillCost(this.gameState.skills[2]);
      if (this.gameState.money < bulldozerCost && !this.gameState.bulldozerActive) {
        this.gameState.skillMessage = "Not enough money";
        this.gameState.skillMessageTimer = 2;
        return;
      }
      this.gameState.bulldozerActive = !this.gameState.bulldozerActive;
      this.gameState.skillMessage = this.gameState.bulldozerActive ? "Bulldozer ACTIVE" : "Bulldozer deactivated";
      this.gameState.skillMessageTimer = 2;
      return;
    }

    // Heli Drop (key 3): activate targeting mode
    if (skillKey === 3) {
      if (this.gameState.heliDropCooldown > 0) {
        this.gameState.skillMessage = `Heli Drop cooldown: ${this.gameState.heliDropCooldown.toFixed(1)}s`;
        this.gameState.skillMessageTimer = 2;
        return;
      }
      const heliCost = this.gameState.getSkillCost(this.gameState.skills[3]);
      if (this.gameState.money < heliCost) {
        this.gameState.skillMessage = "Not enough money";
        this.gameState.skillMessageTimer = 2;
        return;
      }
      this.gameState.heliDropMode = !this.gameState.heliDropMode;
      this.gameState.skillMessage = this.gameState.heliDropMode ? "Click to drop" : "Heli Drop canceled";
      this.gameState.skillMessageTimer = 2;
      return;
    }

    // Worker Crew (key 4): activate targeting mode
    if (skillKey === 4) {
      if (this.gameState.workerCrewCooldown > 0) {
        this.gameState.skillMessage = `Worker Crew cooldown: ${this.gameState.workerCrewCooldown.toFixed(1)}s`;
        this.gameState.skillMessageTimer = 2;
        return;
      }
      const crewCost = this.gameState.getSkillCost(this.gameState.skills[4]);
      if (this.gameState.money < crewCost) {
        this.gameState.skillMessage = "Not enough money";
        this.gameState.skillMessageTimer = 2;
        return;
      }
      this.gameState.workerCrewMode = !this.gameState.workerCrewMode;
      this.gameState.skillMessage = this.gameState.workerCrewMode ? "Click to deploy" : "Worker Crew canceled";
      this.gameState.skillMessageTimer = 2;
      return;
    }

    // Watch Tower (key 5): activate targeting mode
    if (skillKey === 5) {
      if (this.gameState.watchTowerCooldown > 0) {
        this.gameState.skillMessage = `Watch Tower cooldown: ${this.gameState.watchTowerCooldown.toFixed(1)}s`;
        this.gameState.skillMessageTimer = 2;
        return;
      }
      const towerCost = this.gameState.getSkillCost(this.gameState.skills[5]);
      if (this.gameState.money < towerCost) {
        this.gameState.skillMessage = "Not enough money";
        this.gameState.skillMessageTimer = 2;
        return;
      }
      this.gameState.watchTowerMode = !this.gameState.watchTowerMode;
      this.gameState.skillMessage = this.gameState.watchTowerMode ? "Click to place watch tower" : "Watch Tower canceled";
      this.gameState.skillMessageTimer = 2;
      return;
    }
  }

  getCooldownRemaining(skillKey) {
    const cooldownData = this.cooldownDurations[skillKey];
    if (!cooldownData || !cooldownData.key) return 0;
    
    const cooldown = this.gameState[cooldownData.key] || 0;
    return cooldown;
  }

  getBulldozerEnergyPercent() {
    const energy = this.gameState.bulldozerEnergy || 0;
    const maxEnergy = this.gameState.bulldozerMaxEnergy || 100;
    return energy / maxEnergy;
  }

  getCooldownProgress(skillKey) {
    const remaining = this.getCooldownRemaining(skillKey);
    const duration = this.cooldownDurations[skillKey].duration;
    
    if (duration === 0) return 0; // No cooldown
    return Math.max(0, 1 - (remaining / duration));
  }

  render(ctx) {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    
    // Calculate HUD position (centered at bottom)
    const hudX = (canvasWidth - this.totalWidth) / 2;
    const hudY = canvasHeight - this.buttonSize - this.bottomMargin;
    
    // Draw each skill button
    for (let i = 0; i < this.skillKeys.length; i++) {
      const skillKey = this.skillKeys[i];
      const buttonX = hudX + (i * (this.buttonSize + this.gap));
      const buttonY = hudY;
      
      this._drawButton(ctx, buttonX, buttonY, skillKey);
    }
  }

  _drawButton(ctx, x, y, skillKey) {
    const skill = this.gameState.skills[skillKey];
    if (!skill) return;
    
    const isSelected = this.gameState.selectedSkillKey === skillKey;
    const cooldownRemaining = this.getCooldownRemaining(skillKey);
    const onCooldown = cooldownRemaining > 0.01;
    
    // Background
    ctx.fillStyle = isSelected ? '#00ff00' : '#333333';
    ctx.strokeStyle = isSelected ? '#00ff00' : '#666666';
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.fillRect(x, y, this.buttonSize, this.buttonSize);
    ctx.strokeRect(x, y, this.buttonSize, this.buttonSize);
    
    // Handle bulldozer energy display (skill 2)
    if (skillKey === 2) {
      const energyPercent = this.getBulldozerEnergyPercent();
      const energyBarHeight = this.buttonSize * (1 - energyPercent);
      
      // Energy depletion overlay (dark when low energy)
      if (energyPercent < 0.5) {
        ctx.fillStyle = 'rgba(255, 100, 100, 0.3)';
      } else {
        ctx.fillStyle = 'rgba(100, 150, 255, 0.1)';
      }
      ctx.fillRect(x, y, this.buttonSize, this.buttonSize);
      
      // Energy bar background
      ctx.fillStyle = 'rgba(50, 50, 50, 0.5)';
      ctx.fillRect(x + 4, y + 4, this.buttonSize - 8, this.buttonSize - 24);
      
      // Energy bar fill
      const barWidth = this.buttonSize - 8;
      const barHeight = this.buttonSize - 24;
      ctx.fillStyle = energyPercent > 0.5 ? '#00ff00' : '#ff8800';
      ctx.fillRect(x + 4, y + 4 + (barHeight * (1 - energyPercent)), barWidth, barHeight * energyPercent);
      
      // Energy bar border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 4, y + 4, barWidth, barHeight);
      
      // Energy percentage at bottom
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.round(energyPercent * 100)}%`, x + this.buttonSize / 2, y + this.buttonSize - 8);
    } else {
      // Cooldown overlay for other skills (recedes from bottom to top)
      if (onCooldown) {
        const progress = this.getCooldownProgress(skillKey);
        const overlayHeight = this.buttonSize * (1 - progress);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        // Draw from bottom of button upward
        ctx.fillRect(x, y + this.buttonSize - overlayHeight, this.buttonSize, overlayHeight);
      }
      
      // Cooldown radial indicator (circular progress)
      if (onCooldown) {
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const centerX = x + this.buttonSize / 2;
        const centerY = y + this.buttonSize / 2;
        const radius = this.buttonSize / 2 - 5;
        const startAngle = -Math.PI / 2;
        const progress = this.getCooldownProgress(skillKey);
        const endAngle = startAngle + (Math.PI * 2 * progress);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.stroke();
      }
      
      // Only show name and cost when NOT on cooldown
      if (!onCooldown) {
        // Skill icon/name area
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Get short name (first letter or abbreviation)
        let shortName = skill.name.substring(0, 3).toUpperCase();
        ctx.fillText(shortName, x + this.buttonSize / 2, y + this.buttonSize / 2 - 10);
        
        // Cost
        ctx.fillStyle = '#ffff00';
        ctx.font = 'bold 9px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const displayCost = this.gameState.getSkillCost(skill);
        ctx.fillText(`$${displayCost.toFixed ? displayCost.toFixed(0) : displayCost}`, x + this.buttonSize / 2, y + this.buttonSize / 2 + 10);
      } else {
        // Cooldown timer text centered and large (when on cooldown)
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cooldownText = cooldownRemaining.toFixed(1);
        ctx.fillText(cooldownText, x + this.buttonSize / 2, y + this.buttonSize / 2);
      }
    }
    
    // Hotkey number (top-right corner) - always on top
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(String(skillKey), x + this.buttonSize - 4, y + 3);
  }
}
