import type { GalleryItem } from './images';

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 20;
const STEP = 1.25;
const PAD = 32;

export interface View {
  s: number;
  x: number;
  y: number;
}

/** Largest scale that fits the image in the stage, never upscaling past 100%. */
export function fitScale(nw: number, nh: number, w: number, h: number): number {
  if (!nw || !nh || w <= 2 * PAD || h <= 2 * PAD) return 1;
  return Math.min(1, (w - 2 * PAD) / nw, (h - 2 * PAD) / nh);
}

/** Scale by `factor` keeping the point (px, py) fixed on screen. */
export function zoomAt(v: View, factor: number, px: number, py: number): View {
  const s = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.s * factor));
  const k = s / v.s;
  return { s, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
}

/** Centre an nw×nh image in a w×h stage at scale s. */
export function centered(s: number, nw: number, nh: number, w: number, h: number): View {
  return { s, x: (w - nw * s) / 2, y: (h - nh * s) / 2 };
}

let dialog: HTMLDialogElement | null = null;
let items: GalleryItem[] = [];
let index = 0;
let view: View = { s: 1, x: 0, y: 0 };
let fitted = true;

const $ = <T extends Element>(sel: string) => dialog!.querySelector<T>(sel)!;

function build(): HTMLDialogElement {
  const d = document.createElement('dialog');
  d.className = 'ghlb';
  d.setAttribute('aria-label', 'Image viewer');
  d.innerHTML = `
    <div class="ghlb-stage"><img class="ghlb-img" alt="" draggable="false"></div>
    <div class="ghlb-bar">
      <button type="button" data-act="prev" aria-label="Previous image (Left arrow)">‹</button>
      <span class="ghlb-count" aria-live="polite"></span>
      <button type="button" data-act="next" aria-label="Next image (Right arrow)">›</button>
      <span class="ghlb-label"></span>
      <button type="button" data-act="out" aria-label="Zoom out (-)">−</button>
      <span class="ghlb-zoom"></span>
      <button type="button" data-act="in" aria-label="Zoom in (+)">+</button>
      <button type="button" data-act="fit" aria-label="Fit to screen (0)">Fit</button>
      <button type="button" data-act="actual" aria-label="Original size (1)">1:1</button>
      <a class="ghlb-open" target="_blank" rel="noopener noreferrer" aria-label="Open original in new tab">↗</a>
      <button type="button" data-act="close" aria-label="Close (Esc)">✕</button>
    </div>`;

  const stage = d.querySelector<HTMLElement>('.ghlb-stage')!;
  const img = d.querySelector<HTMLImageElement>('.ghlb-img')!;

  img.addEventListener('load', () => {
    img.classList.add('ghlb-ready');
    reset(true);
  });
  img.addEventListener('error', () => {
    $('.ghlb-label').textContent = `Couldn't load ${items[index]?.label || 'image'}`;
  });

  let start: { px: number; py: number; x: number; y: number } | null = null;
  let dragged = false;

  d.addEventListener('click', (e) => {
    if (dragged) return;
    const act = (e.target as Element).closest('[data-act]')?.getAttribute('data-act');
    if (act) return action(act);
    // Backdrop: anywhere that isn't the image or the toolbar.
    if (e.target === stage || e.target === d) d.close();
  });

  d.addEventListener('keydown', (e) => {
    // Keep GitHub's page-level hotkeys from firing behind the modal. Esc still reaches the native `cancel`.
    e.stopPropagation();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const act = KEYS[e.key];
    if (!act) return;
    e.preventDefault();
    action(act);
  });

  d.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoom(Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false },
  );

  img.addEventListener('dblclick', (e) => {
    const r = stage.getBoundingClientRect();
    if (fitted && view.s < 1) zoom(1 / view.s, e.clientX - r.left, e.clientY - r.top);
    else reset(true);
  });

  // Drag to pan.
  img.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    img.setPointerCapture(e.pointerId);
    start = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
    dragged = false;
  });
  img.addEventListener('pointermove', (e) => {
    if (!start) return;
    const dx = e.clientX - start.px;
    const dy = e.clientY - start.py;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
    view = { ...view, x: start.x + dx, y: start.y + dy };
    fitted = false;
    render();
  });
  const end = () => {
    start = null;
    // The click that ends a drag must not count as a backdrop click.
    setTimeout(() => (dragged = false));
  };
  img.addEventListener('pointerup', end);
  img.addEventListener('pointercancel', end);

  d.addEventListener('close', () => removeEventListener('resize', onResize));
  return d;
}

const KEYS: Record<string, string> = {
  ArrowLeft: 'prev',
  ArrowRight: 'next',
  '+': 'in',
  '=': 'in',
  '-': 'out',
  _: 'out',
  '0': 'fit',
  '1': 'actual',
};

function action(act: string) {
  const stage = $<HTMLElement>('.ghlb-stage');
  const cx = stage.clientWidth / 2;
  const cy = stage.clientHeight / 2;
  switch (act) {
    case 'prev':
      return show(index - 1);
    case 'next':
      return show(index + 1);
    case 'in':
      return zoom(STEP, cx, cy);
    case 'out':
      return zoom(1 / STEP, cx, cy);
    case 'fit':
      return reset(true);
    case 'actual':
      return reset(false);
    case 'close':
      return dialog!.close();
  }
}

function zoom(factor: number, px: number, py: number) {
  view = zoomAt(view, factor, px, py);
  fitted = false;
  render();
}

/** Centre the image, either fitted to the stage or at 100%. */
function reset(fit: boolean) {
  const img = $<HTMLImageElement>('.ghlb-img');
  const stage = $<HTMLElement>('.ghlb-stage');
  const { naturalWidth: nw, naturalHeight: nh } = img;
  const { clientWidth: w, clientHeight: h } = stage;
  view = centered(fit ? fitScale(nw, nh, w, h) : 1, nw, nh, w, h);
  fitted = fit;
  render();
}

function render() {
  $<HTMLImageElement>('.ghlb-img').style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
  $('.ghlb-zoom').textContent = `${Math.round(view.s * 100)}%`;
}

function show(i: number) {
  index = (i + items.length) % items.length;
  const item = items[index];
  const img = $<HTMLImageElement>('.ghlb-img');
  img.classList.remove('ghlb-ready');
  img.alt = item.label;
  img.src = item.src;
  $<HTMLAnchorElement>('.ghlb-open').href = item.href;
  $('.ghlb-label').textContent = item.label;
  $('.ghlb-count').textContent = `${index + 1} / ${items.length}`;
  dialog!.classList.toggle('ghlb-single', items.length < 2);
}

function onResize() {
  if (fitted) reset(true);
}

export function openViewer(gallery: GalleryItem[], start: number) {
  if (!gallery.length) return;
  dialog ??= build();
  // GitHub's Turbo navigation can swap <body>, taking the dialog with it.
  if (!dialog.isConnected) document.body.append(dialog);
  items = gallery;
  show(start);
  if (!dialog.open) {
    dialog.showModal();
    addEventListener('resize', onResize);
  }
}

export function viewerState() {
  return { open: !!dialog?.open, index, src: items[index]?.src, view, dialog };
}
