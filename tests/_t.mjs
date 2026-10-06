import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage();
await p.goto('file:///home/user/idioma/index.html'); await p.waitForTimeout(300);
const toks = process.argv.slice(2);
console.log(await p.evaluate((ts) => { const E=window.Idioma.Engine, f=window.Idioma.Store.sentenceIndex(window.Idioma.state).forms; return ts.map(t => `${t}=${E.wordForToken(E.wordToken(t), f)}`).join(' '); }, toks));
await b.close();
