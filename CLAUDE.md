# Image Lightbox for GitHub PRs

Chrome extension (Manifest V3). It is one content script on `https://github.com/*` that does three things:
- opens PR images in an in-page lightbox;
- adds an expand button to Files Changed image diffs;
- adds a toolbar and shortcuts to PR videos, and recovers videos whose signed link expired.

There are no permissions and no runtime dependencies.

## Commands

```sh
npm test            # vitest + jsdom
npm run typecheck   # tsc --noEmit
npm run build       # esbuild → dist/ (load unpacked from here)
npm run package     # version check + typecheck + test + build + extension.zip
```

## Layout

```
src/images.ts    which images qualify, diff-iframe URL decoding, durableUrl(), gallery (pure DOM reads)
src/viewer.ts    image lightbox: <dialog>, zoom/pan math, its keys
src/video.ts     video toolbar, speed handling, focus-scoped keys, expired-link recovery
src/content.ts   wiring: image click listener, render detector, video key listener
src/content.css  lightbox + toolbar styles, and the `ghlb-detect` render detector
test/            jsdom tests; fixture.ts holds markup copied from live GitHub
store/           Chrome Web Store listing text and screenshots
```

## Rules

- **No new permissions and no runtime dependencies.** Any new dev dependency needs a reason a few lines of code can't cover.
- **No MutationObserver.** To react to GitHub rendering something, add its selector to the `ghlb-detect` animation rule in `content.css` and branch on the element in the `animationstart` listener in `content.ts`. It fires once per element as it renders, including lazy-loaded comments and diffs.
- **Don't break GitHub.**
  - Clicks are handled in the bubble phase and skipped when `defaultPrevented`.
  - Cmd, Ctrl, Shift and middle clicks stay native.
  - Keys are only taken while one of our elements has focus, and never in editable fields.
  - Leave `Space` to the browser.
- **Scope:** image clicks and video toolbars act on PR pages only (`isPullRequest()`). The diff expand button isn't gated, because it takes nothing over.
- **Theme:** colours come only from Primer CSS variables, each with a light-mode fallback: `var(--fgColor-default, #1f2328)`.
- **`innerHTML` only for static templates.** Page-derived text goes through `textContent` or attributes.
- **Versions:** bump `manifest.json` and `package.json` together. `npm run package` refuses to build if they differ.
- **Comments:** comment the *why*, especially GitHub or Chrome behaviour the code depends on. Mark known ceilings with `// ponytail:` and say how to lift them.

## GitHub and Chrome facts the code depends on (verified live, Oct 2026)

- **Markdown images:** `<a target="_blank" href=SRC><img src=SRC></a>` inside `.markdown-body`. External images use a camo `src`, with the original URL in `data-canonical-src`.
- **Image diffs:** a cross-origin `iframe[src^="https://viewscreen.githubusercontent.com/"]`. Its `enc_url1`, `enc_url2` and `enc_url` params hold the raw image URLs, hex-encoded. Clicks and hovers inside it never reach the page.
- **Uploaded media links expire.** They are `private-user-images.githubusercontent.com/…?jwt=` URLs with a **300s** lifetime. `github.com/user-attachments/assets/<uuid>` re-signs on every request; see `durableUrl()`. GitHub's CSP allows it for `img-src` and `media-src`.
- **Videos:** `<details><summary/><video controls muted src=…></details>`. Chrome buffers only the first seconds, so playing after expiry fails with `MEDIA_ERR_NETWORK`.
- **Media reloads reset speed.** A load sets `playbackRate` back to 1 and fires `ratechange` while `readyState === 0`. Ignore those, because they aren't a user's choice.
- **Keys pressed inside Chrome's native `<video>` controls never reach the page.** Clicking the play button or the timeline focuses an element in the player's shadow DOM, and the keydown doesn't reach even a window capture listener. That click fires `focusin` on the video while it doesn't match `:focus`; keyboard Tab lands on the video itself first. `jsdom` never matches `:focus`.
- **Content scripts aren't re-injected into open tabs** after the extension is reloaded. Refresh the tab.

## Testing

- jsdom has no layout or media playback. Tests use markup copied from live pages (`test/fixture.ts`) and a fake `<video>` (`test/video.test.ts`) that exposes the state the code reads.
- Every bug fix gets a regression test, and you check it **fails on the old code**: stash `src/`, run, unstash.
- Before calling a user-visible change done, verify it on real GitHub with the `verify-on-github` skill. Report what was and wasn't checked; for example, the logged-in Files Changed view is unverified.
