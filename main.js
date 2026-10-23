/**
 * Cinematic Portfolio Experience
 * Stage 1: Cinematic video frame opening sequence (untouched)
 * Stage 2: Immersive 3D Newspaper Field (The Final Destination)
 */

import gsap from 'gsap';
import { applyPaletteToCSS } from './palette.js';
import { renderReadingViewHTML } from './content.js';
import {
  initNewspaper,
  updateNewspaperScroll,
  updateNewspaperMouse,
  checkRaycast,
  handleNewspaperClick,
  closeFocusedNewspaper,
  onNewspaperResize,
  setImageOverlayOpen,
  focusNewspaperById,
  setSafeArea,
  isNewspaperFocused
} from './newspaper.js';

// Apply shared palette CSS variables immediately
applyPaletteToCSS();

const TOTAL_FRAMES = 296;
const LERP_FACTOR = 0.082; // Inertia damping
const MOUSE_LERP = 0.06;

// Elements
const canvas = document.getElementById('cinema-canvas');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
const cameraRig = document.getElementById('camera-rig');
const webglContainer = document.getElementById('webgl-container');
const newspaperFocusHud = document.getElementById('newspaper-focus-hud');
const closeFocusBtn = document.getElementById('close-focus-btn');
const focusedCategoryIndicator = document.getElementById('focused-category-indicator');
const scrollPrompt = document.getElementById('scroll-prompt');
const loaderContainer = document.getElementById('loader');
const loaderProgressBar = document.getElementById('loader-progress');
const loaderPercent = document.getElementById('loader-percent');
const ambientGlow = document.getElementById('ambient-glow');

// HTML Reading View Overlay Elements (100% Selectable & Copyable)
const readingViewOverlay = document.getElementById('reading-view-overlay');
const readingViewContainer = document.getElementById('reading-view-container');
const readingViewBackdrop = document.querySelector('.reading-view-backdrop');

// Act I Opening & Navigation Elements
const openingDateline = document.getElementById('opening-dateline');
const openingHero = document.getElementById('opening-hero');
const archiveIndexBar = document.getElementById('archive-index-bar');
const archiveIndexItems = document.querySelectorAll('.index-nav-item');

// Section Image Viewer elements
const sectionImageViewer = document.getElementById('section-image-viewer');
const sectionImageEl = document.getElementById('section-image-el');
const sectionImageClose = document.getElementById('section-image-close');
const fieldReadingHint = document.getElementById('field-reading-hint');

// Shared scene state: 'hero' | 'burst' | 'field' | 'focused'
export let sceneState = 'hero';
let fieldHintDismissed = false;

