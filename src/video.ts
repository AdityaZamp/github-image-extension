// Adds the controls GitHub's native <video> player lacks: ±5s skip, frame stepping,
// speeds above 2× that carry over between videos, loop, and a precise clock. Also
// recovers videos whose signed URL expired.

import { durableUrl } from './images';

export const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
const SKIP = 5;
// ponytail: assumes 30 fps (typical screen recording); at 60 fps a step moves two frames.
// Measure with requestVideoFrameCallback metadata if exact stepping matters.
export const FRAME = 1 / 30;

/** Last speed picked on any video; a video with no speed of its own starts at this. */
let preferredRate = 1;
const bars = new WeakMap<Element, HTMLVideoElement>();
// A media load resets playbackRate to 1 and fires `ratechange` while readyState is
// still HAVE_NOTHING (checked in Chrome); that reset is not a user's choice.
const HAVE_NOTHING = 0;

export function formatTime(t: number): string {
  if (!Number.isFinite(t)) return '--:--';
  // Round to hundredths first, so 59.996 reads 1:00.00, not 0:60.00.
  const cs = Math.round(t * 100);
  const m = Math.floor(cs / 6000);
  return `${m}:${((cs % 6000) / 100).toFixed(2).padStart(5, '0')}`;
}

/** The next speed up (dir 1) or down (dir -1) from `rate`; stays put at either end. */
export function stepRate(rate: number, dir: 1 | -1): number {
  const i = dir > 0 ? RATES.findIndex((r) => r > rate) : RATES.findLastIndex((r) => r < rate);
  return i < 0 ? rate : RATES[i];
}

export function seek(video: HTMLVideoElement, delta: number) {
  const end = Number.isFinite(video.duration) ? video.duration : Infinity;
  video.currentTime = Math.min(end, Math.max(0, video.currentTime + delta));
}

export function act(video: HTMLVideoElement, action: string) {
  switch (action) {
    case 'back':
      return seek(video, -SKIP);
    case 'fwd':
      return seek(video, SKIP);
    case 'prev-frame':
      video.pause();
      return seek(video, -FRAME);
    case 'next-frame':
      video.pause();
      return seek(video, FRAME);
    case 'slower':
      video.playbackRate = stepRate(video.playbackRate, -1);
      return;
    case 'faster':
      video.playbackRate = stepRate(video.playbackRate, 1);
      return;
    case 'loop':
      video.loop = !video.loop;
      // `loop` fires no event, so refresh the toolbar here.
      return video.dispatchEvent(new Event('ghvc-sync'));
    case 'mute':
      video.muted = !video.muted;
      return;
    case 'play':
      return video.paused ? void video.play().catch(() => {}) : video.pause();
    case 'fullscreen':
      return void (document.fullscreenElement ? document.exitFullscreen() : video.requestFullscreen()).catch(() => {});
  }
}

const BAR = `
  <button type="button" data-act="back" title="Back 5 seconds (← or j)">−5s</button>
  <button type="button" data-act="prev-frame" title="Previous frame (,)">−1f</button>
  <button type="button" data-act="next-frame" title="Next frame (.)">+1f</button>
  <button type="button" data-act="fwd" title="Forward 5 seconds (→ or l)">+5s</button>
  <select aria-label="Playback speed" title="Playback speed (&lt; or &gt;)">
    ${RATES.map((r) => `<option value="${r}">${r}×</option>`).join('')}
  </select>
  <button type="button" data-act="loop" aria-pressed="false" title="Loop">Loop</button>
  <span class="ghvc-time" aria-label="Current time / duration"></span>`;

