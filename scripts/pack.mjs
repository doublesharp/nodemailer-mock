import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function pack(root, args) {
  return JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', ...args], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  }))[0];
}

/** Pack without lifecycle scripts or dependency installation in the source checkout. */
export function packPackage(root, destination) {
  if (!lstatSync(join(root, 'dist')).isSymbolicLink()) {
    return pack(root, ['--pack-destination', destination]);
  }
  // npm omits symlinks. Stage only publishable files plus the redirected build.
  const staging = mkdtempSync(join(tmpdir(), 'nodemailer-mock-pack-'));
  try {
    for (const file of pack(root, ['--dry-run']).files) {
      const target = join(staging, file.path);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(join(root, file.path), target);
    }
    // Apply the same exclusions when npm walks the real copy of dist.
    for (const name of ['.npmignore', '.gitignore']) {
      if (existsSync(join(root, name))) cpSync(join(root, name), join(staging, name));
    }
    cpSync(join(root, 'dist'), join(staging, 'dist'), { recursive: true, dereference: true });
    return pack(staging, ['--pack-destination', destination]);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/pack.mjs <destination-directory>');
  const destination = resolve(process.argv[2]);
  mkdirSync(destination, { recursive: true });
  const { filename } = packPackage(resolve(dirname(fileURLToPath(import.meta.url)), '..'), destination);
  console.log(join(destination, filename));
}
