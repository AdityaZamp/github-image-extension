// Writes .playwright-mcp/run-inject.js: a Playwright snippet that adds the built
// dist/content.css and dist/content.js to the current page, standing in for the
// unpacked extension (the Playwright MCP browser can't load extensions).
// Usage, from the repo root after `npm run build`:
//   node .claude/skills/verify-on-github/make-injector.mjs
import fs from 'node:fs';

const js = fs.readFileSync('dist/content.js', 'utf8');
const css = fs.readFileSync('dist/content.css', 'utf8');
// Constructable stylesheet + indirect eval: neither is blocked by GitHub's CSP when
// run through Playwright's evaluate.
const inject = `() => {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(${JSON.stringify(css)});
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  (0, eval)(${JSON.stringify(js)});
  return 'injected';
}`;
fs.mkdirSync('.playwright-mcp', { recursive: true });
fs.writeFileSync('.playwright-mcp/run-inject.js', `async (page) => page.evaluate(${inject})`);
console.log('wrote .playwright-mcp/run-inject.js');
