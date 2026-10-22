import { collectGallery, diffFrameItems, isDiffFrame, lightboxImage } from './images';
import { enhanceVideo, onVideoKey } from './video';
import { openViewer } from './viewer';

// Matched on every github.com page because Turbo navigation never re-injects
// content scripts; the PR check runs per event instead.
const isPullRequest = () => /^\/[^/]+\/[^/]+\/pull\/\d+/.test(location.pathname);

function openAt(source: Element) {
  const gallery = collectGallery();
  openViewer(gallery, Math.max(0, gallery.findIndex((item) => item.source === source)));
}

// Markdown images: GitHub wraps them in <a target="_blank">. Bubble phase plus the
// defaultPrevented check lets any GitHub handler that claims the click win.
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  if (!isPullRequest()) return;
  const img = lightboxImage(e.target);
  if (!img) return;
  e.preventDefault();
  openAt(img);
});

// Files Changed image diffs live in a cross-origin iframe: clicks and even hovers
// go straight into it, so give each one an expand button instead.
function addExpandButton(frame: HTMLIFrameElement) {
  if (frame.dataset.ghlb) return;
  frame.dataset.ghlb = '1';
  const host = frame.parentElement!;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ghlb-expand';
  btn.textContent = '⤢';
  btn.title = 'View images full size';
  btn.setAttribute('aria-label', `View ${diffFrameItems(frame)[0].label} full size`);
  btn.addEventListener('click', () => openAt(frame));
  host.append(btn);
}

// content.css runs a 1ms `ghlb-detect` animation on diff iframes and markdown videos;
// its `animationstart` fires once per element as it renders (including lazy-loaded
// diffs and comments), with no MutationObserver over GitHub's very busy DOM. Not
// gated on isPullRequest: the URL may not have updated yet mid-navigation, and both
// additions are additive anyway.
document.addEventListener('animationstart', (e) => {
  if (e.animationName !== 'ghlb-detect') return;
  const el = e.target;
  if (isDiffFrame(el)) addExpandButton(el);
  else if (el instanceof HTMLVideoElement && el.closest('.markdown-body')) enhanceVideo(el);
});
document.addEventListener('keydown', onVideoKey, true);
