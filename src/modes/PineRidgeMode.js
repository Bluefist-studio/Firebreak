import { BaseMode } from "./BaseMode.js";

/**
 * PineRidgeMode
 * A focused mission mode for Pine Ridge.
 *
 * This mode provides a consistent single-mission experience with
 * an optional announcement and persistent money across retries.
 */
export class PineRidgeMode extends BaseMode {
  constructor() {
    super();
    this.currentMoney = 0;
  }

  initializeNewSession(missionStartMoney) {
    this.currentMoney = missionStartMoney;
  }

  getAnnouncementText(isFirstRun) {
    return "Pine Ridge: Keep the fire contained.";
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
    // Pine Ridge is a single mission; just restart with current money.
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
