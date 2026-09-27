/**
 * MusicManager — handles background music tracks with crossfade transitions.
 * menu_music.mp3 : title, menu, base, premission, levelComplete, regionmap
 * mission_music.mp3 : play (active gameplay)
 *
 * Audio is started on the first user gesture to satisfy browser autoplay policy.
 */
export class MusicManager {
  constructor({ menuSrc = "./Media/menu_music.mp3", missionSrc = "./Media/mission_music.mp3", volume = 0.5, fadeDuration = 2.0 } = {}) {
    this._targetVolume = volume;
    this._fadeDuration = fadeDuration; // seconds

    this._menu = new Audio(menuSrc);
    this._menu.loop = true;
    this._menu.volume = 0;

    this._mission = new Audio(missionSrc);
    this._mission.loop = true;
    this._mission.volume = 0;

    this._current = null;
    this._unlocked = false;

    // Active fade state: { out: Audio|null, in: Audio, elapsed: number }
    this._fade = null;

    // Unlock audio on first user gesture anywhere on the page
    const unlock = () => {
      if (this._unlocked) return;
      this._unlocked = true;
      // If the current track was blocked and is still paused, start it now.
      // Don't force volume — a fade may already be managing it.
      if (this._current && this._current.paused) {
        this._current.play().catch(() => {});
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
  }

  /** Call with the screen name whenever a screen transition occurs. */
  onScreenChange(screenName) {
    const next = (screenName === "play" || screenName === "title") ? this._mission : this._menu;

    if (next === this._current && !this._current.paused) return; // already playing

    const outgoing = this._current;
    this._current = next;

    // Always attempt play immediately — the browser will allow it if autoplay is
    // permitted (e.g. local file / trusted origin). If blocked, the unlock handler
    // picks it up on the first user gesture.
    next.volume = outgoing ? 0 : this._targetVolume;
    next.play().catch(() => {});

    if (outgoing) {
      this._fade = { out: outgoing, in: next, elapsed: 0 };
    }
  }

  /** Drive fade interpolation — call this from the game loop every frame. */
  update(dt) {
    if (!this._fade) return;

    this._fade.elapsed += dt;
    const t = Math.min(1, this._fade.elapsed / this._fadeDuration);

    if (this._fade.out) {
      this._fade.out.volume = this._targetVolume * (1 - t);
    }
    this._fade.in.volume = this._targetVolume * t;

    if (t >= 1) {
      // Fade complete — silence and pause the outgoing track
      if (this._fade.out) {
        this._fade.out.pause();
        this._fade.out.currentTime = 0;
        this._fade.out.volume = 0;
      }
      this._fade.in.volume = this._targetVolume;
      this._fade = null;
    }
  }

  /** Pause all music (e.g. tab is hidden). */
  pause() {
    this._current?.pause();
  }

  /** Resume current track. */
  resume() {
    if (this._unlocked && this._current?.paused) {
      this._current.play().catch(() => {});
    }
  }

  get volume() {
    return this._targetVolume;
  }

  set volume(v) {
    this._targetVolume = v;
    // Only update live volume if not mid-fade
    if (!this._fade) {
      if (this._current) this._current.volume = v;
    }
  }
}
