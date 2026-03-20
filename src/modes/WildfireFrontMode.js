import { BaseMode } from "./BaseMode.js";

/**
 * WildfireFrontMode
 * A focused mission mode for the Wildfire Front map.
 *
 * This mode provides a single-session mission with persistent money
 * and a small announcement.
 */
export class WildfireFrontMode extends BaseMode {
  constructor() {
    super();
    this.currentMoney = 0;
  }

  initializeNewSession(missionStartMoney) {
    this.currentMoney = missionStartMoney;
  }

  getAnnouncementText(isFirstRun) {
    return "Wildfire Front: Stay ahead of the flames.";
  }

  getScaledMission(baseMission) {
    const scaledMission = JSON.parse(JSON.stringify(baseMission));
    
    // Respect randomizeWind flag from mission; if not set, use windAngle from mission definition
    if (scaledMission.weather?.randomizeWind) {
      scaledMission.weather.windAngle = Math.floor(Math.random() * 8) * (Math.PI / 4);
    }
    return scaledMission;
  }

  getStartingMoney(missionStartMoney) {
    return this.currentMoney;
  }

  onLevelComplete(finalMoney) {
    this.currentMoney = finalMoney;
  }

  progressDay() {
    // Wildfire Front is a single mission; just restart.
  }

  reset() {
    this.currentMoney = 0;
  }

  shouldRandomizeWind() {
    return true;
  }

  shouldShowFireControl() {
    return false;
  }
}
