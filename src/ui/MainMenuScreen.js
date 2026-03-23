import { EconomyState } from "../core/EconomyState.js";

export class MainMenuScreen {
  constructor({ backgroundImage, onNavigate, onNewGame, onSettings, buttonStyle = {}, confirmStyle = {}, layoutConfig = {} }) {
    this.backgroundImage = backgroundImage;
    this.onNavigate = onNavigate;
    this.onNewGame = onNewGame;
    this.onSettings = onSettings;

    // Visual style for the main buttons — override any of these in main.js
    this.buttonStyle = {
      glowColor:        buttonStyle.glowColor        ?? "rgba(255, 140, 0, 0)",
      glowColorHover:   buttonStyle.glowColorHover   ?? "rgba(253, 255, 239, 0.24)",
      fillColor:        buttonStyle.fillColor        ?? "rgba(0, 0, 0, 0)",
      fillColorHover:   buttonStyle.fillColorHover   ?? "rgba(0, 0, 0, 0)",
      strokeColor:      buttonStyle.strokeColor      ?? "rgba(16, 16, 16, 0)",
      textColor:        buttonStyle.textColor        ?? "rgba(16, 16, 16, 0.0)",
      font:             buttonStyle.font             ?? "24px Arial",
      borderRadius:     buttonStyle.borderRadius     ?? 12,
    };

    // Separate style for the Yes/No confirm modal buttons
    const cs = confirmStyle;
    this.confirmStyle = {
      glowColor:        cs.glowColor        ?? "rgba(255, 140, 0, 0)",
      glowColorHover:   cs.glowColorHover   ?? "rgba(255, 120, 0, 0.45)",
      fillColor:        cs.fillColor        ?? "rgba(0, 0, 0, 0.35)",
      fillColorHover:   cs.fillColorHover   ?? "rgba(0, 0, 0, 0.55)",
      strokeColor:      cs.strokeColor      ?? "rgba(180, 180, 180, 0.6)",
      textColor:        cs.textColor        ?? "white",
      font:             cs.font             ?? "18px Arial",
      borderRadius:     cs.borderRadius     ?? 10,
    };

    // Layout config — positions and sizes as fractions of canvas (0.0–1.0) or px
    // anchorX / anchorY are fractions of canvas size for the button group origin.
    // e.g. anchorX: 0.5 centers horizontally, anchorY: 0.25 places near top.
    this.layoutConfig = {
      anchorX:              layoutConfig.anchorX              ?? 0.11,   // left edge of button group (fraction of canvas width)
      anchorY:              layoutConfig.anchorY              ?? 0.72,   // top edge of first button (fraction of canvas height)
      buttonWidth:          layoutConfig.buttonWidth          ?? 320,    // default logical px (scaled with canvas)
      continueButtonWidth:  layoutConfig.continueButtonWidth  ?? null,   // override for Continue button
      newGameButtonWidth:   layoutConfig.newGameButtonWidth   ?? null,   // override for New Game button
      settingsButtonWidth:  layoutConfig.settingsButtonWidth  ?? 340,   // override for Settings button
      buttonHeight:         layoutConfig.buttonHeight         ?? 141,    // logical px (scaled with canvas)
      gap:                  layoutConfig.gap                  ?? 7,      // gap between buttons, logical px
    };

    this.hoveredButton = null; // "continue" | "newGame" | "settings" | "confirmYes" | "confirmNo"
    this.showConfirm = false;  // New-game overwrite warning modal
  }

  update() {}

  // ── Layout helpers (derive positions from canvas size) ──

  _getLayout(ctx) {
    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;
    const scale = Math.min(cw / 1280, ch / 720, 2);
    const lc = this.layoutConfig;
    const w = Math.max(80, Math.round(lc.buttonWidth  * scale));
    const h = Math.max(24, Math.round(lc.buttonHeight * scale));
    const gap = Math.round(lc.gap * scale);
    const groupCenterX = Math.round(cw * lc.anchorX);
    const baseY   = Math.round(ch * lc.anchorY);
    const hasSave = EconomyState.hasSavedGame();

    return { cw, ch, scale, w, h, gap, groupCenterX, baseY, hasSave };
  }

  _getButtonRects(layout) {
    const { h, gap, groupCenterX, baseY, hasSave, scale } = layout;
    const lc = this.layoutConfig;
    
    // Helper to get individual button width or fall back to default
    const getButtonWidth = (widthKey) => {
      const val = lc[widthKey];
      return val !== null && val !== undefined ? Math.max(80, Math.round(val * scale)) : Math.max(80, Math.round(lc.buttonWidth * scale));
    };
    
    const continueW = getButtonWidth('continueButtonWidth');
    const newGameW = getButtonWidth('newGameButtonWidth');
    const settingsW = getButtonWidth('settingsButtonWidth');
    
    const rects = {};
    const startX = groupCenterX; // groupCenterX is now the left edge
    
    // Always show all 3 buttons — Continue starts new game if no save exists
    rects.continue = { x: startX,                              y: baseY, w: continueW, h };
    rects.newGame  = { x: startX + continueW + gap,             y: baseY, w: newGameW,  h };
    rects.settings = { x: startX + continueW + newGameW + gap * 2, y: baseY, w: settingsW, h };
    return rects;
  }

