/**
 * Stage Renderer & Canvas Animation Engine Module (Fixed 1699x960 16:9 Native Pixel Canvas)
 */
const STAGE_LAYOUT_CONFIG = {
  // Native fixed resolution matching base.jpeg and home.jpeg
  canvasWidth: 1699,
  canvasHeight: 960,
  
  // 3 Larger Wall picture frames shifted right (x: 235) to clear window and down (y: 170)
  frame1: { x: 235, y: 170, width: 430, height: 295 },
  frame2: { x: 690, y: 170, width: 430, height: 295 },
  frame3: { x: 1145, y: 170, width: 430, height: 295 },
  
  // Character on treadmill fixed pixels
  character: { x: 1360, y: 865, width: 300, height: 300 },

  // Walkable floor area polygon for background walking characters
  walkArea: {
    polygon: [
      { x: 127, y: 799 }, // Top-Left
      { x: 648, y: 798 }, // Top-Right
      { x: 698, y: 885 }, // Bottom-Right
      { x: 190, y: 884 }  // Bottom-Left
    ],
    bounds: {
      minX: 127,
      maxX: 698,
      minY: 798,
      maxY: 885
    }
  }
};

/**
 * Background Strolling Characters Manager
 * Controls non-selected characters strolling around inside STAGE_LAYOUT_CONFIG.walkArea
 */
class StrollingManager {
  constructor() {
    this.strollers = [];
  }

  // Clamps point (x, y) strictly within the trapezoid of walkArea
  getValidWalkPos(requestedX, requestedY) {
    const area = STAGE_LAYOUT_CONFIG.walkArea;
    const minY = area.bounds.minY; // 798
    const maxY = area.bounds.maxY; // 885

    const clampedY = Math.max(minY, Math.min(maxY, requestedY));
    const t = (clampedY - minY) / (maxY - minY);
    
    // Linear interpolation of trapezoid left and right boundaries
    // Top: [127, 648], Bottom: [190, 698]
    const minX = 127 + t * (190 - 127) + 50; // +50px padding for larger sprite width
    const maxX = 648 + t * (698 - 648) - 50; // -50px padding

    const clampedX = Math.max(minX, Math.min(maxX, requestedX));
    return { x: clampedX, y: clampedY };
  }

  getRandomTarget(currentX, currentY, otherPos) {
    const area = STAGE_LAYOUT_CONFIG.walkArea;
    let target;
    let attempts = 0;
    do {
      const rx = area.bounds.minX + Math.random() * (area.bounds.maxX - area.bounds.minX);
      const ry = area.bounds.minY + Math.random() * (area.bounds.maxY - area.bounds.minY);
      target = this.getValidWalkPos(rx, ry);
      attempts++;
      if (currentX === undefined) break;

      const distSelf = Math.hypot(target.x - currentX, target.y - currentY);
      const distOther = otherPos ? Math.hypot(target.x - otherPos.x, target.y - otherPos.y) : 999;

      // Keep target far from current position (>140px) AND far from other character (>170px)
      if (distSelf >= 140 && distOther >= 170) {
        break;
      }
    } while (attempts < 30);

    return target;
  }

  init(runningCharIndex) {
    this.strollers = [];
    const allIndices = [0, 1, 2];
    const strollIndices = allIndices.filter(i => i !== runningCharIndex);

    // Initial starting positions (Left zone vs Right zone to guarantee wide separation at start)
    const startPositions = [
      { x: 220 + Math.random() * 80, y: 810 + Math.random() * 30 },
      { x: 500 + Math.random() * 80, y: 845 + Math.random() * 30 }
    ];

    strollIndices.forEach((charIdx, i) => {
      const startPos = this.getValidWalkPos(startPositions[i].x, startPositions[i].y);
      const otherPos = (i === 1) ? this.strollers[0] : null;
      const targetPos = this.getRandomTarget(startPos.x, startPos.y, otherPos);
      const dx = targetPos.x - startPos.x;

      this.strollers.push({
        charIndex: charIdx,
        x: startPos.x,
        y: startPos.y,
        targetX: targetPos.x,
        targetY: targetPos.y,
        dir: (dx < 0) ? 'l' : 'r',
        speed: 38 + Math.random() * 25, // 38~63 px/sec casual stroll speed
        animTime: Math.random() * 1000
      });
    });
  }

