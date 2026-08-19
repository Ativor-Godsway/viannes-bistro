/**
 * Scroll choreography constants — one export per beat so each beat is tunable
 * in isolation without reading the animation code.
 *
 * `m` values are the mobile branch (roughly half the desktop translation:
 * large parallax offsets that read as depth on a 1440px screen read as
 * stuttering on a phone).
 */

// Beat 1 — hero entrance, on load, before any scroll.
export const BEAT1 = {
  lineDuration: 0.9,
  lineStagger: 0.12,
  lineY: 46, // px rise of each headline line
  scriptDraw: 1.1, // s, script wipe/draw
  scriptDelay: 0.55,
  discFrom: 0.9, // scale
  discDuration: 1.3,
  tailDelay: 0.75, // body copy + CTA come last
  tailY: 12,
  decodeCap: 800, // ms to wait for the hero photo before playing regardless
};

// Beat 2 — three depth planes through the hero.
export const BEAT2 = {
  scrub: 0.6, // NOT true — the lag is what gives it weight
  ambient: { y: -8, m: -4 },
  // rot/mRot: total rotation across the hero exit. Subtle — the object settling
  // under its own weight, not a spinning graphic. Shares the parallax trigger.
  disc: { y: -22, rot: 24, m: -11, mRot: 14 },
  rail: { y: -15, m: -8 },
  type: { y: -45, m: -22 },
};

// Beat 3 — the doorway. Headline lines part, red field recedes.
export const BEAT3 = {
  pinDistance: 0.8, // × viewport height (desktop only)
  scrub: 0.6,
  partX: 52, // xPercent, line 1 left / line 2 right
  partXMobile: 40,
  fieldScale: 0.94,
  fieldBrightness: 0.85,
};

// Beat 4 — the threshold wave divider.
export const BEAT4 = {
  scrub: 0.5,
  deep: 'M0,0 L0,60 C240,180 720,-40 1440,80 L1440,0 Z',
  shallow: 'M0,0 L0,40 C360,90 1080,10 1440,44 L1440,0 Z',
};

// Beat 6 — menu card grid entrance. Plays once; no scrub, no skew.
export const BEAT6 = {
  duration: 0.5,
  y: 32,
  stagger: 0.06,
  start: 'top bottom-=15%',
};

// Beat 8 — velocity skew. RETIRED: removed from MenuSection when the shop
// collapsed to one page. Scrolling the menu is now part of ordering, not a
// showcase, and a shearing grid read as an effect rather than as feel. Kept
// here only so the beat numbering stays legible against the design notes.
export const BEAT8 = {
  maxSkew: 4, // deg, hard clamp
  divisor: 260, // velocity → deg
  settle: 0.5, // s, ease back to 0
};
