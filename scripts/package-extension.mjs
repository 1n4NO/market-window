import { mkdir, rm, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(root);
const distDir = join(projectRoot, 'dist');
const zipDir = join(projectRoot, '.zip-build');

async function main() {
  await rm(zipDir, { recursive: true, force: true });
  await mkdir(zipDir, { recursive: true });

  const manifestSource = join(projectRoot, 'manifest.json');
  const manifestTarget = join(zipDir, 'manifest.json');
  await copyFile(manifestSource, manifestTarget);

  const iconsDir = join(projectRoot, 'public', 'icons');
  await mkdir(join(zipDir, 'public', 'icons'), { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    await copyFile(join(iconsDir, `icon${size}.png`), join(zipDir, 'public', 'icons', `icon${size}.png`));
  }

  await copyFile(join(distDir, 'newtab.html'), join(zipDir, 'newtab.html'));
  await mkdir(join(zipDir, 'assets'), { recursive: true });
  await execFileAsync('cp', ['-R', join(distDir, 'assets', '.'), join(zipDir, 'assets')]);

  const zipPath = join(projectRoot, 'market-window-extension.zip');
  await rm(zipPath, { force: true });
  await execFileAsync('zip', ['-r', zipPath, '.'], { cwd: zipDir });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
