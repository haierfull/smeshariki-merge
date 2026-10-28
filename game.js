"use strict";
/*
 * Смешарики: Слияние — мобильная (веб) версия.
 * Читает тот же набор настроек, что и config.json в настольной версии
 * (см. config.js), но хитбоксы здесь всегда круглые — строить их по
 * контуру картинки в браузере слишком дорого для телефона/планшета.
 * Поэтому «radius» каждого персонажа — это одновременно и размер
 * картинки, и его физический радиус (можно подправить hitbox_scale).
 */

// ---------------------------------------------------------------- defaults
const DEFAULTS = {
  title: "Merge", subtitle: "",
  background: { image: "assets/background.png", color: [255, 243, 209], fit: "cover" },
  container: {
    width: 460, height: 600, wall_thickness: 12,
    wall_color: [122, 84, 60], fill_color: [255, 255, 255, 110], image: "assets/container.png",
    danger_line_from_top: 50, danger_seconds: 2.0, danger_grace_seconds: 1.0, danger_color: [230, 60, 60],
  },
  physics: {
    gravity: 1500, elasticity: 0.1, friction: 0.5, wall_friction: 0.4,
    damping: 0.85, density: 1.0, steps_per_second: 60, iterations: 8,
  },
  gameplay: { drop_delay: 0.5, hold_y_offset: 60, top_merge: "vanish", top_merge_bonus: 100, show_guideline: true },
  shuffle: { enabled: true, uses: 3, duration: 0.8, candidates: 24, grace_seconds: 1.5, icon: "" },
  spawn: [], characters: [],
  ui: {
    show_ladder: true, show_next: true, show_volume: true,
    text_color: [90, 56, 37], accent_color: [232, 93, 117], guideline_color: [205, 185, 155],
    panel: { fill_color: [255, 255, 255, 150], border_color: [122, 84, 60], border_width: 4, radius: 18 },
  },
  messages: {
    score: "Счёт", best: "Рекорд", next: "Дальше", ladder: "Цепочка",
    start_text: "Нажмите, чтобы продолжить", game_over: "Игра окончена", new_record: "Новый рекорд!",
    restart_hint: "Нажмите — заново", new_character: "Новый друг: {name}!", top_reached: "Ура! Получился {name}!",
    shuffle: "Перемешать", shuffled: "Перемешали!", shuffle_none: "Пока нечего перемешивать",
    shuffle_empty: "Перемешивания закончились", controls: "Проведите пальцем и отпустите — бросить",
    music: "Музыка", sounds: "Звуки",
  },
  sound: {
    volume: 0.6, music_volume: 0.3,
    drop: "assets/sounds/drop.wav", merge: "assets/sounds/merge.wav", top: "assets/sounds/top.wav",
    game_over: "assets/sounds/game_over.wav", shuffle: "assets/sounds/shuffle.wav", music: "assets/sounds/music.ogg",
  },
};

