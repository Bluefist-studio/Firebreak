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

    // Randomize wind direction if enabled (8 cardinal directions: 360/8 = 45° increments)
    if (scaledMission.weather?.randomizeWind) {
      scaledMission.weather.windAngle = Math.floor(Math.random() * 8) * (Math.PI / 4);
    }
    // Apply additional difficulty scaling on continues (skip on day 0)
    if (this.currentDay > 0) {
      const dayMultiplier = this.currentDay;

      // Increase temperature
      scaledMission.weather.temperature += dayMultiplier * 0.5;

      // Decrease humidity
      scaledMission.weather.humidity = Math.max(10, scaledMission.weather.humidity - dayMultiplier * 1);
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
