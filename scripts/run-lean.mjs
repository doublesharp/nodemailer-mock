import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readlinkSync, statSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../formal/lean/', import.meta.url));
const scratchMount = '/Volumes/Scratch';
const scratch = join(scratchMount, 'nodemailer-mock');
const elanLake = join(homedir(), '.elan', 'bin', 'lake');
const lake = process.env.LAKE ?? (existsSync(elanLake) ? elanLake : 'lake');
const env = { ...process.env };

function isScratchMounted() {
  try {
    return statSync(scratchMount).dev !== statSync('/Volumes').dev;
  } catch {
    return false;
  }
}

try {
  if (!isScratchMounted()) {
    throw new Error(`${scratchMount} is not mounted; refusing to write Lean build artifacts to Data.`);
  }
  const target = join(scratch, 'build', 'lean', '.lake');
  const link = join(cwd, '.lake');
  const previous = lstatSync(link, { throwIfNoEntry: false });
  if (previous && (!previous.isSymbolicLink() || resolve(cwd, readlinkSync(link)) !== target)) {
    throw new Error(`Move the existing Lake directory or symlink at ${link} before running this script.`);
  }
  env.TMPDIR = join(scratch, 'tmp');
  mkdirSync(env.TMPDIR, { recursive: true });
  mkdirSync(target, { recursive: true });
  if (!previous) symlinkSync(target, link, 'dir');

  const result = spawnSync(lake, ['--wfail', 'build'], { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