function deepMerge(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  if (!over || typeof over !== "object") return out;
  for (const k of Object.keys(over)) {
    const v = over[k];
    if (v && typeof v === "object" && !Array.isArray(v) && base && typeof base[k] === "object" && !Array.isArray(base[k])) {
      out[k] = deepMerge(base[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function rgba(arr, fallbackAlpha = 255) {
  const a = arr.length > 3 ? arr[3] : fallbackAlpha;
  return `rgba(${arr[0]},${arr[1]},${arr[2]},${(a / 255).toFixed(3)})`;
}
function rgb(arr) { return `rgb(${arr[0]},${arr[1]},${arr[2]})`; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function smoothstep(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1; t = clamp(t, 0, 1);
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

// ---------------------------------------------------------------- config
function loadConfig() {
  const user = window.GAME_CONFIG || {};
  const cfg = deepMerge(DEFAULTS, user);
  if (!Array.isArray(cfg.characters) || cfg.characters.length < 2) {
    throw new Error("В config.js нужно минимум 2 персонажа (characters).");
  }
  const ids = new Set();
  cfg.characters.forEach((c, i) => {
    if (!c.id) throw new Error(`У персонажа №${i + 1} нет id.`);
    if (ids.has(c.id)) throw new Error("Повторяется id персонажа: " + c.id);
    ids.add(c.id);
    c.name = c.name || c.id;
    c.radius = c.radius || 20 + i * 8;
    c.score = c.score != null ? c.score : (i * (i + 1)) / 2 + 1;
    c.color = c.color || [200, 200, 200];
    c.image = c.image || "";
    c.image_scale = c.image_scale || 1.0;
    c.hitbox_scale = c.hitbox_scale || 1.0;
  });
  if (!cfg.spawn || !cfg.spawn.length) {
    cfg.spawn = cfg.characters.slice(0, 3).map((c) => ({ id: c.id, weight: 1 }));
  }
  cfg.spawn.forEach((s) => { if (!ids.has(s.id)) throw new Error("В spawn указан неизвестный персонаж: " + s.id); s.weight = s.weight || 1; });
  if (cfg.gameplay.top_merge !== "vanish" && cfg.gameplay.top_merge !== "none") cfg.gameplay.top_merge = "vanish";
  return cfg;
}

// ---------------------------------------------------------------- audio
class Sfx {
  constructor(src) { this.ok = false; this.pool = []; this.src = src; this.volume = 1; }
  load() {
    return new Promise((resolve) => {
      const a = new Audio();
      a.oncanplaythrough = () => { this.ok = true; resolve(true); };
      a.onerror = () => resolve(false);
      a.src = this.src; a.preload = "auto"; a.load();
      this.base = a;
      setTimeout(() => resolve(this.ok), 2500); // не ждём звук вечно
    });
  }
  setVolume(v) { this.volume = v; if (this.base) this.base.volume = v; }
  play() {
    if (!this.ok) return;
    const node = this.base.cloneNode(true);
    node.volume = this.volume;
    node.play().catch(() => {});
  }
}

// ---------------------------------------------------------------- piece
let PIECE_SEQ = 1;
class Piece {
  constructor(level, x, y, vx, vy, r, mass, born) {
    this.id = PIECE_SEQ++;
    this.level = level; this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.r = r; this.mass = mass; this.angle = Math.random() * Math.PI * 2; this.spin = (Math.random() - 0.5) * 1.5;
    this.born = born; this.over = 0; this.pop = 0;
  }
}

// ---------------------------------------------------------------- game
class Game {
  constructor(cfg, canvas) {
    this.cfg = cfg; this.canvas = canvas; this.ctx = canvas.getContext("2d");
    this.chars = cfg.characters; this.n = this.chars.length;
    const ids = {}; this.chars.forEach((c, i) => (ids[c.id] = i));
    this.spawnLevels = cfg.spawn.map((s) => ids[s.id]);
    this.spawnWeights = cfg.spawn.map((s) => Math.max(0, +s.weight));
    if (this.spawnWeights.reduce((a, b) => a + b, 0) <= 0) this.spawnWeights = this.spawnLevels.map(() => 1);
    this.maxSpawnLevel = Math.max(...this.spawnLevels);

    this.cw = cfg.container.width; this.ch = cfg.container.height;
    this.wallT = cfg.container.wall_thickness;

    this.state = "menu"; this.time = 0; this.overTime = 0; this.newRecord = false;
    this.anim = null; this.shufflesLeft = cfg.shuffle.uses;
    this.drag = null; this.pointerId = null; this.aiming = false;
    this.toast = null; this.particles = [];
    this.sprites = {}; this.sounds = {}; this.soundsLoaded = false;
    this.audioUnlocked = false;

    this.loadSave();
    this.loadAssets();
    this.layout = null;
    this.resize();
    this.resetRound();
  }

  // ------------------------------------------------------------- save
  loadSave() {
    this.best = 0; this.volMusic = this.cfg.sound.music_volume; this.volSfx = this.cfg.sound.volume;
    try {
      const raw = localStorage.getItem("smeshariki_save");
      if (raw) {
        const d = JSON.parse(raw);
        if (typeof d.best === "number") this.best = d.best;
        if (typeof d.sfx === "number") this.volSfx = clamp(d.sfx, 0, 1);
        if (typeof d.music === "number") this.volMusic = clamp(d.music, 0, 1);
      }
    } catch (e) {}
  }
  saveGame() {
    try {
      localStorage.setItem("smeshariki_save", JSON.stringify({ best: this.best, sfx: this.volSfx, music: this.volMusic }));
    } catch (e) {}
  }

  // ------------------------------------------------------------- assets
  loadImage(path) {
    return new Promise((resolve) => {
      if (!path) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = path;
    });
  }

  async loadAssets() {
    const jobs = [];
    this.charImg = new Array(this.n).fill(null);
    this.chars.forEach((c, i) => jobs.push(this.loadImage(c.image).then((im) => (this.charImg[i] = im))));
    jobs.push(this.loadImage(this.cfg.background.image).then((im) => (this.bgImg = im)));
    jobs.push(this.loadImage(this.cfg.container.image).then((im) => (this.containerImg = im)));
    jobs.push(this.loadImage(this.cfg.shuffle.icon).then((im) => (this.shuffleImg = im)));
    await Promise.all(jobs);

    const s = this.cfg.sound;
    const sfxJobs = [];
    for (const key of ["drop", "merge", "top", "game_over", "shuffle"]) {
      if (!s[key]) continue;
      const sfx = new Sfx(s[key]);
      this.sounds[key] = sfx;
      sfxJobs.push(sfx.load());
    }
    this.music = s.music ? new Audio(s.music) : null;
    if (this.music) { this.music.loop = true; this.music.volume = this.volMusic; }
    await Promise.all(sfxJobs);
    this.applyVolumes();
    this.soundsLoaded = true;
    const loading = document.getElementById("loading");
    if (loading) loading.style.display = "none";
  }

  applyVolumes() {
    for (const k in this.sounds) this.sounds[k].setVolume(this.volSfx);
    if (this.music) this.music.volume = this.volMusic;
  }

  unlockAudio() {
    if (this.audioUnlocked) return;
    this.audioUnlocked = true;
    if (this.music && this.volMusic > 0) this.music.play().catch(() => {});
  }

  // ------------------------------------------------------------- layout
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const sw = window.innerWidth, sh = window.innerHeight;
    this.canvas.width = Math.round(sw * dpr);
    this.canvas.height = Math.round(sh * dpr);
    this.canvas.style.width = sw + "px";
    this.canvas.style.height = sh + "px";
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.screenW = sw; this.screenH = sh;

    const landscape = sw >= sh * 0.95;
    const cw = this.cw, ch = this.ch, margin = 16, gap = 12, wallT = this.wallT;
    let L = { mode: landscape ? "landscape" : "portrait" };

    if (landscape) {
      const panelW = Math.max(150, Math.min(220, sw * 0.001 + 170));
      const topBar = 172, botBar = 40;
      const totalW = margin * 2 + panelW * 2 + gap * 2 + cw;
      const totalH = topBar + ch + botBar;
      const k = Math.min(sw / totalW, sh / totalH);
      const ox = (sw - totalW * k) / 2, oy = (sh - totalH * k) / 2;
      const left = margin + panelW + gap, right = left + cw;
      const top = topBar, bottom = top + ch;
      L = {
        ...L, k, ox, oy, left, right, top, bottom, cw, ch,
        holdY: top - this.cfg.gameplay.hold_y_offset,
        lineY: top + this.cfg.container.danger_line_from_top,
        lp: { x: margin, y: top - 8, w: panelW, h: ch + wallT + 8 },
        rp: { x: right + wallT + gap, y: top - 8, w: panelW, h: ch + wallT + 8 },
        titlePos: [totalW / 2, 22], subtitlePos: [totalW / 2, 48],
        controlsPos: [totalW / 2, totalH - 14],
      };
      const lp = L.lp;
      L.scorePos = { x: lp.x + lp.w / 2, y: top + 4 };
      L.nextPos = { x: lp.x + lp.w / 2, y: top + 232 };
      L.shuffleRect = { x: lp.x + 15, y: top + 320, w: lp.w - 30, h: 46 };
      L.sliders = [
        { x0: lp.x + lp.w / 2 - 75, x1: lp.x + lp.w / 2 + 75, y: top + ch - 112, label: "music" },
        { x0: lp.x + lp.w / 2 - 75, x1: lp.x + lp.w / 2 + 75, y: top + ch - 56, label: "sfx" },
      ];
      const rp = L.rp;
      L.chain = { mode: "vertical", x: rp.x + rp.w / 2, y0: top + 44, step: Math.min(54, (ch - 40) / this.n), labelX: rp.x + 32 };
      L.chainTitle = { x: rp.x + 16, y: top + 4 };
    } else {
      // Наверху — заголовок и ряд (счёт/перемешать/дальше), держим его подальше
      // от места, где «висит» прицеливаемый персонаж (holdY), чтобы они не наезжали
      // друг на друга при любом наборе радиусов из spawn. Цепочка и громкость — внизу.
      const rowY = 82, rowBottom = 110;
      const maxSpawnR = Math.max(...this.spawnLevels.map((i) => this.chars[i].radius * this.chars[i].hitbox_scale));
      const topBar = rowBottom + this.cfg.gameplay.hold_y_offset + maxSpawnR + 26;
      const chainH = 62, slidersH = 78, botBar = chainH + slidersH + 18;
      const totalW = cw + margin * 2;
      const totalH = topBar + ch + botBar;
      const k = Math.min(sw / totalW, sh / totalH);
      const ox = (sw - totalW * k) / 2, oy = (sh - totalH * k) / 2;
      const left = margin, right = left + cw;
      const top = topBar, bottom = top + ch;
      L = {
        ...L, k, ox, oy, left, right, top, bottom, cw, ch,
        holdY: top - this.cfg.gameplay.hold_y_offset,
        lineY: top + this.cfg.container.danger_line_from_top,
        titlePos: [totalW / 2, 18], subtitlePos: [totalW / 2, 38],
        controlsPos: [totalW / 2, totalH - 12],
      };
      L.scorePos = { x: left + 58, y: rowY };
      L.nextPos = { x: right - 44, y: rowY };
      L.shuffleRect = { x: totalW / 2 - 78, y: rowY - 21, w: 156, h: 42 };
      L.topPanel = { x: left - 8, y: rowY - 30, w: cw + 16, h: 72 };
      const chainY = bottom + 10 + chainH / 2;
      L.chain = { mode: "horizontal", y: chainY, x0: left + 8, x1: right - 8, r: Math.min(24, (cw / this.n) / 2 - 4) };
      const sliderY = bottom + chainH + 34;
      L.sliders = [
        { x0: left + 10, x1: left + cw / 2 - 14, y: sliderY, label: "music" },
        { x0: left + cw / 2 + 14, x1: right - 10, y: sliderY, label: "sfx" },
      ];
      L.botPanel = { x: left - 8, y: bottom + 8, w: cw + 16, h: botBar - 16 };
    }
    this.layout = L;
    this.sprites = {}; // кэш масштабированных картинок зависит от k
  }

  // ------------------------------------------------------------- state
  resetRound() {
    this.pieces = [];
    this.anim = null;
    this.shufflesLeft = this.cfg.shuffle.uses;
    this.particles = [];
    this.toast = null;
    this.score = 0;
    this.highest = -1;
    this.acc = 0;
    this.cooldown = 0;
    this.danger = false;
    this.holdX = (this.layout.left + this.layout.right) / 2;
    this.current = this.rollSpawn();
    this.next = this.rollSpawn();
    this.newRecord = false;
  }
  rollSpawn() {
    const total = this.spawnWeights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < this.spawnLevels.length; i++) {
      r -= this.spawnWeights[i];
      if (r <= 0) return this.spawnLevels[i];
    }
    return this.spawnLevels[this.spawnLevels.length - 1];
  }
  start() {
    this.resetRound();
    this.state = "play";
    this.unlockAudio();
  }
  gameOver() {
    this.anim = null;
    this.state = "over";
    this.overTime = this.time;
    this.newRecord = this.score > 0 && this.score >= this.best;
    if (this.score > this.best) this.best = this.score;
    this.saveGame();
    this.play("game_over");
    if (this.music) { try { this.music.pause(); } catch (e) {} }
  }
  play(key) {
    const s = this.sounds[key];
    if (s && s.ok) s.play();
    else if (key === "shuffle" && this.sounds.merge) this.sounds.merge.play();
  }
  showToast(text, seconds) { this.toast = { text, until: this.time + seconds, total: seconds }; }

  // ------------------------------------------------------------- pieces
  holdLimits(level) {
    const r = this.chars[level].radius * this.chars[level].hitbox_scale;
    return [this.layout.left + r, this.layout.right - r];
  }
  addPiece(level, x, y, vx = 0, vy = 0) {
    const ch = this.chars[level];
    const r = ch.radius * ch.hitbox_scale;
    const mass = this.cfg.physics.density * (r * r) / (20 * 20);
    const p = new Piece(level, x, y, vx, vy, r, mass, this.time);
    this.pieces.push(p);
    return p;
  }
  removePiece(p) { const i = this.pieces.indexOf(p); if (i >= 0) this.pieces.splice(i, 1); }

  drop() {
    if (this.state !== "play" || this.cooldown > 0 || this.anim) return;
    const [lo, hi] = this.holdLimits(this.current);
    const x = clamp(this.holdX, lo, hi);
    this.addPiece(this.current, x, this.layout.holdY);
    this.play("drop");
    this.current = this.next; this.next = this.rollSpawn();
    this.cooldown = this.cfg.gameplay.drop_delay;
  }

  // ------------------------------------------------------------- physics
  stepPhysics(dt) {
    const p = this.cfg.physics;
    const damp = Math.pow(p.damping, dt);
    const L = this.layout;
    for (const pc of this.pieces) {
      pc.vy += p.gravity * dt;
      pc.vx *= damp; pc.vy *= damp;
      pc.x += pc.vx * dt; pc.y += pc.vy * dt;
      pc.angle += pc.spin * dt; pc.spin *= 0.98;
    }
    const pieces = this.pieces;

    // --- Velocity resolution: ONE pass per contact per step. Applying the
    // bounce/friction impulse repeatedly within the same step (like the old
    // code did, once per position-iteration) injects energy on every extra
    // pass, which is what sent pieces flying apart and, once they shot out
    // of the container, triggered the "rescue" safety net that teleports
    // escaped pieces back up to the drop point with zero velocity — the
    // "frozen far away" pieces. Friction is now scaled consistently with
    // the normal impulse (divided by invSum, not just by one side's inverse
    // mass) and clamped to Coulomb's law so big, heavy characters actually
    // feel friction instead of sliding like on ice.
    for (let i = 0; i < pieces.length; i++) {
      const a = pieces[i];
      for (let j = i + 1; j < pieces.length; j++) {
        const b = pieces[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const minD = a.r + b.r;
        if (Math.abs(dx) > minD || Math.abs(dy) > minD) continue;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD || d2 < 1e-9) continue;
        const dist = Math.sqrt(d2);
        const nx = dx / dist, ny = dy / dist;
        const invA = 1 / a.mass, invB = 1 / b.mass, invSum = invA + invB;
        const relN = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (relN >= 0) continue; // already separating, nothing to resolve
        const jn = (-(1 + p.elasticity) * relN) / invSum;
        a.vx -= nx * jn * invA; a.vy -= ny * jn * invA;
        b.vx += nx * jn * invB; b.vy += ny * jn * invB;

        const tx = -ny, ty = nx;
        const relT = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
        let jt = -relT / invSum;
        const maxJt = p.friction * jn;
        jt = clamp(jt, -maxJt, maxJt);
        a.vx -= tx * jt * invA; a.vy -= ty * jt * invA;
        b.vx += tx * jt * invB; b.vy += ty * jt * invB;
      }
    }

    // --- Position correction: several iterations, position-only (no further
    // velocity change), just to settle overlaps/stacks without re-bouncing.
    const iters = Math.max(4, Math.min(p.iterations, 12));
    for (let it = 0; it < iters; it++) {
      for (const pc of pieces) {
        if (pc.x - pc.r < L.left) { pc.x = L.left + pc.r; if (pc.vx < 0) pc.vx = -pc.vx * p.wall_friction; }
        if (pc.x + pc.r > L.right) { pc.x = L.right - pc.r; if (pc.vx > 0) pc.vx = -pc.vx * p.wall_friction; }
        if (pc.y + pc.r > L.bottom) { pc.y = L.bottom - pc.r; if (pc.vy > 0) pc.vy = -pc.vy * p.elasticity; }
      }
      for (let i = 0; i < pieces.length; i++) {
        const a = pieces[i];
        for (let j = i + 1; j < pieces.length; j++) {
          const b = pieces[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const minD = a.r + b.r;
          if (Math.abs(dx) > minD || Math.abs(dy) > minD) continue;
          const d2 = dx * dx + dy * dy;
          if (d2 >= minD * minD || d2 < 1e-9) continue;
          const dist = Math.sqrt(d2);
          const nx = dx / dist, ny = dy / dist;
          const overlap = minD - dist;
          const invA = 1 / a.mass, invB = 1 / b.mass, invSum = invA + invB;
          const corr = (overlap / invSum) * 0.6;
          a.x -= nx * corr * invA; a.y -= ny * corr * invA;
          b.x += nx * corr * invB; b.y += ny * corr * invB;
        }
      }
    }
  }

  doMerges() {
    const topVanish = this.cfg.gameplay.top_merge === "vanish";
    const used = new Set(); const pairs = [];
    const pieces = this.pieces;
    for (let i = 0; i < pieces.length; i++) {
      const a = pieces[i]; if (used.has(a.id)) continue;
      if (a.level === this.n - 1 && !topVanish) continue;
      for (let j = i + 1; j < pieces.length; j++) {
        const b = pieces[j];
        if (used.has(b.id) || b.level !== a.level) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const lim = a.r + b.r + 2;
        if (dx * dx + dy * dy <= lim * lim) { used.add(a.id); used.add(b.id); pairs.push([a, b]); break; }
      }
    }
    for (const [a, b] of pairs) this.merge(a, b);
  }
  merge(a, b) {
    const level = a.level;
    const pos = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const vel = { x: (a.vx + b.vx) * 0.25, y: (a.vy + b.vy) * 0.25 };
    this.removePiece(a); this.removePiece(b);
    const m = this.cfg.messages;
    if (level + 1 >= this.n) {
      this.score += this.cfg.gameplay.top_merge_bonus;
      this.burst(pos.x, pos.y, this.chars[level].color, 22, 300);
      this.play("top");
    } else {
      const nl = level + 1;
      const np = this.addPiece(nl, pos.x, pos.y, vel.x, vel.y);
      np.pop = 0.28;
      this.score += this.chars[nl].score;
      this.burst(pos.x, pos.y, this.chars[nl].color, 12, 220);
      this.play("merge");
      if (nl > this.highest) {
        this.highest = nl;
        if (nl === this.n - 1) { this.showToast(m.top_reached.replace("{name}", this.chars[nl].name), 4); this.play("top"); }
        else if (nl > this.maxSpawnLevel) this.showToast(m.new_character.replace("{name}", this.chars[nl].name), 2.2);
      }
    }
    if (this.score > this.best) this.best = this.score;
  }
  burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = (0.3 + Math.random() * 0.7) * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.3, color, size: 3 + Math.random() * 4 });
    }
  }

  // ------------------------------------------------------------- shuffle
  static derangement(n) {
    const idx = [...Array(n).keys()];
    for (let t = 0; t < 60; t++) {
      for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
      if (idx.every((v, i) => v !== i)) return idx;
    }
    return idx.map((_, i) => (i + 1) % n);
  }
  planShuffle(pcs) {
    const n = pcs.length, L = this.layout, line = L.lineY + 20;
    const slots = pcs.map((p) => [p.x, p.y]);
    const rs = pcs.map((p) => p.r);
    let best = null, bestScore = Infinity;
    const candidates = this.cfg.shuffle.candidates;
    for (let c = 0; c < candidates; c++) {
      const perm = Game.derangement(n);
      const tx = [], ty = [];
      let score = 0;
      for (let i = 0; i < n; i++) {
        let [sx, sy] = slots[perm[i]];
        const r = rs[i];
        const x = clamp(sx, L.left + r, L.right - r);
        const y = Math.min(sy, L.bottom - r);
        tx.push(x); ty.push(y);
        const top = y - r;
        if (top < line) score += (line - top) * (line - top) * 4;
      }
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const lim = rs[i] + rs[j];
          const dx = tx[j] - tx[i], dy = ty[j] - ty[i];
          const d2 = dx * dx + dy * dy;
          if (d2 < lim * lim) { const ov = lim - Math.sqrt(d2); score += ov * ov; }
        }
      }
      if (score < bestScore) { bestScore = score; best = tx.map((x, i) => [x, ty[i]]); }
    }
    return best;
  }
  canShuffle() { return this.cfg.shuffle.enabled && this.state === "play" && !this.anim && this.shufflesLeft > 0; }
  startShuffle() {
    const m = this.cfg.messages;
    if (this.state !== "play" || this.anim || !this.cfg.shuffle.enabled) return;
    if (this.shufflesLeft <= 0) { this.showToast(m.shuffle_empty, 1.8); return; }
    const pcs = this.pieces.slice();
    const levels = new Set(pcs.map((p) => p.level));
    if (pcs.length < 2 || levels.size < 2) { this.showToast(m.shuffle_none, 1.8); return; }
    const targets = this.planShuffle(pcs);
    const items = pcs.map((p, i) => {
      p.vx = 0; p.vy = 0;
      return { p, sx: p.x, sy: p.y, tx: targets[i][0], ty: targets[i][1], ang0: p.angle, spin: (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.5) };
    });
    this.anim = { t: 0, dur: this.cfg.shuffle.duration, items };
    this.shufflesLeft--;
    this.play("shuffle");
    this.showToast(m.shuffled, 1.6);
  }
  updateShuffle(dt) {
    const a = this.anim; a.t += dt;
    const u = clamp(a.t / a.dur, 0, 1);
    const e = smoothstep(u);
    const lift = Math.sin(Math.PI * u) * 34;
    const wob = Math.sin(Math.PI * u);
    for (const it of a.items) {
      it.p.x = it.sx + (it.tx - it.sx) * e;
      it.p.y = it.sy + (it.ty - it.sy) * e - lift;
      it.p.angle = it.ang0 + it.spin * wob;
    }
    if (u >= 1) {
      const grace = this.cfg.shuffle.grace_seconds;
      for (const it of a.items) {
        it.p.x = it.tx; it.p.y = it.ty; it.p.angle = it.ang0;
        it.p.vx = 0; it.p.vy = 0; it.p.born = this.time + grace; it.p.over = 0;
      }
      this.anim = null; this.acc = 0;
    }
  }
  rescueEscaped() {
    const L = this.layout, t = this.wallT;
    for (const pc of this.pieces) {
      if (pc.x < L.left - t * 3 || pc.x > L.right + t * 3 || pc.y > L.bottom + t * 3 || pc.y < L.holdY - 300) {
        const [lo, hi] = this.holdLimits(pc.level);
        pc.x = clamp(pc.x, lo, hi); pc.y = L.holdY; pc.vx = 0; pc.vy = 0; pc.born = this.time; pc.over = 0;
      }
    }
  }
  checkDanger(dt) {
    const c = this.cfg.container, L = this.layout;
    let danger = false;
    for (const pc of this.pieces) {
      const topY = pc.y - pc.r;
      if (topY < L.lineY && this.time - pc.born > c.danger_grace_seconds) {
        pc.over += dt;
        if (pc.over > 0.3) danger = true;
        if (pc.over >= c.danger_seconds) { this.gameOver(); return; }
      } else pc.over = 0;
    }
    this.danger = danger;
  }

  // ------------------------------------------------------------- update
  update(dt) {
    this.time += dt;
    for (const pc of this.pieces) if (pc.pop > 0) pc.pop = Math.max(0, pc.pop - dt);
    for (const pt of this.particles) { pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 500 * dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.toast && this.time > this.toast.until) this.toast = null;

    if (this.state !== "play") return;
    const [lo, hi] = this.holdLimits(this.current);
    this.holdX = clamp(this.holdX, lo, hi);
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);

    if (this.anim) { this.updateShuffle(dt); return; }

    this.acc = Math.min(this.acc + Math.min(dt, 0.05), 0.2);
    const step = 1 / this.cfg.physics.steps_per_second;
    let guard = 0;
    while (this.acc >= step && guard < 6) { this.stepPhysics(step); this.acc -= step; guard++; }

    this.rescueEscaped();
    this.doMerges();
    this.checkDanger(dt);
  }

  // ------------------------------------------------------------- input
  toLogical(px, py) { const L = this.layout; return [(px - L.ox) / L.k, (py - L.oy) / L.k]; }
  sliderAt(px, py) {
    if (!this.cfg.ui.show_volume || this.state === "menu") return null;
    const [lx, ly] = this.toLogical(px, py);
    for (const s of this.layout.sliders) if (lx >= s.x0 - 14 && lx <= s.x1 + 14 && Math.abs(ly - s.y) <= 18) return s.label;
    return null;
  }
  setSlider(label, px) {
    const s = this.layout.sliders.find((x) => x.label === label);
    const [lx] = this.toLogical(px, 0);
    let v = (lx - s.x0) / (s.x1 - s.x0);
    v = clamp(v, 0, 1); if (v < 0.02) v = 0;
    if (label === "music") { this.volMusic = v; if (this.music) this.music.volume = v; }
    else { this.volSfx = v; this.applyVolumes(); }
  }
  overShuffle(px, py) {
    if (!this.cfg.shuffle.enabled || this.state !== "play") return false;
    const [lx, ly] = this.toLogical(px, py);
    const r = this.layout.shuffleRect;
    return lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h;
  }

  onPointerDown(px, py, id) {
    if (this.pointerId !== null) return; // один палец за раз
    const sl = this.sliderAt(px, py);
    if (sl) { this.drag = sl; this.pointerId = id; this.setSlider(sl, px); return; }
    if (this.overShuffle(px, py)) { this.pointerId = id; this.pendingTap = "shuffle"; return; }
    if (this.state === "menu") { this.pointerId = id; this.pendingTap = "start"; return; }
    if (this.state === "over") { this.pointerId = id; this.pendingTap = "restart"; return; }
    if (this.state === "play" && this.cooldown <= 0 && !this.anim) {
      this.pointerId = id; this.aiming = true;
      const [lx] = this.toLogical(px, py);
      this.holdX = lx;
    }
  }
  onPointerMove(px, py, id) {
    if (id !== this.pointerId) return;
    if (this.drag) { this.setSlider(this.drag, px); return; }
    if (this.aiming) { const [lx] = this.toLogical(px, py); this.holdX = lx; }
  }
  onPointerUp(px, py, id) {
    if (id !== this.pointerId) return;
    if (this.drag) { this.saveGame(); this.drag = null; this.pointerId = null; return; }
    if (this.pendingTap === "shuffle") { this.startShuffle(); }
    else if (this.pendingTap === "start") { this.start(); }
    else if (this.pendingTap === "restart") { if (this.time - this.overTime > 0.5) this.start(); }
    else if (this.aiming) { this.drop(); }
    this.pendingTap = null; this.aiming = false; this.pointerId = null;
  }

  // ------------------------------------------------------------- draw helpers
  P(x, y) { return [this.layout.ox + x * this.layout.k, this.layout.oy + y * this.layout.k]; }
  px(logicalLen) { return logicalLen * this.layout.k; }
  roundRect(ctx, x, y, w, h, r, fill, stroke, strokeW) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke && strokeW > 0) { ctx.lineWidth = strokeW; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  panel(x, y, w, h) {
    const st = this.cfg.ui.panel;
    const [px, py] = this.P(x, y);
    this.roundRect(this.ctx, px, py, this.px(w), this.px(h), this.px(st.radius), rgba(st.fill_color), rgb(st.border_color), this.px(st.border_width));
  }
  spriteFor(level, dLogical) {
    const key = level + "_" + Math.round(dLogical);
    let s = this.sprites[key];
    if (s) return s;
    const dPx = Math.max(2, Math.round(this.px(dLogical)));
    const img = this.charImg[level];
    const canvas = document.createElement("canvas");
    canvas.width = dPx; canvas.height = dPx;
    const c = canvas.getContext("2d");
    if (img) {
      const scale = (dPx * this.chars[level].image_scale) / Math.max(img.width, img.height);
      const w = img.width * scale, h = img.height * scale;
      c.drawImage(img, (dPx - w) / 2, (dPx - h) / 2, w, h);
    } else {
      this.drawPlaceholder(c, dPx, level);
    }
    this.sprites[key] = canvas;
    return canvas;
  }
  drawPlaceholder(c, d, level) {
    const ch = this.chars[level];
    const col = ch.color, dark = col.map((v) => Math.round(v * 0.65));
    const r = d / 2;
    c.beginPath(); c.arc(r, r, r, 0, Math.PI * 2); c.fillStyle = rgb(dark); c.fill();
    c.beginPath(); c.arc(r, r, Math.max(1, r - Math.max(2, d * 0.04)), 0, Math.PI * 2); c.fillStyle = rgb(col); c.fill();
    const er = Math.max(2, d * 0.09);
    for (const sx of [-1, 1]) {
      const ex = r + sx * d * 0.17, ey = r - d * 0.12;
      c.beginPath(); c.arc(ex, ey, er, 0, Math.PI * 2); c.fillStyle = "#fff"; c.fill();
      c.beginPath(); c.arc(ex + sx * er * 0.1, ey + er * 0.1, er * 0.5, 0, Math.PI * 2); c.fillStyle = "#1e1e1e"; c.fill();
    }
    if (d >= 36) {
      const lum = 0.299 * col[0] + 0.587 * col[1] + 0.114 * col[2];
      c.fillStyle = lum < 140 ? "#fff" : "#3c2818";
      let fs = Math.max(8, Math.round(d * 0.2));
      c.font = `bold ${fs}px system-ui,sans-serif`;
      while (c.measureText(ch.name).width > d * 0.86 && fs > 7) { fs -= 1; c.font = `bold ${fs}px system-ui,sans-serif`; }
      c.textAlign = "center"; c.textBaseline = "middle";
      c.fillText(ch.name, r, r + d * 0.2);
    }
  }
  text(s, size, color, x, y, align = "center", baseline = "alphabetic", shadow = true) {
    const ctx = this.ctx;
    const [px, py] = this.P(x, y);
    ctx.font = `bold ${Math.max(6, Math.round(this.px(size)))}px "GameFont",system-ui,sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = baseline;
    if (shadow) { ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillText(s, px + 2, py + 2); }
    ctx.fillStyle = color; ctx.fillText(s, px, py);
  }

  // ------------------------------------------------------------- draw
  draw() {
    const ctx = this.ctx, L = this.layout, cfg = this.cfg;
    ctx.save();
    ctx.fillStyle = rgb(cfg.background.color);
    ctx.fillRect(0, 0, this.screenW, this.screenH);
    this.drawBackground();

    if (this.state === "menu") { this.drawStartScreen(); ctx.restore(); return; }

    const ui = cfg.ui, tc = rgb(ui.text_color), ac = rgb(ui.accent_color);
    this.text(cfg.title, 30, tc, L.titlePos[0], L.titlePos[1], "center", "middle");
    if (cfg.subtitle) this.text(cfg.subtitle, 16, ac, L.subtitlePos[0], L.subtitlePos[1], "center", "middle");

    if (L.mode === "landscape") { this.panel(L.lp.x, L.lp.y, L.lp.w, L.lp.h); this.panel(L.rp.x, L.rp.y, L.rp.w, L.rp.h); }
    else { this.panel(L.topPanel.x, L.topPanel.y, L.topPanel.w, L.topPanel.h); this.panel(L.botPanel.x, L.botPanel.y, L.botPanel.w, L.botPanel.h); }

    this.drawContainerBack();
    this.drawGuideline();
    this.drawPieces();
    this.drawContainerFront();
    this.drawHeld();
    this.drawParticles();
    this.drawPanelsContent();
    this.drawShuffleButton();
    this.drawVolume();
    this.drawToast();
    if (this.state === "over") this.drawGameOver();
    this.text(cfg.messages.controls, 13, tc, L.controlsPos[0], L.controlsPos[1], "center", "middle");
    ctx.restore();
  }
  drawBackground() {
    if (!this.bgImg) return;
    const sw = this.screenW, sh = this.screenH;
    const iw = this.bgImg.width, ih = this.bgImg.height;
    const fit = this.cfg.background.fit;
    const ctx = this.ctx;
    if (fit === "stretch") {
      const [x, y] = this.P(0, 0);
      ctx.drawImage(this.bgImg, x, y, this.px(this.layout.cw + (this.layout.mode === "landscape" ? 0 : 0)), this.px(this.layout.ch));
    } else {
      const k = Math.max(sw / iw, sh / ih);
      const w = iw * k, h = ih * k;
      ctx.drawImage(this.bgImg, (sw - w) / 2, (sh - h) / 2, w, h);
    }
  }
  drawContainerBack() {
    const L = this.layout, c = this.cfg.container;
    if (!this.containerImg) {
      const [x, y] = this.P(L.left, L.top);
      this.ctx.fillStyle = rgba(c.fill_color);
      this.ctx.fillRect(x, y, this.px(L.cw), this.px(L.ch));
    }
  }
  drawContainerFront() {
    const L = this.layout, c = this.cfg.container, ctx = this.ctx;
    const t = c.wall_thickness;
    if (this.containerImg) {
      const [x, y] = this.P(L.left - t, L.top);
      ctx.drawImage(this.containerImg, x, y, this.px(L.cw + 2 * t), this.px(L.ch + t));
    } else {
      const col = rgb(c.wall_color), half = t / 2;
      const Lx = L.left - half, Rx = L.right + half, B = L.bottom + half;
      const w = Math.max(1, this.px(t));
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round";
      ctx.beginPath();
      let [x1, y1] = this.P(Lx, L.top), [x2, y2] = this.P(Lx, B); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      [x1, y1] = this.P(Lx, B); [x2, y2] = this.P(Rx, B); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      [x1, y1] = this.P(Rx, B); [x2, y2] = this.P(Rx, L.top); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    // красная линия
    const col = this.cfg.container.danger_color;
    const alpha = this.danger ? 1 : 0.28;
    ctx.save(); ctx.setLineDash([this.px(10), this.px(10)]);
    ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
    ctx.lineWidth = Math.max(1, this.px(4));
    ctx.beginPath();
    let [x1, y1] = this.P(L.left, L.lineY), [x2, y2] = this.P(L.right, L.lineY);
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
  }
  drawGuideline() {
    if (this.state !== "play" || this.cooldown > 0 || this.anim) return;
    if (!this.cfg.gameplay.show_guideline) return;
    const L = this.layout, ctx = this.ctx;
    const r = this.chars[this.current].radius * this.chars[this.current].hitbox_scale;
    ctx.save(); ctx.setLineDash([this.px(6), this.px(10)]);
    ctx.strokeStyle = rgb(this.cfg.ui.guideline_color); ctx.lineWidth = Math.max(1, this.px(2));
    const [x, y0] = this.P(this.holdX, L.holdY + r);
    const [, yEnd] = this.P(0, L.bottom);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, yEnd); ctx.stroke(); ctx.restore();
  }
  drawPieces() {
    const ctx = this.ctx;
    for (const pc of this.pieces) {
      const d = this.chars[pc.level].radius * 2;
      const sprite = this.spriteFor(pc.level, d);
      let scale = 1;
      if (pc.pop > 0) scale = 0.5 + 0.5 * easeOutBack(1 - pc.pop / 0.28);
      const [x, y] = this.P(pc.x, pc.y);
      ctx.save(); ctx.translate(x, y); ctx.rotate(pc.angle); ctx.scale(scale, scale);
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
      ctx.restore();
    }
  }
  drawHeld() {
    if (this.state !== "play") return;
    const delay = this.cfg.gameplay.drop_delay;
    const prog = delay <= 0 ? 1 : 1 - this.cooldown / delay;
    const d = this.chars[this.current].radius * 2;
    const sprite = this.spriteFor(this.current, d);
    const scale = 0.4 + 0.6 * clamp(prog, 0, 1);
    const [x, y] = this.P(this.holdX, this.layout.holdY);
    this.ctx.save(); this.ctx.translate(x, y); this.ctx.scale(scale, scale);
    this.ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2);
    this.ctx.restore();
  }
  drawParticles() {
    const ctx = this.ctx;
    for (const pt of this.particles) {
      const [x, y] = this.P(pt.x, pt.y);
      const r = Math.max(1, this.px(pt.size) * Math.min(1, pt.life / 0.35));
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = rgb(pt.color); ctx.fill();
    }
  }
  drawPanelsContent() {
    const L = this.layout, m = this.cfg.messages, tc = rgb(this.cfg.ui.text_color), ac = rgb(this.cfg.ui.accent_color);
    if (L.mode === "landscape") {
      const cx = L.lp.x + L.lp.w / 2;
      this.text(m.score, 20, tc, cx, L.top + 4, "center", "top");
      this.text(String(this.score), 40, ac, cx, L.top + 30, "center", "top");
      this.text(m.best, 17, tc, cx, L.top + 100, "center", "top");
      this.text(String(this.best), 26, tc, cx, L.top + 124, "center", "top");
      if (this.cfg.ui.show_next && this.state === "play") {
        this.text(m.next, 18, tc, cx, L.top + 184, "center", "top");
        const d = Math.min(2 * this.chars[this.next].radius, 86);
        const spr = this.spriteFor(this.next, d);
        const [px, py] = this.P(cx, L.top + 232);
        this.ctx.drawImage(spr, px - spr.width / 2, py - spr.height / 2);
      }
      if (this.cfg.ui.show_ladder) {
        this.text(m.ladder, 19, tc, L.chainTitle.x, L.chainTitle.y, "left", "top");
        for (let i = 0; i < this.n; i++) {
          const y = L.chain.y0 + i * L.chain.step;
          const d = 22 + (20 * i) / Math.max(1, this.n - 1);
          const spr = this.spriteFor(i, d);
          const [px, py] = this.P(L.chain.x, y);
          this.ctx.drawImage(spr, px - spr.width / 2, py - spr.height / 2);
          this.text(this.chars[i].name, 13, tc, L.chain.labelX, y, "left", "middle");
        }
      }
    } else {
      this.text(m.score + ": " + this.score, 19, ac, L.scorePos.x, L.scorePos.y - 14, "center", "middle");
      this.text(m.best + ": " + this.best, 14, tc, L.scorePos.x, L.scorePos.y + 12, "center", "middle");
      if (this.cfg.ui.show_next && this.state === "play") {
        const d = Math.min(2 * this.chars[this.next].radius, 40);
        const spr = this.spriteFor(this.next, d);
        const [px, py] = this.P(L.nextPos.x, L.nextPos.y - 6);
        this.ctx.drawImage(spr, px - spr.width / 2, py - spr.height / 2);
        this.text(m.next, 11, tc, L.nextPos.x, L.nextPos.y + 24, "center", "top");
      }
      if (this.cfg.ui.show_ladder) {
        const ch = L.chain;
        const step = (ch.x1 - ch.x0) / this.n;
        for (let i = 0; i < this.n; i++) {
          const x = ch.x0 + step * (i + 0.5);
          const d = Math.min(ch.r * 2, step - 6);
          const spr = this.spriteFor(i, d);
          const [px, py] = this.P(x, ch.y);
          this.ctx.drawImage(spr, px - spr.width / 2, py - spr.height / 2);
        }
      }
    }
  }
  shuffleVisual() {
    const sc = this.cfg.shuffle, active = this.canShuffle(), ac = this.cfg.ui.accent_color;
    if (!active) return { fill: [196, 186, 176], border: [150, 140, 130], fg: [240, 236, 232] };
    return { fill: ac, border: ac.map((v) => Math.round(v * 0.7)), fg: [255, 255, 255] };
  }
  drawShuffleButton() {
    const sc = this.cfg.shuffle;
    if (!sc.enabled || this.state === "menu") return;
    const r = this.layout.shuffleRect;
    const v = this.shuffleVisual();
    const ctx = this.ctx;
    const [px, py] = this.P(r.x, r.y);
    this.roundRect(ctx, px, py, this.px(r.w), this.px(r.h), this.px(14), rgb(v.fill), rgb(v.border), this.px(3));
    // иконка
    const iconSize = Math.max(4, this.px(24));
    const [ix, iy] = this.P(r.x + 26, r.y + r.h / 2);
    if (this.shuffleImg) {
      ctx.drawImage(this.shuffleImg, ix - iconSize / 2, iy - iconSize / 2, iconSize, iconSize);
    } else {
      this.drawShuffleIcon(ix, iy, iconSize);
    }
    const label = this.cfg.messages.shuffle;
    let fsize = 16;
    const room = this.px(r.w - 58);
    ctx.fillStyle = rgb(v.fg); ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.max(6, this.px(fsize))}px "GameFont",system-ui,sans-serif`;
    while (ctx.measureText(label).width > room && fsize > 10) {
      fsize -= 1;
      ctx.font = `bold ${Math.max(6, this.px(fsize))}px "GameFont",system-ui,sans-serif`;
    }
    const [lx, ly] = this.P(r.x + 46, r.y + r.h / 2);
    ctx.fillText(label, lx, ly);
    // счётчик
    const [bx, by] = this.P(r.x + r.w - 3, r.y + 3);
    const br = this.px(12);
    ctx.beginPath(); ctx.arc(bx, by, br + this.px(2), 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = this.shufflesLeft > 0 ? rgb(this.cfg.ui.text_color) : "#968c82"; ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(6, this.px(14))}px system-ui,sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(this.shufflesLeft), bx, by + 1);
  }
  drawShuffleIcon(cx, cy, size) {
    const ctx = this.ctx, u = size / 32, w = Math.max(2, 3.2 * u);
    ctx.save(); ctx.translate(cx - size / 2, cy - size / 2);
    ctx.strokeStyle = "#fff"; ctx.fillStyle = "#fff"; ctx.lineWidth = w; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const [pts, yEnd] of [[[[3, 23], [11, 23], [20, 9], [24, 9]], 9], [[[3, 9], [11, 9], [20, 23], [24, 23]], 23]]) {
      ctx.beginPath(); ctx.moveTo(pts[0][0] * u, pts[0][1] * u);
      for (const p of pts.slice(1)) ctx.lineTo(p[0] * u, p[1] * u);
      ctx.stroke();
      ctx.beginPath(); ctx.moveTo(23 * u, (yEnd - 5.5) * u); ctx.lineTo(23 * u, (yEnd + 5.5) * u); ctx.lineTo(30.5 * u, yEnd * u); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  drawVolume() {
    if (!this.cfg.ui.show_volume || this.state === "menu" || !this.soundsLoaded) return;
    const L = this.layout, m = this.cfg.messages, ctx = this.ctx;
    const tc = rgb(this.cfg.ui.text_color), ac = this.cfg.ui.accent_color;
    for (const s of L.sliders) {
      const val = s.label === "music" ? this.volMusic : this.volSfx;
      const labelText = s.label === "music" ? m.music : m.sounds;
      this.text(labelText, 14, tc, s.x0, s.y - 22, "left", "alphabetic");
      this.text(Math.round(val * 100) + "%", 14, tc, s.x1, s.y - 22, "right", "alphabetic");
      const [ax, ay] = this.P(s.x0, s.y), [bx, by] = this.P(s.x1, s.y);
      const w = Math.max(3, this.px(6));
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgb(215,195,165)"; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      const kx = s.x0 + (s.x1 - s.x0) * val;
      if (val > 0) {
        const [kxp] = this.P(kx, s.y);
        ctx.strokeStyle = rgb(ac); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(kxp, by); ctx.stroke();
      }
      const [knx, kny] = this.P(kx, s.y);
      const hot = this.drag === s.label;
      ctx.beginPath(); ctx.arc(knx, kny, this.px(hot ? 13 : 10), 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill();
      ctx.beginPath(); ctx.arc(knx, kny, this.px(hot ? 9 : 7), 0, Math.PI * 2); ctx.fillStyle = rgb(ac); ctx.fill();
    }
  }
  drawToast() {
    if (!this.toast) return;
    const left = this.toast.until - this.time;
    const k = easeOutBack(clamp((this.toast.total - left) / 0.3, 0, 1));
    const size = Math.max(10, 28 * k);
    const y = this.layout.mode === "landscape" ? this.layout.top + 150 : this.layout.top + 100;
    this.text(this.toast.text, size, rgb(this.cfg.ui.accent_color), (this.layout.left + this.layout.right) / 2, y, "center", "middle");
  }
  dim(alpha) {
    this.ctx.fillStyle = `rgba(30,20,15,${alpha})`;
    this.ctx.fillRect(0, 0, this.screenW, this.screenH);
  }
  drawStartScreen() {
    this.dim(0.32);
    const pulse = 0.5 + 0.5 * Math.sin(this.time * 3);
    const ctx = this.ctx;
    const size = Math.max(8, Math.round(this.layout.k * 40 * (this.screenW / (this.screenW))));
    const fontPx = Math.max(16, Math.min(44, this.screenW * 0.05));
    ctx.font = `bold ${fontPx}px "GameFont",system-ui,sans-serif`;
    const text = this.cfg.messages.start_text;
    const tw = ctx.measureText(text).width;
    const pw = tw + 90, ph = fontPx + 60;
    const cx = this.screenW / 2, cy = this.screenH / 2;
    const st = this.cfg.ui.panel;
    this.roundRect(ctx, cx - pw / 2, cy - ph / 2, pw, ph, st.radius, rgba(st.fill_color), rgb(st.border_color), st.border_width);
    ctx.globalAlpha = 0.65 + 0.35 * pulse;
    ctx.fillStyle = rgb(this.cfg.ui.text_color);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, cx, cy);
    ctx.globalAlpha = 1;
    if (!this.soundsLoaded) {
      ctx.font = "14px system-ui,sans-serif"; ctx.fillStyle = "#fff";
      ctx.fillText("Загружаю звук…", cx, cy + ph / 2 + 24);
    }
  }
  drawGameOver() {
    this.dim(0.45);
    const m = this.cfg.messages;
    const cx = (this.layout.left + this.layout.right) / 2;
    const cy = (this.layout.top + this.layout.bottom) / 2 - 40;
    this.text(m.game_over, 38, "#fff", cx, cy, "center", "middle", false);
    this.text(m.score + ": " + this.score, 26, "#ffe2a0", cx, cy + 46, "center", "middle", false);
    if (this.newRecord) this.text(m.new_record, 22, "#ffaac6", cx, cy + 82, "center", "middle", false);
    else this.text(m.best + ": " + this.best, 18, "#f0e6dc", cx, cy + 82, "center", "middle", false);
    if (this.time - this.overTime > 0.6) this.text(m.restart_hint, 18, "#fff", cx, cy + 122, "center", "middle", false);
  }
}

