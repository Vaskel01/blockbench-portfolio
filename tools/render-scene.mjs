// Renders the staged scenes in tools/scenes/: the store teaser beside the home page's store link, and the portfolio
// scenes. Usage: npm run render:scene <scene> [bbmodel|preview|quick]   (npm run render:workshop: the store teaser)
// Needs Chrome or Edge installed and a local server serving the repo root on port 8765 (e.g. `python -m http.server
// 8765`). A render writes the scene's WebP; `bbmodel` instead exports the scene as a Blockbench project; `preview`
// (a rasterised frame) and `quick` (a 16-sample trace) write checks to tools/scenes/build/<scene>-<mode>.webp.
import * as esbuild from 'esbuild';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Each scene's output and its Blockbench project. The store teaser is a cutout trimmed to the figure, so it just fills
// a big window; the portfolio scenes are full frames pinned to an exact size (rendered at 2x, then downsampled) and
// path-traced on the GPU.
const SCENES = {
  workshop: { out: 'renders/workshop-vaskel.webp', window: [2400, 1500], model: 'blockbench/vaskel-easel.bbmodel' },
  wushu: { out: 'renders/scene-wushu.webp', frame: [1920, 1080], traced: true, model: 'blockbench/wushu-courtyard.bbmodel' },
  parkour: { out: 'renders/scene-rooftops.webp', frame: [1920, 1080], traced: true, model: 'blockbench/rooftop-run.bbmodel' },
  persona: { out: 'renders/scene-dark-hour.webp', frame: [1920, 1080], traced: true, model: 'blockbench/dark-hour.bbmodel' },
};
const [name, mode] = process.argv.slice(2);
const scene = SCENES[name];
if (!scene) throw new Error(`Pick a scene: ${Object.keys(SCENES).join(', ')}`);

mkdirSync('tools/scenes/build', { recursive: true });
await esbuild.build({
  entryPoints: [`tools/scenes/${name}.jsx`], outfile: `tools/scenes/build/${name}.js`, bundle: true, minify: true, format: 'iife',
  jsx: 'automatic', loader: { '.png': 'dataurl' }, define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning',
});
const root = scene.frame ? `#root{width:${scene.frame[0]}px;height:${scene.frame[1]}px}` : '';
writeFileSync(`tools/scenes/build/${name}.html`, `<!doctype html><meta charset="utf-8"><style>html,body,#root{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}${root}</style><div id="root"></div><script src="${name}.js"></script>`);
// Headless windows lose some height to browser chrome, so a pinned frame gets a roomier window around it.
const windowSize = scene.frame ? [scene.frame[0] + 64, scene.frame[1] + 256] : scene.window;

const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(existsSync);
if (!chrome) throw new Error('Chrome or Edge not found');
const page = `http://localhost:8765/tools/scenes/build/${name}.html`;
// Path-traced scenes run on the real GPU; the rest use the software rasteriser, which renders them identically every
// time.
const gpu = scene.traced ? ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const run = (args) => {
  const profile = mkdtempSync(join(tmpdir(), 'scene-'));
  try {
    return execFileSync(chrome, ['--headless=new', ...gpu, '--hide-scrollbars', `--user-data-dir=${profile}`, ...args], { maxBuffer: 512 << 20 }).toString();
  } finally {
    rmSync(profile, { recursive: true, force: true });
  }
};
// The page writes its result into the DOM for --dump-dom. Headless Chrome now and then hands back a page that never
// rendered, so try a few times before giving up.
const capture = (args, pattern) => {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const dom = run(args);
    const match = dom.match(pattern);
    if (match) return match[1];
    const error = dom.match(/ERROR:([\s\S]*?)<\/pre>/);
    if (error) throw new Error(`${name} failed in the page: ${error[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')}`);
    console.warn(`attempt ${attempt} came back empty`);
  }
  throw new Error(`${name} did not finish`);
};
const webp = /WEBP:data:image\/webp;base64,([A-Za-z0-9+/=]+)/;

// Path-traced scenes can't use virtual time: the path tracer waits on a GPU shader compile that takes real seconds,
// and virtual time races past it. So those run in real time over the DevTools protocol, polling the page until it
// writes its result (or an error).
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function live(url, timeout = 45 * 60 * 1000) {
  const port = 9300 + Math.floor(Math.random() * 600);
  const profile = mkdtempSync(join(tmpdir(), 'scene-'));
  const browser = spawn(chrome, ['--headless=new', ...gpu, '--disable-gpu-watchdog', '--hide-scrollbars', `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`, `--window-size=${windowSize.join(',')}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let targets = [];
    for (let i = 0; i < 100 && !targets.some((t) => t.type === 'page'); i++) {
      await sleep(150);
      targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json()).catch(() => []);
    }
    const socket = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
    const pending = new Map();
    socket.addEventListener('message', (e) => {
      const message = JSON.parse(e.data);
      pending.get(message.id)?.(message);
      pending.delete(message.id);
    });
    let id = 0;
    const send = (method, params = {}) => new Promise((resolve) => {
      pending.set(++id, resolve);
      socket.send(JSON.stringify({ id, method, params }));
    });
    await send('Page.navigate', { url });
    for (const start = Date.now(); Date.now() - start < timeout;) {
      await sleep(2000);
      const reply = await send('Runtime.evaluate', { expression: "document.getElementById('result')?.textContent || ''", returnByValue: true });
      const text = reply.result?.result?.value;
      if (text?.startsWith('ERROR:')) throw new Error(`${name} failed in the page: ${text.slice(6)}`);
      if (text) {
        socket.close();
        return text;
      }
    }
    throw new Error(`${name} timed out`);
  } finally {
    browser.kill();
    await sleep(500);
    rmSync(profile, { recursive: true, force: true });
  }
}

if (mode === 'bbmodel') {
  const json = capture(['--window-size=800,500', '--virtual-time-budget=20000', '--dump-dom', `${page}?bbmodel`], /BBMODEL:(.+?)<\/pre>/s)
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  mkdirSync('blockbench', { recursive: true });
  writeFileSync(scene.model, JSON.stringify(JSON.parse(json), null, 1));
  console.log(scene.model, readFileSync(scene.model).length, 'bytes');
} else if (mode === 'preview') {
  // A rasterised frame of a path-traced scene, for checking the composition.
  const data = capture([`--window-size=${windowSize.join(',')}`, '--virtual-time-budget=600000', '--dump-dom', `${page}?preview`], webp);
  const out = `tools/scenes/build/${name}-preview.webp`;
  writeFileSync(out, Buffer.from(data, 'base64'));
  console.log(out, readFileSync(out).length, 'bytes');
} else if (scene.traced) {
  // quick: a 16-sample trace into the build folder; otherwise the full trace.
  const started = Date.now();
  const text = await live(mode === 'quick' ? `${page}?samples=16${process.argv[4] ? `&hide=${process.argv[4]}` : ''}` : page);
  const out = mode === 'quick' ? `tools/scenes/build/${name}-quick.webp` : scene.out;
  writeFileSync(out, Buffer.from(text.match(webp)[1], 'base64'));
  console.log(out, readFileSync(out).length, 'bytes', `${Math.round((Date.now() - started) / 1000)}s`);
} else {
  const data = capture([`--window-size=${windowSize.join(',')}`, '--virtual-time-budget=60000', '--dump-dom', page], webp);
  writeFileSync(scene.out, Buffer.from(data, 'base64'));
  console.log(scene.out, readFileSync(scene.out).length, 'bytes');
}