export function dismissFieldHint() {
  if (fieldHintDismissed) return;
  fieldHintDismissed = true;
  if (fieldReadingHint) {
    fieldReadingHint.classList.remove('visible');
    fieldReadingHint.classList.add('hidden');
    fieldReadingHint.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Maps a portfolio section id → its exact uploaded asset path.
 *
 * EDUCATION: Uses the exact uploaded file (public/assets/education-newspaper.jpg, 478 KB .jpg).
 * Do NOT regenerate or replace this image — it is the user's actual uploaded asset.
 *
 * To activate a future section: upload its image to public/assets/ and uncomment its line.
 * All sections use the identical cinematic viewer interaction automatically.
 */
/**
 * Separate Cover / Thumbnail mappings for sections inside the 3D pile.
 */
export const SECTION_COVERS = {
  education:    '/assets/education-cover.jpg',       // ✅ uploaded · exact thumbnail/cover
  // experience: '/assets/experience-cover.jpg',
};

const SECTION_IMAGES = {
  // All 5 sheets now use high-resolution procedural 3D typesetting with full editorial content.
  // To route a section to a full-bleed scanned image overlay instead, uncomment its line:
  // education:    '/assets/education-newspaper.jpg',
  // experience:   '/assets/experience-newspaper.jpg',
};

/** Tracks whether the image viewer is currently visible */
let imageViewerActive = false;

// Image Cache & State (Stage 1)
const frames = new Array(TOTAL_FRAMES);
let loadedCount = 0;
let isFirstFrameReady = false;

// Motion State
let targetProgress = 0;
let smoothedProgress = 0;
let prevProgress = 0;
let velocity = 0;

// Mouse & Parallax State
let targetMouseX = 0;
let targetMouseY = 0;
let currentMouseX = 0;
let currentMouseY = 0;

// Dimensions
let canvasWidth = 0;
let canvasHeight = 0;
let dpr = 1;

/**
 * Generate frame file path
 */
function getFramePath(index) {
  const frameNum = String(index + 1).padStart(3, '0');
  return `/ezgif/ezgif-frame-${frameNum}.jpg`;
}

/**
 * Resize handler for canvas with Retina/DPR scaling
 */
function updateSafeArea() {
  const isMobile = window.innerWidth < 768;
  const navH = archiveIndexBar ? archiveIndexBar.offsetHeight : 44;
  setSafeArea({
    top: isMobile ? Math.max(64, navH + 16) : Math.max(92, navH + 28),
    bottom: isMobile ? 24 : 32,
    focusBottom: isMobile ? 64 : 88
  });
}

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;

  canvas.width = Math.round(canvasWidth * dpr);
  canvas.height = Math.round(canvasHeight * dpr);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  updateSafeArea();
  renderStage1Frame(smoothedProgress);
  onNewspaperResize();
}

/**
 * Draw an image to canvas with precise aspect ratio 'cover' mode
 */
function drawCover(image, opacity = 1.0) {
  if (!image || !image.complete || image.naturalWidth === 0) return;

  const imgW = image.naturalWidth || 1280;
  const imgH = image.naturalHeight || 720;

  const targetW = canvas.width;
  const targetH = canvas.height;

  const scale = Math.max(targetW / imgW, targetH / imgH);
  const renderW = imgW * scale;
  const renderH = imgH * scale;

  const dx = (targetW - renderW) / 2;
  const dy = (targetH - renderH) / 2;

  ctx.globalAlpha = opacity;
  ctx.drawImage(image, dx, dy, renderW, renderH);
}

/**
 * Find nearest loaded frame
 */
function getNearestLoadedFrame(targetIndex) {
  if (frames[targetIndex]?.complete && frames[targetIndex]?.naturalWidth > 0) {
    return frames[targetIndex];
  }

  for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
    const prev = targetIndex - offset;
    const next = targetIndex + offset;

    if (prev >= 0 && frames[prev]?.complete && frames[prev]?.naturalWidth > 0) {
      return frames[prev];
    }
    if (next < TOTAL_FRAMES && frames[next]?.complete && frames[next]?.naturalWidth > 0) {
      return frames[next];
    }
  }
  return null;
}

/**
 * Render Stage 1 frame with sub-frame optical crossfade
 */
function renderStage1Frame(overallProgress) {
  const stage1Progress = Math.max(0, Math.min(1, overallProgress / 0.50));

  const frameFloat = stage1Progress * (TOTAL_FRAMES - 1);
  const baseIndex = Math.floor(frameFloat);
  const nextIndex = Math.min(TOTAL_FRAMES - 1, baseIndex + 1);
  const blendAlpha = frameFloat - baseIndex;

  const baseImage = frames[baseIndex];
  const nextImage = frames[nextIndex];

  if (baseImage && baseImage.complete && baseImage.naturalWidth > 0) {
    drawCover(baseImage, 1.0);
  } else {
    const fallback = getNearestLoadedFrame(baseIndex);
    if (fallback) drawCover(fallback, 1.0);
  }

  if (blendAlpha > 0.005 && nextImage && nextImage.complete && nextImage.naturalWidth > 0) {
    drawCover(nextImage, blendAlpha);
  }

  ctx.globalAlpha = 1.0;
}

/**
 * Update 3D Stage 1 Camera Rig
 */
function updateStage1Rig() {
  const yaw = currentMouseX * 1.8;
  const pitch = -currentMouseY * 1.5 - velocity * 15;
  const roll = velocity * 12;

  const diveProgress = Math.max(0, Math.min(1, (smoothedProgress - 0.35) / 0.15));
  const dynamicScale = 1.025 + Math.abs(velocity) * 0.1 + diveProgress * 0.18;

  cameraRig.style.transform = `perspective(1200px) rotateX(${pitch.toFixed(3)}deg) rotateY(${yaw.toFixed(3)}deg) rotateZ(${roll.toFixed(3)}deg) scale(${dynamicScale.toFixed(4)})`;
}

/**
 * Update stage crossfade and synchronization
 */