  updateAndRender(ctx, dt, isPaused) {
    if (this.strollers.length === 0) return;

    // Apply anti-overlap repulsion force if strollers get closer than 150px
    if (this.strollers.length > 1) {
      const s0 = this.strollers[0];
      const s1 = this.strollers[1];
      const dist = Math.hypot(s0.x - s1.x, s0.y - s1.y);
      const minAllowedDist = 150; // Minimum clearance between characters

      if (dist < minAllowedDist && dist > 0) {
        const overlap = minAllowedDist - dist;
        const pushX = ((s0.x - s1.x) / dist) * overlap * 0.5 * dt * 5;
        const pushY = ((s0.y - s1.y) / dist) * overlap * 0.5 * dt * 5;

        s0.x += pushX;
        s0.y += pushY;
        s1.x -= pushX;
        s1.y -= pushY;

        const v0 = this.getValidWalkPos(s0.x, s0.y);
        s0.x = v0.x; s0.y = v0.y;
        const v1 = this.getValidWalkPos(s1.x, s1.y);
        s1.x = v1.x; s1.y = v1.y;

        // If too close, force one to pick a new target away from the other
        if (dist < 100) {
          const newTarget = this.getRandomTarget(s0.x, s0.y, { x: s1.x, y: s1.y });
          s0.targetX = newTarget.x;
          s0.targetY = newTarget.y;
        }
      }
    }

    // Y-sorting so characters farther back (smaller Y) draw behind closer ones (larger Y)
    this.strollers.sort((a, b) => a.y - b.y);

    this.strollers.forEach(stroller => {
      stroller.animTime += dt * 1000;

      let activeDir = stroller.dir;
      if (isPaused) {
        activeDir = 'idle';
      } else {
        // Move towards target continuously (no pause)
        const dx = stroller.targetX - stroller.x;
        const dy = stroller.targetY - stroller.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 10) {
          // Reached target -> pick new target far from other stroller
          const otherStroller = this.strollers.find(s => s !== stroller);
          const otherPos = otherStroller ? { x: otherStroller.x, y: otherStroller.y } : null;
          const newTarget = this.getRandomTarget(stroller.x, stroller.y, otherPos);
          stroller.targetX = newTarget.x;
          stroller.targetY = newTarget.y;
          const newDx = stroller.targetX - stroller.x;
          if (Math.abs(newDx) > 5) {
            stroller.dir = (newDx < 0) ? 'l' : 'r';
          }
        } else {
          const step = stroller.speed * dt;
          stroller.x += (dx / dist) * step;
          stroller.y += (dy / dist) * step;
          
          // Keep inside valid trapezoid
          const valid = this.getValidWalkPos(stroller.x, stroller.y);
          stroller.x = valid.x;
          stroller.y = valid.y;

          if (Math.abs(dx) > 2) {
            stroller.dir = (dx < 0) ? 'l' : 'r';
          }
        }
      }

      // Calculate depth scale based on Y (y ranges 798 to 885)
      const depthRatio = (stroller.y - 798) / (885 - 798);
      const drawScale = 270 + depthRatio * 40; // 270px (far back) ~ 310px (front)

      charMgr.drawStrollFrame(
        ctx,
        stroller.charIndex,
        activeDir,
        stroller.animTime,
        stroller.x,
        stroller.y,
        drawScale,
        drawScale
      );
    });
  }
}

