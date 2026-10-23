import * as THREE from 'three';
import gsap from 'gsap';
import { PALETTE } from './palette.js';
import { PORTFOLIO_NEWSPAPERS } from './content.js';

export { PORTFOLIO_NEWSPAPERS };

export const SECTION_COVERS = {};

/* ==========================================================================
   Constants & Typography
   ========================================================================== */
const REDUCED_MOTION = typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const SHEET_W = 5.0;
const SHEET_H = 3.5; // ~1.43:1 Landscape ratio matching inspiration reference
const FOV = 40;
const TL_DURATION = 10;
const FOCUS_Z = 2.2;

// Canvas layout coordinates (2048x1434 for landscape crispness)
const LW = 2048;
const LH = 1434;
const M = 85;

const F_DISPLAY = '"Playfair Display", Georgia, serif';
const F_BODY = '"EB Garamond", Georgia, serif';
const F_CAPS = '"Cinzel", "Times New Roman", serif';

// Warm monochrome palette matching reference (newspaper-pile.jpg)
const INK_PRIMARY = '#3b2a1a'; // Dark warm brown, never pure black
const INK_MUTED = 'rgba(59, 42, 26, 0.78)';
const INK_ACCENT = '#7a3420';

// Lighting look presets — warm tan/sepia archival spread
const LOOK_BURST = { key: 2.0, hemi: 0.38, fill: 0.40, rim: 2.8, fog: 0.025, exposure: 0.95, bg: 0.0, dust: 0.50 };
const LOOK_FIELD = { key: 2.6, hemi: 0.52, fill: 0.75, rim: 0.0, fog: 0.008, exposure: 1.06, bg: 1.0, dust: 0.30 };

/* ==========================================================================
   State
   ========================================================================== */
let scene, camera, renderer;
let fieldGroup, bgMesh, bgMat, deskVignetteMesh, dustParticles;
let keyLight, hemiLight, fillLight, rimLight, candleLight;
let raycaster, mouse;
let maxAniso = 8;
let paperBumpTex = null;
let deckledAlphaTex = null;
let pileTexture = null;

let mainSheets = [];
let looseSheets = [];
let allSheets = [];
let pickables = [];

let timeline = null;
let scrollT = 0;
let focusScrollT = 0;

const grade = { ...LOOK_BURST };
const camProxy = { x: 0, y: 0, z: 6.5, ly: 0, lz: -4 };
const focusCam = { x: 0, y: 0, z: 8, ly: 0, lz: FOCUS_Z };
const camFocusMix = { v: 0 };
const globalDim = { v: 0 };
const mouseTarget = { x: 0, y: 0 };
const mouseScreen = { x: 0, y: 0 };
const lookTmp = new THREE.Vector3();

let fieldPose = { x: 0, y: 0, z: 12, ly: 0, lz: 0 };
let fieldBounds = { minX: -8, maxX: 8, minY: -4, maxY: 4 };
let safeArea = { top: 96, bottom: 24, focusBottom: 96 };

let hoveredSheet = null;
let activeSheet = null;
let isStoryFocused = false;
let imageOverlayOpen = false;
let onFocusChangeCallback = null;

// Hover ribbon DOM element
let hoverRibbonEl = null;
let hoverRibbonNum = null;
let hoverRibbonText = null;

// Reference images loaded in browser for canvas sampling
let localPortraitImg = null;

if (typeof window !== 'undefined') {
  localPortraitImg = new Image();
  localPortraitImg.src = '/images/portrait.jpg';
  localPortraitImg.onload = () => {
    const aboutSheet = mainSheets.find((s) => s.id === 'about');
    if (aboutSheet) {
      renderOverviewCover(aboutSheet);
      aboutSheet.overviewTex.needsUpdate = true;
    }
  };
}

/* ==========================================================================
   Helpers
   ========================================================================== */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = THREE.MathUtils.lerp;

function setFont(ctx, weight, size, family, style = '') {
  ctx.font = `${style} ${weight} ${Math.max(1, Math.round(size))}px ${family}`.trim();
}

