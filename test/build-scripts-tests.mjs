import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packPackage } from '../scripts/pack.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const { scripts } = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'));

function fixture(check) {
  const temporary = mkdtempSync(join(tmpdir(), 'nodemailer-mock-build-'));
  const root = join(temporary, 'project');
  mkdirSync(root);
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
      const target = join(temporary, 'build output');
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
      execSync(scripts.clean, { cwd: root });
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
        const target = layout === 'directory' ? output : join(temporary, 'build output');
        mkdirSync(target);
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
        const packed = packPackage(root, destination);
        const paths = packed.files.map((file) => file.path).sort();
        assert.deepEqual(paths, ['README.md', 'dist/entry.d.ts', 'dist/entry.js', 'package.json']);
        assert.ok(existsSync(join(destination, packed.filename)));
        assert.equal(lstatSync(output).isSymbolicLink(), layout !== 'directory');
        assert.equal(readFileSync(join(target, 'entry.js'), 'utf8'), 'exports.value = 1;');
      });
    });
  }
});
