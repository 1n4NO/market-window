import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(root);
const distDir = join(projectRoot, 'dist');
const releaseDir = join(projectRoot, 'release');
const unpackedDir = join(releaseDir, 'unpacked-extension');

async function main() {
  await rm(releaseDir, { recursive: true, force: true });
  await mkdir(releaseDir, { recursive: true });
  await cp(distDir, unpackedDir, { recursive: true });

  const zipPath = join(releaseDir, 'market-window-extension.zip');
  await rm(zipPath, { force: true });
  await execFileAsync('zip', ['-r', zipPath, '.'], { cwd: unpackedDir });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
