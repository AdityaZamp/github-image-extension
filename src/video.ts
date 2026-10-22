// Adds the controls GitHub's native <video> player lacks: ±5s skip, frame stepping,
// speeds above 2× that carry over between videos, loop, and a precise clock. Also
// recovers videos whose signed URL expired.

import { durableUrl } from './images';

export const RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
const SKIP = 5;
// ponytail: assumes 30 fps (typical screen recording); at 60 fps a step moves two frames.
// Measure with requestVideoFrameCallback metadata if exact stepping matters.
export const FRAME = 1 / 30;

/** Last speed the user picked; applied to every video when it starts playing. */
let preferredRate = 1;
const bars = new WeakMap<Element, HTMLVideoElement>();

export function formatTime(t: number): string {
  if (!Number.isFinite(t)) return '--:--';
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(2).padStart(5, '0')}`;
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

/** Adds the toolbar under one PR video. Safe to call more than once. */
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
  // Any speed change, ours or from the native ⋮ menu, becomes the default for the next video.
  video.addEventListener('ratechange', () => (preferredRate = video.playbackRate));
  video.addEventListener('play', () => {
    if (video.playbackRate !== preferredRate) video.playbackRate = preferredRate;
  });

  bar.addEventListener('click', (e) => {
    const action = (e.target as Element).closest('[data-act]')?.getAttribute('data-act');
    if (action) act(video, action);
  });
  select.addEventListener('change', () => (video.playbackRate = Number(select.value)));

  recoverExpiredSource(video);
  video.after(bar);
  sync();
}

/**
 * Uploaded videos stream from a signed URL that expires 5 minutes after page load, and
 * Chrome only buffers the first seconds up front, so playing later dies with
 * MEDIA_ERR_NETWORK ("data source error"). On that error, reload from the
 * user-attachments URL (re-signed on every request) and pick up where it stopped.
 * One retry per successful load, so a genuinely broken file can't loop.
 */
function recoverExpiredSource(video: HTMLVideoElement) {
  let retried = false;
  let resume = false;
  video.addEventListener('loadeddata', () => (retried = false));
  video.addEventListener('play', () => (resume = true));
  video.addEventListener('pause', () => {
    if (!video.error) resume = false;
  });
  video.addEventListener('error', () => {
    const fresh = durableUrl(video.currentSrc || video.src);
    if (retried || !fresh.startsWith('https://github.com/user-attachments/assets/')) return;
    retried = true;
    const time = video.currentTime;
    const play = resume;
    video.addEventListener(
      'loadedmetadata',
      () => {
        video.currentTime = time;
        if (play) void video.play().catch(() => {});
      },
      { once: true },
    );
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
  // Leave the speed <select> its own arrow keys.
  if (target.localName === 'select') return null;
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
  const video = action && targetVideo(e.target);
  if (!video) return;
  e.preventDefault();
  e.stopPropagation();
  act(video, action);
}
