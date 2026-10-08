export const hex = (s: string) => [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const RAW_OLD = 'https://raw.githubusercontent.com/o/r/aaa/shots/a.png';
export const RAW_NEW = 'https://raw.githubusercontent.com/o/r/bbb/shots/a.png';
export const diffSrc = `https://viewscreen.githubusercontent.com/diff/img?enc_url1=${hex(RAW_OLD)}&enc_url2=${hex(RAW_NEW)}&path=shots%2Fa.png`;
export const PRIVATE = 'https://private-user-images.githubusercontent.com/1/2-abc.png?jwt=x';

// Markup recorded from a live PR (see README "Research").
export const FIXTURE = `
  <div class="comment-body markdown-body">
    <a target="_blank" rel="noopener noreferrer" href="${PRIVATE}"><img id="attach" class="js-gh-image-fallback" src="${PRIVATE}" alt="screenshot"></a>
    <a target="_blank" rel="noopener noreferrer" href="https://example.com/shot.png"><img id="camo" src="https://camo.githubusercontent.com/abc/def" data-canonical-src="https://example.com/shot.png" alt="external"></a>
    <a href="https://github.com/user-attachments/assets/1234"><img id="ua" src="https://private-user-images.githubusercontent.com/9.png" alt="ua"></a>
    <a href="https://ci.example.com/build/1"><img id="badge" src="https://camo.githubusercontent.com/badge" alt="build passing"></a>
    <themed-picture><picture><img id="icon" src="https://camo.githubusercontent.com/icon" alt="Medium severity"></picture></themed-picture>
  </div>
  <div class="file"><div class="render-container"><iframe class="render-viewer" src="${diffSrc}"></iframe></div></div>
  <div class="file"><div class="render-container"><iframe id="svgdiff" src="https://viewscreen.githubusercontent.com/diff/svg?enc_url1=${hex(RAW_OLD)}"></iframe></div></div>
  <a href="${PRIVATE}"><img id="outside" src="${PRIVATE}"></a>
`;
