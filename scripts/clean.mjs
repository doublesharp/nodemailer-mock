import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { distTarget } from './dist-target.mjs';

const root = resolve('.');
const target = distTarget(root);
if (target) {
  // Keep local output redirection, including a link whose target was removed.
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(target)) {
    rmSync(join(target, entry), { recursive: true, force: true });
  }
} else {
  rmSync(join(root, 'dist'), { recursive: true, force: true });
}
