# Chrome Web Store submission

Upload `extension.zip` (made by `npm run package`) at https://chrome.google.com/webstore/devconsole, then paste the fields below.

## Store listing tab

**Name:** Scrubby: image & video viewer for GitHub PRs (comes from the manifest)

**Summary** (from the manifest, ≤132 chars):
View PR screenshots in an in-page lightbox, and give PR videos ±5s skip, frame stepping, speeds up to 4× and loop.

**Description:**

Reviewing a pull request full of screenshots and screen recordings? GitHub opens images in a new tab, and its video player can't skip, step frame by frame or go faster than 2×. Scrubby fixes both, right on the PR page.

Videos
• A toolbar under every PR video: skip ±5 seconds, step one frame at a time, speeds from 0.25× to 4×, loop, and a clock to 1/100 of a second
• Keyboard shortcuts once you've clicked the video: ← / → skip 5s, , / . previous / next frame, < / > speed, k play / pause, m mute, f fullscreen
• The speed you pick carries over to the next video you play
• Fixes PR videos that stop playing when the tab has been open for more than 5 minutes

Images
• Click any image in a PR description, comment or review thread to open it in a lightbox instead of a new tab
• Zoom with the mouse wheel, trackpad pinch or + / −, drag to pan, and press 1 for original resolution
• ← / → step through every image on the page; Esc or a click outside closes the viewer
• Image diffs in "Files changed" get an expand button that shows the before and after versions full size

Works with GitHub's light, dark and high-contrast themes. Cmd/Ctrl-click still opens a new tab, and links on images that point elsewhere keep working.

Lightweight and private: no permissions requested and no data collected. It runs only on github.com and talks only to GitHub.

Not affiliated with or endorsed by GitHub.

**Category:** Developer Tools
**Language:** English

**Graphic assets:**
- Store icon: `icons/icon128.png`
- Screenshots (1280×800): `store/screenshot-3-video-toolbar.png` (upload first: it becomes the main image), `store/screenshot-1-comment-light.png`, `store/screenshot-2-diff-dark.png`
- Small promo tile (440×280): optional, skipped

## Privacy practices tab

**Single purpose:**
Improves viewing images and videos on GitHub pull request pages: opens PR images in an in-page viewer instead of a new tab, and adds playback controls to PR videos.

**Permission justification — host access (`https://github.com/*`, content script):**
The content script must run on GitHub pages to show PR images in an in-page viewer and add controls to PR videos. It matches all of github.com because GitHub moves between pages without a full reload, so a script limited to /pull/ URLs would not load when a user navigates to a PR from another GitHub page. The script only acts on pull request pages, and it reads or sends no user data.

**Remote code:** No, I am not using remote code. (All JavaScript ships in the package.)

**Data usage:** tick none of the data types. Then certify:
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://github.com/AdityaZamp/github-image-extension/blob/main/PRIVACY.md (the form marks it required even when no data is collected).

## Distribution tab

Visibility: Public (or Unlisted to share by link only). Regions: all.
