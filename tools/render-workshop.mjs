// Renders renders/workshop-vaskel.webp, the transparent easel cutout beside the store link on the home page.
// Usage: npm run render:workshop  (needs Chrome or Edge installed; a local server must serve the repo root
// on port 8765, e.g. `python -m http.server 8765`).
import * as esbuild from 'esbuild';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

await esbuild.build({
  entryPoints: ['tools/workshop/scene.jsx'], outfile: 'tools/workshop/bundle.js', bundle: true, minify: true, format: 'iife',
  jsx: 'automatic', loader: { '.png': 'dataurl' }, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning',
});
writeFileSync('tools/workshop/index.html', '<!doctype html><meta charset="utf-8"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}</style><div id="root"></div><script src="bundle.js"></script>');

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
if (!chrome) throw new Error('Chrome or Edge not found');
const base = 'http://localhost:8765/tools/workshop/';
const run = (args) => {
  const profile = mkdtempSync(join(tmpdir(), 'workshop-'));
  try {
    return execFileSync(chrome, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', `--user-data-dir=${profile}`, ...args], { maxBuffer: 256 << 20 }).toString();
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
};
// The scene page renders at 2x, grades, cuts the figure out with a mask pass, trims it and writes the WebP into
// the DOM for --dump-dom.
const dom = run(['--window-size=1600,1000', '--virtual-time-budget=30000', '--dump-dom', `${base}index.html`]);
const data = dom.match(/WEBP:data:image\/webp;base64,([A-Za-z0-9+/=]+)/);
if (!data) throw new Error('The render did not finish');
writeFileSync('renders/workshop-vaskel.webp', Buffer.from(data[1], 'base64'));
console.log('renders/workshop-vaskel.webp', readFileSync('renders/workshop-vaskel.webp').length, 'bytes');
