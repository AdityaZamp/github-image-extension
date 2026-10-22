// Writes .playwright-mcp/run-inject.js: a Playwright snippet that adds the built
// dist/content.css and dist/content.js to the current page, standing in for the
// unpacked extension (the Playwright MCP browser can't load extensions).
// Usage, from the repo root after `npm run build`:
//   node .claude/skills/verify-on-github/make-injector.mjs
import fs from 'node:fs';

const js = fs.readFileSync('dist/content.js', 'utf8');
const css = fs.readFileSync('dist/content.css', 'utf8');
// Constructable stylesheet + indirect eval: neither is blocked by GitHub's CSP when
// run through Playwright's evaluate (an inline <script> via addScriptTag is). The
// bundle is the same code the installed extension runs, but it executes with whatever
// session the test browser has, so refuse anything but a logged-out github.com page.
const inject = `() => {
  if (location.origin !== 'https://github.com') throw new Error('inject only into https://github.com pages');
  // Logged out, GitHub still renders <meta name="user-login" content="">; signed in, it holds the username.
  const loggedIn = /(^|; )logged_in=yes/.test(document.cookie) || document.querySelector('meta[name="user-login"]:not([content=""])');
  if (loggedIn) throw new Error('refusing to inject: this browser is logged in to GitHub; use a logged-out profile');
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(${JSON.stringify(css)});
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  (0, eval)(${JSON.stringify(js)});
  return 'injected';
}`;
fs.mkdirSync('.playwright-mcp', { recursive: true });
fs.writeFileSync('.playwright-mcp/run-inject.js', `async (page) => page.evaluate(${inject})`);
console.log('wrote .playwright-mcp/run-inject.js');