  _getConfirmRects(layout) {
    const { cw, ch, scale } = layout;
    const boxW = Math.round(420 * scale);
    const boxH = Math.round(180 * scale);
    const bx = cw / 2 - boxW / 2;
    const by = ch / 2 - boxH / 2;
    const btnW = Math.round(100 * scale);
    const btnH = Math.round(40 * scale);
    const btnGap = Math.round(24 * scale);
    const btnY = by + boxH - btnH - Math.round(20 * scale);
    const yesX = cw / 2 - btnW - btnGap / 2;
    const noX = cw / 2 + btnGap / 2;
    return {
      box: { x: bx, y: by, w: boxW, h: boxH },
      yes: { x: yesX, y: btnY, w: btnW, h: btnH },
      no:  { x: noX,  y: btnY, w: btnW, h: btnH },
    };
  }

  // ── Render ──

  render(ctx) {
    if (this.backgroundImage && this.backgroundImage.complete && this.backgroundImage.naturalWidth) {
      ctx.drawImage(this.backgroundImage, 0, 0, ctx.canvas.width, ctx.canvas.height);
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    const layout = this._getLayout(ctx);
    const btns = this._getButtonRects(layout);

    this._drawButton(ctx, btns.continue, "Continue", this.hoveredButton === "continue");
    this._drawButton(ctx, btns.newGame,  "New Game",  this.hoveredButton === "newGame");
    this._drawButton(ctx, btns.settings, "Settings",  this.hoveredButton === "settings");

    if (this.showConfirm) {
      this._drawConfirmModal(ctx, layout);
    }
  }

  _drawButton(ctx, r, label, isHovered, style) {
    const s = style ?? this.buttonStyle;

    // Glow
    ctx.save();
    ctx.filter = "blur(8px)";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(16, 16, 16, 0.8)";
    ctx.fillStyle = isHovered ? s.glowColorHover : s.glowColor;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, s.borderRadius + 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Button body
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = s.strokeColor;
    ctx.fillStyle = isHovered ? s.fillColorHover : s.fillColor;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, s.borderRadius);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = s.textColor;
    ctx.font = s.font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
  }

  _drawConfirmModal(ctx, layout) {
    const cr = this._getConfirmRects(layout);
    const { box } = cr;

    // Dim background
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, layout.cw, layout.ch);

    // Modal box
    ctx.save();
    ctx.fillStyle = "rgba(20, 20, 20, 0.92)";
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.w, box.h, 14);
    ctx.fill();
    ctx.strokeStyle = "#fa0";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Warning text
    ctx.fillStyle = "#fa0";
    ctx.font = "bold 20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Start New Game?", box.x + box.w / 2, box.y + Math.round(box.h * 0.25));

    ctx.fillStyle = "#ccc";
    ctx.font = "16px Arial";
    ctx.fillText("This will overwrite your current save.", box.x + box.w / 2, box.y + Math.round(box.h * 0.45));

    // Yes / No buttons
    this._drawButton(ctx, cr.yes, "Yes", this.hoveredButton === "confirmYes", this.confirmStyle);
    this._drawButton(ctx, cr.no,  "No",  this.hoveredButton === "confirmNo",  this.confirmStyle);
  }

  // ── Input ──

  handlePointerDown(x, y, evt) {
    const canvas = evt?.target;
    const width = canvas?.width ?? 1280;
    const height = canvas?.height ?? 720;
    const fakeCtx = { canvas: { width, height } };
    const layout = this._getLayout(fakeCtx);

    if (this.showConfirm) {
      const cr = this._getConfirmRects(layout);
      if (this._hit(x, y, cr.yes)) {
        this.showConfirm = false;
        this.onNewGame?.();
      } else if (this._hit(x, y, cr.no)) {
        this.showConfirm = false;
      }
      return;
    }

    const btns = this._getButtonRects(layout);
    if (this._hit(x, y, btns.continue)) {
      if (layout.hasSave) {
        this.onNavigate?.("base");
      } else {
        this.onNewGame?.();
      }
    } else if (this._hit(x, y, btns.newGame)) {
      if (layout.hasSave) {
        this.showConfirm = true;
      } else {
        this.onNewGame?.();
      }
    } else if (this._hit(x, y, btns.settings)) {
      this.onSettings?.();
    }
  }

  handlePointerMove(x, y, evt) {
    const canvas = evt?.target;
    const width = canvas?.width ?? 1280;
    const height = canvas?.height ?? 720;
    const fakeCtx = { canvas: { width, height } };
    const layout = this._getLayout(fakeCtx);

    this.hoveredButton = null;

    if (this.showConfirm) {
      const cr = this._getConfirmRects(layout);
      if (this._hit(x, y, cr.yes)) this.hoveredButton = "confirmYes";
      else if (this._hit(x, y, cr.no)) this.hoveredButton = "confirmNo";
      return;
    }

    const btns = this._getButtonRects(layout);
    if (this._hit(x, y, btns.continue)) {
      this.hoveredButton = "continue";
    } else if (this._hit(x, y, btns.newGame)) {
      this.hoveredButton = "newGame";
    } else if (this._hit(x, y, btns.settings)) {
      this.hoveredButton = "settings";
    }
  }

  handleKeyDown(evt) {
    if (this.showConfirm) {
      if (evt.key === "Escape") this.showConfirm = false;
      return;
    }
    if (evt.key === "Enter") {
      if (EconomyState.hasSavedGame()) {
        this.onNavigate?.("base");
      } else {
        this.onNewGame?.();
      }
    }
  }

  _hit(x, y, r) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
}