function setSpacing(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px.toFixed(1)}px`;
}

function wrapLines(ctx, text, maxW) {
  if (!text) return [];
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawLines(ctx, lines, x, y, lh, draw = true) {
  if (draw) lines.forEach((l, i) => ctx.fillText(l, x, y + lh * (i + 0.78)));
  return y + lh * lines.length;
}

function hRule(ctx, x1, x2, y, w, color, draw = true) {
  if (!draw) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

function makeTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

/**
 * Procedural stippled paper grain bump map for tactile micro-texture
 */
function createPaperBumpTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  const imgData = ctx.getImageData(0, 0, 256, 256);
  const d = imgData.data;
  const rng = mulberry32(4242);
  for (let i = 0; i < d.length; i += 4) {
    const v = 128 + (rng() - 0.5) * 48;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
  }
  ctx.putImageData(imgData, 0, 0);

  // Micro-fibres
  ctx.strokeStyle = 'rgba(60, 60, 60, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 45; i++) {
    ctx.beginPath();
    const sx = rng() * 256, sy = rng() * 256;
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (rng() - 0.5) * 18, sy + (rng() - 0.5) * 12);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 6);
  return tex;
}

/**
 * Creates authentic torn deckled edge alpha map texture.
 * Features feathered fibrous ragged edges around the sheet.
 */
function createDeckledAlphaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 358;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 512, 358);

  const imgData = ctx.getImageData(0, 0, 512, 358);
  const data = imgData.data;
  const rng = mulberry32(404);
  const edge = 10;

  for (let y = 0; y < 358; y++) {
    for (let x = 0; x < 512; x++) {
      const dist = Math.min(x, 511 - x, y, 357 - y);
      if (dist < edge) {
        const noise = (Math.sin(x * 0.4) + Math.cos(y * 0.4) + (rng() - 0.5) * 1.5) * 2.2;
        const effDist = dist + noise;
        const a = Math.max(0, Math.min(255, Math.floor((effDist / edge) * 255)));
        data[(y * 512 + x) * 4 + 3] = a;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

/* ==========================================================================
   Paper Realism & Canvas Painter
   ========================================================================== */

const PAPER_TINTS = {
  education:  { base: '#f4ebd8', aged: '#dfcca5', deep: '#c6ad80' }, // Warm aged cream
  experience: { base: '#eddcc0', aged: '#d4ba8e', deep: '#bc9d6e' }, // Vintage warm tan
  projects:   { base: '#e9e3d4', aged: '#cfc4ad', deep: '#b5a990' }, // Grey-ivory rag paper
  about:      { base: '#f6ebd6', aged: '#dec498', deep: '#c7a772' }, // Antique parchment
  skills:     { base: '#eee2c6', aged: '#d5bd8e', deep: '#bd9e6c' }  // Ochre newsprint
};

/**
 * Paints authentic aged paper with uneven tone, pulp grain, foxing spots,
 * edge darkening, fold lines (horizontal and vertical creases), and subtle stains.
 */
function paintRealisticPaper(ctx, W, H, seed = 1, tintKey = 'education', withCoffeeRing = false) {
  const rng = mulberry32(seed);
  const tint = PAPER_TINTS[tintKey] || PAPER_TINTS.education;

  // 1. Base aged wash
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, tint.base);
  g.addColorStop(0.5, tint.aged);
  g.addColorStop(1, tint.deep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 2. High-density paper pulp fibres
  const n = Math.round((W * H) / 160);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = rng() < 0.6 ? 'rgba(84, 52, 22, 0.05)' : 'rgba(255, 252, 240, 0.08)';
    ctx.fillRect(rng() * W, rng() * H, 1 + rng() * 2.5, 1 + rng() * 1.5);
  }

  // 3. Natural mottled water/age clouds
  for (let k = 0; k < 4; k++) {
    const sx = rng() * W;
    const sy = rng() * H;
    const sr = (0.16 + rng() * 0.32) * W;
    const st = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
    st.addColorStop(0, 'rgba(140, 95, 45, 0.065)');
    st.addColorStop(1, 'rgba(140, 95, 45, 0)');
    ctx.fillStyle = st;
    ctx.fillRect(0, 0, W, H);
  }

  // 4. Foxing spots (tiny rusty freckles on old paper)
  const foxingCount = 20 + Math.floor(rng() * 20);
  for (let i = 0; i < foxingCount; i++) {
    const fx = rng() * W;
    const fy = rng() * H;
    const fr = 1.0 + rng() * 3.0;
    const fGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr * 2.0);
    fGrad.addColorStop(0, 'rgba(120, 70, 25, 0.22)');
    fGrad.addColorStop(0.4, 'rgba(120, 70, 25, 0.10)');
    fGrad.addColorStop(1, 'rgba(120, 70, 25, 0)');
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.arc(fx, fy, fr * 2.0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 5. Soft edge darkening / patina vignette
  const r = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.38, W / 2, H / 2, Math.max(W, H) * 0.72);
  r.addColorStop(0, 'rgba(0, 0, 0, 0)');
  r.addColorStop(0.75, 'rgba(92, 56, 22, 0.14)');
  r.addColorStop(1, 'rgba(78, 44, 16, 0.32)');
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, W, H);

  // 6. Two Soft Fold Lines (Vertical Crease + Horizontal Mid-Page Crease)
  const vx = W * 0.502;
  const vFold = ctx.createLinearGradient(vx - 20, 0, vx + 20, 0);
  vFold.addColorStop(0, 'rgba(0,0,0,0)');
  vFold.addColorStop(0.44, 'rgba(50, 30, 15, 0.13)');
  vFold.addColorStop(0.50, 'rgba(30, 16, 8, 0.18)');
  vFold.addColorStop(0.56, 'rgba(255, 250, 235, 0.18)');
  vFold.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = vFold;
  ctx.fillRect(vx - 20, 0, 40, H);

  const hy = H * 0.46;
  const hFold = ctx.createLinearGradient(0, hy - 16, 0, hy + 16);
  hFold.addColorStop(0, 'rgba(0,0,0,0)');
  hFold.addColorStop(0.44, 'rgba(50, 30, 15, 0.11)');
  hFold.addColorStop(0.50, 'rgba(30, 16, 8, 0.15)');
  hFold.addColorStop(0.56, 'rgba(255, 250, 235, 0.16)');
  hFold.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hFold;
  ctx.fillRect(0, hy - 16, W, 32);

  // 7. Optional Coffee Ring Stain
  if (withCoffeeRing) {
    drawCoffeeRing(ctx, W * 0.84, H * 0.76, 88, rng);
  }
}

function drawCoffeeRing(ctx, cx, cy, radius, rng) {
  ctx.save();
  ctx.strokeStyle = 'rgba(96, 56, 22, 0.20)';
  ctx.lineWidth = 4.0;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(120, 72, 30, 0.10)';
  ctx.lineWidth = 7.0;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2);
  ctx.stroke();

  const wash = ctx.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 0.98);
  wash.addColorStop(0, 'rgba(100, 60, 25, 0.02)');
  wash.addColorStop(1, 'rgba(100, 60, 25, 0.07)');
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Draws real justified text in narrow columns at small print sizes (11-12px),
 * using actual content words and ragged line breaks. NO SOLID BLACK BARS.
 */
function drawJustifiedBodyColumn(ctx, text, x, y, width, lineHeight, maxLines = 14) {
  const words = String(text).split(/\s+/).filter(Boolean);
  let lineWords = [];
  let curWidth = 0;
  let lineCount = 0;

  setFont(ctx, 400, 11.5, F_BODY);
  ctx.fillStyle = INK_MUTED;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordW = ctx.measureText(word).width;
    const spaceW = ctx.measureText(' ').width;

    if (curWidth + wordW > width && lineWords.length > 0) {
      if (lineCount >= maxLines) break;
      const totalWordsW = lineWords.reduce((sum, w) => sum + ctx.measureText(w).width, 0);
      const totalSpace = width - totalWordsW;
      const gaps = lineWords.length - 1;
      const spaceSize = gaps > 0 ? Math.min(spaceW * 2.5, totalSpace / gaps) : spaceW;

      let curX = x;
      for (let j = 0; j < lineWords.length; j++) {
        ctx.fillText(lineWords[j], curX, y + lineHeight * (lineCount + 0.82));
        curX += ctx.measureText(lineWords[j]).width + spaceSize;
      }
      lineCount++;
      lineWords = [word];
      curWidth = wordW;
    } else {
      lineWords.push(word);
      curWidth += wordW + spaceW;
    }
  }

  // Last line is left-aligned
  if (lineWords.length > 0 && lineCount < maxLines) {
    let curX = x;
    const spaceW = ctx.measureText(' ').width;
    for (let j = 0; j < lineWords.length; j++) {
      ctx.fillText(lineWords[j], curX, y + lineHeight * (lineCount + 0.82));
      curX += ctx.measureText(lineWords[j]).width + spaceW;
    }
    lineCount++;
  }

  return y + lineCount * lineHeight;
}

/**
 * Draws a soft sepia halftone hero photo (moderate contrast, light vignette,
 * photo corners, italic caption). NEVER a black blob.
 */
function drawHalftoneHeroPhoto(ctx, x, y, w, h, caption, seed = 1, sourceImg = null) {
  ctx.save();
  ctx.fillStyle = '#ebdcc2';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(74, 52, 28, 0.65)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x, y, w, h);

  const pad = 5;
  const ix = x + pad;
  const iy = y + pad;
  const iw = w - pad * 2;
  const ih = h - pad * 2 - 20;

  ctx.fillStyle = '#dfcca8';
  ctx.fillRect(ix, iy, iw, ih);

  const dotStep = 4.8;
  const rng = mulberry32(seed);

  let sampleCanvas = null;
  let sampleCtx = null;
  let sampleData = null;

  // 1. If real source image is provided (e.g. portrait.jpg), sample from it
  if (sourceImg && sourceImg.complete && sourceImg.naturalWidth > 0) {
    sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = Math.max(1, Math.floor(iw / dotStep));
    sampleCanvas.height = Math.max(1, Math.floor(ih / dotStep));
    sampleCtx = sampleCanvas.getContext('2d');
    sampleCtx.drawImage(sourceImg, 0, 0, sampleCanvas.width, sampleCanvas.height);
    sampleData = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
  }
  // 2. Otherwise use clean procedural architectural / landscape shapes with fine grain (never sample newspaper-pile)

  const cols = Math.floor(iw / dotStep);
  const rows = Math.floor(ih / dotStep);

  // Soft sepia ink dots with moderate contrast
  ctx.fillStyle = INK_PRIMARY;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let luma = 0.52;
      if (sampleData && sampleCanvas) {
        const idx = (r * sampleCanvas.width + c) * 4;
        const red = sampleData[idx] || 0;
        const green = sampleData[idx + 1] || 0;
        const blue = sampleData[idx + 2] || 0;
        luma = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
      } else {
        const nx = (c / cols - 0.5) * 2;
        const ny = (r / rows - 0.5) * 2;
        const dist = Math.sqrt(nx * nx + ny * ny);
        const noise = (rng() - 0.5) * 0.18;
        const arch = Math.sin(nx * 3.2) * 0.2 + (1 - ny * 0.5) * 0.3;
        luma = Math.max(0.18, Math.min(0.85, 0.48 + arch - dist * 0.28 + noise));
      }

      // Moderate contrast curve (never solid black, preserves mid-tones)
      const darkness = Math.max(0, Math.min(1, 1 - luma));
      const radius = Math.max(0.5, darkness * (dotStep * 0.62));

      const dx = ix + c * dotStep + dotStep / 2;
      const dy = iy + r * dotStep + dotStep / 2;

      ctx.beginPath();
      ctx.arc(dx, dy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Classic dark corner brackets
  const cornerSize = 13;
  ctx.fillStyle = '#26190e';
  // Top-left
  ctx.beginPath();
  ctx.moveTo(ix - 1, iy - 1);
  ctx.lineTo(ix + cornerSize, iy - 1);
  ctx.lineTo(ix - 1, iy + cornerSize);
  ctx.closePath();
  ctx.fill();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(ix + iw + 1, iy - 1);
  ctx.lineTo(ix + iw - cornerSize, iy - 1);
  ctx.lineTo(ix + iw + 1, iy + cornerSize);
  ctx.closePath();
  ctx.fill();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(ix - 1, iy + ih + 1);
  ctx.lineTo(ix + cornerSize, iy + ih + 1);
  ctx.lineTo(ix - 1, iy + ih - cornerSize);
  ctx.closePath();
  ctx.fill();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(ix + iw + 1, iy + ih + 1);
  ctx.lineTo(ix + iw - cornerSize, iy + ih + 1);
  ctx.lineTo(ix + iw + 1, iy + ih - cornerSize);
  ctx.closePath();
  ctx.fill();

  // Gentle light vignette (moderate)
  const vig = ctx.createRadialGradient(ix + iw / 2, iy + ih / 2, Math.min(iw, ih) * 0.35, ix + iw / 2, iy + ih / 2, Math.max(iw, ih) * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(60, 42, 20, 0.28)');
  ctx.fillStyle = vig;
  ctx.fillRect(ix, iy, iw, ih);

  if (caption) {
    setFont(ctx, 400, 12.5, F_BODY, 'italic');
    ctx.fillStyle = INK_PRIMARY;
    ctx.textAlign = 'center';
    ctx.fillText(caption, x + w / 2, y + h - 5);
    ctx.textAlign = 'left';
  }
  ctx.restore();
}

function drawTactileStamp(ctx, text, sub, x, y, angle = -0.10, color = 'rgba(154, 42, 26, 0.75)') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.strokeRect(-100, -26, 200, 52);
  ctx.lineWidth = 1.0;
  ctx.strokeRect(-96, -22, 192, 44);

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  setFont(ctx, 700, 14, F_CAPS);
  setSpacing(ctx, 3);
  ctx.fillText(text, 0, -3);
  setFont(ctx, 600, 10, F_CAPS);
  setSpacing(ctx, 2);
  ctx.fillText(sub, 0, 13);
  setSpacing(ctx, 0);
  ctx.restore();
}

function drawBrassPaperclip(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(3, -24);
  ctx.lineTo(3, 44);
  ctx.arc(11, 44, 8, Math.PI, 0, true);
  ctx.lineTo(19, -16);
  ctx.stroke();

  ctx.strokeStyle = '#c29944';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(0, -26);
  ctx.lineTo(0, 42);
  ctx.arc(8, 42, 8, Math.PI, 0, true);
  ctx.lineTo(16, -18);
  ctx.arc(12, -18, 4, 0, Math.PI, true);
  ctx.lineTo(8, 30);
  ctx.stroke();

  ctx.strokeStyle = '#f8df9e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0.5, -24);
  ctx.lineTo(0.5, 40);
  ctx.stroke();
  ctx.restore();
}

function drawWashiTape(ctx, x, y, angle = -0.38) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(230, 214, 178, 0.70)';
  ctx.fillRect(-60, -13, 120, 26);
  ctx.strokeStyle = 'rgba(150, 130, 95, 0.40)';
  ctx.lineWidth = 1;
  ctx.strokeRect(-60, -13, 120, 26);
  ctx.restore();
}

/* ==========================================================================
   Level 1: Overview Cover Painter (Designed to match inspiration-field.png)
   - Large bold serif Section Title (~9% width = 182px)
   - Italic Subtitle (~3.8% width = 76px)
   - Short text column on left in large type (~3.2% width = 64px, 40-50 words)
   - Sepia photo on right with small italic caption (~2% width = 42px)
   - Footer of three words separated by dots (46px)
   - Legible at a distance, zero empty areas, aged tactile paper
   ========================================================================== */

const OVERVIEW_DATA = {
  education: {
    title: 'Education',
    subtitle: 'Building the foundation for tomorrow',
    body: 'My academic journey has given me the knowledge, curiosity, and confidence to keep learning. From formative schooling through higher secondary to an advanced MCA curriculum, it is not just about degrees, but about the mindset to grow beyond the classroom and build solutions that endure.',
    caption: 'Small steps, big dreams. Learning beyond the classroom.',
    footer: ['LEARN', 'EXPLORE', 'EVOLVE']
  },
  experience: {
    title: 'Experience',
    subtitle: 'The chapters that shaped my journey',
    body: 'Every experience has taught me something — about people, processes, and myself. Across practical internships in UI/UX design, data science, Python, web development, and operations, these milestones have shaped the person I am today through real production work, collaborative teams, and disciplined execution.',
    caption: 'Real work. Real people. Real growth.',
    footer: ['BUILD', 'CONTRIBUTE', 'LEAD']
  },
  projects: {
    title: 'Projects',
    subtitle: 'Ideas into action',
    body: 'Through practical projects, I have explored new technologies, solved real problems, and turned ideas into meaningful solutions. From automated answer sheet evaluation presented at ICAC 2026 to AI recommendation engines and full-stack web platforms, each project has been a step closer to engineering excellence.',
    caption: 'Lead research: Automated error-free grading.',
    footer: ['BUILD', 'SOLVE', 'CREATE']
  },
  about: {
    title: 'About',
    subtitle: 'A versatile technologist with a communicator’s voice',
    body: 'I am an MCA graduate with a versatile technical foundation across Python, web development, UI/UX design, and data analysis, combined with strong leadership. Eager to contribute across technical and business-support roles, bringing systematic discipline, proactive communication, and positive energy to build meaningful digital products.',
    caption: 'Nashrin Fathima B. · Tiruchirappalli, Tamil Nadu.',
    footer: ['OBSERVE', 'REFLECT', 'SHARE']
  },
  skills: {
    title: 'Skills',
    subtitle: 'Technical craft meets professional strength',
    body: 'Hands-on proficiencies applying programming languages, data pipelines, modern interface tooling, and scalable architectural patterns. From core Python, responsive web systems, and Figma UI/UX architecture to cloud hosting fundamentals, public speaking, event orchestration, and operations management — uniting technical craft with clear human communication.',
    caption: 'Craft, logic and leadership in balance.',
    footer: ['CRAFT', 'CODE', 'DESIGN']
  }
};

/**
 * Draws a clean procedural sepia scene (soft gradient, architecture/workspace shapes, fine grain).
 * NEVER uses crops of the newspaper pile inside photo frames.
 */
function drawProceduralSepiaScene(ctx, x, y, w, h, sectionId, seed = 1) {
  const rng = mulberry32(seed);

  // Soft warm sky / room gradient
  const skyGrad = ctx.createLinearGradient(x, y, x, y + h);
  skyGrad.addColorStop(0, '#f2e5d0');
  skyGrad.addColorStop(0.5, '#debfa0');
  skyGrad.addColorStop(1, '#947250');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(x, y, w, h);

  if (sectionId === 'education') {
    // Neoclassical University Hall with Columns & Pediment
    const groundY = y + h * 0.76;
    ctx.fillStyle = '#4c3522';
    ctx.fillRect(x, groundY, w, h - (groundY - y));

    // Distant lawn trees in sepia
    ctx.fillStyle = '#684d34';
    for (let i = 0; i < 7; i++) {
      const tx = x + (i / 6) * w * 0.95 + (rng() - 0.5) * 20;
      const th = 40 + rng() * 35;
      ctx.beginPath();
      ctx.arc(tx, groundY - th * 0.5, 32 + rng() * 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // Main University Facade
    const bW = w * 0.68;
    const bH = h * 0.52;
    const bX = x + (w - bW) / 2;
    const bY = groundY - bH;

    // Building body
    ctx.fillStyle = '#d6bfa2';
    ctx.fillRect(bX, bY, bW, bH);
    ctx.strokeStyle = '#5a3d24';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bX, bY, bW, bH);

    // Dome / Cupola on roof
    const domeW = bW * 0.32;
    const domeH = bH * 0.32;
    const domeX = bX + (bW - domeW) / 2;
    ctx.fillStyle = '#bda080';
    ctx.beginPath();
    ctx.arc(domeX + domeW / 2, bY, domeW / 2, Math.PI, 0);
    ctx.fill();
    ctx.stroke();

    // Pediment (triangular roof gable)
    ctx.fillStyle = '#c7ab8b';
    ctx.beginPath();
    ctx.moveTo(bX - 10, bY);
    ctx.lineTo(bX + bW / 2, bY - 48);
    ctx.lineTo(bX + bW + 10, bY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 6 Classical Columns
    const numCols = 6;
    const colStep = (bW - 40) / (numCols - 1);
    ctx.fillStyle = '#f0e1cb';
    ctx.strokeStyle = '#5a3d24';
    ctx.lineWidth = 1.8;
    for (let c = 0; c < numCols; c++) {
      const cx = bX + 20 + c * colStep;
      ctx.fillRect(cx - 7, bY, 14, bH);
      ctx.strokeRect(cx - 7, bY, 14, bH);
    }

    // Arched Windows between columns
    ctx.fillStyle = '#3a2414';
    for (let c = 0; c < numCols - 1; c++) {
      const wx = bX + 20 + c * colStep + colStep / 2;
      ctx.beginPath();
      ctx.arc(wx, bY + bH * 0.38, 12, Math.PI, 0);
      ctx.lineTo(wx + 12, bY + bH * 0.72);
      ctx.lineTo(wx - 12, bY + bH * 0.72);
      ctx.closePath();
      ctx.fill();
    }

    // Grand stone staircase steps
    ctx.fillStyle = '#ecdac3';
    for (let s = 0; s < 5; s++) {
      const stepW = bW + 40 + s * 22;
      const stepH = 8;
      const stepX = bX - 20 - s * 11;
      const stepY = groundY + s * stepH;
      ctx.fillRect(stepX, stepY, stepW, stepH);
      ctx.strokeRect(stepX, stepY, stepW, stepH);
    }
  } else if (sectionId === 'experience') {
    // Cityscape & Industrial Architecture with River & Bridge
    const waterY = y + h * 0.70;

    // Distant buildings
    ctx.fillStyle = '#6b4d32';
    const numBuildings = 14;
    for (let i = 0; i < numBuildings; i++) {
      const bx = x + (i / numBuildings) * w;
      const bw = (w / numBuildings) * 1.05;
      const bh = 80 + ((i * 37) % 110);
      ctx.fillRect(bx, waterY - bh, bw, bh);
    }

    // Historic Clock Tower
    const towerX = x + w * 0.42;
    const towerW = 54;
    const towerH = 190;
    ctx.fillStyle = '#48301c';
    ctx.fillRect(towerX, waterY - towerH, towerW, towerH);
    // Spire
    ctx.beginPath();
    ctx.moveTo(towerX, waterY - towerH);
    ctx.lineTo(towerX + towerW / 2, waterY - towerH - 45);
    ctx.lineTo(towerX + towerW, waterY - towerH);
    ctx.closePath();
    ctx.fill();
    // Clock Face
    ctx.fillStyle = '#eddac0';
    ctx.beginPath();
    ctx.arc(towerX + towerW / 2, waterY - towerH + 32, 14, 0, Math.PI * 2);
    ctx.fill();

    // Suspension Bridge Arches
    ctx.strokeStyle = '#321f12';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, waterY - 30);
    ctx.quadraticCurveTo(x + w * 0.25, waterY - 110, x + w * 0.5, waterY - 30);
    ctx.quadraticCurveTo(x + w * 0.75, waterY - 110, x + w, waterY - 30);
    ctx.stroke();

    // Water river reflection
    const waterGrad = ctx.createLinearGradient(x, waterY, x, y + h);
    waterGrad.addColorStop(0, '#583f29');
    waterGrad.addColorStop(0.5, '#422c1b');
    waterGrad.addColorStop(1, '#2b1b10');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(x, waterY, w, h - (waterY - y));

    // Shimmering reflection ripples
    ctx.strokeStyle = 'rgba(235, 210, 175, 0.25)';
    ctx.lineWidth = 1.8;
    for (let r = 0; r < 14; r++) {
      const ry = waterY + 12 + r * 14;
      const rw = 60 + ((r * 43) % 180);
      const rx = towerX - rw / 2 + towerW / 2 + (rng() - 0.5) * 20;
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx + rw, ry);
      ctx.stroke();
    }
  } else if (sectionId === 'projects') {
    // Investigative Engineering Workspace: Laptop, Code, Notebook, Coffee
    const deskY = y + h * 0.38;
    const woodGrad = ctx.createLinearGradient(x, deskY, x, y + h);
    woodGrad.addColorStop(0, '#755436');
    woodGrad.addColorStop(0.5, '#563c25');
    woodGrad.addColorStop(1, '#342316');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(x, deskY, w, h - (deskY - y));

    // Wooden planks grain
    ctx.strokeStyle = 'rgba(30, 18, 10, 0.35)';
    ctx.lineWidth = 2.0;
    for (let i = 1; i <= 4; i++) {
      const py = deskY + (h - (deskY - y)) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(x, py);
      ctx.lineTo(x + w, py);
      ctx.stroke();
    }

    // Laptop Open at 3/4 angle
    const lapX = x + w * 0.16;
    const lapY = deskY + 20;
    const lapW = w * 0.46;
    const lapH = h * 0.44;

    // Screen
    ctx.fillStyle = '#1c1712';
    ctx.fillRect(lapX, lapY, lapW, lapH);
    ctx.strokeStyle = '#9e8467';
    ctx.lineWidth = 3;
    ctx.strokeRect(lapX, lapY, lapW, lapH);

    // Code lines glowing on screen in amber sepia
    ctx.fillStyle = '#f5dfbe';
    for (let cl = 0; cl < 12; cl++) {
      const cy = lapY + 24 + cl * 18;
      const cw = 40 + ((cl * 71) % Math.round(lapW * 0.65));
      const indent = (cl % 3) * 24;
      ctx.fillRect(lapX + 24 + indent, cy, cw, 6);
    }

    // Keyboard base
    ctx.fillStyle = '#3a2d22';
    ctx.beginPath();
    ctx.moveTo(lapX - 25, lapY + lapH);
    ctx.lineTo(lapX + lapW + 25, lapY + lapH);
    ctx.lineTo(lapX + lapW + 55, lapY + lapH + 65);
    ctx.lineTo(lapX - 55, lapY + lapH + 65);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Spiral Notebook on right
    const nbX = x + w * 0.68;
    const nbY = deskY + 45;
    const nbW = w * 0.26;
    const nbH = h * 0.46;
    ctx.fillStyle = '#eeddc5';
    ctx.fillRect(nbX, nbY, nbW, nbH);
    ctx.strokeStyle = '#5a422e';
    ctx.lineWidth = 2;
    ctx.strokeRect(nbX, nbY, nbW, nbH);

    // Ruled lines and schematic sketch
    ctx.strokeStyle = 'rgba(120, 80, 45, 0.45)';
    ctx.lineWidth = 1;
    for (let nl = 0; nl < 9; nl++) {
      const ny = nbY + 20 + nl * 22;
      ctx.beginPath();
      ctx.moveTo(nbX + 16, ny);
      ctx.lineTo(nbX + nbW - 16, ny);
      ctx.stroke();
    }
    // Schematic circuit / architecture box
    ctx.strokeStyle = '#7c2818';
    ctx.lineWidth = 1.8;
    ctx.strokeRect(nbX + 30, nbY + 80, nbW - 60, 60);

    // Coffee mug
    const cmX = x + w * 0.08;
    const cmY = deskY + 60;
    ctx.fillStyle = '#ecd4b6';
    ctx.beginPath();
    ctx.arc(cmX, cmY, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a3d24';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#261408';
    ctx.beginPath();
    ctx.arc(cmX, cmY, 21, 0, Math.PI * 2);
    ctx.fill();
  } else if (sectionId === 'skills') {
    // Drafting & Craftsmanship Studio: Blueprint Grid, Compass, Books, Tools
    const bgGrad = ctx.createLinearGradient(x, y, x, y + h);
    bgGrad.addColorStop(0, '#5a422c');
    bgGrad.addColorStop(1, '#2f1f13');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(x, y, w, h);

    // Architectural grid lines
    ctx.strokeStyle = 'rgba(235, 215, 185, 0.16)';
    ctx.lineWidth = 1;
    const gridStep = 32;
    for (let gx = x; gx <= x + w; gx += gridStep) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }
    for (let gy = y; gy <= y + h; gy += gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
      ctx.stroke();
    }

    // Geometric Drafting Curves
    ctx.strokeStyle = 'rgba(215, 175, 110, 0.45)';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(x + w * 0.48, y + h * 0.52, Math.min(w, h) * 0.38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w * 0.48, y + h * 0.52, Math.min(w, h) * 0.22, 0, Math.PI * 2);
    ctx.stroke();

    // Brass Drafting Compass
    const compX = x + w * 0.48;
    const compY = y + h * 0.28;
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(compX, compY);
    ctx.lineTo(compX - 60, compY + 160);
    ctx.moveTo(compX, compY);
    ctx.lineTo(compX + 60, compY + 160);
    ctx.stroke();
    // Hinge circle
    ctx.fillStyle = '#f0c75e';
    ctx.beginPath();
    ctx.arc(compX, compY, 11, 0, Math.PI * 2);
    ctx.fill();

    // Stack of reference leather books on right
    const bkX = x + w * 0.72;
    const bkY = y + h * 0.55;
    for (let b = 0; b < 3; b++) {
      const by = bkY + b * 28;
      ctx.fillStyle = b === 0 ? '#6e2b1d' : b === 1 ? '#3a4a35' : '#825628';
      ctx.fillRect(bkX - b * 6, by, 170, 24);
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(bkX - b * 6, by, 170, 24);
    }
  }

  // Fine photographic grain
  const nDots = Math.round((w * h) / 38);
  for (let d = 0; d < nDots; d++) {
    ctx.fillStyle = rng() < 0.5 ? 'rgba(40, 24, 12, 0.08)' : 'rgba(255, 248, 230, 0.08)';
    ctx.fillRect(x + rng() * w, y + rng() * h, 1.2, 1.2);
  }

  // Soft edge vignette
  const vig = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.35, x + w / 2, y + h / 2, Math.max(w, h) * 0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(0.7, 'rgba(50, 30, 15, 0.20)');
  vig.addColorStop(1, 'rgba(35, 20, 10, 0.50)');
  ctx.fillStyle = vig;
  ctx.fillRect(x, y, w, h);
}

/**
 * Draws a sepia photo frame with vintage album corners and italic caption.
 */
function drawOverviewSepiaPhoto(ctx, x, y, w, h, caption, sectionId, seed = 1, sourceImg = null) {
  ctx.save();

  // Photo frame card
  ctx.fillStyle = '#ebe0ce';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(74, 52, 28, 0.75)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x, y, w, h);

  const pad = 12;
  const ix = x + pad;
  const iy = y + pad;
  const iw = w - pad * 2;
  const ih = h - pad * 2 - 58; // Leave room for caption

  // Draw inner photo
  if (sourceImg && sourceImg.complete && sourceImg.naturalWidth > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(ix, iy, iw, ih);
    ctx.clip();

    const imgAspect = sourceImg.naturalWidth / sourceImg.naturalHeight;
    const boxAspect = iw / ih;
    let dw, dh, dx, dy;
    if (imgAspect > boxAspect) {
      dh = ih;
      dw = ih * imgAspect;
      dx = ix + (iw - dw) / 2;
      dy = iy;
    } else {
      dw = iw;
      dh = iw / imgAspect;
      dx = ix;
      dy = iy + (ih - dh) / 2;
    }
    ctx.drawImage(sourceImg, dx, dy, dw, dh);

    // Warm sepia multiply & overlay
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#c8a882';
    ctx.fillRect(ix, iy, iw, ih);
    ctx.globalCompositeOperation = 'source-over';

    // Soft grain
    const rng = mulberry32(seed);
    const nDots = Math.round((iw * ih) / 45);
    for (let d = 0; d < nDots; d++) {
      ctx.fillStyle = rng() < 0.5 ? 'rgba(40, 24, 12, 0.08)' : 'rgba(255, 248, 230, 0.08)';
      ctx.fillRect(ix + rng() * iw, iy + rng() * ih, 1.2, 1.2);
    }
    // Vignette
    const vig = ctx.createRadialGradient(ix + iw / 2, iy + ih / 2, Math.min(iw, ih) * 0.35, ix + iw / 2, iy + ih / 2, Math.max(iw, ih) * 0.75);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(50, 30, 15, 0.35)');
    ctx.fillStyle = vig;
    ctx.fillRect(ix, iy, iw, ih);
    ctx.restore();
  } else {
    // Procedural clean sepia scene
    drawProceduralSepiaScene(ctx, ix, iy, iw, ih, sectionId, seed);
  }

  // Inner photo border
  ctx.strokeStyle = 'rgba(65, 45, 25, 0.85)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(ix, iy, iw, ih);

  // 4 Vintage Album Corner Tabs (Dark sepia photo corners)
  const cSize = 18;
  ctx.fillStyle = '#2a1a0e';
  // Top-left
  ctx.beginPath();
  ctx.moveTo(ix - 1, iy - 1);
  ctx.lineTo(ix + cSize, iy - 1);
  ctx.lineTo(ix - 1, iy + cSize);
  ctx.closePath();
  ctx.fill();
  // Top-right
  ctx.beginPath();
  ctx.moveTo(ix + iw + 1, iy - 1);
  ctx.lineTo(ix + iw - cSize, iy - 1);
  ctx.lineTo(ix + iw + 1, iy + cSize);
  ctx.closePath();
  ctx.fill();
  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(ix - 1, iy + ih + 1);
  ctx.lineTo(ix + cSize, iy + ih + 1);
  ctx.lineTo(ix - 1, iy + ih - cSize);
  ctx.closePath();
  ctx.fill();
  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(ix + iw + 1, iy + ih + 1);
  ctx.lineTo(ix + iw - cSize, iy + ih + 1);
  ctx.lineTo(ix + iw + 1, iy + ih - cSize);
  ctx.closePath();
  ctx.fill();

  // Photo Caption under image (~2% width = 42px)
  if (caption) {
    setFont(ctx, 400, 42, F_BODY, 'italic');
    ctx.fillStyle = INK_PRIMARY;
    ctx.textAlign = 'center';
    ctx.fillText(caption, x + w / 2, y + h - 18);
    ctx.textAlign = 'left';
  }

  ctx.restore();
}

/**
 * Safely measures, wraps, and renders overview sheet body text so it NEVER overflows
 * the column or enters the reserved footer band.
 * Steps down font size from 58px down to 36px in small steps (2px) to fit available height.
 * If text still exceeds maxH at minFontSize, trims to the last full sentence that fits
 * and appends an ellipsis.
 */
function drawFitOverviewBodyText(ctx, text, x, y, maxW, maxH) {
  if (!text) return;
  const baseFontSize = 58;
  const minFontSize = 36;
  let chosenSize = minFontSize;
  let chosenLines = [];
  let chosenLineHeight = Math.round(chosenSize * 1.30);

  // 1. Measure and step down font size in small steps (2px)
  for (let sz = baseFontSize; sz >= minFontSize; sz -= 2) {
    setFont(ctx, 400, sz, F_BODY);
    const lh = Math.round(sz * 1.30);
    const lines = wrapLines(ctx, text, maxW);
    const totalH = (lines.length - 1) * lh + sz * 1.15;
    if (totalH <= maxH) {
      chosenSize = sz;
      chosenLines = lines;
      chosenLineHeight = lh;
      break;
    }
  }

  // 2. If it still doesn't fit at minFontSize, trim to last full sentence that fits
  if (chosenLines.length === 0 || (chosenLines.length - 1) * chosenLineHeight + chosenSize * 1.15 > maxH) {
    chosenSize = minFontSize;
    chosenLineHeight = Math.round(chosenSize * 1.30);
    setFont(ctx, 400, chosenSize, F_BODY);
    const maxAllowedLines = Math.max(1, Math.floor((maxH - chosenSize * 0.20) / chosenLineHeight));

    // Match full sentences ending in ., !, or ?
    const sentenceMatches = text.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [text];
    let fittingSentences = '';
    let fittingLines = [];

    for (let s = 0; s < sentenceMatches.length; s++) {
      const candidate = fittingSentences ? `${fittingSentences} ${sentenceMatches[s].trim()}` : sentenceMatches[s].trim();
      const testLines = wrapLines(ctx, candidate, maxW);
      if (testLines.length <= maxAllowedLines) {
        fittingSentences = candidate;
        fittingLines = testLines;
      } else {
        break;
      }
    }

    if (fittingLines.length > 0) {
      chosenLines = fittingLines;
      // If any sentence was omitted, append ellipsis to the last line
      if (fittingSentences.trim().length < text.trim().length) {
        const lastIdx = chosenLines.length - 1;
        let lastLine = chosenLines[lastIdx].replace(/[.!?]+$/, '');
        while (lastLine && ctx.measureText(lastLine + ' …').width > maxW) {
          const words = lastLine.split(' ');
          if (words.length <= 1) break;
          words.pop();
          lastLine = words.join(' ');
        }
        chosenLines[lastIdx] = lastLine + ' …';
      }
    } else {
      // If even the first sentence exceeds maxAllowedLines, truncate words on the last allowed line
      const allLines = wrapLines(ctx, text, maxW);
      chosenLines = allLines.slice(0, maxAllowedLines);
      const lastIdx = chosenLines.length - 1;
      let lastLine = chosenLines[lastIdx];
      while (lastLine && ctx.measureText(lastLine + ' …').width > maxW) {
        const words = lastLine.split(' ');
        if (words.length <= 1) break;
        words.pop();
        lastLine = words.join(' ');
      }
      chosenLines[lastIdx] = lastLine + ' …';
    }
  }

  // 3. Draw text lines safely within [y, y + maxH]
  setFont(ctx, 400, chosenSize, F_BODY);
  ctx.fillStyle = INK_PRIMARY;
  for (let i = 0; i < chosenLines.length; i++) {
    const lineY = y + i * chosenLineHeight + chosenSize * 0.90;
    ctx.fillText(chosenLines[i], x, lineY);
  }
}

function renderOverviewCover(sheet) {
  const { overviewCanvas, paper } = sheet;
  const ctx = overviewCanvas.getContext('2d');
  const W = LW;
  const H = LH;
  const seed = sheet.seed || 101;
  const sectionId = paper.id;
  const data = OVERVIEW_DATA[sectionId] || OVERVIEW_DATA.education;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const withCoffee = sectionId === 'skills' || sectionId === 'experience';
  paintRealisticPaper(ctx, W, H, seed, sectionId, withCoffee);

  // Oxford double outer border rules in dark brown ink
  ctx.strokeStyle = INK_PRIMARY;
  ctx.lineWidth = 3.5;
  ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(38, 38, W - 76, H - 76);

  const x0 = M;
  const wContent = W - 2 * M;
  let y = M;

  // 1. Top Masthead & Issue Strip
  setFont(ctx, 700, 40, F_CAPS);
  setSpacing(ctx, 3.5);
  ctx.fillStyle = INK_PRIMARY;
  ctx.fillText('THE DAILY CHRONICLE', x0, y + 24);

  ctx.textAlign = 'right';
  setSpacing(ctx, 2.5);
  ctx.fillText(paper.issueNo || 'VOL. 12 NO. 08', W - x0, y + 24);
  ctx.textAlign = 'left';
  setSpacing(ctx, 0);

  y += 50;
  hRule(ctx, x0, W - x0, y, 2.0, INK_PRIMARY);
  y += 28;

  // 2. Giant Section Title (about 9% of texture width = 182px!)
  setFont(ctx, 800, 182, F_DISPLAY);
  ctx.fillStyle = INK_PRIMARY;
  ctx.fillText(data.title, x0, y + 145);
  y += 165;

  // 3. Italic Subtitle directly under title (about 3.8% of texture width = 76px!)
  setFont(ctx, 400, 76, F_BODY, 'italic');
  ctx.fillStyle = '#4a3525';
  ctx.fillText(data.subtitle, x0, y + 60);
  y += 82;

  hRule(ctx, x0, W - x0, y, 1.8, INK_PRIMARY);
  y += 32;

  // 4. Two Main Content Regions: Left Text Column + Right Photo Card
  // Reserve fixed footer band: footerRule is at footerY - 14.
  // Leave a safe gap of 32px above footerRule, so text and photo end cleanly at contentBottom.
  const bodyTop = y;
  const footerY = H - M - 20;
  const footerRuleY = footerY - 14;
  const safeGap = 32;
  const contentH = footerRuleY - safeGap - bodyTop; // Exact matching height for both columns

  const colGap = 48;
  const leftColW = Math.round(wContent * 0.39);
  const rightColW = wContent - leftColW - colGap;
  const rightColX = x0 + leftColW + colGap;

  // Left Column: Measured and dynamically fitted body text that never enters footer band
  drawFitOverviewBodyText(ctx, data.body, x0, bodyTop + 6, leftColW - 12, contentH - 6);

  // Right Column: Sepia photo card + caption matching exact contentH
  const heroImg = sectionId === 'about' ? localPortraitImg : null;
  drawOverviewSepiaPhoto(ctx, rightColX, bodyTop, rightColW, contentH, data.caption, sectionId, seed + 99, heroImg);

  // 5. Tactile Details (Verified Stamp, brass paperclip, washi tape)
  if (sectionId === 'education') {
    drawTactileStamp(ctx, 'OFFICIAL ARCHIVE', 'VERIFIED TRANSCRIPT · 2026', W - x0 - 130, M + 95, 0.08, 'rgba(154, 42, 26, 0.75)');
  } else if (sectionId === 'experience') {
    drawBrassPaperclip(ctx, x0 + 170, 24);
  } else if (sectionId === 'projects') {
    drawWashiTape(ctx, x0 + 40, 48, -0.40);
    drawTactileStamp(ctx, 'ICAC 2026', 'CONFERENCE ACCEPTED', W - x0 - 120, M + 90, -0.06, 'rgba(40, 75, 115, 0.72)');
  } else if (sectionId === 'about') {
    drawTactileStamp(ctx, 'EXEMPLARY', 'CHRONICLE PROFILE DOSSIER', W - x0 - 125, M + 95, 0.05, 'rgba(154, 42, 26, 0.75)');
  }

  // 6. Bottom Footer Band: three words separated by dots (strictly reserved, never entered by text)
  hRule(ctx, x0, W - x0, footerY - 14, 2.0, INK_PRIMARY);
  hRule(ctx, x0, W - x0, footerY - 9, 1.0, INK_PRIMARY);

  const footerText = data.footer.join('   ◆   ');
  setFont(ctx, 700, 46, F_CAPS);
  setSpacing(ctx, 8);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK_PRIMARY;
  ctx.fillText(footerText, W / 2, footerY + 16);
  ctx.textAlign = 'left';
  setSpacing(ctx, 0);
}

/* ==========================================================================
   Level 2: Detailed Layout Painter (Zoomed Inspection View)
   ========================================================================== */
function renderDetailFront(sheet) {
  const { detailCanvas, paper } = sheet;
  const ctx = detailCanvas.getContext('2d');
  const W = LW;
  const H = LH;
  const seed = sheet.seed || 101;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  paintRealisticPaper(ctx, W, H, seed, paper.id, false);

  ctx.strokeStyle = INK_PRIMARY;
  ctx.lineWidth = 3.2;
  ctx.strokeRect(26, 26, W - 52, H - 52);
  ctx.lineWidth = 1.2;
  ctx.strokeRect(34, 34, W - 68, LH - 68);

  const x0 = M;
  const wContent = W - 2 * M;
  let y = M;

  setFont(ctx, 700, 25, F_CAPS);
  setSpacing(ctx, 3.5);
  ctx.fillStyle = INK_PRIMARY;
  ctx.fillText(paper.masthead || 'THE DAILY CHRONICLE', x0, y + 22);
  setSpacing(ctx, 0);

  setFont(ctx, 400, 16.5, F_BODY, 'italic');
  ctx.fillStyle = '#4e3928';
  ctx.fillText(paper.mastheadTagline || 'Real Stories. Brighter Tomorrows.', x0, y + 42);

  const sectionText = paper.sectionName || 'CHRONICLE ARCHIVE';
  setFont(ctx, 700, 30, F_CAPS);
  setSpacing(ctx, 6);
  const secW = ctx.measureText(sectionText).width;
  const centerX = W / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = INK_PRIMARY;
  ctx.fillText(sectionText, centerX, y + 26);
  ctx.textAlign = 'left';
  setSpacing(ctx, 0);

  const ruleGap = 22;
  hRule(ctx, x0 + 380, centerX - secW / 2 - ruleGap, y + 18, 1.2, INK_PRIMARY);
  hRule(ctx, centerX + secW / 2 + ruleGap, W - x0 - 290, y + 18, 1.2, INK_PRIMARY);

  setFont(ctx, 700, 18, F_CAPS);
  setSpacing(ctx, 3.5);
  ctx.fillStyle = '#4e3928';
  ctx.textAlign = 'right';
  ctx.fillText(paper.issueNo || 'VOL. 12 · NO. 01', W - x0, y + 24);
  ctx.textAlign = 'left';
  setSpacing(ctx, 0);

  y += 56;
  hRule(ctx, x0, W - x0, y, 3, INK_PRIMARY);
  hRule(ctx, x0, W - x0, y + 6, 1.2, INK_PRIMARY);
  y += 24;

  const wHeadlineCol = Math.round(wContent * 0.68);
  const wQuoteCol = wContent - wHeadlineCol - 40;
  const xQuote = x0 + wHeadlineCol + 40;

  setFont(ctx, 800, 48, F_DISPLAY);
  ctx.fillStyle = INK_PRIMARY;
  const headLines = wrapLines(ctx, paper.headline, wHeadlineCol);
  let curY = drawLines(ctx, headLines.slice(0, 2), x0, y, 54);

  setFont(ctx, 400, 21, F_BODY, 'italic');
  ctx.fillStyle = '#443224';
  const subLines = wrapLines(ctx, paper.subhead, wHeadlineCol);
  curY = drawLines(ctx, subLines.slice(0, 2), x0, curY + 6, 26);

  if (paper.pullQuote) {
    ctx.fillStyle = INK_ACCENT;
    ctx.fillRect(xQuote, y + 4, 3.5, 96);
    setFont(ctx, 400, 20.5, F_BODY, 'italic');
    ctx.fillStyle = INK_PRIMARY;
    const qLines = wrapLines(ctx, paper.pullQuote, wQuoteCol - 18);
    drawLines(ctx, qLines, xQuote + 18, y + 10, 28);
  }

  y = Math.max(curY, y + 104) + 14;
  hRule(ctx, x0, W - x0, y, 1.2, 'rgba(50, 30, 15, 0.45)');
  y += 20;

  const wBoxesArea = Math.round(wContent * 0.70);
  const wSidePanel = wContent - wBoxesArea - 32;
  const xSidePanel = x0 + wBoxesArea + 32;
  const bodyTopY = y;
  const footerY = LH - M - 26;
  const availableBodyH = footerY - bodyTopY - 20;

  ctx.strokeStyle = 'rgba(74, 53, 34, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(xSidePanel - 16, bodyTopY);
  ctx.lineTo(xSidePanel - 16, footerY - 14);
  ctx.stroke();

  const boxes = paper.boxes || [];
  if (boxes.length <= 2) {
    const boxW = Math.round((wBoxesArea - 24) / 2);
    boxes.forEach((b, i) => {
      drawStoryBoxCanvas(ctx, b, x0 + i * (boxW + 24), bodyTopY, boxW, availableBodyH - 10);
    });
  } else if (boxes.length === 3) {
    const leadH = Math.round(availableBodyH * 0.44);
    const subH = availableBodyH - leadH - 18;
    drawStoryBoxCanvas(ctx, boxes[0], x0, bodyTopY, wBoxesArea, leadH);
    const subW = Math.round((wBoxesArea - 22) / 2);
    drawStoryBoxCanvas(ctx, boxes[1], x0, bodyTopY + leadH + 18, subW, subH);
    drawStoryBoxCanvas(ctx, boxes[2], x0 + subW + 22, bodyTopY + leadH + 18, subW, subH);
  } else {
    const row1H = Math.round(availableBodyH * 0.50);
    const row2H = availableBodyH - row1H - 18;
    const col3W = Math.round((wBoxesArea - 36) / 3);
    const col2W = Math.round((wBoxesArea - 24) / 2);

    boxes.slice(0, 3).forEach((b, i) => {
      drawStoryBoxCanvas(ctx, b, x0 + i * (col3W + 18), bodyTopY, col3W, row1H);
    });
    boxes.slice(3, 5).forEach((b, i) => {
      drawStoryBoxCanvas(ctx, b, x0 + i * (col2W + 24), bodyTopY + row1H + 18, col2W, row2H);
    });
  }

  drawSidePanelCanvas(ctx, paper.sidePanel, paper.contactStrip, xSidePanel, bodyTopY, wSidePanel, availableBodyH);

  hRule(ctx, x0, W - x0, footerY - 14, 2, INK_PRIMARY);
  hRule(ctx, x0, W - x0, footerY - 9, 1, INK_PRIMARY);

  const footerWords = paper.footerWords || ['LEARN', 'GROW', 'ACHIEVE'];
  const footerText = footerWords.join('   ◆   ');
  setFont(ctx, 700, 16.5, F_CAPS);
  setSpacing(ctx, 6);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK_PRIMARY;
  ctx.fillText(footerText, W / 2, footerY + 12);
  ctx.textAlign = 'left';
  setSpacing(ctx, 0);
}

function drawStoryBoxCanvas(ctx, box, x, y, w, h) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(74, 53, 34, 0.32)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  const pad = 12;
  const ix = x + pad;
  let iy = y + pad;
  const iw = w - pad * 2;

  const numRadius = 14;
  ctx.fillStyle = '#22150b';
  ctx.beginPath();
  ctx.arc(ix + numRadius, iy + numRadius, numRadius, 0, Math.PI * 2);
  ctx.fill();

  setFont(ctx, 700, 13, F_CAPS);
  ctx.fillStyle = '#fbf5e8';
  ctx.textAlign = 'center';
  ctx.fillText(box.num, ix + numRadius, iy + numRadius + 4.5);
  ctx.textAlign = 'left';

  const titleX = ix + numRadius * 2 + 10;
  const titleW = iw - (numRadius * 2 + 10);
  setFont(ctx, 700, 16.5, F_DISPLAY);
  ctx.fillStyle = INK_PRIMARY;
  const titleLines = wrapLines(ctx, box.title, titleW);
  const nextY = drawLines(ctx, titleLines, titleX, iy, 19);

  setFont(ctx, 600, 12.5, F_CAPS);
  setSpacing(ctx, 1.5);
  ctx.fillStyle = INK_ACCENT;
  const subLines = wrapLines(ctx, box.subtitle, iw);
  iy = drawLines(ctx, subLines, ix, Math.max(iy + numRadius * 2 + 8, nextY + 4), 16);
  setSpacing(ctx, 0);
  iy += 6;

  setFont(ctx, 400, 14.5, F_BODY);
  ctx.fillStyle = '#2a1e14';
  const pLines = wrapLines(ctx, box.paragraph, iw);
  iy = drawLines(ctx, pLines.slice(0, 3), ix, iy, 18.5);

  const photoH = Math.min(105, Math.max(75, h - (iy - y) - 14));
  if (photoH >= 55) {
    const photoY = y + h - photoH - 8;
    drawHalftoneHeroPhoto(ctx, ix, photoY, iw, photoH, box.caption, parseInt(box.num, 10) || 1);
  }
  ctx.restore();
}

function drawSidePanelCanvas(ctx, panel, contactStrip, x, y, w, h) {
  if (!panel) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = 'rgba(235, 222, 198, 0.65)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#3c2a1c';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = INK_PRIMARY;
  ctx.fillRect(x, y, w, 5);

  const pad = 12;
  const ix = x + pad;
  let iy = y + pad + 6;
  const iw = w - pad * 2;

  setFont(ctx, 700, 16.5, F_CAPS);
  setSpacing(ctx, 3);
  ctx.textAlign = 'center';
  ctx.fillStyle = INK_PRIMARY;
  ctx.fillText(panel.title, x + w / 2, iy + 14);
  ctx.textAlign = 'left';
  setSpacing(ctx, 0);
  iy += 24;

  hRule(ctx, ix, ix + iw, iy, 1, '#3c2a1c');
  iy += 14;

  if (panel.type === 'timeline' && panel.timeline) {
    panel.timeline.forEach((step, i) => {
      ctx.fillStyle = INK_ACCENT;
      ctx.beginPath();
      ctx.arc(ix + 8, iy + 6, 3.5, 0, Math.PI * 2);
      ctx.fill();

      setFont(ctx, 700, 14.5, F_DISPLAY);
      ctx.fillStyle = INK_PRIMARY;
      ctx.fillText(step.label, ix + 20, iy + 9);

      setFont(ctx, 400, 13, F_BODY, 'italic');
      ctx.fillStyle = '#553e2b';
      const detLines = wrapLines(ctx, step.detail, iw - 20);
      iy = drawLines(ctx, detLines, ix + 20, iy + 12, 16);
      iy += 8;

      if (i < panel.timeline.length - 1) {
        ctx.fillStyle = INK_ACCENT;
        ctx.textAlign = 'center';
        setFont(ctx, 600, 11, F_CAPS);
        ctx.fillText('↓', ix + 8, iy);
        ctx.textAlign = 'left';
        iy += 8;
      }
    });

    if (panel.honors) {
      iy += 4;
      hRule(ctx, ix, ix + iw, iy, 1, 'rgba(60, 42, 24, 0.4)');
      iy += 12;
      setFont(ctx, 700, 13.5, F_CAPS);
      setSpacing(ctx, 2.5);
      ctx.textAlign = 'center';
      ctx.fillStyle = INK_ACCENT;
      ctx.fillText(panel.honorsTitle || 'HONORS COLUMN', x + w / 2, iy + 10);
      ctx.textAlign = 'left';
      setSpacing(ctx, 0);
      iy += 18;

      panel.honors.forEach((hItem) => {
        setFont(ctx, 700, 14, F_DISPLAY);
        ctx.fillStyle = INK_PRIMARY;
        ctx.fillText(hItem.prize, ix, iy + 10);
        setFont(ctx, 400, 13, F_BODY);
        ctx.fillStyle = '#4b3624';
        const evLines = wrapLines(ctx, hItem.event, iw);
        iy = drawLines(ctx, evLines, ix, iy + 14, 16);
        iy += 6;
      });
    }
  } else if (panel.type === 'leadership' && panel.items) {
    panel.items.forEach((item) => {
      setFont(ctx, 700, 15, F_DISPLAY);
      ctx.fillStyle = INK_PRIMARY;
      const roleLines = wrapLines(ctx, item.role, iw);
      iy = drawLines(ctx, roleLines, ix, iy, 18);
      setFont(ctx, 400, 13.5, F_BODY, 'italic');
      ctx.fillStyle = '#4e3928';
      const orgLines = wrapLines(ctx, item.org, iw);
      iy = drawLines(ctx, orgLines, ix, iy + 2, 16);
      iy += 12;
      hRule(ctx, ix, ix + iw, iy - 4, 1, 'rgba(60, 42, 24, 0.25)');
    });
  } else if (panel.type === 'brief' && panel.items) {
    panel.items.forEach((item) => {
      setFont(ctx, 700, 14.5, F_DISPLAY);
      ctx.fillStyle = INK_PRIMARY;
      const hLines = wrapLines(ctx, item.heading, iw);
      iy = drawLines(ctx, hLines, ix, iy, 18);
      setFont(ctx, 400, 13.5, F_BODY);
      ctx.fillStyle = '#4e3928';
      const dLines = wrapLines(ctx, item.detail, iw);
      iy = drawLines(ctx, dLines, ix, iy + 2, 16);
      iy += 12;
      hRule(ctx, ix, ix + iw, iy - 4, 1, 'rgba(60, 42, 24, 0.25)');
    });
  } else if (panel.type === 'glance' && panel.items) {
    panel.items.forEach((item) => {
      setFont(ctx, 700, 12.5, F_CAPS);
      setSpacing(ctx, 1.5);
      ctx.fillStyle = INK_ACCENT;
      ctx.fillText(item.label, ix, iy + 10);
      setSpacing(ctx, 0);
      setFont(ctx, 500, 14.5, F_BODY);
      ctx.fillStyle = INK_PRIMARY;
      const vLines = wrapLines(ctx, item.value, iw);
      iy = drawLines(ctx, vLines, ix, iy + 14, 17);
      iy += 10;
      hRule(ctx, ix, ix + iw, iy - 3, 1, 'rgba(60, 42, 24, 0.25)');
    });
  }

  if (contactStrip) {
    const csY = y + h - 56;
    ctx.fillStyle = '#23160c';
    ctx.fillRect(ix, csY, iw, 48);
    setFont(ctx, 700, 11, F_CAPS);
    setSpacing(ctx, 1.5);
    ctx.fillStyle = '#e2c99a';
    ctx.textAlign = 'center';
    ctx.fillText('DISPATCH CONTACT', ix + iw / 2, csY + 16);
    setFont(ctx, 400, 12, F_BODY);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(contactStrip.email, ix + iw / 2, csY + 34);
    ctx.textAlign = 'left';
    setSpacing(ctx, 0);
  }
  ctx.restore();
}

function renderBack(canvas, title, subtitle, seed = 1) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  ctx.setTransform(-1, 0, 0, 1, W, 0);
  paintRealisticPaper(ctx, W, H, seed, 'skills', false);

  ctx.strokeStyle = INK_PRIMARY;
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  ctx.textAlign = 'center';
  ctx.fillStyle = INK_PRIMARY;
  setFont(ctx, 700, 36, F_DISPLAY);
  ctx.fillText(title, W / 2, 58);
  setFont(ctx, 600, 14, F_CAPS);
  setSpacing(ctx, 3);
  ctx.fillStyle = INK_ACCENT;
  ctx.fillText(subtitle, W / 2, 84);
  setSpacing(ctx, 0);
  ctx.textAlign = 'left';
  hRule(ctx, 24, W - 24, 96, 2, INK_PRIMARY, true);
  hRule(ctx, 24, W - 24, 102, 1, INK_PRIMARY, true);

  const colW = (W - 48 - 36) / 3;
  for (let c = 0; c < 3; c++) {
    const cx = 24 + c * (colW + 18);
    if (c === 1) {
      drawHalftoneHeroPhoto(ctx, cx, 116, colW, 140, 'Archival field record', seed + c);
    } else {
      setFont(ctx, 700, 16, F_DISPLAY);
      ctx.fillStyle = INK_PRIMARY;
      ctx.fillText(c === 0 ? 'INVESTIGATIVE LOG' : 'CHRONICLE DESK', cx, 130);
      drawJustifiedBodyColumn(ctx, 'Archival records and investigative dispatches documenting milestones across systems and leadership.', cx, 148, colW, 16, 10);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/* ==========================================================================
   3D Geometry & Sheet Construction
   ========================================================================== */
function createMainPaperGeometry(width, height, isMobile = false, seed = 1) {
  const segX = isMobile ? 18 : 36;
  const segY = isMobile ? 12 : 24;
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position;
  const rng = mulberry32(seed);

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const fold = -Math.exp(-Math.pow(vx / (width * 0.08), 2)) * 0.058;
    const hFold = -Math.exp(-Math.pow((vy - height * 0.04) / (height * 0.08), 2)) * 0.028;
    const curl = (Math.pow(vx / (width * 0.5), 2) + Math.pow(vy / (height * 0.5), 2)) * 0.038;
    const wave = Math.sin((vx / width) * Math.PI * 2.5 + seed) * 0.012;
    pos.setZ(i, fold + hFold + curl + wave);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Creates individual crumpled loose sheets with random folds, curls,
 * lifted corners, UV crops from newspaper-pile.jpg, and warm vertex colors.
 */
function createCrumpledSheetGeometry(width, height, seed = 1) {
  const segX = 8;
  const segY = 6;
  const geo = new THREE.PlaneGeometry(width, height, segX, segY);
  const pos = geo.attributes.position;
  const rng = mulberry32(seed);

  const foldAngle = rng() * Math.PI;
  const cosA = Math.cos(foldAngle);
  const sinA = Math.sin(foldAngle);
  const foldOffset = (rng() - 0.5) * 0.3;
  const foldDepth = 0.035 + rng() * 0.035;

  const liftedCorner = Math.floor(rng() * 5);
  const liftHeight = 0.045 + rng() * 0.045;

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);

    const dist = vx * cosA + vy * sinA - foldOffset;
    let vz = -Math.exp(-Math.pow(dist / 0.16, 2)) * foldDepth;
    vz += (Math.pow(vx / (width * 0.5), 2) + Math.pow(vy / (height * 0.5), 2)) * 0.024;

    if (liftedCorner === 1 && vx < -width * 0.3 && vy > height * 0.3) vz += liftHeight;
    else if (liftedCorner === 2 && vx > width * 0.3 && vy > height * 0.3) vz += liftHeight;
    else if (liftedCorner === 3 && vx < -width * 0.3 && vy < -height * 0.3) vz += liftHeight;
    else if (liftedCorner === 4 && vx > width * 0.3 && vy < -height * 0.3) vz += liftHeight;

    vz += (rng() - 0.5) * 0.012;
    pos.setZ(i, vz);
  }
  geo.computeVertexNormals();

  // Custom UV assignment from random region of newspaper-pile.jpg
  const uvs = geo.attributes.uv;
  const u0 = rng() * 0.65;
  const v0 = rng() * 0.65;
  const uSpan = 0.22 + rng() * 0.28;
  const vSpan = 0.22 + rng() * 0.28;

  for (let i = 0; i < uvs.count; i++) {
    const u = uvs.getX(i);
    const v = uvs.getY(i);
    uvs.setXY(i, u0 + u * uSpan, v0 + v * vSpan);
  }

  // Vertex colors for per-sheet warm monochrome tinting (#c9a56a to #8a6a3c range)
  const TINTS = [
    [0.96, 0.91, 0.82], // cream
    [0.88, 0.79, 0.64], // warm tan
    [0.84, 0.73, 0.56], // honey sepia
    [0.86, 0.82, 0.75], // grey-ivory
    [0.78, 0.66, 0.48]  // aged deep tan
  ];
  const chosenTint = TINTS[Math.floor(rng() * TINTS.length)];
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const varFactor = 0.96 + rng() * 0.08;
    colors[i * 3]     = chosenTint[0] * varFactor;
    colors[i * 3 + 1] = chosenTint[1] * varFactor;
    colors[i * 3 + 2] = chosenTint[2] * varFactor;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  return geo;
}

function createMainSheet({ geo, overviewTex, detailTex, backTex, paper = null, isMain = true, seed = 1 }) {
  if (!paperBumpTex) {
    paperBumpTex = createPaperBumpTexture();
  }
  if (!deckledAlphaTex) {
    deckledAlphaTex = createDeckledAlphaTexture();
  }

  const paperBaseColor = new THREE.Color('#eddcb8');

  const frontMat = new THREE.MeshStandardMaterial({
    map: overviewTex,
    bumpMap: paperBumpTex,
    bumpScale: 0.010,
    alphaMap: deckledAlphaTex,
    transparent: true,
    alphaTest: 0.05,
    roughness: 0.88,
    metalness: 0.0,
    color: paperBaseColor,
    side: THREE.FrontSide
  });

  const backMat = new THREE.MeshStandardMaterial({
    map: backTex,
    bumpMap: paperBumpTex,
    bumpScale: 0.010,
    alphaMap: deckledAlphaTex,
    transparent: true,
    alphaTest: 0.05,
    roughness: 0.90,
    metalness: 0.0,
    color: paperBaseColor,
    side: THREE.BackSide
  });

  const front = new THREE.Mesh(geo, frontMat);
  front.castShadow = true;
  front.receiveShadow = true;

  const back = new THREE.Mesh(geo, backMat);
  back.receiveShadow = true;

  const group = new THREE.Group();
  group.add(front, back);

  // Stack 2-3 thin sub-sheets underneath each main newspaper for visible 3D thickness
  const subMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d4bf92'),
    alphaMap: deckledAlphaTex,
    transparent: true,
    alphaTest: 0.05,
    roughness: 0.92,
    metalness: 0.0,
    side: THREE.FrontSide
  });
  for (let s = 1; s <= 3; s++) {
    const subMesh = new THREE.Mesh(geo, subMat);
    subMesh.position.set((Math.random() - 0.5) * 0.035, (Math.random() - 0.5) * 0.025, -s * 0.008);
    subMesh.rotation.z = (Math.random() - 0.5) * 0.014;
    subMesh.castShadow = true;
    subMesh.receiveShadow = true;
    group.add(subMesh);
  }

  const sheet = {
    id: paper?.id || null,
    paper,
    isMain: true,
    seed,
    group,
    front,
    back,
    frontMat,
    backMat,
    overviewTex,
    detailTex,
    proxy: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 },
    base: { x: 0, y: 0, z: 0, rz: 0, scale: 1 },
    start: null,
    burst: null,
    order: 0,
    hover: { v: 0 },
    focus: { v: 0 },
    dim: { v: 0 },
    focusPose: { x: 0, y: 0, z: FOCUS_Z }
  };
  front.userData.sheet = sheet;
  back.userData.sheet = sheet;
  return sheet;
}

/* ==========================================================================
   Composition: Full-Bleed Desk Spread & Overlapping Loose Sheets
   ========================================================================== */
function computeLayout(aspect) {
  if (aspect >= 1.1) {
    return {
      education:  { pos: [-5.0,  1.90, 0.34], rz: -0.038, scale: 1.02 },
      experience: { pos: [ 0.05, 2.15, 0.36], rz:  0.026, scale: 1.04 },
      projects:   { pos: [ 5.10, 1.85, 0.33], rz: -0.024, scale: 1.02 },
      about:      { pos: [-2.65, -1.65, 0.40], rz:  0.035, scale: 1.01 },
      skills:     { pos: [ 2.75, -1.75, 0.38], rz: -0.028, scale: 1.01 }
    };
  }
  if (aspect >= 0.75) {
    return {
      education:  { pos: [-2.6,  3.75, 0.34], rz: -0.040, scale: 1.02 },
      experience: { pos: [ 2.6,  3.65, 0.36], rz:  0.032, scale: 1.03 },
      projects:   { pos: [-2.6,  0.05, 0.34], rz:  0.035, scale: 1.01 },
      about:      { pos: [ 2.6, -0.10, 0.39], rz: -0.030, scale: 1.00 },
      skills:     { pos: [ 0.0, -3.75, 0.37], rz:  0.025, scale: 1.01 }
    };
  }
  return {
    education:  { pos: [-0.08,  7.2, 0.34], rz: -0.035, scale: 1.00 },
    experience: { pos: [ 0.08,  3.6, 0.36], rz:  0.030, scale: 1.02 },
    projects:   { pos: [-0.08,  0.0, 0.34], rz: -0.025, scale: 1.00 },
    about:      { pos: [ 0.08, -3.6, 0.39], rz:  0.032, scale: 1.00 },
    skills:     { pos: [-0.06, -7.2, 0.37], rz: -0.022, scale: 1.00 }
  };
}

function tanHalfFov() {
  return Math.tan(THREE.MathUtils.degToRad(FOV / 2));
}

function availFraction(topPx, bottomPx) {
  const h = window.innerHeight || 1;
  return Math.max(0.35, 1 - (topPx + bottomPx) / h);
}

function relayout() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const layout = computeLayout(aspect);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  mainSheets.forEach((s) => {
    const cfg = layout[s.id] || { pos: [0, 0, 0.3], rz: 0, scale: 1 };
    s.base = {
      x: cfg.pos[0],
      y: cfg.pos[1],
      z: cfg.pos[2],
      rz: cfg.rz,
      scale: cfg.scale || 1
    };
    minX = Math.min(minX, cfg.pos[0] - (SHEET_W * s.base.scale) / 2);
    maxX = Math.max(maxX, cfg.pos[0] + (SHEET_W * s.base.scale) / 2);
    minY = Math.min(minY, cfg.pos[1] - (SHEET_H * s.base.scale) / 2);
    maxY = Math.max(maxY, cfg.pos[1] + (SHEET_H * s.base.scale) / 2);
  });
  fieldBounds = { minX, maxX, minY, maxY };

  const t = tanHalfFov();
  const frac = availFraction(safeArea.top, safeArea.bottom);
  const halfW = (maxX - minX) / 2 + 0.3;
  const halfH = (maxY - minY) / 2 + 0.3;
  const dH = halfH / (t * frac);
  const dW = halfW / (t * aspect * 0.96);
  const d = Math.max(dH, dW);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const visH = 2 * d * t;
  const offset = ((safeArea.top - safeArea.bottom) / 2 / window.innerHeight) * visH;

  // Camera field pose looking across the desk
  fieldPose = {
    x: cx,
    y: cy + offset - 0.35,
    z: d + 0.25,
    ly: cy + offset + 0.55,
    lz: -0.2
  };

  // 1. Oversized background plane (newspaper-pile.jpg) completely fills view edge-to-edge
  if (bgMesh) {
    const bgW = Math.max(visH * aspect, visH) * 2.4;
    const bgH = Math.max(visH, visH / aspect) * 2.4;
    bgMesh.scale.set(bgW, bgH, 1);
    bgMesh.position.set(cx, cy, -0.16);
    if (deskVignetteMesh) {
      deskVignetteMesh.scale.set(bgW, bgH, 1);
      deskVignetteMesh.position.set(cx, cy, -0.15);
    }
  }

  // 2. Loose sheets positions (densely packed, edge-to-edge, no gaps or voids)
  const rng = mulberry32(777);
  looseSheets.forEach((s, i) => {
    // Spread across entire visible desk area
    const spreadX = (maxX - minX) * 1.35;
    const spreadY = (maxY - minY) * 1.35;
    const fx = cx + (rng() - 0.5) * spreadX;
    const fy = cy + (rng() - 0.5) * spreadY;
    s.base = {
      x: fx,
      y: fy,
      z: 0.02 + (i / looseSheets.length) * 0.22,
      rz: (rng() - 0.5) * Math.PI * 1.8,
      scale: 0.85 + rng() * 0.35
    };
  });

  if (keyLight) {
    keyLight.position.set(cx - 8, cy + 10, 14);
    keyLight.target.position.set(cx, cy, 0);
  }
  if (fillLight) {
    fillLight.position.set(cx + 9, cy - 6, 10);
  }

  buildBurstStates();
  buildTimeline();

  if (isStoryFocused && activeSheet) {
    computeFocusPose(activeSheet);
    Object.assign(focusCam, activeSheet._cam);
  }
}

function computeFocusPose(sheet) {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  const t = tanHalfFov();
  const top = safeArea.top;
  const bottom = safeArea.focusBottom;
  const frac = availFraction(top, bottom);
  const dH = (SHEET_H / 2) / (t * frac * 0.95);
  const dW = (SHEET_W / 2) / (t * aspect * 0.94);
  const d = Math.max(dH, dW);
  const cx = (fieldBounds.minX + fieldBounds.maxX) / 2;
  const cy = (fieldBounds.minY + fieldBounds.maxY) / 2;
  const visH = 2 * d * t;
  const offset = ((top - bottom) / 2 / window.innerHeight) * visH;
  sheet.focusPose = { x: cx, y: cy, z: FOCUS_Z };
  sheet._cam = { x: cx, y: cy + offset, z: FOCUS_Z + d, ly: cy + offset, lz: FOCUS_Z };
}

/* ==========================================================================
   Burst Timeline
   ========================================================================== */
function buildBurstStates() {
  const rng = mulberry32(2024);
  const cx = (fieldBounds.minX + fieldBounds.maxX) / 2;
  const cy = (fieldBounds.minY + fieldBounds.maxY) / 2;
  const spread = Math.max(fieldBounds.maxX - fieldBounds.minX, fieldBounds.maxY - fieldBounds.minY) / 2;
  allSheets.forEach((s) => {
    s.order = rng();
    s.start = {
      x: cx + (rng() - 0.5) * 1.4,
      y: cy + (rng() - 0.5) * 1.0,
      z: -7 - rng() * 5,
      rx: (rng() - 0.5) * 0.8,
      ry: (rng() - 0.5) * 0.8,
      rz: (rng() - 0.5) * 1.2
    };
    const a = rng() * Math.PI * 2;
    const r = 0.25 + rng() * 0.75;
    s.burst = {
      x: cx + Math.cos(a) * r * spread * 0.9,
      y: cy + Math.sin(a) * r * spread * 0.6,
      z: -1.5 + rng() * 5.5,
      rx: (rng() - 0.5) * Math.PI * 1.6,
      ry: (rng() - 0.5) * Math.PI * 2.0,
      rz: (rng() - 0.5) * Math.PI
    };
  });
}

function buildTimeline() {
  if (timeline) timeline.kill();
  const tl = gsap.timeline({ paused: true });
  tl.to({}, { duration: TL_DURATION }, 0);

  if (REDUCED_MOTION) {
    allSheets.forEach((s) => Object.assign(s.proxy, { x: s.base.x, y: s.base.y, z: s.base.z, rx: 0, ry: 0, rz: s.base.rz }));
    Object.assign(camProxy, fieldPose);
    tl.fromTo(grade, { ...LOOK_BURST }, { ...LOOK_FIELD, duration: TL_DURATION, ease: 'none' }, 0);
  } else {
    allSheets.forEach((s) => {
      const o = s.order;
      tl.fromTo(s.proxy, { ...s.start }, { ...s.burst, duration: 2.8, ease: 'expo.out', immediateRender: true }, o * 0.6);
      const settleAt = 3.0 + o * 1.4;
      tl.to(s.proxy, { x: s.base.x, y: s.base.y, duration: 4.6, ease: 'sine.inOut' }, settleAt);
      tl.to(s.proxy, { z: s.base.z, duration: 4.6, ease: 'power3.inOut' }, settleAt);
      tl.to(s.proxy, { rx: 0, ry: 0, rz: s.base.rz, duration: 4.2, ease: 'power2.inOut' }, settleAt);
    });
    const camStart = { x: fieldPose.x, y: (fieldBounds.minY + fieldBounds.maxY) / 2, z: 6.5, ly: (fieldBounds.minY + fieldBounds.maxY) / 2, lz: -4 };
    tl.fromTo(camProxy, camStart, { ...fieldPose, duration: 8.6, ease: 'power2.inOut', immediateRender: true }, 0.4);
    tl.fromTo(grade, { ...LOOK_BURST }, { ...LOOK_FIELD, duration: 6.2, ease: 'sine.inOut', immediateRender: true }, 2.8);
  }

  timeline = tl;
  tl.progress(scrollT);
}

/* ==========================================================================
   Init & Desk Props
   ========================================================================== */
function ensureFonts() {
  if (!document.fonts?.load) return Promise.resolve();
  const loads = [
    '800 182px "Playfair Display"',
    'italic 400 76px "EB Garamond"',
    '400 64px "EB Garamond"',
    'italic 400 42px "EB Garamond"',
    '700 46px "Cinzel"',
    '700 40px "Cinzel"',
    '800 56px "Playfair Display"',
    '700 48px "Playfair Display"',
    '400 12px "EB Garamond"',
    'italic 400 14px "EB Garamond"',
    '700 30px "Cinzel"',
    '600 18px "Cinzel"'
  ].map((f) => document.fonts.load(f).catch(() => null));
  return Promise.all(loads).then(() => document.fonts.ready);
}

function redrawAllTextures() {
  mainSheets.forEach((s) => {
    renderOverviewCover(s);
    s.overviewTex.needsUpdate = true;

    renderDetailFront(s);
    s.detailTex.needsUpdate = true;

    renderBack(s.backCanvas, 'The Daily Chronicle', `SECTION ARCHIVE · ${s.paper.sectionName}`, s.seed + 11);
    s.backMat.map.needsUpdate = true;
  });
}

function createScatteredPhotos(group) {
  // Generate 3 unique vintage photo print canvas textures (with ivory white borders)
  const photoTextures = [];
  for (let t = 0; t < 3; t++) {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 196;
    const ctx = cv.getContext('2d');

    // Aged white photo border (thick bottom like classic photographic prints)
    ctx.fillStyle = '#f8f2e4';
    ctx.fillRect(0, 0, 256, 196);
    ctx.strokeStyle = 'rgba(120, 95, 65, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 256, 196);

    // Inner photo area
    const px = 14, py = 14, pw = 228, ph = 145;
    const pGrad = ctx.createLinearGradient(px, py, px, py + ph);
    if (t === 0) {
      // Vintage portrait silhouette
      pGrad.addColorStop(0, '#ebd7bf');
      pGrad.addColorStop(1, '#5a3d24');
      ctx.fillStyle = pGrad;
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = '#3a2414';
      ctx.beginPath();
      ctx.arc(px + pw / 2, py + ph * 0.42, 28, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + pw / 2, py + ph + 10, 48, Math.PI, 0);
      ctx.fill();
    } else if (t === 1) {
      // Vintage architecture facade
      pGrad.addColorStop(0, '#f2dfca');
      pGrad.addColorStop(1, '#684a2e');
      ctx.fillStyle = pGrad;
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = '#382212';
      ctx.fillRect(px + 40, py + 40, pw - 80, ph - 40);
      ctx.fillStyle = '#eddac0';
      for (let c = 0; c < 5; c++) {
        ctx.fillRect(px + 52 + c * 28, py + 50, 10, ph - 50);
      }
    } else {
      // Vintage landscape / horizon
      pGrad.addColorStop(0, '#f0d9bc');
      pGrad.addColorStop(0.6, '#9c754d');
      pGrad.addColorStop(1, '#341f11');
      ctx.fillStyle = pGrad;
      ctx.fillRect(px, py, pw, ph);
    }

    // Soft grain & vignette
    const pRng = mulberry32(t * 111 + 55);
    for (let d = 0; d < 800; d++) {
      ctx.fillStyle = pRng() < 0.5 ? 'rgba(50, 30, 15, 0.08)' : 'rgba(255, 250, 235, 0.08)';
      ctx.fillRect(px + pRng() * pw, py + pRng() * ph, 1.2, 1.2);
    }
    const vig = ctx.createRadialGradient(px + pw / 2, py + ph / 2, pw * 0.25, px + pw / 2, py + ph / 2, pw * 0.65);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(40, 20, 10, 0.40)');
    ctx.fillStyle = vig;
    ctx.fillRect(px, py, pw, ph);

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    photoTextures.push(tex);
  }

  const photoGeo = new THREE.PlaneGeometry(0.95, 0.72);
  const pMats = photoTextures.map((tex) => new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.82,
    metalness: 0.05
  }));

  const rng = mulberry32(999);
  const photoCount = 20;

  // Preset scatter positions in margin and between loose sheets
  const scatterCoords = [
    [-8.2,  3.2, 0.12,  0.35],
    [-7.6,  0.4, 0.15, -0.42],
    [-8.5, -2.6, 0.14,  0.62],
    [-6.8, -4.2, 0.16, -0.28],
    [-4.2, -4.4, 0.18,  0.45],
    [-1.2, -4.5, 0.17, -0.32],
    [ 1.4, -4.4, 0.18,  0.52],
    [ 5.2, -4.5, 0.16, -0.48],
    [ 7.4, -3.2, 0.15,  0.38],
    [ 8.2, -0.6, 0.16, -0.55],
    [ 7.8,  1.8, 0.14,  0.48],
    [ 7.4,  3.8, 0.15, -0.38],
    [-7.2,  4.6, 0.13,  0.22],
    [-2.2,  4.5, 0.14, -0.45],
    [ 2.4,  4.6, 0.15,  0.32],
    [ 6.5,  4.7, 0.14, -0.25],
    [-5.8,  1.2, 0.12,  0.55],
    [-0.8,  0.2, 0.14, -0.62],
    [ 4.4,  0.4, 0.13,  0.42],
    [ 6.8, -1.8, 0.15, -0.35]
  ];

  for (let i = 0; i < photoCount; i++) {
    const coord = scatterCoords[i] || [
      (rng() - 0.5) * 16,
      (rng() - 0.5) * 10,
      0.12,
      (rng() - 0.5) * 1.2
    ];
    const mat = pMats[i % pMats.length];
    const mesh = new THREE.Mesh(photoGeo, mat);
    mesh.position.set(coord[0], coord[1], coord[2]);
    mesh.rotation.z = coord[3];
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Attach tiny brass paperclip to 2 of the photos
    if (i === 1 || i === 8) {
      const clipMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.85 });
      const clipMesh = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 8, 16), clipMat);
      clipMesh.position.set(0.35, 0.28, 0.015);
      clipMesh.castShadow = true;
      mesh.add(clipMesh);
    }

    group.add(mesh);
  }
}

function createDeskProps(group) {
  // 1. Candle Lamp (Top-Left Margin) with Real Flickering Warm PointLight
  const candleGroup = new THREE.Group();
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xc49a45, roughness: 0.32, metalness: 0.85 });
  const waxMat = new THREE.MeshStandardMaterial({ color: 0xf5ebd7, roughness: 0.72, metalness: 0.05 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.32 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });

  // Brass saucer base
  const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.70, 0.80, 0.14, 24), brassMat);
  saucer.castShadow = true;
  saucer.receiveShadow = true;
  candleGroup.add(saucer);

  // Wax candle cylinder
  const candleWax = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.1, 24), waxMat);
  candleWax.position.y = 0.58;
  candleWax.castShadow = true;
  candleGroup.add(candleWax);

  // Flame cone
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 16), flameMat);
  flame.position.y = 1.25;
  candleGroup.add(flame);

  // Glass hurricane lantern chimney
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.46, 1.8, 24, 1, true), glassMat);
  chimney.position.y = 0.95;
  candleGroup.add(chimney);

  candleGroup.position.set(-9.2, 5.2, 0.35);
  candleGroup.rotation.set(0.12, 0.10, -0.15);
  group.add(candleGroup);

  // Real flickering warm PointLight
  candleLight = new THREE.PointLight(0xffaa44, 2.4, 20, 1.8);
  candleLight.position.set(-9.2, 5.2, 1.6);
  candleLight.castShadow = true;
  candleLight.shadow.bias = -0.001;
  candleLight.shadow.mapSize.set(512, 512);
  scene.add(candleLight);

  // 2. Ceramic Coffee Mug on Saucer (Left Margin) with Golden Crema
  const mugGroup = new THREE.Group();
  const mugMat = new THREE.MeshStandardMaterial({ color: 0x241812, roughness: 0.65, metalness: 0.08 });
  const saucerMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.78, 0.08, 24), mugMat);
  saucerMesh.castShadow = true;
  saucerMesh.receiveShadow = true;
  mugGroup.add(saucerMesh);

  const mugMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.44, 0.75, 24), mugMat);
  mugMesh.position.y = 0.40;
  mugMesh.castShadow = true;
  mugMesh.receiveShadow = true;
  mugGroup.add(mugMesh);

  // Coffee liquid + golden crema ring
  const coffeeMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.48, 24),
    new THREE.MeshStandardMaterial({ color: 0x140a05, roughness: 0.18, metalness: 0.2 })
  );
  coffeeMesh.rotation.x = -Math.PI / 2;
  coffeeMesh.position.y = 0.76;
  mugGroup.add(coffeeMesh);

  const cremaMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.35, 0.46, 24),
    new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.35, metalness: 0.1 })
  );
  cremaMesh.rotation.x = -Math.PI / 2;
  cremaMesh.position.y = 0.762;
  mugGroup.add(cremaMesh);

  const handleMesh = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.055, 12, 24, Math.PI), mugMat);
  handleMesh.rotation.z = -Math.PI / 2;
  handleMesh.position.set(-0.52, 0.42, 0);
  handleMesh.castShadow = true;
  mugGroup.add(handleMesh);

  mugGroup.position.set(-9.6, 1.2, 0.28);
  mugGroup.rotation.set(0.18, 0.12, -0.22);
  group.add(mugGroup);

  // 3. Vintage Camera (Top-Right Margin)
  const cameraGroup = new THREE.Group();
  const camBodyMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.78 });
  const camSilverMat = new THREE.MeshStandardMaterial({ color: 0xa8a8a8, roughness: 0.28, metalness: 0.88 });

  const camBody = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.95, 0.82), camBodyMat);
  camBody.castShadow = true;
  cameraGroup.add(camBody);

  const camTopPlate = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.24, 0.84), camSilverMat);
  camTopPlate.position.y = 0.58;
  camTopPlate.castShadow = true;
  cameraGroup.add(camTopPlate);

  const camLens = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.55, 24), camSilverMat);
  camLens.rotation.x = Math.PI / 2;
  camLens.position.set(0.15, 0.05, 0.55);
  camLens.castShadow = true;
  cameraGroup.add(camLens);

  const camDial1 = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 16), camSilverMat);
  camDial1.position.set(-0.55, 0.78, 0);
  cameraGroup.add(camDial1);

  const camDial2 = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.15, 16), camSilverMat);
  camDial2.position.set(0.55, 0.76, 0);
  cameraGroup.add(camDial2);

  cameraGroup.position.set(8.8, 5.0, 0.35);
  cameraGroup.rotation.set(0.14, -0.15, 0.28);
  group.add(cameraGroup);

  // 4. Dried Flowers Spray (Top-Right Margin)
  const flowerGroup = new THREE.Group();
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x5a482e, roughness: 0.85 });
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xe8d5b5, roughness: 0.92 });
  const fRng = mulberry32(333);

  for (let s = 0; s < 5; s++) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.8, 8), stemMat);
    stem.rotation.z = -0.55 + s * 0.18 + (fRng() - 0.5) * 0.1;
    stem.rotation.y = (fRng() - 0.5) * 0.4;
    stem.position.set(s * 0.15, 0.8, 0);
    stem.castShadow = true;
    flowerGroup.add(stem);

    for (let b = 0; b < 6; b++) {
      const bud = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), petalMat);
      bud.position.set(
        s * 0.15 + (fRng() - 0.5) * 0.4 + Math.sin(stem.rotation.z) * (0.8 + b * 0.18),
        Math.cos(stem.rotation.z) * (0.8 + b * 0.18),
        (fRng() - 0.5) * 0.25
      );
      bud.castShadow = true;
      flowerGroup.add(bud);
    }
  }
  flowerGroup.position.set(9.8, 3.4, 0.25);
  flowerGroup.rotation.set(0.10, -0.22, 0.45);
  group.add(flowerGroup);

  // 5. Vintage Leather Book (Top-Right Corner)
  const bookGroup = new THREE.Group();
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x3d2214, roughness: 0.68, metalness: 0.05 });
  const pageMat = new THREE.MeshStandardMaterial({ color: 0xd9c49a, roughness: 0.92, metalness: 0 });
  const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xc89842, roughness: 0.35, metalness: 0.85 });

  const bookCover = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.7, 0.36), leatherMat);
  bookCover.castShadow = true;
  bookCover.receiveShadow = true;
  bookGroup.add(bookCover);

  const bookPages = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 0.30), pageMat);
  bookGroup.add(bookPages);

  const bookRibbon = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.72, 0.38), goldTrimMat);
  bookRibbon.position.x = -0.7;
  bookGroup.add(bookRibbon);

  bookGroup.position.set(10.2, 5.6, 0.28);
  bookGroup.rotation.set(0.12, -0.08, 0.38);
  group.add(bookGroup);

  // 6. Antique Brass Pocket Compass (Bottom-Right Margin)
  const compassGroup = new THREE.Group();
  const compCase = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.16, 32), brassMat);
  compCase.castShadow = true;
  compCase.receiveShadow = true;
  compassGroup.add(compCase);

  const dialMat = new THREE.MeshStandardMaterial({ color: 0xf0e2c8, roughness: 0.82 });
  const compDial = new THREE.Mesh(new THREE.CircleGeometry(0.50, 32), dialMat);
  compDial.rotation.x = -Math.PI / 2;
  compDial.position.y = 0.082;
  compassGroup.add(compDial);

  const needleNorth = new THREE.Mesh(
    new THREE.ConeGeometry(0.065, 0.42, 4),
    new THREE.MeshStandardMaterial({ color: 0x9e2418, roughness: 0.4 })
  );
  needleNorth.rotation.x = -Math.PI / 2;
  needleNorth.position.set(0, 0.09, -0.20);
  compassGroup.add(needleNorth);

  const needleSouth = new THREE.Mesh(
    new THREE.ConeGeometry(0.065, 0.42, 4),
    new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.4 })
  );
  needleSouth.rotation.x = Math.PI / 2;
  needleSouth.position.set(0, 0.09, 0.20);
  compassGroup.add(needleSouth);

  const glassCover = new THREE.Mesh(new THREE.CircleGeometry(0.51, 32), glassMat);
  glassCover.rotation.x = -Math.PI / 2;
  glassCover.position.y = 0.095;
  compassGroup.add(glassCover);

  const topRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 12, 24), brassMat);
  topRing.position.set(0, 0, -0.68);
  compassGroup.add(topRing);

  compassGroup.position.set(8.8, -4.4, 0.22);
  compassGroup.rotation.set(0.14, -0.12, 0.42);
  group.add(compassGroup);

  // 7. Vintage Fountain Pen (Right Margin)
  const penGroup = new THREE.Group();
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x141210, roughness: 0.32, metalness: 0.25 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.85 });

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 2.2, 16), barrelMat);
  barrel.rotation.z = Math.PI / 2;
  barrel.castShadow = true;
  penGroup.add(barrel);

  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.08, 16), goldMat);
  ring.rotation.z = Math.PI / 2;
  ring.position.x = 0.32;
  penGroup.add(ring);

  const nib = new THREE.Mesh(new THREE.ConeGeometry(0.062, 0.26, 16), goldMat);
  nib.rotation.z = -Math.PI / 2;
  nib.position.x = 1.23;
  nib.castShadow = true;
  penGroup.add(nib);

  penGroup.position.set(9.2, -1.2, 0.20);
  penGroup.rotation.set(0.12, -0.06, 0.58);
  group.add(penGroup);

  // 8. 20 Small Vintage Sepia Photo Prints with White Borders Scattered on Desk
  createScatteredPhotos(group);
}

export function initNewspaper(container, onFocusChange) {
  onFocusChangeCallback = onFocusChange;
  const isSmall = window.innerWidth < 760;

  hoverRibbonEl = document.getElementById('newspaper-hover-ribbon');
  if (hoverRibbonEl) {
    hoverRibbonNum = hoverRibbonEl.querySelector('.nhr-num');
    hoverRibbonText = hoverRibbonEl.querySelector('.nhr-text');
  }

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(new THREE.Color('#120b06'), LOOK_BURST.fog);

  camera = new THREE.PerspectiveCamera(FOV, window.innerWidth / window.innerHeight, 0.1, 200);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = LOOK_BURST.exposure;
  container.appendChild(renderer.domElement);
  maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // Warm key light from upper-left + gentle warm fill from lower-right
  hemiLight = new THREE.HemisphereLight(0xffecd0, 0x3d2716, LOOK_BURST.hemi);
  scene.add(hemiLight);

  keyLight = new THREE.DirectionalLight(0xffdfb8, LOOK_BURST.key);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
  keyLight.shadow.bias = -0.0002;
  keyLight.shadow.normalBias = 0.02;
  keyLight.shadow.camera.left = -16;
  keyLight.shadow.camera.right = 16;
  keyLight.shadow.camera.top = 12;
  keyLight.shadow.camera.bottom = -12;
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 45;
  scene.add(keyLight);
  scene.add(keyLight.target);

  fillLight = new THREE.DirectionalLight(0xc9a56a, LOOK_BURST.fill);
  scene.add(fillLight);

  rimLight = new THREE.PointLight(new THREE.Color(PALETTE.rimLight || '#ff9c4a'), LOOK_BURST.rim, 0, 0);
  rimLight.position.set(0, 0, -10);
  scene.add(rimLight);

  fieldGroup = new THREE.Group();
  scene.add(fieldGroup);

  // 1. Reference texture for background and loose sheets
  pileTexture = new THREE.TextureLoader().load('/images/newspaper-pile.jpg');
  pileTexture.colorSpace = THREE.SRGBColorSpace;
  pileTexture.anisotropy = maxAniso;
  pileTexture.generateMipmaps = true;
  pileTexture.minFilter = THREE.LinearMipmapLinearFilter;
  pileTexture.magFilter = THREE.LinearFilter;

  // Full-bleed background plane under everything (50% darker, warm multiply tint, desaturated)
  bgMat = new THREE.MeshStandardMaterial({
    map: pileTexture,
    color: new THREE.Color('#4a3624'),
    roughness: 0.94,
    metalness: 0.0
  });
  bgMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bgMat);
  bgMesh.receiveShadow = true;
  bgMesh.renderOrder = -3;
  fieldGroup.add(bgMesh);

  // Soft moody desk vignette plane
  const vigCanvas = document.createElement('canvas');
  vigCanvas.width = 512;
  vigCanvas.height = 512;
  const vctx = vigCanvas.getContext('2d');
  const vGrad = vctx.createRadialGradient(256, 256, 110, 256, 256, 256);
  vGrad.addColorStop(0, 'rgba(15, 10, 6, 0)');
  vGrad.addColorStop(0.68, 'rgba(15, 10, 6, 0.40)');
  vGrad.addColorStop(1, 'rgba(8, 5, 3, 0.85)');
  vctx.fillStyle = vGrad;
  vctx.fillRect(0, 0, 512, 512);
  const vigTex = new THREE.CanvasTexture(vigCanvas);

  const deskVignetteMat = new THREE.MeshBasicMaterial({
    map: vigTex,
    transparent: true,
    opacity: 0.90,
    depthWrite: false
  });
  deskVignetteMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), deskVignetteMat);
  deskVignetteMesh.renderOrder = -2;
  fieldGroup.add(deskVignetteMesh);

  // Add desk props in margin
  createDeskProps(fieldGroup);

  // 2. Loose crumpled sheets (85–100 sheets desktop, 45 mobile) sharing pileTexture
  const sharedPileMat = new THREE.MeshStandardMaterial({
    map: pileTexture,
    roughness: 0.90,
    metalness: 0.0,
    vertexColors: true,
    side: THREE.DoubleSide
  });

  const looseCount = isSmall ? 45 : 95;
  looseSheets = [];
  const rng = mulberry32(888);

  for (let i = 0; i < looseCount; i++) {
    const sw = 1.6 + rng() * 2.2;
    const sh = sw * (0.64 + rng() * 0.16);
    const geo = createCrumpledSheetGeometry(sw, sh, 500 + i * 19);

    const mesh = new THREE.Mesh(geo, sharedPileMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.renderOrder = -1;

    const group = new THREE.Group();
    group.add(mesh);
    fieldGroup.add(group);

    const sheetObj = {
      isMain: false,
      group,
      mesh,
      proxy: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 },
      base: { x: 0, y: 0, z: 0, rz: 0, scale: 1 },
      start: null,
      burst: null,
      order: 0,
      focus: { v: 0 },
      hover: { v: 0 },
      dim: { v: 0 }
    };
    looseSheets.push(sheetObj);
  }

  // 3. Five Main Section Sheets sitting on top of the pile
  const mainGeo = createMainPaperGeometry(SHEET_W, SHEET_H, isSmall, 101);
  const texW = 2048;
  const texH = Math.round(texW * SHEET_H / SHEET_W);

  mainSheets = PORTFOLIO_NEWSPAPERS.map((paper, i) => {
    const overviewCanvas = document.createElement('canvas');
    overviewCanvas.width = texW;
    overviewCanvas.height = texH;

    const detailCanvas = document.createElement('canvas');
    detailCanvas.width = texW;
    detailCanvas.height = texH;

    const backCanvas = document.createElement('canvas');
    backCanvas.width = 1024;
    backCanvas.height = Math.round(1024 * SHEET_H / SHEET_W);

    const overviewTex = makeTexture(overviewCanvas);
    const detailTex = makeTexture(detailCanvas);
    const backTex = makeTexture(backCanvas);

    const sheet = createMainSheet({
      geo: mainGeo,
      overviewTex,
      detailTex,
      backTex,
      paper,
      isMain: true,
      seed: 101 + i * 23
    });
    sheet.overviewCanvas = overviewCanvas;
    sheet.detailCanvas = detailCanvas;
    sheet.backCanvas = backCanvas;
    fieldGroup.add(sheet.group);
    pickables.push(sheet.front, sheet.back);
    return sheet;
  });

  allSheets = [...looseSheets, ...mainSheets];

  redrawAllTextures();
  ensureFonts().then(redrawAllTextures).catch(redrawAllTextures);

  // Floating warm golden dust particles in the key light beam
  const particleCount = isSmall ? 100 : 180;
  const particleGeo = new THREE.BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount * 3; i += 3) {
    particlePositions[i] = (Math.random() - 0.5) * 28;
    particlePositions[i + 1] = (Math.random() - 0.5) * 22;
    particlePositions[i + 2] = Math.random() * 8 + 0.5;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  dustParticles = new THREE.Points(particleGeo, new THREE.PointsMaterial({
    color: new THREE.Color('#f6dfba'),
    size: 0.055,
    transparent: true,
    opacity: LOOK_BURST.dust,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  }));
  scene.add(dustParticles);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2(-999, -999);

  relayout();
  requestAnimationFrame(animate);
}

/* ==========================================================================
   Public API & Interaction Handlers
   ========================================================================== */
export function setSafeArea({ top, bottom, focusBottom } = {}) {
  const next = {
    top: top ?? safeArea.top,
    bottom: bottom ?? safeArea.bottom,
    focusBottom: focusBottom ?? safeArea.focusBottom
  };
  const changed = next.top !== safeArea.top || next.bottom !== safeArea.bottom || next.focusBottom !== safeArea.focusBottom;
  safeArea = next;
  if (changed && scene) relayout();
}

export function getSceneGrade() {
  return grade;
}

export function isFieldInteractive() {
  return scrollT >= 0.92;
}

export function isNewspaperFocused() {
  return isStoryFocused;
}

function updateHoverRibbon(sheet) {
  if (!hoverRibbonEl) return;
  if (sheet && sheet.isMain && sheet.paper && !isStoryFocused) {
    const idxMap = { education: '01', experience: '02', projects: '03', about: '04', skills: '05' };
    const num = idxMap[sheet.id] || sheet.paper.boxes?.[0]?.num || '01';
    const title = (sheet.paper.sectionName || sheet.paper.category || 'CHAPTER').toUpperCase();
    if (hoverRibbonNum) hoverRibbonNum.textContent = num;
    if (hoverRibbonText) hoverRibbonText.textContent = `${num} ${title} - CLICK TO READ`;
    hoverRibbonEl.classList.remove('hidden');
    hoverRibbonEl.style.left = `${mouseScreen.x}px`;
    hoverRibbonEl.style.top = `${mouseScreen.y}px`;
  } else {
    hoverRibbonEl.classList.add('hidden');
  }
}

function setHover(sheet) {
  if (hoveredSheet === sheet) return;
  if (hoveredSheet) gsap.to(hoveredSheet.hover, { v: 0, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
  hoveredSheet = sheet;
  if (sheet) gsap.to(sheet.hover, { v: 1, duration: 0.35, ease: 'power2.out', overwrite: 'auto' });
  document.body.style.cursor = sheet ? 'pointer' : 'default';
  updateHoverRibbon(sheet);
}

function pick(clientX, clientY) {
  mouse.x = (clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  return hits.length ? hits[0].object.userData.sheet : null;
}

export function checkRaycast(clientX, clientY) {
  mouseScreen.x = clientX;
  mouseScreen.y = clientY;
  if (!raycaster || !camera) return null;
  if (isStoryFocused || !isFieldInteractive()) {
    setHover(null);
    return null;
  }
  const hit = pick(clientX, clientY);
  setHover(hit);
  if (hit && hoverRibbonEl && !hoverRibbonEl.classList.contains('hidden')) {
    hoverRibbonEl.style.left = `${clientX}px`;
    hoverRibbonEl.style.top = `${clientY}px`;
  }
  return hit;
}

export function handleNewspaperClick(clientX, clientY) {
  if (!raycaster || !camera) return false;
  if (isStoryFocused) {
    const hit = pick(clientX, clientY);
    if (hit !== activeSheet) {
      closeFocusedNewspaper();
      return true;
    }
    return false;
  }
  if (!isFieldInteractive()) return false;
  const hit = pick(clientX, clientY);
  if (hit) {
    focusNewspaper(hit);
    return true;
  }
  return false;
}

export function focusNewspaper(target) {
  const sheet = target?.userData?.sheet || target;
  if (!sheet || !sheet.isMain || sheet === activeSheet) return;

  const previous = activeSheet;
  activeSheet = sheet;
  isStoryFocused = true;
  focusScrollT = scrollT;
  setHover(null);
  updateHoverRibbon(null);

  computeFocusPose(sheet);
  if (previous) {
    gsap.to(previous.focus, { v: 0, duration: 1.2, ease: 'power3.inOut', overwrite: 'auto' });
    gsap.to(focusCam, { ...sheet._cam, duration: 1.4, ease: 'power3.inOut', overwrite: 'auto' });
  } else {
    Object.assign(focusCam, sheet._cam);
  }

  allSheets.forEach((o) => gsap.to(o.dim, { v: o === sheet ? 0 : 1, duration: 1.0, overwrite: 'auto' }));
  gsap.to(globalDim, { v: 1, duration: 1.0, overwrite: 'auto' });
  gsap.to(sheet.focus, { v: 1, duration: 1.6, ease: 'power3.inOut', overwrite: 'auto' });
  gsap.to(camFocusMix, {
    v: 1,
    duration: 1.6,
    ease: 'power3.inOut',
    overwrite: 'auto',
    onComplete: () => {
      if (activeSheet === sheet && onFocusChangeCallback) {
        onFocusChangeCallback({ isFocused: true, paper: sheet.paper });
      }
    }
  });
}

export function focusNewspaperById(sectionId) {
  const sheet = mainSheets.find((s) => s.id === sectionId);
  if (sheet) {
    focusNewspaper(sheet);
    return true;
  }
  return false;
}

export function closeFocusedNewspaper() {
  if (!isStoryFocused || !activeSheet) return;
  const sheet = activeSheet;
  activeSheet = null;
  isStoryFocused = false;
  updateHoverRibbon(null);

  gsap.to(sheet.focus, { v: 0, duration: 1.25, ease: 'power3.inOut', overwrite: 'auto' });
  gsap.to(camFocusMix, { v: 0, duration: 1.25, ease: 'power3.inOut', overwrite: 'auto' });
  allSheets.forEach((o) => gsap.to(o.dim, { v: 0, duration: 0.8, overwrite: 'auto' }));
  gsap.to(globalDim, { v: 0, duration: 0.8, overwrite: 'auto' });

  if (onFocusChangeCallback) onFocusChangeCallback({ isFocused: false, paper: null });
}

export function setImageOverlayOpen(isOpen) {
  imageOverlayOpen = !!isOpen;
}

export function updateNewspaperScroll(stageProgress) {
  const t = Math.max(0, Math.min(1, stageProgress));
  scrollT = t;
  if (timeline) timeline.progress(t);
  if (isStoryFocused && !imageOverlayOpen && Math.abs(t - focusScrollT) > 0.03) {
    closeFocusedNewspaper();
  }
}

export function updateNewspaperMouse(normalizedX, normalizedY) {
  mouseTarget.x = normalizedX;
  mouseTarget.y = normalizedY;
}

export function onNewspaperResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  relayout();
}

/* ==========================================================================
   Render Loop
   ========================================================================== */
function applySheet(s) {
  const p = s.proxy;
  const f = s.focus.v;
  const h = s.hover.v;
  const d = s.dim.v;

  if (s.isMain) {
    // LOD texture swapping
    const targetTex = f > 0.35 ? s.detailTex : s.overviewTex;
    if (s.frontMat.map !== targetTex) {
      s.frontMat.map = targetTex;
      s.frontMat.needsUpdate = true;
    }

    const liftZ = REDUCED_MOTION ? h * 0.12 : (h * 0.38 - d * 0.16);
    const tiltX = REDUCED_MOTION ? 0 : -h * mouseTarget.y * 0.07;
    const tiltY = REDUCED_MOTION ? 0 : h * mouseTarget.x * 0.07;

    s.group.position.set(
      lerp(p.x, s.focusPose.x, f),
      lerp(p.y, s.focusPose.y, f),
      lerp(p.z + liftZ, s.focusPose.z, f)
    );
    s.group.rotation.set(
      lerp(p.rx + tiltX, 0, f),
      lerp(p.ry + tiltY, 0, f),
      lerp(p.rz, 0, f)
    );

    const baseScale = s.base?.scale || 1;
    const sc = baseScale * (1 + h * 0.025);
    s.group.scale.set(sc, sc, 1);

    const b = (1 - d * 0.60) * (1 + h * 0.06);
    s.frontMat.color.setRGB(0.93, 0.86, 0.72).multiplyScalar(b);
    s.backMat.color.setRGB(0.93, 0.86, 0.72).multiplyScalar(b * 0.92);
  } else {
    // Loose sheets beneath
    s.group.position.set(
      p.x,
      p.y,
      p.z - d * 0.08
    );
    s.group.rotation.set(p.rx, p.ry, p.rz);
    const sc = (s.base?.scale || 1);
    s.group.scale.set(sc, sc, 1);
  }
}

function animate() {
  requestAnimationFrame(animate);

  const px = isStoryFocused || REDUCED_MOTION ? 0 : mouseTarget.x * 0.035;
  const py = isStoryFocused || REDUCED_MOTION ? 0 : mouseTarget.y * 0.025;
  fieldGroup.rotation.y += (px - fieldGroup.rotation.y) * 0.06;
  fieldGroup.rotation.x += (py - fieldGroup.rotation.x) * 0.06;

  for (let i = 0; i < allSheets.length; i++) applySheet(allSheets[i]);

  const m = camFocusMix.v;
  camera.position.set(lerp(camProxy.x, focusCam.x, m), lerp(camProxy.y, focusCam.y, m), lerp(camProxy.z, focusCam.z, m));
  lookTmp.set(lerp(camProxy.x, focusCam.x, m), lerp(camProxy.ly, focusCam.ly, m), lerp(camProxy.lz, focusCam.lz, m));
  camera.lookAt(lookTmp);

  keyLight.intensity = grade.key * (1 + m * 0.12);
  hemiLight.intensity = grade.hemi;
  fillLight.intensity = grade.fill;
  rimLight.intensity = grade.rim;
  if (candleLight) {
    const t = performance.now() * 0.003;
    candleLight.intensity = (2.2 + Math.sin(t * 6.5) * 0.28 + Math.sin(t * 14.8) * 0.14) * (1 - m * 0.45);
  }
  scene.fog.density = grade.fog * (1 - m * 0.6);
  renderer.toneMappingExposure = grade.exposure;
  bgMat.opacity = grade.bg;
  bgMat.color.setRGB(0.32, 0.24, 0.17).multiplyScalar(1 - globalDim.v * 0.50);
  dustParticles.material.opacity = grade.dust * (1 - m * 0.7);

  const pos = dustParticles.geometry.attributes.position;
  for (let i = 1; i < pos.count * 3; i += 3) {
    pos.array[i] += 0.0025;
    if (pos.array[i] > 10) pos.array[i] = -10;
  }
  pos.needsUpdate = true;

  renderer.render(scene, camera);
}
