import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, enhanceVideo, FRAME, formatTime, onVideoKey, RATES, stepRate } from '../src/video';

/** jsdom has no media playback; give a real <video> the state the code reads and writes. */
function fakeVideo(duration = 20) {
  const v = document.createElement('video');
  let rate = 1;
  const state = { currentTime: 0, paused: true };
  Object.defineProperties(v, {
    error: { value: null, writable: true },
    duration: { value: duration },
    currentTime: { get: () => state.currentTime, set: (t) => ((state.currentTime = t), v.dispatchEvent(new Event('seeked'))) },
    paused: { get: () => state.paused },
    playbackRate: { get: () => rate, set: (r) => ((rate = r), v.dispatchEvent(new Event('ratechange'))) },
    play: { value: () => ((state.paused = false), v.dispatchEvent(new Event('play')), Promise.resolve()) },
    pause: { value: () => (state.paused = true) },
  });
  return v;
}

// GitHub's markup for an uploaded video (recorded from a live PR).
function mount(...videos: HTMLVideoElement[]) {
  document.body.innerHTML = '';
  for (const v of videos) {
    const details = document.createElement('details');
    details.open = true;
    details.innerHTML = '<summary>recording.mp4</summary>';
    details.append(v);
    const body = document.createElement('div');
    body.className = 'comment-body markdown-body';
    body.append(details);
    document.body.append(body);
    enhanceVideo(v);
  }
}

const key = (target: Element, k: string) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  target.addEventListener('keydown', onVideoKey as EventListener, { once: true });
  target.dispatchEvent(e);
  return e;
};

describe('helpers', () => {
  it('formats a precise clock', () => {
    expect(formatTime(0)).toBe('0:00.00');
    expect(formatTime(3.271)).toBe('0:03.27');
    expect(formatTime(125.5)).toBe('2:05.50');
    expect(formatTime(NaN)).toBe('--:--');
    expect(formatTime(Infinity)).toBe('--:--');
  });

  it('steps through speeds and stops at the ends', () => {
    expect(stepRate(1, 1)).toBe(1.25);
    expect(stepRate(2, 1)).toBe(2.5);
    expect(stepRate(1, -1)).toBe(0.75);
    expect(stepRate(RATES.at(-1)!, 1)).toBe(4);
    expect(stepRate(RATES[0], -1)).toBe(0.25);
    // A speed set elsewhere (e.g. 1.1) snaps to its neighbours.
    expect(stepRate(1.1, 1)).toBe(1.25);
    expect(stepRate(1.1, -1)).toBe(1);
  });
});

describe('actions', () => {
  let v: HTMLVideoElement;
  beforeEach(() => {
    v = fakeVideo(20);
    mount(v);
  });

  it('skips 5s and clamps to the start and end', () => {
    act(v, 'fwd');
    expect(v.currentTime).toBe(5);
    act(v, 'back');
    act(v, 'back');
    expect(v.currentTime).toBe(0);
    v.currentTime = 18;
    act(v, 'fwd');
    expect(v.currentTime).toBe(20);
  });

  it('steps single frames and pauses', () => {
    void v.play();
    v.currentTime = 1;
    act(v, 'next-frame');
    expect(v.paused).toBe(true);
    expect(v.currentTime).toBeCloseTo(1 + FRAME);
    act(v, 'prev-frame');
    act(v, 'prev-frame');
    expect(v.currentTime).toBeCloseTo(1 - FRAME);
  });

  it('toggles loop and mute', () => {
    act(v, 'loop');
    expect(v.loop).toBe(true);
    expect(document.querySelector('[data-act="loop"]')!.getAttribute('aria-pressed')).toBe('true');
    act(v, 'mute');
    expect(v.muted).toBe(true);
  });
});

describe('toolbar', () => {
  it('is added once, right under the video, with a live clock', () => {
    const v = fakeVideo(6.27);
    mount(v);
    enhanceVideo(v);
    expect(document.querySelectorAll('.ghvc-bar')).toHaveLength(1);
    expect(v.nextElementSibling?.className).toBe('ghvc-bar');
    v.currentTime = 3.27;
    expect(document.querySelector('.ghvc-time')!.textContent).toBe('0:03.27 / 0:06.27');
  });

  it('buttons and the speed menu drive the video', () => {
    const v = fakeVideo();
    mount(v);
    (document.querySelector('[data-act="fwd"]') as HTMLButtonElement).click();
    expect(v.currentTime).toBe(5);
    const select = document.querySelector('select')!;
    select.value = '3';
    select.dispatchEvent(new Event('change'));
    expect(v.playbackRate).toBe(3);
  });

  it('ignores data-act attributes outside the toolbar', () => {
    const v = fakeVideo();
    mount(v);
    // Something above the toolbar carrying data-act must not trigger an action.
    v.closest('details')!.setAttribute('data-act', 'fwd');
    (document.querySelector('.ghvc-time') as HTMLElement).click();
    expect(v.currentTime).toBe(0);
  });

  it('carries the chosen speed over to the next video played', () => {
    const a = fakeVideo();
    const b = fakeVideo();
    mount(a, b);
    act(a, 'faster');
    act(a, 'faster');
    expect(a.playbackRate).toBe(1.5);
    void b.play();
    expect(b.playbackRate).toBe(1.5);
    expect(document.querySelectorAll('select')[1].value).toBe('1.5');
  });
});

