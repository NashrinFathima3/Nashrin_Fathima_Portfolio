/**
 * Shared colour palette — single source of truth for the whole experience.
 * Used by the Three.js scene (newspaper.js), the canvas paper textures,
 * and pushed into CSS custom properties at boot (applyPaletteToCSS) so the
 * hero, HUD, nav bar and 3D field all share the same warm sepia grade.
 */
export const PALETTE = {
  bg: '#070605',          // near-black stage background
  bgWarm: '#140d07',      // dark sepia used for fog / overlays
  ink: '#1d140c',         // printed ink
  inkSoft: '#4a3826',     // secondary ink (bylines, meta)
  inkFaint: 'rgba(40, 26, 14, 0.38)',
  accent: '#7a2e1c',      // oxblood kicker ink
  paper: '#efe2c6',       // fresh cream newsprint
  paperAged: '#e0caa0',   // aged edge tone
  paperBurn: '#a9885a',   // burnt edges / stains
  sepiaDeep: '#3a2716',
  gold: '#e2c99a',        // UI gold
  goldBright: '#f5e4c3',
  goldDim: 'rgba(226, 201, 154, 0.45)',
  keyLight: '#ffcf94',    // warm candle key
  fillLight: '#8a5a2b',   // deep amber fill
  rimLight: '#ff9c4a'     // burst rim glow
};

/** Expose the palette as CSS variables (--pal-*) on :root. */
export function applyPaletteToCSS(root = document.documentElement) {
  Object.entries(PALETTE).forEach(([key, value]) => {
    const cssKey = key.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
    root.style.setProperty(`--pal-${cssKey}`, value);
  });
}
