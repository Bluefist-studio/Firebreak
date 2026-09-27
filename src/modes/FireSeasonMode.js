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
    this.currentDay = 1;
    this.currentMoney = 0;
    this.seasonRewardsTotal = 0;
    this.seasonFoodWear = 0;
    this.seasonFuelConsumed = 0;
    this.seasonRetardantConsumed = 0;
  }

  /**
   * Initialize fire season for a new session
   */
  initializeNewSession(missionStartMoney) {
    this.currentDay = 1;
    this.currentMoney = missionStartMoney;
    this.seasonRewardsTotal = 0;
    this.seasonFoodWear = 0;
    this.seasonFuelConsumed = 0;
    this.seasonRetardantConsumed = 0;
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
   * Get difficulty-scaled mission for current day.
   * Always reconstructs from the base mission so values accumulate correctly.
   */
  getScaledMission(baseMission) {
    const scaledMission = JSON.parse(JSON.stringify(baseMission));

    // Randomize wind direction (8 cardinal directions)
    if (scaledMission.weather?.randomizeWind) {
      scaledMission.weather.windAngle = Math.floor(Math.random() * 8) * (Math.PI / 4);
    }

    const day = this.currentDay;
    if (day <= 1) return scaledMission;

    const daysElapsed = day - 1;

    // These worsen every single day — scale linearly with daysElapsed
    if (scaledMission.fireBuildup) {
      scaledMission.fireBuildup.buildupDuration = Math.max(1,
        scaledMission.fireBuildup.buildupDuration + daysElapsed * 0.5);
      scaledMission.fireBuildup.treeThreshold =
        (scaledMission.fireBuildup.treeThreshold || 100) + daysElapsed * 50;
    }
    scaledMission.failBurnPercent = Math.max(4,
      (scaledMission.failBurnPercent || 10)); // - daysElapsed * 0.25);

    // Rotating cycle: one property changes per day, looping every 5 days.
    // Loop from day 2 up to currentDay to accumulate all past changes.
    for (let d = 2; d <= day; d++) {
      const slot = (d - 2) % 5;
      if (slot === 0) {
        // +1 ignition point every 5 days (cap 3)
        scaledMission.fireStartCount = Math.min(3, (scaledMission.fireStartCount || 1) + 1);
      } else if (slot === 1) {
        // Wind picks up
        scaledMission.weather.windStrength = Math.min(90, scaledMission.weather.windStrength + 10);
      } else if (slot === 2) {
        // Temperature rises
        scaledMission.weather.temperature = Math.min(50, scaledMission.weather.temperature + 1);
      } else if (slot === 3) {
        // Air dries out
        scaledMission.weather.airHumidity = Math.max(10, scaledMission.weather.airHumidity - 5);
      } else if (slot === 4) {
        // Fuel moisture drops
        scaledMission.weather.fuelHumidity = Math.max(10, scaledMission.weather.fuelHumidity - 5);
      }
    }

    // Build fire start config: 1st fire at map center, extras at random unique quadrants
    {
      const count = Math.min(3, scaledMission.fireStartCount || 1);
      const entries = [{ quadrant: "NW", cornerOffset: 1, radius: 25 }]; // cornerOffset:1 = map center
      if (count > 1) {
        const quads = ["NW", "NE", "SW", "SE"].sort(() => Math.random() - 0.5);
        for (let i = 0; i < count - 1; i++) {
          entries.push({ quadrant: quads[i], radius: 25 });
        }
      }
      scaledMission.fireStartCount = count;
      scaledMission.fireStartPattern = "quadrant";
      scaledMission.fireStartQuadrants = entries;
    }

    return scaledMission;
  }

  /**
   * Get starting money for this day (persisted from previous day or mission start)
   */
  getStartingMoney(missionStartMoney) {
    return this.currentDay === 1 ? missionStartMoney : this.currentMoney;
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

  getDayReward() {
    return 3500 + 500 * this.currentDay;
  }

  addDayReward(amount) {
    if (amount > 0) this.seasonRewardsTotal += amount;
  }

  addDayResources(foodWear, fuelConsumed, retardantConsumed) {
    this.seasonFoodWear += foodWear;
    this.seasonFuelConsumed += fuelConsumed;
    this.seasonRetardantConsumed += retardantConsumed;
  }

  /**
   * Returns a preview of the scaled mission for the next day without advancing the day counter.
   */
  getNextDayMission(baseMission) {
    this.currentDay++;
    const next = this.getScaledMission(baseMission);
    this.currentDay--;
    return next;
  }

  /**
   * Reset to initial state (return to menu)
   */
  reset() {
    this.currentDay = 1;
    this.currentMoney = 0;
    this.seasonRewardsTotal = 0;
    this.seasonFoodWear = 0;
    this.seasonFuelConsumed = 0;
    this.seasonRetardantConsumed = 0;
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
