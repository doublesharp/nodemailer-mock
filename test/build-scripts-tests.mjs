import assert from 'node:assert/strict';
import { execFileSync, execSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('../', import.meta.url));
const { scripts } = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));

function fixture(check) {
  const temporary = mkdtempSync(join(tmpdir(), 'nodemailer-mock-build-'));
  const root = join(temporary, 'project');
  mkdirSync(root);
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'pack-layout-fixture', version: '1.0.0' }));
  cpSync(join(project, 'scripts'), join(root, 'scripts'), { recursive: true });
  try {
    check(root, temporary);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

describe('build scripts', () => {
  it('cleans ordinary output and tolerates missing output', () => fixture((root) => {
    mkdirSync(join(root, 'dist/nested'), { recursive: true });
    writeFileSync(join(root, 'dist/nested/stale.js'), 'stale');
    writeFileSync(join(root, 'keep.txt'), 'keep');
    execSync(scripts.clean, { cwd: root });
    assert.equal(existsSync(join(root, 'dist')), false);
    assert.equal(readFileSync(join(root, 'keep.txt'), 'utf8'), 'keep');
    execSync(scripts.clean, { cwd: root });
  }));

  for (const link of ['absolute', 'relative', 'dangling']) {
    it(`preserves the ${link} output symlink when cleaning`, () => fixture((root, temporary) => {
      const base = join(temporary, 'allowed');
      const target = join(base, 'build output');
      const outside = join(temporary, 'unrelated');
      mkdirSync(outside);
      writeFileSync(join(outside, 'keep.txt'), 'keep');
      if (link !== 'dangling') {
        mkdirSync(join(target, 'nested'), { recursive: true });
        writeFileSync(join(target, 'nested/stale.js'), 'stale');
        symlinkSync(outside, join(target, 'nested-link'), 'dir');
      }
      const destination = link === 'absolute' ? target : relative(root, target);
      const output = join(root, 'dist');
      symlinkSync(destination, output, 'dir');
      execSync(scripts.clean, { cwd: root, env: { ...process.env, NODEMAILER_MOCK_DIST_ROOT: base } });
      assert.ok(lstatSync(output).isSymbolicLink());
      assert.equal(readlinkSync(output), destination);
      assert.deepEqual(readdirSync(target), []);
      assert.equal(readFileSync(join(outside, 'keep.txt'), 'utf8'), 'keep');
      writeFileSync(join(output, 'rebuilt.js'), 'rebuilt');
      assert.equal(readFileSync(join(target, 'rebuilt.js'), 'utf8'), 'rebuilt');
    }));
  }

  for (const layout of ['directory', 'relative symlink', 'absolute symlink']) {
    it(`packs compiled files from an output ${layout}`, function() {
      this.timeout(15000);
      fixture((root, temporary) => {
        const output = join(root, 'dist');
        const base = join(temporary, 'allowed');
        const target = layout === 'directory' ? output : join(base, 'build output');
        mkdirSync(target, { recursive: true });
        writeFileSync(join(target, 'entry.js'), 'exports.value = 1;');
        writeFileSync(join(target, 'entry.d.ts'), 'export declare const value = 1;');
        writeFileSync(join(target, 'ignored.txt'), 'exclude from package');
        if (layout !== 'directory') {
          symlinkSync(layout === 'relative symlink' ? relative(root, target) : target, output, 'dir');
        }
        writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'pack-layout-fixture',
          version: '1.0.0', main: './dist/entry.js' }));
        writeFileSync(join(root, 'README.md'), 'Package fixture');
        writeFileSync(join(root, 'source.ts'), 'exclude source');
        writeFileSync(join(root, '.npmignore'), 'scripts\nsource.ts\ndist/ignored.txt\n');
        const destination = join(temporary, 'archives');
        mkdirSync(destination);
        const archive = execFileSync(process.execPath, ['scripts/pack.mjs', destination], {
          cwd: root, env: { ...process.env, NODEMAILER_MOCK_DIST_ROOT: base }, encoding: 'utf8',
        }).trim();
        const paths = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n').sort();
        assert.deepEqual(paths, ['package/README.md', 'package/dist/entry.d.ts', 'package/dist/entry.js',
          'package/package.json']);
        assert.equal(lstatSync(output).isSymbolicLink(), layout !== 'directory');
        assert.equal(readFileSync(join(target, 'entry.js'), 'utf8'), 'exports.value = 1;');
      });
    });
  }

  for (const location of ['outside base', 'allowed base itself', 'project root', 'project ancestor',
    'symlinked ancestor']) {
    it(`rejects cleaning and packing when dist reaches ${location}`, () => fixture((root, temporary) => {
      const base = join(temporary, 'allowed');
      const outside = join(temporary, 'outside');
      mkdirSync(base);
      mkdirSync(outside);
      const marker = join(outside, 'entry.js');
      writeFileSync(marker, 'keep');
      symlinkSync(outside, join(base, 'escape'), 'dir');
      const target = {
        'outside base': outside,
        'allowed base itself': base,
        'project root': root,
        'project ancestor': temporary,
        'symlinked ancestor': join(base, 'escape'),
      }[location];
      const output = join(root, 'dist');
      symlinkSync(target, output, 'dir');
      const destination = join(temporary, 'archives');
      mkdirSync(destination);
      const allowed = ['project root', 'project ancestor'].includes(location) ? join(temporary, '..') : base;
      const options = { cwd: root, env: { ...process.env, NODEMAILER_MOCK_DIST_ROOT: allowed }, stdio: 'pipe' };
      assert.throws(() => execFileSync(process.execPath, ['scripts/pack.mjs', destination], options),
        /Unsafe dist symlink target/);
      assert.throws(() => execFileSync(process.execPath, ['scripts/clean.mjs'], options),
        /Unsafe dist symlink target/);
      assert.equal(readlinkSync(output), target);
      assert.equal(readFileSync(marker, 'utf8'), 'keep');
      assert.deepEqual(readdirSync(destination), []);
    }));
  }

  it('rejects blank dist root overrides and project-descendant targets', () => fixture((root, temporary) => {
    const inside = join(root, 'src');
    mkdirSync(inside);
    const marker = join(inside, 'keep.ts');
    writeFileSync(marker, 'export const keep = true;');
    symlinkSync(inside, join(root, 'dist'), 'dir');
    const destination = join(temporary, 'archives');
    mkdirSync(destination);
    for (const value of ['', '   ', root]) {
      const options = { cwd: root, env: { ...process.env, NODEMAILER_MOCK_DIST_ROOT: value }, stdio: 'pipe' };
      assert.throws(() => execFileSync(process.execPath, ['scripts/clean.mjs'], options),
        /Unsafe dist symlink target/);
      assert.throws(() => execFileSync(process.execPath, ['scripts/pack.mjs', destination], options),
        /Unsafe dist symlink target/);
    }
    assert.equal(readFileSync(marker, 'utf8'), 'export const keep = true;');
    assert.deepEqual(readdirSync(destination), []);
  }));

  it('rejects a traversal package name when resolving the default dist root', () => fixture((root, temporary) => {
    const target = join(temporary, 'outside');
    mkdirSync(target);
    writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '../../outside', version: '1.0.0' }));
    symlinkSync(target, join(root, 'dist'), 'dir');
    const env = { ...process.env };
    delete env.NODEMAILER_MOCK_DIST_ROOT;
    assert.throws(() => execFileSync(process.execPath, ['scripts/clean.mjs'], { cwd: root, env, stdio: 'pipe' }),
      /Unsafe package name/);
  }));

  it('excludes links inside a redirected dist from the package', function() {
    this.timeout(15000);
    fixture((root, temporary) => {
      const base = join(temporary, 'allowed');
      const target = join(base, 'dist');
      mkdirSync(target, { recursive: true });
      writeFileSync(join(target, 'entry.js'), 'exports.value = 1;');
      writeFileSync(join(temporary, 'private.js'), 'fixture unrelated to the package');
      symlinkSync(join(temporary, 'private.js'), join(target, 'linked.js'));
      symlinkSync(target, join(root, 'dist'), 'dir');
      const archive = execFileSync(process.execPath, ['scripts/pack.mjs', temporary], {
        cwd: root, env: { ...process.env, NODEMAILER_MOCK_DIST_ROOT: base }, encoding: 'utf8',
      }).trim();
      const paths = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' });
      assert.match(paths, /package\/dist\/entry\.js/);
      assert.doesNotMatch(paths, /linked\.js/);
    });
  });
});
