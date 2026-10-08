import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FIXTURE } from './fixture';
import { centered, fitScale, MAX_ZOOM, MIN_ZOOM, viewerState, zoomAt } from '../src/viewer';

beforeAll(async () => {
  // jsdom lacks modal dialogs.
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  await import('../src/content');
});

beforeEach(() => {
  viewerState().dialog?.close();
  history.replaceState(null, '', '/owner/repo/pull/1');
  document.body.innerHTML = FIXTURE;
});

const click = (el: Element, init: MouseEventInit = {}) => {
  const e = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
  el.dispatchEvent(e);
  return e;
};
const key = (k: string) => {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  viewerState().dialog!.dispatchEvent(e);
  return e;
};
const byId = (id: string) => document.getElementById(id)!;

describe('click interception', () => {
  it('opens the viewer in-page instead of following the link', () => {
    const e = click(byId('camo'));
    expect(e.defaultPrevented).toBe(true);
    expect(viewerState()).toMatchObject({ open: true, index: 1 });
  });

  it('keeps modifier and non-left clicks native (open in new tab still works)', () => {
    for (const init of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }]) {
      expect(click(byId('attach'), init).defaultPrevented).toBe(false);
    }
    expect(viewerState().open).toBe(false);
  });

  it('ignores badge links and pages that are not pull requests', () => {
    expect(click(byId('badge')).defaultPrevented).toBe(false);
    history.replaceState(null, '', '/owner/repo/issues/1');
    expect(click(byId('attach')).defaultPrevented).toBe(false);
    expect(viewerState().open).toBe(false);
  });

  it('respects clicks GitHub already handled', () => {
    byId('attach').addEventListener('click', (e) => e.preventDefault(), { once: true });
    click(byId('attach'));
    expect(viewerState().open).toBe(false);
  });

  it('adds one expand button per image diff, opening at its "before" image', () => {
    const rendered = (el: Element, animationName = 'ghlb-diff-frame') =>
      el.dispatchEvent(Object.assign(new Event('animationstart', { bubbles: true }), { animationName }));
    const frame = document.querySelector('iframe.render-viewer')!;
    rendered(frame);
    rendered(frame); // re-render (e.g. collapse/expand) must not duplicate
    rendered(frame, 'some-github-animation');
    rendered(document.getElementById('svgdiff')!);
    const buttons = document.querySelectorAll('.ghlb-expand');
    expect(buttons).toHaveLength(1);
    click(buttons[0]);
    expect(viewerState()).toMatchObject({ open: true, index: 3 });
  });

  it('survives the body being replaced by client-side navigation', () => {
    click(byId('attach'));
    viewerState().dialog!.close();
    document.body.innerHTML = FIXTURE;
    click(byId('ua'));
    expect(viewerState().dialog!.isConnected).toBe(true);
    expect(viewerState().index).toBe(2);
  });
});

describe('viewer keyboard and controls', () => {
  it('navigates with arrow keys and wraps around', () => {
    click(byId('attach'));
    key('ArrowLeft');
    expect(viewerState().index).toBe(4);
    key('ArrowRight');
    key('ArrowRight');
    expect(viewerState().index).toBe(1);
    expect(viewerState().dialog!.querySelector('.ghlb-count')!.textContent).toBe('2 / 5');
  });

  it('zooms with +/- and keeps keys away from GitHub hotkeys', () => {
    let leaked = 0;
    document.addEventListener('keydown', () => leaked++);
    click(byId('attach'));
    const s = viewerState().view.s;
    expect(key('+').defaultPrevented).toBe(true);
    expect(viewerState().view.s).toBeCloseTo(s * 1.25);
    key('-');
    key('-');
    expect(viewerState().view.s).toBeCloseTo(s / 1.25);
    key('c');
    expect(leaked).toBe(0);
  });

  it('closes on backdrop click but not on toolbar or image clicks', () => {
    click(byId('attach'));
    const d = viewerState().dialog!;
    click(d.querySelector('.ghlb-img')!);
    click(d.querySelector('.ghlb-label')!);
    expect(viewerState().open).toBe(true);
    click(d.querySelector('.ghlb-stage')!);
    expect(viewerState().open).toBe(false);
  });

  it('close button closes', () => {
    click(byId('attach'));
    click(viewerState().dialog!.querySelector('[data-act="close"]')!);
    expect(viewerState().open).toBe(false);
  });
});

describe('zoom math', () => {
  it('keeps the point under the cursor fixed', () => {
    const v = zoomAt({ s: 1, x: 10, y: 20 }, 2, 110, 120);
    expect(v).toEqual({ s: 2, x: -90, y: -80 });
    // Image pixel under the cursor before == after.
    expect((110 - v.x) / v.s).toBe((110 - 10) / 1);
  });

  it('clamps zoom range', () => {
    expect(zoomAt({ s: 1, x: 0, y: 0 }, 1e6, 0, 0).s).toBe(MAX_ZOOM);
    expect(zoomAt({ s: 1, x: 0, y: 0 }, 1e-6, 0, 0).s).toBe(MIN_ZOOM);
  });

  it('fits large images, never upscales small ones, tolerates zero sizes', () => {
    expect(fitScale(2000, 1000, 1064, 564)).toBe(0.5);
    expect(fitScale(100, 100, 1000, 1000)).toBe(1);
    expect(fitScale(0, 0, 1000, 1000)).toBe(1);
    expect(fitScale(100, 100, 0, 0)).toBe(1);
    expect(centered(0.5, 2000, 1000, 1064, 564)).toEqual({ s: 0.5, x: 32, y: 32 });
  });
});
