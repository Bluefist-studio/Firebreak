export class ScreenManager {
  constructor({ screens, initial }) {
    this.screens = screens;
    this.current = null;

    this._transition = {
      active: false,
      from: null,
      to: null,
      timer: 0,
      duration: 0.35, // seconds
    };

    this.goTo(initial);
  }

  goTo(name, payload) {
    if (this._transition.active) {
      // If a transition is already in progress, finish it immediately and start a new one.
      this._completeTransition();
    }

    const next = this.screens[name];
    if (!next) throw new Error(`Unknown screen: ${name}`);

    const prev = this.current;
    if (prev?.onExit) prev.onExit();

    this.current = next;
    if (this.current.onEnter) this.current.onEnter(payload);

    this._transition = {
      active: true,
      from: prev,
      to: next,
      timer: 0,
      duration: 0.35,
    };
  }

  _completeTransition() {
    if (!this._transition.active) return;
    this._transition.active = false;
    this._transition.from = null;
    this._transition.to = null;
    this._transition.timer = 0;
  }

  update(dt) {
    if (this._transition.active) {
      this._transition.timer += dt;
      if (this._transition.timer >= this._transition.duration) {
        this._completeTransition();
      }
    }

    this.current?.update?.(dt);
  }

  render(ctx) {
    if (this._transition.active && this._transition.from) {
      const t = Math.min(1, Math.max(0, this._transition.timer / this._transition.duration));

      ctx.save();
      ctx.globalAlpha = 1 - t;
      this._transition.from.render(ctx);
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = t;
      this._transition.to?.render(ctx);
      ctx.restore();

      return;
    }

    this.current?.render?.(ctx);
  }

  handlePointerDown(x, y, evt) {
    this.current?.handlePointerDown?.(x, y, evt);
  }

  handlePointerMove(x, y, evt) {
    this.current?.handlePointerMove?.(x, y, evt);
  }

  handlePointerUp(x, y, evt) {
    this.current?.handlePointerUp?.(evt);
  }

  handleKeyDown(evt) {
    this.current?.handleKeyDown?.(evt);
  }

  handleKeyUp(evt) {
    this.current?.handleKeyUp?.(evt);
  }
}
