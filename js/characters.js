/**
 * Per-character fine-tuning scale configuration table
 * Allows independent scale adjustments for sitting, standing (selection/idle), running, and celebration.
 */
const CHARACTER_SCALES = {
  saya: {
    sitting: 1.00,
    standing: 1.10, // Enlarged by +10% (additional +5%)
    running: 1.00,
    celebration: 1.00
  },
  sheath: {
    sitting: 1.00,
    standing: 1.10, // Enlarged by 10% for selected standing state
    running: 1.00,
    celebration: 1.00
  },
  hiiragi: {
    sitting: 1.00,
    standing: 1.05, // Enlarged by 5% for selected standing state
    running: 1.00,
    celebration: 1.00
  }
};

class CharacterManager {
  constructor() {
    this.charIds = ['saya', 'sheath', 'hiiragi'];
    this.characters = {};
    this.imgLoaded = false;
  }

  async load() {
    try {
      const loadPromises = this.charIds.map(id => this.loadCharacter(id));
      await Promise.all(loadPromises);
      this.imgLoaded = true;
      console.log('Character assets loaded successfully');
    } catch (err) {
      console.error('Error loading character assets:', err);
    }
  }

  async loadCharacter(id) {
    const basePath = `assets/charecter/${id}`;
    
    let config = {};
    try {
      const res = await fetch(`${basePath}/character.json`);
      if (res.ok) config = await res.json();
    } catch (e) {
      console.warn(`Could not load character.json for ${id}`, e);
    }

    const states = {};

    // Load sitting image (static frame)
    const sittingImg = await this.loadImage(`${basePath}/sitting.png`);
    states['sitting'] = { image: sittingImg, json: null, totalDur: 0 };

    // Load animated states (metadata + sprite sheet PNG)
    const animStateNames = ['idle', 'idle_blink', 'running', 'celebration'];
    for (const name of animStateNames) {
      try {
        let json = null;
        const jsonRes = await fetch(`${basePath}/${name}.json`);
        if (jsonRes.ok) {
          json = await jsonRes.json();
        }
        const img = await this.loadImage(`${basePath}/${name}.png`);
        const totalDur = (json && json.durationsMs) ? json.durationsMs.reduce((a, b) => a + b, 0) : 1000;
        states[name] = { json, image: img, totalDur };
      } catch (e) {
        console.warn(`Failed to load state ${name} for ${id}`, e);
      }
    }

    // Load stroll sprite sheets (2048 x 512, 4 frames of 512 x 512)
    const strollL = await this.loadImage(`assets/charecter/stroll/${id}/stroll_l.png`);
    const strollR = await this.loadImage(`assets/charecter/stroll/${id}/stroll_r.png`);
    const strollIdle = await this.loadImage(`assets/charecter/stroll/${id}/stroll_idle.png`);
    states['stroll_l'] = { image: strollL };
    states['stroll_r'] = { image: strollR };
    states['stroll_idle'] = { image: strollIdle };

    this.characters[id] = { config, states };
  }