function updateStages(progress) {
  const transitionStart = 0.42;
  const transitionEnd = 0.50;

  if (progress <= transitionStart) {
    cameraRig.style.opacity = '1';
    cameraRig.style.pointerEvents = 'auto';
    webglContainer.style.opacity = '0';
    webglContainer.classList.remove('active');
    updateNewspaperScroll(0);
  } else if (progress >= transitionEnd) {
    cameraRig.style.opacity = '0';
    cameraRig.style.pointerEvents = 'none';
    webglContainer.style.opacity = '1';
    webglContainer.classList.add('active');

    // Progression within newspaper field: 0.18 to 1.0 settling smoothly at final destination
    const stage2Progress = 0.18 + ((progress - transitionEnd) / (1.0 - transitionEnd)) * 0.82;
    updateNewspaperScroll(stage2Progress);
  } else {
    // Smooth tear entry handoff into Three.js 3D burst
    const blend = (progress - transitionStart) / (transitionEnd - transitionStart);
    cameraRig.style.opacity = (1 - blend).toFixed(3);
    webglContainer.style.opacity = blend.toFixed(3);
    webglContainer.classList.add('active');

    updateNewspaperScroll(blend * 0.18);
  }
}

/**
 * Drives visibility of all hero elements, masthead, prompt, and hints from one unified state:
 * 'hero'    → Opening portrait editorial presence (scrollPrompt visible, dateline & hero active)
 * 'burst'   → Optical handoff & zoom dive (all hero-only chrome strictly hidden, 0 opacity)
 * 'field'   → 3D newspaper spread on desk (archive navigation & subtle field reading hint)
 * 'focused' → Zoomed newspaper sheet inspection & HTML reading view overlay
 */
function updateSceneState(progress) {
  const isReadingActive = isNewspaperFocused() || imageViewerActive ||
    (readingViewOverlay && !readingViewOverlay.classList.contains('hidden'));

  let nextState;
  if (isReadingActive) {
    nextState = 'focused';
  } else if (progress < 0.08) {
    nextState = 'hero';
  } else if (progress < 0.44) {
    nextState = 'burst';
  } else {
    nextState = 'field';
  }

  sceneState = nextState;

  // 1. Hero scroll prompt & vertical line (Visible ONLY in 'hero')
  if (scrollPrompt) {
    if (sceneState === 'hero') {
      const promptAlpha = Math.max(0, 1 - progress / 0.04);
      if (promptAlpha > 0.01 && heroEntranceTriggered) {
        scrollPrompt.style.opacity = promptAlpha.toFixed(3);
        scrollPrompt.style.visibility = 'visible';
        scrollPrompt.style.pointerEvents = promptAlpha > 0.1 ? 'auto' : 'none';
        scrollPrompt.setAttribute('aria-hidden', promptAlpha > 0.1 ? 'false' : 'true');
        scrollPrompt.classList.remove('hidden');
      } else if (!heroEntranceTriggered) {
        scrollPrompt.style.visibility = 'visible';
      } else {
        scrollPrompt.style.opacity = '0';
        scrollPrompt.style.visibility = 'hidden';
        scrollPrompt.style.pointerEvents = 'none';
        scrollPrompt.setAttribute('aria-hidden', 'true');
        scrollPrompt.classList.add('hidden');
      }
    } else {
      // In 'burst', 'field', 'focused': 100% hidden, never overlaps sheets
      scrollPrompt.style.opacity = '0';
      scrollPrompt.style.visibility = 'hidden';
      scrollPrompt.style.pointerEvents = 'none';
      scrollPrompt.setAttribute('aria-hidden', 'true');
      scrollPrompt.classList.add('hidden');
    }
  }

  // 2. Opening Hero Two-Column Container (Left plate & right invite)
  if (openingHero) {
    if (sceneState === 'hero') {
      const heroAlpha = Math.max(0, 1 - progress / 0.08);
      const heroY = -(progress / 0.08) * 22;
      if (heroAlpha > 0.01 && heroEntranceTriggered) {
        openingHero.style.opacity = heroAlpha.toFixed(3);
        openingHero.style.transform = `translateY(${heroY.toFixed(1)}px)`;
        openingHero.style.visibility = 'visible';
        openingHero.style.pointerEvents = heroAlpha > 0.1 ? 'auto' : 'none';
        openingHero.setAttribute('aria-hidden', heroAlpha > 0.1 ? 'false' : 'true');
        openingHero.classList.remove('hidden');
      } else if (!heroEntranceTriggered) {
        openingHero.style.visibility = 'visible';
      } else {
        openingHero.style.opacity = '0';
        openingHero.style.visibility = 'hidden';
        openingHero.style.pointerEvents = 'none';
        openingHero.setAttribute('aria-hidden', 'true');
        openingHero.classList.add('hidden');
      }
    } else {
      openingHero.style.opacity = '0';
      openingHero.style.visibility = 'hidden';
      openingHero.style.pointerEvents = 'none';
      openingHero.setAttribute('aria-hidden', 'true');
      openingHero.classList.add('hidden');
    }
  }

  // 3. Opening Editorial Masthead Dateline Header
  if (openingDateline) {
    if (sceneState === 'hero') {
      const datelineAlpha = Math.max(0, 1 - progress / 0.06);
      if (datelineAlpha > 0.01 && heroEntranceTriggered) {
        openingDateline.style.opacity = datelineAlpha.toFixed(3);
        openingDateline.style.visibility = 'visible';
        openingDateline.style.pointerEvents = datelineAlpha > 0.1 ? 'auto' : 'none';
        openingDateline.setAttribute('aria-hidden', datelineAlpha > 0.1 ? 'false' : 'true');
        openingDateline.classList.remove('hidden');
      } else if (!heroEntranceTriggered) {
        openingDateline.style.visibility = 'visible';
      } else {
        openingDateline.style.opacity = '0';
        openingDateline.style.visibility = 'hidden';
        openingDateline.style.pointerEvents = 'none';
        openingDateline.setAttribute('aria-hidden', 'true');
        openingDateline.classList.add('hidden');
      }
    } else {
      openingDateline.style.opacity = '0';
      openingDateline.style.visibility = 'hidden';
      openingDateline.style.pointerEvents = 'none';
      openingDateline.setAttribute('aria-hidden', 'true');
      openingDateline.classList.add('hidden');
    }
  }

  // 4. Subtle Field Reading Hint ("Click a newspaper to read")
  if (fieldReadingHint) {
    if (sceneState === 'field' && !fieldHintDismissed) {
      fieldReadingHint.classList.add('visible');
      fieldReadingHint.classList.remove('hidden');
      fieldReadingHint.setAttribute('aria-hidden', 'false');
    } else {
      fieldReadingHint.classList.remove('visible');
      fieldReadingHint.classList.add('hidden');
      fieldReadingHint.setAttribute('aria-hidden', 'true');
    }
  }

  // 5. Stage 2 Archive Index Bar
  if (archiveIndexBar) {
    if (sceneState === 'field') {
      archiveIndexBar.classList.remove('hidden');
    } else {
      archiveIndexBar.classList.add('hidden');
    }
  }
}

