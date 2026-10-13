#!/usr/bin/env node
const { spawnSync } = require('child_process');
const { readdirSync, statSync } = require('fs');
const { join, relative } = require('path');

const root = join(__dirname, '..');
const pattern = /\.test\.(ts|tsx|js|mjs)$/;

function collect(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return collect(full);
    return pattern.test(name) ? [full] : [];
  });
}

const requested = process.argv.slice(2);
const files = (requested.length ? requested : collect(join(root, 'tests'))).sort();
const failed = [];

for (const file of files) {
  const result = spawnSync('bun', ['test', file], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) failed.push(relative(root, file));
}

console.log(`\n${files.length - failed.length}/${files.length} test files passed`);
if (failed.length) {
  console.log(`failed: ${failed.join(', ')}`);
  process.exit(1);
}
