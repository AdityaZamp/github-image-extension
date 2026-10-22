# Chrome Web Store submission

Upload `extension.zip` (made by `npm run package`) at https://chrome.google.com/webstore/devconsole, then paste the fields below.

## Store listing tab

**Name:** Media Viewer for GitHub PRs (comes from the manifest)

**Summary** (from the manifest, ≤132 chars):
View PR screenshots in an in-page lightbox, and give PR videos ±5s skip, frame stepping, speeds up to 4× and loop.

**Description:**

Reviewing a pull request full of screenshots? Clicking one normally opens it in a new tab and pulls you out of the review. This extension opens it right on the PR page instead.

• Click any image in a PR description, comment or review thread to open it in a lightbox
• Image diffs in "Files changed" get an expand button that shows the before and after versions full size
• Zoom with the mouse wheel, trackpad pinch or + / −, drag to pan, and press 1 for original resolution
• ← / → step through every image on the page, and Esc or a click outside closes the viewer
• Follows GitHub's light, dark and high-contrast themes automatically
• Cmd/Ctrl-click still opens a new tab, and badge links keep working as before
• Videos get a toolbar: ±5s skip, frame-by-frame stepping, speeds up to 4× that carry over between videos, loop, and a precise clock, all with keyboard shortcuts
• Fixes PR videos that stop playing after the tab has been open for 5 minutes

Lightweight and private: no permissions requested and no data collected. It runs only on github.com and talks only to GitHub.

Not affiliated with or endorsed by GitHub.

**Category:** Developer Tools
**Language:** English

**Graphic assets:**
- Store icon: `icons/icon128.png`
- Screenshots (1280×800): `store/screenshot-1-comment-light.png`, `store/screenshot-2-diff-dark.png`
- Small promo tile (440×280): optional, skipped

## Privacy practices tab

**Single purpose:**
Shows images on GitHub pull request pages in an in-page lightbox viewer instead of opening them in a new tab.

**Permission justification — host access (`https://github.com/*`, content script):**
The content script must run on GitHub pages to open PR images in an in-page viewer. It matches all of github.com because GitHub moves between pages without a full reload, so a script limited to /pull/ URLs would not load when a user navigates to a PR from another GitHub page. The script only acts on pull request pages.

**Remote code:** No, I am not using remote code. (All JavaScript ships in the package.)

**Data usage:** tick none of the data types. Then certify:
- [x] I do not sell or transfer user data to third parties, outside of the approved use cases
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** not required, since no user data is collected. If the form insists, link to a page stating: "This extension collects, stores and transmits no data."

## Distribution tab

Visibility: Public (or Unlisted to share by link only). Regions: all.
