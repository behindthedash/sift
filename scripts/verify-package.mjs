// Verify the actual published files, not just the successful TypeScript build.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (pkg.name !== '@sift-grid/react' || pkg.license !== 'MIT' || pkg.private === true) {
  throw new Error('Unexpected package identity, license or private setting');
}

const packJson = execFileSync(
  'npm',
  ['pack', '--dry-run', '--json', '--ignore-scripts'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
);
const [artifact] = JSON.parse(packJson);
if (!artifact || artifact.name !== pkg.name || artifact.version !== pkg.version) {
  throw new Error('npm pack metadata differs from package.json');
}

const included = new Set(artifact.files.map((file) => file.path));
const required = ['dist/index.js', 'dist/index.d.ts', 'dist/styles.css', 'LICENSE', 'README.md'];
const missing = required.filter((path) => !included.has(path));
if (missing.length) {
  throw new Error('Incomplete npm package: missing ' + missing.join(', '));
}

console.log(`Verified ${artifact.name}@${artifact.version} (${artifact.files.length} files) is ready for staging.`);