/**
 * Main Animation Loop
 */
function tick() {
  prevProgress = smoothedProgress;
  smoothedProgress += (targetProgress - smoothedProgress) * LERP_FACTOR;
  velocity = smoothedProgress - prevProgress;

  if (Math.abs(velocity) < 0.00001) {
    smoothedProgress = targetProgress;
    velocity = 0;
  }

  currentMouseX += (targetMouseX - currentMouseX) * MOUSE_LERP;
  currentMouseY += (targetMouseY - currentMouseY) * MOUSE_LERP;

  if (smoothedProgress < 0.58) {
    renderStage1Frame(smoothedProgress);
    updateStage1Rig();
  }

  updateStages(smoothedProgress);

  if (smoothedProgress > 0.44) {
    updateNewspaperMouse(currentMouseX, currentMouseY);
  }

  // Drive all scene overlays, hero hints, and field hints from unified sceneState
  updateSceneState(smoothedProgress);

  if (ambientGlow) {
    const glowX = 55 + currentMouseX * 10;
    const glowY = 40 + currentMouseY * 10;
    const glowIntensity = 0.08 + smoothedProgress * 0.05;
    ambientGlow.style.background = `radial-gradient(circle at ${glowX}% ${glowY}%, rgba(240, 190, 120, ${glowIntensity}) 0%, transparent 65%)`;
  }

  requestAnimationFrame(tick);
}

/**
 * Update target progress from window scroll
 */
function onScroll() {
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  if (maxScroll <= 0) {
    targetProgress = 0;
  } else {
    targetProgress = Math.max(0, Math.min(1, window.scrollY / maxScroll));
  }
}

let heroEntranceTriggered = false;

