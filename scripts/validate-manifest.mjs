import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(root);
const manifestPath = join(projectRoot, 'manifest.json');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

  assert(manifest.manifest_version === 3, 'Manifest version must be 3.');
  assert(Array.isArray(manifest.permissions), 'Manifest permissions must be an array.');
  assert(Array.isArray(manifest.host_permissions), 'Manifest host permissions must be an array.');

  const permissions = new Set(manifest.permissions);
  assert(permissions.size === manifest.permissions.length, 'Manifest permissions must not contain duplicates.');
  assert(permissions.has('storage'), 'Manifest must request storage permission.');
  assert(!permissions.has('browsingHistory'), 'browsingHistory permission is not allowed.');
  assert(!permissions.has('activeTab'), 'activeTab permission is not allowed.');
  assert(!('content_scripts' in manifest), 'content_scripts are not allowed.');

  const hostPermissions = new Set(manifest.host_permissions);
  assert(hostPermissions.size === manifest.host_permissions.length, 'Host permissions must not contain duplicates.');
  assert(hostPermissions.has('https://api.twelvedata.com/*'), 'Twelve Data host permission is required.');

  const csp = manifest.content_security_policy?.extension_pages;
  assert(csp === "script-src 'self'; object-src 'self';", 'Manifest CSP must remain restrictive.');

  console.log('Manifest validation passed.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
