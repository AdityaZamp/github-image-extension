import { beforeEach, describe, expect, it } from 'vitest';
import { FIXTURE, PRIVATE, RAW_NEW, RAW_OLD, hex } from './fixture';
import { collectGallery, decodeHexUrl, diffFrameItems, durableUrl, isDiffFrame, lightboxImage } from '../src/images';

const byId = (id: string) => document.getElementById(id);

beforeEach(() => {
  document.body.innerHTML = FIXTURE;
});

describe('lightboxImage', () => {
  it('accepts images whose link points at the image itself', () => {
    expect(lightboxImage(byId('attach'))).toBe(byId('attach'));
    expect(lightboxImage(byId('camo'))).toBe(byId('camo'));
    expect(lightboxImage(byId('ua'))).toBe(byId('ua'));
  });

  it('leaves badge links, unlinked icons and non-markdown images alone', () => {
    expect(lightboxImage(byId('badge'))).toBeNull();
    expect(lightboxImage(byId('icon'))).toBeNull();
    expect(lightboxImage(byId('outside'))).toBeNull();
    expect(lightboxImage(byId('attach')!.parentElement)).toBeNull();
    expect(lightboxImage(null)).toBeNull();
  });
});

describe('diff iframes', () => {
  it('decodes before/after URLs from a modified-image diff', () => {
    const items = diffFrameItems(document.querySelector('iframe.render-viewer')!);
    expect(items.map((i) => [i.src, i.label])).toEqual([
      [RAW_OLD, 'shots/a.png (before)'],
      [RAW_NEW, 'shots/a.png (after)'],
    ]);
  });

  it('handles added images and ignores non-image renderers', () => {
    const added = document.createElement('iframe');
    added.src = `https://viewscreen.githubusercontent.com/added/img?enc_url=${hex(RAW_NEW)}&path=x.png`;
    expect(diffFrameItems(added)).toEqual([{ src: RAW_NEW, href: RAW_NEW, label: 'x.png', source: added }]);
    expect(isDiffFrame(byId('svgdiff'))).toBe(false);
  });

  it('rejects malformed or non-https encodings', () => {
    expect(decodeHexUrl('zz')).toBeNull();
    expect(decodeHexUrl('abc')).toBeNull();
    expect(decodeHexUrl(hex('javascript:alert(1)'))).toBeNull();
    expect(decodeHexUrl(null)).toBeNull();
  });
});

describe('expiring upload URLs', () => {
  // Shape copied from a real PR upload; the jwt expires minutes after page load.
  const SIGNED = 'https://private-user-images.githubusercontent.com/206983548/668242433-7cb98712-f2ed-4698-b2ad-d0ece1e0a3de.png?jwt=eyJ0eX';
  const DURABLE = 'https://github.com/user-attachments/assets/7cb98712-f2ed-4698-b2ad-d0ece1e0a3de';

  it('maps signed upload URLs to the re-signing user-attachments URL', () => {
    expect(durableUrl(SIGNED)).toBe(DURABLE);
    expect(durableUrl('https://camo.githubusercontent.com/abc')).toBe('https://camo.githubusercontent.com/abc');
    expect(durableUrl('https://private-user-images.githubusercontent.com/1/2-abc.png?jwt=x')).toContain('?jwt=x');
    expect(durableUrl('not a url')).toBe('not a url');
  });

  it('links "open original" to the durable URL, and shows it when the page copy never loaded', () => {
    document.body.innerHTML = `<div class="markdown-body"><a href="${SIGNED}"><img src="${SIGNED}" loading="lazy" alt="lazy"></a></div>`;
    expect(collectGallery()[0]).toMatchObject({ src: DURABLE, href: DURABLE });
  });

  it('keeps showing the already-loaded (cached) copy', () => {
    document.body.innerHTML = `<div class="markdown-body"><a href="${SIGNED}"><img src="${SIGNED}" alt="loaded"></a></div>`;
    const img = document.querySelector('img')!;
    Object.defineProperties(img, { complete: { value: true }, naturalWidth: { value: 800 } });
    expect(collectGallery()[0]).toMatchObject({ src: SIGNED, href: DURABLE });
  });
});

describe('collectGallery', () => {
  it('lists eligible images and diff sides in document order', () => {
    expect(collectGallery().map((i) => i.label)).toEqual([
      'screenshot',
      'external',
      'ua',
      'shots/a.png (before)',
      'shots/a.png (after)',
    ]);
  });

  it('picks up content added after load', () => {
    document.querySelector('.markdown-body')!.insertAdjacentHTML(
      'beforeend',
      `<a href="${PRIVATE}#2"><img src="${PRIVATE}#2" alt="late comment"></a>`,
    );
    expect(collectGallery().map((i) => i.label)).toContain('late comment');
  });
});
