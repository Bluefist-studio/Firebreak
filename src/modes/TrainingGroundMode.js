import { BaseMode } from "./BaseMode.js";

/**
 * TrainingGroundMode
 * A simple single-level training mode with:
 * - No day progression or difficulty scaling
 * - No money persistence between runs
 * - Full access to fire control modal for learning
 * - Clean, simple level reset on completion
 */
export class TrainingGroundMode extends BaseMode {
  constructor() {
    super();
    this.completed = false;
  }

  /**
   * Initialize training ground session
   */
  initializeNewSession(missionStartMoney) {
    this.completed = false;
  }

  /**
   * Get announcement text for training mode
   */
  getAnnouncementText(isFirstRun) {
    return "Training Grounds";
  }

  /**
   * Get scaled mission (no scaling for training ground)
   */
  getScaledMission(baseMission) {
    const scaledMission = JSON.parse(JSON.stringify(baseMission));
    
    // Respect randomizeWind flag from mission; if not set, use windAngle from mission definition
    if (scaledMission.weather?.randomizeWind) {
      scaledMission.weather.windAngle = Math.floor(Math.random() * 8) * (Math.PI / 4);
    }
    return scaledMission;
  }

  /**
   * Get starting money (always fresh start)
   */
  getStartingMoney(missionStartMoney) {
    return missionStartMoney;
  }

  /**
   * Mark training ground as completed
   */
  onLevelComplete(finalMoney) {
    this.completed = true;
  }

  /**
   * Continue training (fresh start)
   */
  progressDay() {
    // Training ground doesn't support progression, stays on same level
  }

  /**
   * Reset training ground
   */
  reset() {
    this.completed = false;
  }

  /**
   * Whether the Fire Control modal should be visible.
   * Training mode shows it for learning purposes.
   */
  shouldShowFireControl() {
    return true;
  }

  /**
   * Check if wind should be randomized
   */
  shouldRandomizeWind() {
    return true;
  }
}