/** Adds the toolbar under one video. Safe to call more than once. */
export function enhanceVideo(video: HTMLVideoElement) {
  if (video.dataset.ghvc) return;
  video.dataset.ghvc = '1';

  const bar = document.createElement('div');
  bar.className = 'ghvc-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Video controls');
  bar.innerHTML = BAR;
  bars.set(bar, video);
  const select = bar.querySelector('select')!;
  const loop = bar.querySelector('[data-act="loop"]')!;
  const time = bar.querySelector('.ghvc-time')!;

  const sync = () => {
    time.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    select.value = String(video.playbackRate);
    loop.setAttribute('aria-pressed', String(video.loop));
  };
  for (const type of ['timeupdate', 'seeked', 'durationchange', 'loadedmetadata', 'ratechange', 'ghvc-sync']) {
    video.addEventListener(type, sync);
  }
  // Speed: once set on this video (toolbar, keys or the native ⋮ menu) it's the video's
  // own; until then the video follows the last speed picked anywhere.
  let ownRate: number | undefined;
  video.addEventListener('ratechange', () => {
    if (video.readyState === HAVE_NOTHING) return;
    ownRate = preferredRate = video.playbackRate;
  });
  video.addEventListener('play', () => {
    const rate = ownRate ?? preferredRate;
    if (video.playbackRate !== rate) video.playbackRate = rate;
  });

  bar.addEventListener('click', (e) => {
    const button = (e.target as Element).closest('[data-act]');
    if (button && bar.contains(button)) act(video, button.getAttribute('data-act')!);
  });
  select.addEventListener('change', () => (video.playbackRate = Number(select.value)));

  // Clicking Chrome's own controls (play button, timeline) focuses an element inside the
  // player's shadow DOM, and key presses there never reach the page, so the shortcuts
  // went dead. Such a click fires `focusin` while the video itself isn't :focus; pull
  // focus back to the video. Keyboard users keep the native controls: Tab lands on the
  // video first (:focus), and Tabbing on into the controls fires no further focusin.
  video.addEventListener('focusin', () => {
    if (!video.matches(':focus')) video.focus();
  });

  recoverExpiredSource(video);
  video.after(bar);
  sync();
}

/**
 * Uploaded videos stream from a signed URL that expires 5 minutes after page load, and
 * Chrome only buffers the first seconds up front, so playing later dies with
 * MEDIA_ERR_NETWORK ("data source error"). On that error, reload from the
 * user-attachments URL (re-signed on every request) and pick up where it stopped.
 *
 * The reload resets time and speed, so both are restored. If a reload fails before
 * loading, the next one keeps the original target rather than the reset 0:00 / 1×.
 *
 * Bounded so a broken or crafted upload can't cause a reload loop: decode errors are
 * skipped (a fresh URL can't fix a bad file), and there's at most one reload per
 * RETRY_GAP_MS. A real expiry needs one reload per 300s link lifetime, well under that.
 */
const MEDIA_ERR_DECODE = 3;
const RETRY_GAP_MS = 60_000;

function recoverExpiredSource(video: HTMLVideoElement) {
  let lastRetry = -Infinity;
  let resume = false;
  let pending: { time: number; rate: number; play: boolean } | null = null;
  video.addEventListener('play', () => (resume = true));
  video.addEventListener('pause', () => {
    if (!video.error) resume = false;
  });
  // One listener for every reload, so a reload that failed early can't leave a stale
  // handler that fires alongside the next one.
  video.addEventListener('loadedmetadata', () => {
    if (!pending) return;
    const { time, rate, play } = pending;
    pending = null;
    video.currentTime = time;
    video.playbackRate = rate;
    if (play) void video.play().catch(() => {});
  });
  video.addEventListener('error', () => {
    if (video.error?.code === MEDIA_ERR_DECODE) return;
    const fresh = durableUrl(video.currentSrc || video.src);
    if (!fresh.startsWith('https://github.com/user-attachments/assets/')) return;
    if (Date.now() - lastRetry < RETRY_GAP_MS) return;
    lastRetry = Date.now();
    pending ??= { time: video.currentTime, rate: video.playbackRate, play: resume };
    video.src = fresh;
  });
}

const KEYS: Record<string, string> = {
  ArrowLeft: 'back',
  ArrowRight: 'fwd',
  j: 'back',
  l: 'fwd',
  k: 'play',
  ',': 'prev-frame',
  '.': 'next-frame',
  '<': 'slower',
  '>': 'faster',
  m: 'mute',
  f: 'fullscreen',
};

/** The enhanced video a key press is aimed at: the focused video, or the one whose toolbar has focus. */
function targetVideo(target: EventTarget | null): HTMLVideoElement | null {
  if (!(target instanceof Element)) return null;
  if (target.localName === 'video') return (target as HTMLVideoElement).dataset.ghvc ? (target as HTMLVideoElement) : null;
  const bar = target.closest('.ghvc-bar');
  return (bar && bars.get(bar)) ?? null;
}

/**
 * Keyboard shortcuts, only while a PR video or its toolbar has focus, so page keys and
 * typing are never taken over. Capture phase, to beat the native player's 1%-step arrows
 * and GitHub's own hotkeys. Space is left to the browser (play/pause on the video,
 * activate on a button).
 */
export function onVideoKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const action = KEYS[e.key];
  // The speed <select> keeps its own arrow keys; every other shortcut still works there.
  if (!action || (e.key.startsWith('Arrow') && e.target instanceof HTMLSelectElement)) return;
  const video = targetVideo(e.target);
  if (!video) return;
  e.preventDefault();
  e.stopPropagation();
  act(video, action);
}
