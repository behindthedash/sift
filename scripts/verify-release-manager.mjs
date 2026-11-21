// Validate the no-bypass release topology before accepting release automation.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const manager = readFileSync('.github/workflows/release-manager.yml', 'utf8');
const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
const coordinator = readFileSync('scripts/release-coordinator.mjs', 'utf8');
const config = JSON.parse(readFileSync('release-please-config.json', 'utf8'));
const manifest = JSON.parse(readFileSync('.release-please-manifest.json', 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

assert.equal(config.packages['.']['release-type'], 'node');
assert.equal(config.packages['.']['package-name'], '@sift-grid/react');
assert.match(config['bootstrap-sha'], /^[0-9a-f]{40}$/);
assert.equal(manifest['.'], pkg.version);
assert.match(manager, /skip-github-release: true/);
assert.match(manager, /release-please-action@[a-f0-9]{40}/);
for (const rule of ['contents: write', 'pull-requests: write', 'actions: write',
                    'cancel-in-progress: false']) {
  assert.ok(manager.includes(rule), 'Missing release manager control: ' + rule);
}
assert.match(ci, /workflow_dispatch:/);
assert.ok(coordinator.includes("['test-build', 'e2e']"));
assert.ok(coordinator.includes("merge_method: 'squash'"));
assert.ok(coordinator.includes('workflow_dispatch explicitly runs'));
assert.ok(!coordinator.includes('NPM_TOKEN'));
assert.ok(!manager.includes('pull_request_target'));
assert.ok(!manager.includes('secrets.NPM_TOKEN'));
console.log('Release Please versioning, changelog, protected checks and OIDC dispatch verified.');
