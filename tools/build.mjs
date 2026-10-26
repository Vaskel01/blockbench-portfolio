// Bundles camp/src into one classic script (camp/scene.bundle.js) so index.html still works from file://,
// and writes the licenses of every bundled package next to it.
// Usage: npm run build   (or npm run watch while editing)
import * as esbuild from 'esbuild';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const options = {
  entryPoints: ['camp/src/main.jsx'],
  outfile: 'camp/scene.bundle.js',
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020', 'chrome100', 'safari15', 'firefox100'],
  jsx: 'automatic',
  loader: { '.png': 'dataurl', '.ogg': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  metafile: true,
  logLevel: 'info',
};

function writeLicenses(metafile) {
  const packages = new Set();
  for (const input of Object.keys(metafile.inputs)) {
    const match = input.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
    if (match) packages.add(match[1]);
  }
  const sections = [...packages].sort().map((name) => {
    const dir = join('node_modules', name), pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const file = readdirSync(dir).find((f) => /^licen[sc]e/i.test(f));
    const text = file ? readFileSync(join(dir, file), 'utf8').trim() : `License: ${pkg.license}`;
    return `${name}@${pkg.version} (${pkg.license})\n${'-'.repeat(60)}\n${text}\n`;
  });
  writeFileSync('camp/scene.bundle.LICENSES.txt', `Third-party software bundled into camp/scene.bundle.js\n\n${sections.join('\n')}`);
}

const plugins = [{
  name: 'licenses',
  setup(build) {
    build.onEnd((result) => result.metafile && writeLicenses(result.metafile));
  },
}];

if (process.argv.includes('--watch')) {
  const context = await esbuild.context({ ...options, plugins });
  await context.watch();
} else {
  await esbuild.build({ ...options, plugins });
}
if (existsSync('camp/scene.bundle.js.LEGAL.txt')) console.log('Note: camp/scene.bundle.js.LEGAL.txt is from an older build and can be deleted.');
