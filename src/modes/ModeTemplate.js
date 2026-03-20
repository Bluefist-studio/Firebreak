import { BaseMode } from "./BaseMode.js";

/**
 * ModeTemplate
 * 
 * Copy this file to create a new game mode.
 * Change the class name and override only the methods you need.
 * Uncomment/modify methods based on your mode's behavior.
 * 
 * Fire Pattern Options (set in missions.js):
 * - "center": All fires spawn at center of play area
 * - "quadrant": Fires spawn in specified fireStartQuadrants (1 per quadrant)
 * - "random quadrant": Fires spawn in a single randomly selected quadrant
 * - "random": Fires spawn randomly across entire play area
 * 
 * Steps to create a new mode:
 * 1. Copy this file to YourNewMode.js
 * 2. Change the class name
 * 3. Update the JSDoc comment with description
 * 4. Override methods as needed
 * 5. Register in main.js (import, create instance, add to selector, add mission)
 * 6. Add mission configuration to src/data/missions.js with fire parameters
 */
export class ModeTemplate extends BaseMode {
  constructor() {
    super();
    // Initialize mode-specific state here
    // Example: this.currentDay = 0;
    // Example: this.currentMoney = 0;
  }

  /**
   * Initialize a new session for this mode
   * Called when entering the mode before first mission
   */
  initializeNewSession(missionStartMoney) {
    // Initialize/reset mode state
  }

  /**
   * Get announcement text for the current session
   * This text is displayed at the start of each level
   */
  getAnnouncementText(isFirstRun) {
    if (isFirstRun) {
      return "Mode starts.";
    }
    return "Continue the mission.";
  }

  /**
   * Optionally scale/modify mission difficulty
   * Called before creating GameState
   * Examples:
   * - Randomize wind based on randomizeWind flag
   * - Increase difficulty over time
   * - Modify fire counts
   */
  getScaledMission(baseMission) {
    const scaledMission = JSON.parse(JSON.stringify(baseMission));
    
    // Respect randomizeWind flag from mission; if enabled, randomize wind direction
    if (scaledMission.weather?.randomizeWind) {
      scaledMission.weather.windAngle = Math.floor(Math.random() * 8) * (Math.PI / 4);
    }
    
    return scaledMission;
  }

  /**
   * Get starting money for current session
   * Allows persistence of money between levels
   */
  getStartingMoney(missionStartMoney) {
    return missionStartMoney;
  }

  /**
   * Called when player completes a level successfully
   */
  onLevelComplete(finalMoney) {
  }

  /**
   * Called when player chooses to continue/retry
   * Move to next day/level or restart
   */
  progressDay() {
  }

  /**
   * Reset the mode to initial state
   * Called when returning to menu
   */
  reset() {
  }

  /**
   * Whether to show the Fire Control modal in the UI
   * Override to return true if your mode should allow fire control adjustments
   */
  shouldShowFireControl() {
    return false;
  }

  /**
   * Whether wind should be randomized each mission
   * Override to return false if your mode should use consistent weather
   */
  shouldRandomizeWind() {
    return true;
  }

  // NOTE: Fire initialization is automatic via BaseMode.initializeFires()
  // It respects mission.fireStartCount, mission.fireStartPattern, and mission.fireStartQuadrants
  // You do not need to override it unless you want custom fire spawning behavior
}