/**
 * Cinematic entrance choreography for Act I: Personal Presence
 */
function triggerHeroEntrance() {
  if (heroEntranceTriggered) return;
  heroEntranceTriggered = true;

  const leftCol = document.querySelector('.hero-left-column');
  const rightCol = document.querySelector('.hero-right-column');

  if (leftCol) {
    gsap.fromTo(
      leftCol,
      { opacity: 0, x: -28, scale: 0.98 },
      { opacity: 1, x: 0, scale: 1, duration: 1.3, delay: 0.32, ease: 'power3.out' }
    );
  }

  if (rightCol) {
    gsap.fromTo(
      rightCol,
      { opacity: 0, x: 28, scale: 0.98 },
      { opacity: 1, x: 0, scale: 1, duration: 1.3, delay: 0.45, ease: 'power3.out' }
    );
  }

  const datelineChildren = openingDateline?.querySelectorAll('.dateline-left, .dateline-center, .dateline-right');
  if (datelineChildren && datelineChildren.length) {
    gsap.fromTo(
      datelineChildren,
      { opacity: 0, y: -12 },
      { opacity: 1, y: 0, duration: 1.0, stagger: 0.12, delay: 0.2, ease: 'power2.out' }
    );
  }

  if (scrollPrompt) {
    gsap.fromTo(
      scrollPrompt,
      { opacity: 0, y: 16 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        delay: 0.85,
        ease: 'power2.out',
        onComplete: () => {
          if (sceneState !== 'hero') {
            scrollPrompt.style.opacity = '0';
            scrollPrompt.style.visibility = 'hidden';
            scrollPrompt.style.pointerEvents = 'none';
            scrollPrompt.setAttribute('aria-hidden', 'true');
            scrollPrompt.classList.add('hidden');
          }
        }
      }
    );
  }
}

/**
 * Preloader engine for opening frames
 */
function preloadFrames() {
  function updateProgress() {
    const percent = Math.floor((loadedCount / TOTAL_FRAMES) * 100);
    if (loaderProgressBar) loaderProgressBar.style.width = `${percent}%`;
    if (loaderPercent) loaderPercent.textContent = `${percent}%`;

    if (loadedCount >= 5 && loaderContainer && !loaderContainer.classList.contains('loaded')) {
      loaderContainer.classList.add('loaded');
      triggerHeroEntrance();
    }
  }

  for (let i = 0; i < TOTAL_FRAMES; i++) {
    const img = new Image();
    img.onload = () => {
      frames[i] = img;
      loadedCount++;
      if (i === 0) {
        isFirstFrameReady = true;
        renderStage1Frame(0);
      }
      updateProgress();
    };
    img.onerror = () => {
      loadedCount++;
      updateProgress();
    };
    img.src = getFramePath(i);
  }

  // Safety fallback
  setTimeout(() => {
    if (loaderContainer && !loaderContainer.classList.contains('loaded')) {
      loaderContainer.classList.add('loaded');
    }
    triggerHeroEntrance();
  }, 800);
}

/**
 * Show the cinematic image viewer.
 * Called only AFTER the Three.js camera has fully arrived at the newspaper
 * (fired from focusNewspaper's onComplete), so the transition feels like
 * physically crossing the surface of the paper.
 */
function showSectionImageViewer(imageSrc) {
  if (!sectionImageViewer || !sectionImageEl) return;

  const testImg = new Image();
  testImg.onload = () => {
    setImageOverlayOpen(true);
    sectionImageEl.src = imageSrc;
    sectionImageViewer.classList.remove('hidden');
    sectionImageViewer.setAttribute('aria-hidden', 'false');
    imageViewerActive = true;
    if (archiveIndexBar) archiveIndexBar.classList.add('hidden');

    // Scale from slightly larger (as if we're already inside the paper)
    // to natural size — creates a seamless "crossing the surface" feeling
    gsap.fromTo(
      sectionImageViewer,
      { opacity: 0 },
      { opacity: 1, duration: 0.65, ease: 'power2.out' }
    );
    const frame = sectionImageViewer.querySelector('.section-image-frame');
    if (frame) {
      gsap.fromTo(
        frame,
        { scale: 1.06, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.75, ease: 'power2.out', delay: 0.05 }
      );
    }
  };

  testImg.onerror = () => {
    // If the image file has not yet been uploaded to disk, fall back cleanly to 3D HUD
    newspaperFocusHud.classList.remove('hidden');
    if (focusedCategoryIndicator) {
      focusedCategoryIndicator.textContent = 'IMAGE PENDING UPLOAD · ' + imageSrc.replace('/assets/', '');
    }
  };

  testImg.src = imageSrc;
}

