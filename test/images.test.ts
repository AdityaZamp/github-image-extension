import { beforeEach, describe, expect, it } from 'vitest';
import { FIXTURE, PRIVATE, RAW_NEW, RAW_OLD, hex } from './fixture';
import { collectGallery, decodeHexUrl, diffFrameItems, isDiffFrame, lightboxImage } from '../src/images';

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
    expect(diffFrameItems(added)).toEqual([{ src: RAW_NEW, label: 'x.png', source: added }]);
    expect(isDiffFrame(byId('svgdiff'))).toBe(false);
  });

  it('rejects malformed or non-https encodings', () => {
    expect(decodeHexUrl('zz')).toBeNull();
    expect(decodeHexUrl('abc')).toBeNull();
    expect(decodeHexUrl(hex('javascript:alert(1)'))).toBeNull();
    expect(decodeHexUrl(null)).toBeNull();
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