class StageRenderer {
  constructor() {
    this.canvas = document.getElementById('stage-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.animFrame = null;
    this.runningTime = 0;
    this.lastTimestamp = 0;
    this.lastDt = 0.016;
    this.canvasRect = null;
    this.bubbleEl = null;
    this.cachedBgCanvas = null;
    this.strollingMgr = new StrollingManager();
  }

  resize() {
    // Keep internal canvas resolution strictly fixed at native 1699 x 960
    this.canvas.width = STAGE_LAYOUT_CONFIG.canvasWidth;
    this.canvas.height = STAGE_LAYOUT_CONFIG.canvasHeight;
    this.canvasRect = this.canvas.getBoundingClientRect();
  }

  buildCachedBackground() {
    if (!this.cachedBgCanvas) {
      this.cachedBgCanvas = document.createElement('canvas');
      this.cachedBgCanvas.width = STAGE_LAYOUT_CONFIG.canvasWidth;
      this.cachedBgCanvas.height = STAGE_LAYOUT_CONFIG.canvasHeight;
    }
    const bgCtx = this.cachedBgCanvas.getContext('2d');
    const w = STAGE_LAYOUT_CONFIG.canvasWidth;
    const h = STAGE_LAYOUT_CONFIG.canvasHeight;

    bgCtx.clearRect(0, 0, w, h);

    const isStandby = (state.screen === 'standby');
    const bgType = isStandby ? 'home' : 'base';
    const bgObj = sceneMgr.getBaseBg(bgType);

    if (bgObj && bgObj.loaded && bgObj.image) {
      bgCtx.drawImage(bgObj.image, 0, 0, w, h);
    } else {
      const bgGrad = bgCtx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#fbcfe8');
      bgGrad.addColorStop(1, '#38bdf8');
      bgCtx.fillStyle = bgGrad;
      bgCtx.fillRect(0, 0, w, h);
    }

    if (isStandby) {
      const emptyObj = sceneMgr.getImage('assets/frame_empty.jpg');
      this.drawWallFrame(bgCtx, emptyObj, STAGE_LAYOUT_CONFIG.frame1);
      this.drawWallFrame(bgCtx, emptyObj, STAGE_LAYOUT_CONFIG.frame2);
      this.drawWallFrame(bgCtx, emptyObj, STAGE_LAYOUT_CONFIG.frame3);
    } else {
      const runFrames = sceneMgr.getRunFrames();
      this.drawWallFrame(bgCtx, runFrames[0], STAGE_LAYOUT_CONFIG.frame1);
      this.drawWallFrame(bgCtx, runFrames[1], STAGE_LAYOUT_CONFIG.frame2);
      this.drawWallFrame(bgCtx, runFrames[2], STAGE_LAYOUT_CONFIG.frame3);
    }
  }

  start() {
    this.stop();
    this.runningTime = 0;
    this.resize();
    this.buildCachedBackground();
    this.strollingMgr.init(state.charIndex);
    this.lastTimestamp = performance.now();
    this.loop();
  }

  stop() {
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  loop = (now) => {
    if (state.screen === 'running' || state.screen === 'celebrate') {
      const current = now || performance.now();
      const dt = Math.min((current - (this.lastTimestamp || current)) * 0.001, 0.1);
      this.lastTimestamp = current;
      this.lastDt = dt;

      if (!state.isPaused && state.screen === 'running') {
        this.runningTime += dt;
      }
      this.render();
      this.updateSpeechBubble();
      this.animFrame = requestAnimationFrame(this.loop);
    } else {
      this.stop();
    }
  };

  render() {
    const w = STAGE_LAYOUT_CONFIG.canvasWidth;
    const h = STAGE_LAYOUT_CONFIG.canvasHeight;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, w, h);

    // 1. Layer 0 & 1: Fast 1:1 draw call from static offscreen background cache
    if (this.cachedBgCanvas) {
      ctx.drawImage(this.cachedBgCanvas, 0, 0);
    } else {
      this.buildCachedBackground();
      if (this.cachedBgCanvas) ctx.drawImage(this.cachedBgCanvas, 0, 0);
    }

    // 2. Layer 1.5: Background Strolling Characters on Floor
    this.strollingMgr.updateAndRender(ctx, this.lastDt, state.isPaused || state.isCountdown);

    // 3. Layer 2: Character on Treadmill
    this.renderRunningCharacter(ctx);
  }

  drawWallFrame(ctx, frameObj, layoutCfg) {
    if (!frameObj || !frameObj.loaded || !frameObj.image) return;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.fillRect(layoutCfg.x + 6, layoutCfg.y + 6, layoutCfg.width, layoutCfg.height);

    ctx.drawImage(frameObj.image, layoutCfg.x, layoutCfg.y, layoutCfg.width, layoutCfg.height);
  }

  renderRunningCharacter(ctx) {
    const charCfg = STAGE_LAYOUT_CONFIG.character;
    const charX = charCfg.x;   // Fixed 1360px over right treadmill
    const charY = charCfg.y;   // Fixed 865px
    const charWidth = charCfg.width;
    const charHeight = charCfg.height;

    // Determine character animation state
    let charState = 'running';
    if (state.isCountdown || state.isPaused) {
      charState = 'idle';
    }

    // Elastic Beat Bounce (Only during active 'running' state)
    const beatsPerSec = (state.bpm || 180) / 60;
    const tau = (this.runningTime * beatsPerSec) % 1.0;
    const bounceOffset = (charState === 'running' && !state.isPaused) ? -Math.sin(tau * Math.PI) * 12 : 0;
    const tiltAngle = 0;

    // Shadow position lowered 10px to charY - 28 for precise foot alignment
    const shadowY = charY - 28;

    // Draw Unified Dynamic Ground Shadow
    charMgr.drawUnifiedGroundShadow(ctx, charX, shadowY, charWidth, bounceOffset);

    // Draw Character Animated Sprite Frame (BPM synchronized)
    // 1 full 18-frame sprite cycle = 2 beats (steps) -> Target cycle duration = 120,000 / BPM
    const bpm = state.bpm || 180;
    const targetCycleDurMs = 120000 / bpm;
    const activeCharId = charMgr.charIds[state.charIndex];
    const activeCharData = charMgr.characters[activeCharId];
    const runningStateData = activeCharData ? activeCharData.states['running'] : null;
    const charJsonDurMs = (runningStateData && runningStateData.totalDur) ? runningStateData.totalDur : 1000;

    const speedMultiplier = charJsonDurMs / targetCycleDurMs;
    const animTimeMs = (charState === 'running')
      ? this.runningTime * 1000 * speedMultiplier
      : performance.now();

    charMgr.drawStateFrame(ctx, state.charIndex, charState, animTimeMs, charX, charY, charWidth, charHeight, bounceOffset, tiltAngle);

    // Save screen position for speech bubble placement
    this.currentCharScreenX = charX;
    this.currentCharScreenY = charY + bounceOffset - charHeight + 15;
  }

  updateSpeechBubble() {
    if (!this.bubbleEl) this.bubbleEl = document.getElementById('speech-bubble');
    if (!this.bubbleEl || this.bubbleEl.classList.contains('hidden')) return;

    if (this.currentCharScreenX && this.currentCharScreenY) {
      if (!this.canvasRect) this.canvasRect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvasRect.width / STAGE_LAYOUT_CONFIG.canvasWidth;
      const scaleY = this.canvasRect.height / STAGE_LAYOUT_CONFIG.canvasHeight;

      const screenX = this.currentCharScreenX * scaleX;
      const screenY = (this.currentCharScreenY - 15) * scaleY;

      this.bubbleEl.style.left = `${screenX}px`;
      this.bubbleEl.style.top = `${screenY}px`;
    }
  }
}

const stageRenderer = new StageRenderer();
