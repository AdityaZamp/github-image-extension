// Finds the images the lightbox should handle. Pure DOM reads, no side effects.

export interface GalleryItem {
  src: string;
  label: string;
  /** Element the item came from: the <img>, or the diff <iframe>. */
  source: Element;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico)$/i;
const DIFF_FRAME = 'iframe[src^="https://viewscreen.githubusercontent.com/"]';
const MARKDOWN_IMG = '.markdown-body a[href] img';

/**
 * True when the link wrapping an image points at that image (GitHub's default
 * `target=_blank` wrapper), not at some other page like a CI badge target.
 */
export function linkTargetsImage(a: HTMLAnchorElement, img: HTMLImageElement): boolean {
  const href = a.href;
  if (!href) return false;
  if (href === img.src || href === img.dataset.canonicalSrc) return true;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (url.hostname === 'github.com' && url.pathname.startsWith('/user-attachments/assets/')) return true;
  return IMAGE_EXT.test(url.pathname);
}

/** The markdown image a click landed on, if the lightbox should take it over. */
export function lightboxImage(target: EventTarget | null): HTMLImageElement | null {
  if (!(target instanceof Element) || target.localName !== 'img') return null;
  const img = target as HTMLImageElement;
  const a = img.closest('a');
  if (!a || !img.closest('.markdown-body')) return null;
  return linkTargetsImage(a, img) ? img : null;
}

/** Decodes GitHub's hex-encoded `enc_url*` params. Returns null for anything that isn't an https URL. */
export function decodeHexUrl(hex: string | null): string | null {
  if (!hex || !/^([0-9a-f]{2})+$/i.test(hex)) return null;
  const bytes = Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16));
  const url = new TextDecoder().decode(bytes);
  return url.startsWith('https://') ? url : null;
}

/** Image URLs inside a Files Changed image-diff iframe (old/new for modified, one for added/removed). */
export function diffFrameItems(frame: HTMLIFrameElement): GalleryItem[] {
  let url: URL;
  try {
    url = new URL(frame.src);
  } catch {
    return [];
  }
  if (!url.pathname.endsWith('/img')) return [];
  const path = url.searchParams.get('path') ?? 'image';
  const params: [string, string][] = [
    ['enc_url1', `${path} (before)`],
    ['enc_url2', `${path} (after)`],
    ['enc_url', path],
  ];
  return params.flatMap(([key, label]) => {
    const src = decodeHexUrl(url.searchParams.get(key));
    return src ? [{ src, label, source: frame }] : [];
  });
}

/** Every viewable image in document order. Built on open, so nothing has to track DOM changes. */
export function collectGallery(root: ParentNode = document): GalleryItem[] {
  return [...root.querySelectorAll(`${MARKDOWN_IMG}, ${DIFF_FRAME}`)].flatMap((el): GalleryItem[] => {
    if (el.localName === 'iframe') return diffFrameItems(el as HTMLIFrameElement);
    const img = lightboxImage(el);
    return img ? [{ src: img.currentSrc || img.src, label: img.alt, source: img }] : [];
  });
}

export function isDiffFrame(el: EventTarget | null): el is HTMLIFrameElement {
  return el instanceof Element && el.matches(DIFF_FRAME) && diffFrameItems(el as HTMLIFrameElement).length > 0;
}
