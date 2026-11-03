import { lstatSync, mkdirSync, readdirSync, readlinkSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const output = resolve('dist');
if (lstatSync(output, { throwIfNoEntry: false })?.isSymbolicLink()) {
  // Keep local output redirection, including a link whose target was removed.
  const target = resolve(dirname(output), readlinkSync(output));
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(target)) {
    rmSync(join(target, entry), { recursive: true, force: true });
  }
} else {
  rmSync(output, { recursive: true, force: true });
}
