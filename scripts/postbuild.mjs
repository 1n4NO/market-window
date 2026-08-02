import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(projectRoot, 'dist');
const publicDir = join(projectRoot, 'public');

async function main() {
  await copyFile(join(projectRoot, 'manifest.json'), join(distDir, 'manifest.json'));

  const iconsDir = join(publicDir, 'icons');
  const targetIconsDir = join(distDir, 'icons');
  await mkdir(targetIconsDir, { recursive: true });
  for (const entry of await readdir(iconsDir)) {
    if (entry.endsWith('.png')) {
      await copyFile(join(iconsDir, entry), join(targetIconsDir, entry));
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