/**
 * Dismiss the image viewer, then — only after it has fully faded out —
 * trigger the 3D camera retreat back to the newspaper field.
 * This creates a clean two-phase exit: image disappears, then 3D scene restores.
 */
function hideSectionImageViewer() {
  if (!sectionImageViewer || !imageViewerActive) return;
  imageViewerActive = false;
  setImageOverlayOpen(false);

  const frame = sectionImageViewer.querySelector('.section-image-frame');
  if (frame) {
    gsap.to(frame, { scale: 1.04, opacity: 0, duration: 0.35, ease: 'power2.in' });
  }

  gsap.to(sectionImageViewer, {
    opacity: 0,
    duration: 0.45,
    ease: 'power2.in',
    onComplete: () => {
      sectionImageViewer.classList.add('hidden');
      sectionImageViewer.setAttribute('aria-hidden', 'true');
      sectionImageEl.src = '';
      // Reset frame scale for next open
      if (frame) gsap.set(frame, { scale: 1, opacity: 1 });
      if (archiveIndexBar && smoothedProgress >= 0.54) {
        archiveIndexBar.classList.remove('hidden');
      }
      // 3D camera retreat begins ONLY after image is fully gone
      closeFocusedNewspaper();
    }
  });
}

/**
 * Dismiss the HTML Reading View (or image viewer if active) with a smooth fade-out,
 * then restore the 3D newspaper field.
 */
function dismissFocusedReading() {
  if (readingViewOverlay && !readingViewOverlay.classList.contains('hidden')) {
    gsap.to(readingViewOverlay, {
      opacity: 0,
      duration: 0.32,
      ease: 'power2.in',
      onComplete: () => {
        readingViewOverlay.classList.add('hidden');
        readingViewOverlay.setAttribute('aria-hidden', 'true');
        if (readingViewContainer) readingViewContainer.innerHTML = '';
        closeFocusedNewspaper();
      }
    });
  } else if (imageViewerActive) {
    hideSectionImageViewer();
  } else {
    closeFocusedNewspaper();
  }
}

/**
 * Handle Newspaper Focus change.
 * Fades in the 100% selectable semantic HTML Reading View overlay directly over
 * the zoomed 3D newspaper sheet, matching its physical layout 1:1.
 */
