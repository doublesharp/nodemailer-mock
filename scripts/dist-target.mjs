import { lstatSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';

// Resolve existing symlink components even if the final directory has yet to be built.
function canonical(path) {
  try {
    return realpathSync.native(path);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const parent = dirname(path);
  if (lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink()) {
    return canonical(resolve(parent, readlinkSync(path)));
  }
  return join(canonical(parent), basename(path));
}

function isInside(base, target) {
  const path = relative(base, target);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

/** Return a validated canonical target for redirected dist output. */
export function distTarget(root) {
  const output = join(root, 'dist');
  if (!lstatSync(output, { throwIfNoEntry: false })?.isSymbolicLink()) return;

  const target = canonical(resolve(root, readlinkSync(output)));
  const packageRoot = canonical(root);
  const { name } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const configuredRoot = process.env.NODEMAILER_MOCK_DIST_ROOT?.trim() || undefined;
  if (!configuredRoot && (typeof name !== 'string' || !/^[a-z0-9][a-z0-9._-]*$/i.test(name))) {
    throw new Error(`Unsafe package name for default dist root: ${String(name)}.`);
  }
  const base = canonical(resolve(configuredRoot ?? `/Volumes/Scratch/${name}/build`));
  if (target === parse(target).root || target === canonical(homedir()) || target === packageRoot ||
    isInside(target, packageRoot) || isInside(packageRoot, target) || !isInside(base, target)) {
    throw new Error(`Unsafe dist symlink target: ${target}. Expected a directory inside ${base}.`);
  }
  return target;
}
