/* Builds the home-screen icons from the fox in index.html.

   The fox is drawn once, as a <symbol> in the page, and the icons are cut
   from that same drawing rather than redrawn, so a change to him there is a
   change here after one run of this script:

     node tools/icons/build.mjs

   The symbol reads its colours and faces from custom properties, each with
   the paper-theme value as its fallback. An icon file has no stylesheet to
   set them, so every var() is replaced with its fallback before drawing.
   That leaves the idle face, the paper colours and the whiskers on.

   Writes to icons/:
     fox.svg              the favicon, transparent, no suit or whiskers
     icon-192.png         the manifest icons, fox on paper, bleeding off the
     icon-512.png         bottom edge like a bust in a frame
     maskable-512.png     smaller, for Android's circle and squircle masks,
                          which cut away everything outside the middle 80%
     apple-touch-icon.png 180px, for the iPhone home screen */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const symbol = html.match(/<symbol id="fox-sym" viewBox="0 0 120 120">([\s\S]*?)<\/symbol>/)[1]
  .replace(/<!--[\s\S]*?-->/g, '');
// detail off is what the page does at 32px: no suit, no whiskers.
const draw = (detail) => symbol
  .replace(/var\(--fox-detail,\s*1\)/g, detail ? '1' : '0')
  .replace(/var\(--[\w-]+,\s*([^)]+)\)/g, '$1')
  .replace(/\n\s*\n/g, '\n');

const PAPER = '#efe3c8';

/* scale: how big the 120-unit fox is drawn on a 120-unit canvas. He is
   bottom-aligned, so the suit runs off the bottom edge at every size. */
const svg = ({ scale, bg, detail = true }) => {
  /* The suit is drawn to exactly the symbol's width, which is right in a
     frame the fox fills. Drawn smaller on a square it stops short of both
     edges, so the icons carry his shoulders on out to the sides. */
  const shoulders = bg && detail
    ? '<path d="M-60 120 L-60 107 Q-30 103.4 0 103 L120 103 Q150 103.4 180 107 L180 120 Z" fill="#c9a86a"/>'
    : '';
  const body = shoulders + draw(detail);
  const x = (120 - 120 * scale) / 2, y = 120 - 120 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">`
    + (bg ? `<rect width="120" height="120" fill="${bg}"/>` : '')
    + `<g transform="translate(${x} ${y}) scale(${scale})">${body}</g></svg>`;
};

// The favicon is a head at 16px, drawn the way the header draws him at 32.
writeFileSync(new URL('icons/fox.svg', root), svg({ scale: 1, bg: null, detail: false }) + '\n');

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage();
const shoot = async (file, size, markup) => {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`);
  await p.screenshot({ path: new URL(`icons/${file}`, root).pathname, omitBackground: false });
};
const full = svg({ scale: 0.86, bg: PAPER });
const masked = svg({ scale: 0.75, bg: PAPER });
await shoot('icon-192.png', 192, full);
await shoot('icon-512.png', 512, full);
await shoot('apple-touch-icon.png', 180, full);
await shoot('maskable-512.png', 512, masked);
await b.close();
console.log('icons written');
