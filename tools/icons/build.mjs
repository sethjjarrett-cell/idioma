/* Builds the home-screen icons from the fox in index.html.

   The fox is drawn once, as a <symbol> in the page, and the icons are cut
   from that same drawing rather than redrawn, so a change to him there is a
   change here after one run of this script:

     node tools/icons/build.mjs

   The symbol reads its colours and faces from custom properties, each with
   the paper-theme value as its fallback. An icon file has no stylesheet to
   set them, so every var() is replaced with its fallback before drawing.
   That leaves the idle face and the paper colours. The suit is left off:
   the icons are his face alone.

   Writes to icons/:
     fox.svg              the favicon, transparent, no whiskers
     icon-192.png         the manifest icons, his face on paper
     icon-512.png
     maskable-512.png     smaller, for Android's circle and squircle masks,
                          which cut away everything outside the middle 80%
     apple-touch-icon.png 180px, for the iPhone home screen */
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const root = new URL('../../', import.meta.url);
const html = readFileSync(new URL('index.html', root), 'utf8');
const symbol = html.match(/<symbol id="fox-sym" viewBox="0 0 120 120">([\s\S]*?)<\/symbol>/)[1]
  .replace(/<!--[\s\S]*?-->/g, '');
/* The icons are his face alone. The suit is the first group the symbol
   hides at small sizes and is always off here; the whiskers are the second,
   kept wherever there is room for them. */
const draw = (whiskers) => symbol
  .replace(/var\(--fox-detail,\s*1\)/, '0')
  .replace(/var\(--fox-detail,\s*1\)/, whiskers ? '1' : '0')
  .replace(/var\(--[\w-]+,\s*([^)]+)\)/g, '$1')
  .replace(/\n\s*\n/g, '\n');

const PAPER = '#efe3c8';

/* The face, ear tips to chin and whisker to whisker, is about 100 units
   square in the symbol, centred on (60, 43). scale is how big that is drawn
   on a 120-unit canvas, and he is moved so the face sits in the middle. */
const svg = ({ scale, bg, whiskers = true }) => {
  const x = 60 - 60 * scale, y = 60 - 43 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">`
    + (bg ? `<rect width="120" height="120" fill="${bg}"/>` : '')
    + `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale})">${draw(whiskers)}</g></svg>`;
};

// A tab is 16px: the head as big as the square allows, and no whiskers.
writeFileSync(new URL('icons/fox.svg', root), svg({ scale: 1.25, bg: null, whiskers: false }) + '\n');

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage();
const shoot = async (file, size, markup) => {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${markup}`);
  await p.screenshot({ path: new URL(`icons/${file}`, root).pathname, omitBackground: false });
};
const full = svg({ scale: 1.0, bg: PAPER });
// Android may cut this to a circle of the middle 80%; ear tips and
// whisker ends are the corners that have to stay inside it.
const masked = svg({ scale: 0.7, bg: PAPER });
await shoot('icon-192.png', 192, full);
await shoot('icon-512.png', 512, full);
await shoot('apple-touch-icon.png', 180, full);
await shoot('maskable-512.png', 512, masked);
await b.close();
console.log('icons written');