  loadImage(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  /**
   * Draw state frame based on requested character, state name, timestamp and coordinates
   */
  drawStateFrame(ctx, charIndexOrId, stateName, timeMs, x, y, width, height, bounceOffset = 0, tiltAngle = 0) {
    if (!this.imgLoaded) return;

    const charId = (typeof charIndexOrId === 'number') ? this.charIds[charIndexOrId] : charIndexOrId;
    const charData = this.characters[charId];
    if (!charData) return;

    const scales = CHARACTER_SCALES[charId] || {};
    let customScale = 1.0;
    if (stateName === 'sitting') {
      customScale = scales.sitting || 1.0;
    } else if (stateName === 'selection_loop' || stateName === 'idle' || stateName === 'idle_blink') {
      customScale = scales.standing || 1.0;
    } else if (stateName === 'running') {
      customScale = scales.running || 1.0;
    } else if (stateName === 'celebration') {
      customScale = scales.celebration || 1.0;
    }

    let scaleMult = customScale;
    if (stateName === 'idle' || stateName === 'idle_blink') {
      scaleMult *= 1.08;
    }

    const drawW = width * scaleMult;
    const drawH = height * scaleMult;

    ctx.save();
    ctx.translate(x, y + bounceOffset);
    if (tiltAngle !== 0) ctx.rotate(tiltAngle);

    if (stateName === 'sitting') {
      const sData = charData.states['sitting'];
      if (sData && sData.image) {
        ctx.drawImage(sData.image, 0, 0, sData.image.width, sData.image.height, -drawW / 2, -drawH, drawW, drawH);
      }
    } else if (stateName === 'selection_loop') {
      const idleData = charData.states['idle'];
      const blinkData = charData.states['idle_blink'];

      const idleDur = (idleData && idleData.totalDur) ? idleData.totalDur : 1000;
      const blinkDur = (blinkData && blinkData.totalDur) ? blinkData.totalDur : 1000;

      const idlePhaseDur = idleDur * 3;
      const totalCycleDur = idlePhaseDur + blinkDur;
      const posInCycle = timeMs % totalCycleDur;

      if (posInCycle < idlePhaseDur) {
        this.renderStateObj(ctx, idleData, posInCycle % idleDur, drawW, drawH);
      } else {
        this.renderStateObj(ctx, blinkData, posInCycle - idlePhaseDur, drawW, drawH);
      }
    } else if (stateName === 'celebration') {
      const cData = charData.states['celebration'];
      if (cData && cData.json) {
        const animDur = cData.totalDur || 2000;
        const pauseDur = 2000;
        const totalCycle = animDur + pauseDur;
        const posInCycle = timeMs % totalCycle;

        const timeInAnim = Math.min(posInCycle, animDur - 1);
        this.renderStateObj(ctx, cData, timeInAnim, drawW, drawH, true);
      } else if (cData) {
        this.renderStateObj(ctx, cData, timeMs, drawW, drawH);
      }
    } else {
      const sData = charData.states[stateName];
      if (sData) {
        this.renderStateObj(ctx, sData, timeMs, drawW, drawH);
      }
    }

    ctx.restore();
  }

  renderStateObj(ctx, stateObj, timeMs, width, height, forceNoLoop = false) {
    if (!stateObj || !stateObj.image) return;
    const img = stateObj.image;
    const json = stateObj.json;

    if (!json || !json.frames || json.frames.length === 0) {
      ctx.drawImage(img, 0, 0, img.width, img.height, -width / 2, -height, width, height);
      return;
    }

    const totalDur = stateObj.totalDur || 1000;
    const loopTime = (json.loop !== false && !forceNoLoop) ? (timeMs % totalDur) : Math.min(timeMs, totalDur - 1);

    let frame = json.frames[0];
    let accum = 0;
    const numFrames = json.frames.length;
    for (let i = 0; i < numFrames; i++) {
      const dur = (json.durationsMs && json.durationsMs[i]) || (totalDur / numFrames);
      accum += dur;
      if (loopTime < accum) {
        frame = json.frames[i];
        break;
      }
    }

    const rect = frame.rect || [0, 0, json.frameWidth || 512, json.frameHeight || 512];
    ctx.drawImage(img, rect[0], rect[1], rect[2], rect[3], -width / 2, -height, width, height);
  }

  /**
   * Draw stroll sprite sheet frame for background strolling characters
   * - Slow chunky frame rate: 250ms per frame (4 frames per cycle)
   * - dir: 'l' (facing/walking left) or 'r' (facing/walking right)
   */
  drawStrollFrame(ctx, charIndexOrId, dir, timeMs, x, y, width, height) {
    if (!this.imgLoaded) return;
    const charId = (typeof charIndexOrId === 'number') ? this.charIds[charIndexOrId] : charIndexOrId;
    const charData = this.characters[charId];
    if (!charData) return;

    let stateKey = 'stroll_idle';
    if (dir === 'l') stateKey = 'stroll_l';
    else if (dir === 'r') stateKey = 'stroll_r';

    const sData = charData.states[stateKey] || charData.states['stroll_idle'];
    if (!sData || !sData.image) return;

    const img = sData.image;
    // Slow chunky step rate requested by user: 250ms per frame
    const frameIdx = Math.floor((timeMs / 250) % 4);
    const frameW = 512;
    const frameH = 512;

    ctx.save();
    ctx.translate(x, y);

    // Unified Ground Shadow
    this.drawUnifiedGroundShadow(ctx, 0, 2, width, 0);

    // Render 512x512 sprite frame
    ctx.drawImage(img, frameIdx * frameW, 0, frameW, frameH, -width / 2, -height, width, height);
    ctx.restore();
  }

  /**
   * Unified Ground Shadow Renderer for all characters (running & strolling)
   */
  drawUnifiedGroundShadow(ctx, x, y, spriteWidth, bounceOffset = 0) {
    const shadowW = Math.max(35, spriteWidth * 0.18 + bounceOffset * 0.8);
    const shadowH = Math.max(8, spriteWidth * 0.04);
    const shadowAlpha = Math.max(0.12, 0.22 + bounceOffset * 0.008);

    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, shadowW, shadowH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

const charMgr = new CharacterManager();
