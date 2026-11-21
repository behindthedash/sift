// A lightweight safeguard: PR CI must reject accidental token fallback or
// direct npm publishing. The actual OIDC exchange is verified on GitHub's
// first stage run after npm trusted-publisher configuration.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const workflow = readFileSync('.github/workflows/npm-stage.yml', 'utf8');
const stripComments = workflow.replace(/^\\s*#.*$/gm, '');
const checks = [
  ['manual or versioned main-branch staging', /branches:\\s*\\[main\\]/, true],
  ['protected-main validation', /GITHUB_REF.*refs\\/heads\\/main/, true],
  ['version bump gate', /previousPackage\\.version !== pkg\\.version/, true],
  ['npm trusted publishing OIDC permission', /id-token:\\s*write/, true],
  ['npm publication approval environment', /environment:\\s*npm-publish/, true],
  ['staged publish only', /\\bnpm stage publish\\b/, true],
  ['no direct npm publish', /\\bnpm publish\\b/, false],
  ['no long-lived token', /NPM_TOKEN|NODE_AUTH_TOKEN|_authToken/, false],
  ['no interactive stage list in CI', /\\bnpm stage list\\b/, false],
];
for (const [name, pattern, expected] of checks) {
  const actual = pattern.test(stripComments);
  assert.equal(actual, expected, `Release safeguard failed: ${name}`);
}
console.log('Sift staging workflow uses protected-main OIDC, no npm publishing token and no direct publish.');