describe('expired upload URLs', () => {
  // Shape copied from a live PR upload; the jwt expires 5 minutes after page load.
  const SIGNED = 'https://private-user-images.githubusercontent.com/295742110/677757600-3d76b96f-09a0-4c42-bd1c-26c503d27266.mp4?jwt=x';
  const DURABLE = 'https://github.com/user-attachments/assets/3d76b96f-09a0-4c42-bd1c-26c503d27266';

  it('reloads from the re-signing URL and resumes where playback died', () => {
    const v = fakeVideo();
    v.setAttribute('src', SIGNED);
    mount(v);
    void v.play();
    v.currentTime = 2.24;
    v.dispatchEvent(new Event('error'));
    expect(v.getAttribute('src')).toBe(DURABLE);
    v.pause(); // the failed load leaves it paused
    v.currentTime = 0; // and a new source starts at 0
    v.dispatchEvent(new Event('loadedmetadata'));
    expect(v.currentTime).toBe(2.24);
    expect(v.paused).toBe(false);
  });

  afterEach(() => vi.useRealTimers());

  it('reloads at most once a minute, so a broken upload cannot loop', () => {
    vi.useFakeTimers();
    const v = fakeVideo();
    v.setAttribute('src', SIGNED);
    mount(v);
    v.dispatchEvent(new Event('error'));
    expect(v.getAttribute('src')).toBe(DURABLE);
    // The file loads a frame, then fails again: no reload, even after loadeddata.
    v.setAttribute('src', SIGNED);
    v.dispatchEvent(new Event('loadeddata'));
    vi.advanceTimersByTime(59_000);
    v.dispatchEvent(new Event('error'));
    expect(v.getAttribute('src')).toBe(SIGNED);
    // A real expiry is 300s after the last fresh URL, well past the gap.
    vi.advanceTimersByTime(241_000);
    v.dispatchEvent(new Event('error'));
    expect(v.getAttribute('src')).toBe(DURABLE);
  });

  it('skips decode errors, which a fresh URL cannot fix', () => {
    const v = fakeVideo();
    v.setAttribute('src', SIGNED);
    mount(v);
    (v as { error: unknown }).error = { code: 3 };
    v.dispatchEvent(new Event('error'));
    expect(v.getAttribute('src')).toBe(SIGNED);
  });

  it('leaves non-upload videos alone', () => {
    const v = fakeVideo();
    v.setAttribute('src', 'https://example.com/clip.mp4');
    mount(v);
    v.dispatchEvent(new Event('error'));
    expect(v.getAttribute('src')).toBe('https://example.com/clip.mp4');
  });
});

describe('keyboard', () => {
  let v: HTMLVideoElement;
  beforeEach(() => {
    v = fakeVideo();
    mount(v);
    v.playbackRate = 1;
  });

  it('acts on the focused video and blocks the native 1% arrow step', () => {
    const e = key(v, 'ArrowRight');
    expect(e.defaultPrevented).toBe(true);
    expect(v.currentTime).toBe(5);
    key(v, '>');
    expect(v.playbackRate).toBe(1.25);
    key(v, '.');
    expect(v.currentTime).toBeCloseTo(5 + FRAME);
  });

  it('works from the toolbar buttons too', () => {
    key(document.querySelector('[data-act="loop"]')!, 'l');
    expect(v.currentTime).toBe(5);
  });

  it('leaves Space, modified keys, the speed menu and other page elements alone', () => {
    expect(key(v, ' ').defaultPrevented).toBe(false);
    const meta = new KeyboardEvent('keydown', { key: 'ArrowRight', metaKey: true, cancelable: true });
    onVideoKey(Object.defineProperty(meta, 'target', { value: v }));
    expect(meta.defaultPrevented).toBe(false);
    expect(key(document.querySelector('select')!, 'ArrowRight').defaultPrevented).toBe(false);
    const textarea = document.body.appendChild(document.createElement('textarea'));
    expect(key(textarea, 'k').defaultPrevented).toBe(false);
    expect(v.currentTime).toBe(0);
  });

  it('ignores videos the extension did not enhance', () => {
    const plain = document.body.appendChild(document.createElement('video'));
    expect(key(plain, 'ArrowRight').defaultPrevented).toBe(false);
  });
});
