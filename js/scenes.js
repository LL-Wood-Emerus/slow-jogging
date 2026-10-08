/**
 * Room & Wall Frame Scene Manager Module (Random 3 Picture Frames Engine)
 */
class SceneManager {
  constructor() {
    this.bgImages = {
      home: 'assets/home.jpeg',
      base: 'assets/base.jpeg'
    };
    
    this.allFramePaths = [
      'assets/frame/frame (1).jpeg',
      'assets/frame/frame (2).jpeg',
      'assets/frame/frame (3).jpeg',
      'assets/frame/frame (4).jpeg',
      'assets/frame/frame (5).jpeg',
      'assets/frame/frame (6).jpeg',
      'assets/frame/frame (7).jpeg',
      'assets/frame/frame (8).jpeg'
    ];

    this.currentRunFrames = [];
    this.cache = {};
  }

  getImage(src) {
    if (!src) return null;
    if (this.cache[src]) return this.cache[src];

    const obj = { loaded: false, image: null, failed: false };
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      obj.image = img;
      obj.loaded = true;
    };
    img.onerror = () => {
      console.warn(`Failed to load asset: ${src}`);
      obj.failed = true;
    };
    img.src = src;
    this.cache[src] = obj;
    return obj;
  }

  getBaseBg(type = 'base') {
    const src = this.bgImages[type] || this.bgImages.base;
    return this.getImage(src);
  }

  pickRandomRunFrames() {
    const shuffled = [...this.allFramePaths].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, 3);
    this.currentRunFrames = picked.map(path => this.getImage(path));
    return this.currentRunFrames;
  }

  getRunFrames() {
    if (!this.currentRunFrames || this.currentRunFrames.length < 3) {
      this.pickRandomRunFrames();
    }
    return this.currentRunFrames;
  }

  preload() {
    const urls = [
      this.bgImages.home,
      this.bgImages.base,
      'assets/frame_empty.jpg',
      ...this.allFramePaths
    ];

    const promises = urls.map(url => new Promise(resolve => {
      const item = this.getImage(url);
      if (item.loaded || item.failed) resolve();
      else {
        const interval = setInterval(() => {
          if (item.loaded || item.failed) {
            clearInterval(interval);
            resolve();
          }
        }, 50);
      }
    }));

    return Promise.all(promises);
  }
}

const sceneMgr = new SceneManager();