// ---------------------------------------------------------------- bootstrap
function fitAudioUnlockHandlers(game) {
  const unlock = () => game.unlockAudio();
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
}

function main() {
  const canvas = document.getElementById("game");
  let cfg;
  try { cfg = loadConfig(); }
  catch (e) {
    document.getElementById("loading").textContent = "Ошибка в config.js: " + e.message;
    console.error(e);
    return;
  }
  const game = new Game(cfg, canvas);
  window.__game = game; // для отладки
  fitAudioUnlockHandlers(game);

  const onResize = () => game.resize();
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", () => setTimeout(onResize, 100));
  if (window.visualViewport) window.visualViewport.addEventListener("resize", onResize);

  canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); game.onPointerDown(e.clientX, e.clientY, e.pointerId); }, { passive: false });
  canvas.addEventListener("pointermove", (e) => { e.preventDefault(); game.onPointerMove(e.clientX, e.clientY, e.pointerId); }, { passive: false });
  canvas.addEventListener("pointerup", (e) => { e.preventDefault(); game.onPointerUp(e.clientX, e.clientY, e.pointerId); }, { passive: false });
  canvas.addEventListener("pointercancel", (e) => { game.onPointerUp(e.clientX, e.clientY, e.pointerId); });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Tab") { e.preventDefault(); game.startShuffle(); }
    if (e.code === "Space" || e.code === "Enter") {
      if (game.state === "menu") game.start();
      else if (game.state === "over") { if (game.time - game.overTime > 0.5) game.start(); }
      else game.drop();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.music) { try { game.music.pause(); } catch (e) {} }
    else if (!document.hidden && game.state === "play" && game.audioUnlocked && game.volMusic > 0 && game.music) {
      try { game.music.play().catch(() => {}); } catch (e) {}
    }
  });

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    game.update(dt);
    game.draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

main();