function onFocusChange({ isFocused, paper }) {
  if (isFocused && paper) {
    dismissFieldHint();
    // Synchronize active item in the archive index navigation
    const items = document.querySelectorAll('.index-nav-item');
    items.forEach((item) => {
      if (item.getAttribute('data-section') === paper.id) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    if (archiveIndexBar) archiveIndexBar.classList.add('hidden');
    if (scrollPrompt) {
      scrollPrompt.classList.add('hidden');
      scrollPrompt.style.pointerEvents = 'none';
    }

    const imageSrc = SECTION_IMAGES[paper.id];
    if (imageSrc) {
      showSectionImageViewer(imageSrc);
      newspaperFocusHud.classList.add('hidden');
    } else {
      // Fade in the HTML Reading View overlay
      if (readingViewContainer && readingViewOverlay) {
        readingViewContainer.innerHTML = renderReadingViewHTML(paper);
        readingViewOverlay.classList.remove('hidden');
        readingViewOverlay.setAttribute('aria-hidden', 'false');
        gsap.fromTo(
          readingViewOverlay,
          { opacity: 0 },
          { opacity: 1, duration: 0.45, ease: 'power2.out' }
        );
      }

      newspaperFocusHud.classList.remove('hidden');
      if (focusedCategoryIndicator) {
        focusedCategoryIndicator.textContent = paper.sectionName || paper.category || 'CHRONICLE';
      }
    }
  } else {
    if (readingViewOverlay && !readingViewOverlay.classList.contains('hidden')) {
      gsap.to(readingViewOverlay, {
        opacity: 0,
        duration: 0.28,
        ease: 'power2.in',
        onComplete: () => {
          readingViewOverlay.classList.add('hidden');
          readingViewOverlay.setAttribute('aria-hidden', 'true');
          if (readingViewContainer) readingViewContainer.innerHTML = '';
        }
      });
    }
    newspaperFocusHud.classList.add('hidden');
    if (archiveIndexBar && smoothedProgress >= 0.50) {
      archiveIndexBar.classList.remove('hidden');
    }
  }
}

/**
 * Initialize Event Listeners
 */
function initEvents() {
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', resizeCanvas, { passive: true });

  // Mouse move for 3D raycasting and parallax
  window.addEventListener('mousemove', (e) => {
    targetMouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    targetMouseY = (e.clientY / window.innerHeight - 0.5) * 2;

    if (smoothedProgress > 0.44) {
      const hit = checkRaycast(e.clientX, e.clientY);
      if (hit) {
        dismissFieldHint();
      }
    }
  }, { passive: true });

  window.addEventListener('mouseleave', () => {
    targetMouseX = 0;
    targetMouseY = 0;
  }, { passive: true });

  // Click on WebGL container to zoom into or exit newspaper
  webglContainer.addEventListener('click', (e) => {
    if (smoothedProgress > 0.44) {
      dismissFieldHint();
      handleNewspaperClick(e.clientX, e.clientY);
    }
  });

  // Top HUD return button
  if (closeFocusBtn) {
    closeFocusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissFocusedReading();
    });
  }

  // Backdrop click dismisses reading view
  if (readingViewBackdrop) {
    readingViewBackdrop.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissFocusedReading();
    });
  }

  // Image viewer return button
  if (sectionImageClose) {
    sectionImageClose.addEventListener('click', (e) => {
      e.stopPropagation();
      hideSectionImageViewer();
    });
  }

  // Clicking the dark backdrop also closes
  if (sectionImageViewer) {
    sectionImageViewer.addEventListener('click', (e) => {
      if (e.target === sectionImageViewer || e.target.classList.contains('section-image-backdrop')) {
        hideSectionImageViewer();
      }
    });
  }

  // ESC key: close reading view first if open, otherwise return to field
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      dismissFocusedReading();
      return;
    }

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const step = window.innerHeight * 0.45;

    if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
      window.scrollBy({ top: step, behavior: 'smooth' });
      e.preventDefault();
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      window.scrollBy({ top: -step, behavior: 'smooth' });
      e.preventDefault();
    } else if (e.key === 'Home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      e.preventDefault();
    } else if (e.key === 'End') {
      window.scrollTo({ top: maxScroll, behavior: 'smooth' });
      e.preventDefault();
    }
  });

  // Touch gesture support
  let touchStartY = 0;
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) {
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      const touchY = e.touches[0].clientY;
      touchStartY = touchY;

      targetMouseX = (e.touches[0].clientX / window.innerWidth - 0.5) * 2;
      targetMouseY = (e.touches[0].clientY / window.innerHeight - 0.5) * 2;
    }
  }, { passive: true });

  // Archive index navigation buttons
  const navItems = document.querySelectorAll('.index-nav-item');
  navItems.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissFieldHint();
      const sectionId = btn.getAttribute('data-section');
      if (!sectionId) return;

      navItems.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      if (readingViewOverlay && !readingViewOverlay.classList.contains('hidden')) {
        readingViewOverlay.classList.add('hidden');
        if (readingViewContainer) readingViewContainer.innerHTML = '';
      }

      if (imageViewerActive) {
        hideSectionImageViewer();
      }

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (smoothedProgress < 0.90) {
        window.scrollTo({ top: maxScroll, behavior: 'smooth' });
        setTimeout(() => {
          focusNewspaperById(sectionId);
        }, 850);
      } else {
        focusNewspaperById(sectionId);
      }
    });
  });

  // Interactive scroll prompt click handling
  if (scrollPrompt) {
    scrollPrompt.addEventListener('click', (e) => {
      e.stopPropagation();
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: maxScroll, behavior: 'smooth' });
    });
  }

  // Right-column "ENTER THE ARCHIVE" trigger button
  const heroEnterTrigger = document.getElementById('hero-enter-trigger');
  if (heroEnterTrigger) {
    heroEnterTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: maxScroll, behavior: 'smooth' });
    });
  }
}

/**
 * Bootstrap Application
 */
function init() {
  preloadFrames();
  resizeCanvas();
  initEvents();
  onScroll();
  requestAnimationFrame(tick);

  try {
    initNewspaper(webglContainer, onFocusChange);
    updateSafeArea();
  } catch (err) {
    console.error('Newspaper initialization error:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
