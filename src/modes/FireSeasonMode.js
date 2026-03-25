import { BaseMode } from "./BaseMode.js";

/**
 * FireSeasonMode
 * Encapsulates all fire season-specific logic including:
 * - Day progression and difficulty scaling
 * - Money persistence between days
 * - Wind randomization (8 cardinal directions)
 * - Announcements
 * - Level complete handling
 */
export class FireSeasonMode extends BaseMode {
  constructor() {
    super();
    this.currentDay = 0;
    this.currentMoney = 0;
  }

  /**
   * Initialize fire season for a new session
   */
  initializeNewSession(missionStartMoney) {
    this.currentDay = 0;
    this.currentMoney = missionStartMoney;
  }

  /**
   * Get announcement text for this day
   */
  getAnnouncementText(isFirstRun) {
    if (isFirstRun) {
      return "Fire Season starts.";
    }
    return `Day ${this.currentDay} of fire season.`;
  }

  /**
   * Get difficulty-scaled mission for current day
   */
  getScaledMission(baseMission) {
    const scaledMission = JSON.parse(JSON.stringify(baseMission));

    // Randomize wind direction (8 cardinal directions)
    if (scaledMission.weather?.randomizeWind) {
      scaledMission.weather.windAngle = Math.floor(Math.random() * 8) * (Math.PI / 4);
    }

    const day = this.currentDay;

    if (day > 0) {
      // These two worsen every single day
      if (scaledMission.fireBuildup) {
        scaledMission.fireBuildup.buildupDuration = Math.max(0.5, scaledMission.fireBuildup.buildupDuration - 0.1);
      }
      scaledMission.failBurnPercent = Math.max(4, (scaledMission.failBurnPercent || 10) - 0.25);

      // The remaining properties rotate — one changes per day (5-step cycle)
      const slot = (day - 1) % 5;

      if (slot === 0) {
        // Big impact — one more ignition point every 5 days
        scaledMission.fireStartCount = Math.min(5, (scaledMission.fireStartCount || 1) + 1);
      } else if (slot === 1) {
        // Huge impact — wind picks up
        scaledMission.weather.windStrength = Math.min(90, scaledMission.weather.windStrength + 2);
      } else if (slot === 2) {
        // Huge impact — temperature rises
        scaledMission.weather.temperature = Math.min(50, scaledMission.weather.temperature + 0.5);
      } else if (slot === 3) {
        // Huge impact — air dries out
        scaledMission.weather.airHumidity = Math.max(10, scaledMission.weather.airHumidity - 1);
      } else if (slot === 4) {
        // Biggest impact — fuel moisture drops
        scaledMission.weather.fuelHumidity = Math.max(10, scaledMission.weather.fuelHumidity - 1);
      }
    }

    return scaledMission;
  }

  /**
   * Get starting money for this day (persisted from previous day or mission start)
   */
  getStartingMoney(missionStartMoney) {
    return this.currentDay === 0 ? missionStartMoney : this.currentMoney;
  }

  /**
   * Update money after level completion
   */
  onLevelComplete(finalMoney) {
    this.currentMoney = finalMoney;
  }

  /**
   * Progress to next day
   */
  progressDay() {
    this.currentDay++;
  }

  /**
   * Reset to initial state (return to menu)
   */
  reset() {
    this.currentDay = 0;
    this.currentMoney = 0;
  }

  /**
   * Whether the Fire Control modal should be visible.
   * Fire Season mode hides it to keep focus on gameplay.
   */
  shouldShowFireControl() {
    return false;
  }

  /**
   * Check if wind should be randomized (fire season always randomizes)
   */
  shouldRandomizeWind() {
    return true;
  }
}
