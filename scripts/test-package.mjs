import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const declarationVersions = { 6: '6.4.17', 7: '7.0.11', 8: '8.0.1', 9: '8.0.1', 10: null };
const require = createRequire(import.meta.url);
const version = process.argv[2] ?? require('nodemailer/package.json').version;
const major = Number(version.split('.')[0]);
if (!/^(6|7|8|9|10)\.\d+\.\d+$/.test(version) || process.argv.length > 3) {
  throw new Error('Usage: pnpm run test:package [exact Nodemailer 6-10 version]');
}
const declarationVersion = declarationVersions[major];
const { packageManager } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const releaseAge = execFileSync('pnpm', ['config', 'get', 'minimumReleaseAge'], {
  cwd: root, encoding: 'utf8',
}).trim();
if (releaseAge !== 'undefined' && !/^\d+$/.test(releaseAge)) {
  throw new Error(`Invalid effective minimumReleaseAge: ${releaseAge}`);
}
const temporary = mkdtempSync(join(tmpdir(), 'nodemailer-mock-consumer-'));
const consumer = join(temporary, 'consumer');
const run = (command, args, cwd = consumer) => execFileSync(command, args, {
  cwd,
  stdio: 'inherit',
});
try {
  // Do not run prepare or install anything in the source checkout.
  run('npm', ['pack', '--ignore-scripts', '--pack-destination', temporary], root);
  const archive = readdirSync(temporary).find((name) => name.endsWith('.tgz'));
  if (!archive) throw new Error('npm pack did not produce an archive');
  cpSync(join(root, 'test/package'), consumer, { recursive: true });
  const dependencies = {
    'nodemailer-mock': `file:${join(temporary, archive)}`,
    nodemailer: version,
    typescript: '6.0.3',
    '@types/node': '22.20.2',
    '@types/debug': '4.1.13',
  };
  if (declarationVersion) dependencies['@types/nodemailer'] = declarationVersion;
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({
    name: 'nodemailer-mock-consumer',
    private: true,
    version: '1.0.0',
    packageManager,
    dependencies,
  }, null, 2));
  // Preserve the root's effective waiting period plus inherited pnpm safeguards.
  if (releaseAge !== 'undefined') {
    writeFileSync(join(consumer, 'pnpm-workspace.yaml'), `minimumReleaseAge: ${releaseAge}\n`);
  }
  console.log(`Consumer package manager ${packageManager}; minimumReleaseAge ${releaseAge}`);
  run('pnpm', ['--version']);
  run('pnpm', ['install', '--ignore-scripts', '--store-dir', join(temporary, 'store')]);
  const installed = JSON.parse(readFileSync(join(consumer, 'node_modules/nodemailer/package.json'), 'utf8'));
  if (installed.version !== version) throw new Error(`Expected Nodemailer ${version}, received ${installed.version}`);
  console.log(`Consumer Node ${process.version}; Nodemailer ${installed.version}; declarations ${declarationVersion ?? 'bundled'}`);
  run(process.execPath, ['runtime.mjs']);
  run(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json']);
  console.log('Packaged CommonJS and ESM TypeScript consumers passed');
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
