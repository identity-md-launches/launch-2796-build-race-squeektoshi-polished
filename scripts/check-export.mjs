import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';

const root = resolve('.'), dist = resolve('dist');
async function filesAt(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name), path = relative(root, file);
    if (entry.name === '.git' || entry.name === '.github' || entry.name === '.imd' || entry.name.startsWith('.env') || path === 'test/scratch') continue;
    if (['node_modules', '.npm', '.vite', '.cache', '.pnpm-store'].includes(entry.name)) {
      assert.ok(!path.startsWith(`dist${sep}`), `dependency/cache in the production export: ${path}`);
      continue; // Explicitly ignored development directories are not submission files.
    }
    if (entry.name.endsWith('.tsbuildinfo')) continue;
    assert.ok(!entry.isSymbolicLink(), `submission must not contain symlinks/submodules: ${path}`);
    if (entry.isDirectory()) files.push(...await filesAt(file));
    else files.push(file);
  }
  return files;
}
const html = await readFile(join(dist, 'index.html'), 'utf8');
for (const marker of [/<title>[^<]+<\/title>/, /name="description"/, /rel="icon"/, /property="og:title"/, /property="og:image"/, /name="twitter:card" content="summary_large_image"/]) assert.match(html, marker);
const references = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]);
references.push(html.match(/property="og:image" content="([^"]+)"/)?.[1]);
for (const url of references.filter(Boolean)) {
  assert.ok(url.startsWith('./'), `relative HTML asset expected: ${url}`);
  await lstat(resolve(dist, url));
}
const productionFiles = await filesAt(dist);
for (const file of productionFiles) {
  assert.ok(!/\.(tgz|zip|map)$/.test(file), `unnecessary production packaging file: ${file}`);
  if (extname(file) !== '.css') continue;
  const css = await readFile(file, 'utf8');
  for (const match of css.matchAll(/url\(([^)]+)\)/g)) {
    const url = match[1].replace(/["']/g, '').trim();
    if (url.startsWith('data:')) continue;
    assert.ok(!/^(https?:|\/)/.test(url), `font/asset must be bundled and relative: ${url}`);
    await lstat(resolve(dirname(file), url));
  }
}
const manifest = [];
for (const file of productionFiles.sort()) {
  const data = await readFile(file);
  manifest.push({ path: relative(dist, file).split(sep).join('/'), bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
}
const productionBytes = manifest.reduce((sum, file) => sum + file.bytes, 0);
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/export-manifest.json', JSON.stringify({ productionBytes, files: manifest }, null, 2) + '\n');
const submissionFiles = await filesAt(root);
assert.ok(!submissionFiles.some(file => relative(root, file) === '.gitmodules'), 'no submodule manifest');
assert.ok(!submissionFiles.some(file => /\.(tgz|zip)$/.test(file)), 'no unnecessary dependency archives');
let submissionBytes = 0;
for (const file of submissionFiles) submissionBytes += (await lstat(file)).size;
assert.ok(submissionBytes <= 8388608, `submission exceeds 8 MiB: ${submissionBytes}`);
console.log(JSON.stringify({ passed: true, productionFiles: manifest.length, productionBytes, submissionFiles: submissionFiles.length, submissionBytes, budgetBytes: 8388608, relativeAssets: true, packagingArchives: 0, dependencyDirectories: 0 }, null, 2));
