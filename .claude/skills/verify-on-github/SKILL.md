---
name: verify-on-github
description: Verify a change to this extension on real github.com pages by injecting the built content script into a public PR with the Playwright browser. Use after any change to src/ that affects what users see or do (clicks, keys, layout, media loading), before saying it works. Unit tests can't see layout, real media or GitHub's live DOM.
---

# Verify on live GitHub

The Playwright MCP browser can't load an unpacked extension, so inject the build into a public PR instead. The injected code is the same `dist/` bundle users install. It runs in the page's JS world rather than an extension's isolated world, which makes no difference for this extension: it uses no `chrome.*` APIs.

## Steps

1. Build, then generate the injector:
   ```sh
   npm run build && node .claude/skills/verify-on-github/make-injector.mjs
   ```
   It writes `.playwright-mcp/run-inject.js`. That folder is gitignored and is the one path Playwright's `filename` option is allowed to read besides the repo.
2. Navigate to a test page, then run the injector: `browser_run_code_unsafe` with `filename: ".playwright-mcp/run-inject.js"`. It should return `"injected"`. Re-run it after every navigation.
3. Exercise the feature with **real input** (`page.mouse`, `page.keyboard`, `locator.click()`), not `dispatchEvent`, and read state back with `page.evaluate`. Check what users would see, e.g. a toolbar count, `currentTime`, `playbackRate`, `dialog.open`.
4. Check both themes: `page.emulateMedia({ colorScheme: 'dark' })`, then take screenshots and **look at them**.
5. Clean up: `browser_close`, then `rm -rf .playwright-mcp`.

## Test pages (public, work logged out)

| What | URL |
|---|---|
| Comment images (`private-user-images` + camo) | https://github.com/microsoft/vscode/pull/340149 |
| Files Changed PNG image diffs (iframes) | https://github.com/vrothberg/vgrep/pull/267/files |
| Uploaded videos, MP4 | https://github.com/excalidraw/excalidraw/pull/12353 |
| Uploaded videos, QuickTime `.mov` | https://github.com/excalidraw/excalidraw/pull/12344 |

If one disappears, find another: list PR bodies with `gh api "repos/<owner>/<repo>/pulls?state=all&per_page=80"`. Then probe each `user-attachments/assets/<id>` URL with `curl -s -r 0-0 -o /dev/null -L -w '%{content_type}'`. A HEAD request gets a 403 from GitHub's signed storage, so use the 1-byte GET.

## Recipes

- **Expired upload link** without waiting 5 minutes: `v.src = v.src.replace(/jwt=[^&]+/, 'jwt=expired'); v.play()`. A real expiry fails mid-stream with `MEDIA_ERR_NETWORK`; the corrupted one fails at load. The recovery code handles both the same way.
- **Screenshots of one element**: scroll it to mid-screen first (`el.scrollIntoView({ block: 'center' })`). GitHub's sticky PR and file headers cover anything near the top.
- **Image-diff buttons**: at widths under about 1100px the diff page scrolls sideways and pushes the button off-screen. Use 1280×800.

## Limits to report, not hide

- Logged out, GitHub serves the classic Files Changed page. The logged-in React "changes" view hasn't been checked; say so.
- If the browser restarts mid-test (the tab list shows `about:blank`), navigate and inject again. Earlier page state is gone.
