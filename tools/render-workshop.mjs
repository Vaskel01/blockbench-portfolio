// Renders renders/workshop-vaskel.webp, the image beside the store link on the home page.
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
writeFileSync('tools/workshop/index.html', '<!doctype html><meta charset="utf-8"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden;background:#0f1327}</style><div id="root"></div><script src="bundle.js"></script>');
// A converter page: loads the 2x snapshot, downsamples it to 1600x1000 (supersampled edges) and re-encodes it as
// WebP, written into the DOM for --dump-dom.
writeFileSync('tools/workshop/encode.html', '<!doctype html><meta charset="utf-8"><body><script>const i=new Image();i.onload=()=>{const c=document.createElement("canvas");c.width=1600;c.height=1000;const x=c.getContext("2d");x.imageSmoothingQuality="high";x.drawImage(i,0,0,1600,1000);document.body.textContent="WEBP:"+c.toDataURL("image/webp",0.9)};i.src="shot.png"</script>');

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
if (!chrome) throw new Error('Chrome or Edge not found');
const profile = mkdtempSync(join(tmpdir(), 'workshop-'));
const base = 'http://localhost:8765/tools/workshop/';
const flags = ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', `--user-data-dir=${profile}`];
execFileSync(chrome, [...flags, '--window-size=1600,1000', '--force-device-scale-factor=2', '--virtual-time-budget=40000', `--screenshot=${join(process.cwd(), 'tools/workshop/shot.png')}`, base + 'index.html'], { stdio: 'ignore' });
const dom = execFileSync(chrome, [...flags, '--virtual-time-budget=5000', '--dump-dom', base + 'encode.html'], { maxBuffer: 64 << 20 }).toString();
const data = dom.match(/WEBP:data:image\/webp;base64,([A-Za-z0-9+/=]+)/);
if (!data) throw new Error('WebP encoding failed');
writeFileSync('renders/workshop-vaskel.webp', Buffer.from(data[1], 'base64'));
rmSync(profile, { recursive: true, force: true });
console.log('renders/workshop-vaskel.webp', readFileSync('renders/workshop-vaskel.webp').length, 'bytes');
