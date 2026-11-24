import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../formal/tla/', import.meta.url));
const scratchMount = '/Volumes/Scratch';
const scratch = join(scratchMount, 'nodemailer-mock');
const scratchTmp = join(scratch, 'tmp');
const jars = [
  process.env.TLA2TOOLS_JAR,
  join(scratchTmp, 'tla2tools.jar'),
  '/Volumes/Scratch/ensemble-contracts/tools/tla-1.7.4/tla2tools.jar',
  join(homedir(), '.tla', 'tla2tools.jar'),
];
const javaCandidates = [
  process.env.JAVA_HOME ? join(process.env.JAVA_HOME, 'bin', 'java') : undefined,
  '/opt/homebrew/opt/openjdk@21/bin/java',
  '/opt/homebrew/opt/openjdk/bin/java',
];
const java = javaCandidates.find((candidate) => candidate && existsSync(candidate)) ?? 'java';

function isScratchMounted() {
  try {
    return statSync(scratchMount).dev !== statSync('/Volumes').dev;
  } catch {
    return false;
  }
}

try {
  const configuredMeta = process.env.TLC_METADIR?.trim();
  if (!configuredMeta && !isScratchMounted()) {
    throw new Error(`${scratchMount} is not mounted; refusing to write TLC state files to Data.`);
  }
  const metadir = resolve(configuredMeta || join(scratchTmp, 'tlc-states'));
  const jar = jars.find((candidate) => candidate && existsSync(candidate));
  if (!jar) throw new Error('Set TLA2TOOLS_JAR to the path of tla2tools.jar.');
  mkdirSync(metadir, { recursive: true });
  for (const module of ['MockPool', 'SendLifecycle']) {
    const states = mkdtempSync(join(metadir, `${module}-`));
    console.log(`Checking ${module} with TLC`);
    const vm = ['-XX:+UseParallelGC', `-Djava.io.tmpdir=${states}`];
    if (/^[1-9]\d*$/.test(process.env.COMPUTE_JOBS ?? '')) {
      vm.push(`-XX:ActiveProcessorCount=${process.env.COMPUTE_JOBS}`);
    }
    const args = [
      ...vm, '-cp', resolve(jar), 'tlc2.TLC', '-workers', 'auto', '-cleanup',
      '-metadir', states, '-config', `${module}.cfg`, `${module}.tla`,
    ];
    const result = spawnSync(java, args, { cwd, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      console.error(`Retained TLC state files at ${states}`);
      break;
    }
    rmSync(states, { recursive: true });
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
