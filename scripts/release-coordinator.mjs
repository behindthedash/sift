#!/usr/bin/env node
// Sift's GitHub-token-only release coordinator.
//
// Release Please generates release PRs, but GITHUB_TOKEN-created PRs do not
// reliably trigger the protected CI checks. Explicit workflow_dispatch is
// exempt from that limitation. The merge API still enforces GitHub rulesets.
// A GITHUB_TOKEN merge likewise suppresses normal push-triggered workflows,
// so an explicit workflow_dispatch starts the existing OIDC publisher.

import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const repo = process.env.GITHUB_REPOSITORY;
if (repo !== 'behindthedash/sift' || process.env.GITHUB_REF !== 'refs/heads/main') {
  throw new Error('Release coordination is restricted to protected main in behindthedash/sift');
}
if (!process.env.GH_TOKEN) {
  throw new Error('The temporary GitHub Actions token must be available');
}

function github(method, path, input) {
  const args = ['api', '-X', method, '-H', 'Accept: application/vnd.github+json', path];
  if (input !== undefined) args.push('--input', '-');
  const stdout = execFileSync('gh', args, {
    encoding: 'utf8',
    input: input === undefined ? undefined : JSON.stringify(input),
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 8 * 1024 * 1024,
    timeout: 45_000,
  });
  return stdout.trim() ? JSON.parse(stdout) : null;
}

function pathFor(path) {
  return '/repos/' + repo + '/' + path;
}

function getJsonFile(path, ref) {
  const content = github('GET', pathFor('contents/' + path + '?ref=' + encodeURIComponent(ref)));
  if (!content || content.type !== 'file' || content.encoding !== 'base64') {
    throw new Error('Cannot read trusted repository file: ' + path + ' at ' + ref);
  }
  return JSON.parse(Buffer.from(content.content.replace(/\s/g, ''), 'base64').toString('utf8'));
}

function validateVersion(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('Unexpected npm version: ' + version);
  }
  return version.split('.').map(Number);
}

function isGreater(a, b) {
  const left = validateVersion(a);
  const right = validateVersion(b);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i];
  }
  return false;
}

async function publicNpmVersions() {
  const url = 'https://registry.npmjs.org/' + encodeURIComponent('@sift-grid/react');
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.npm.install-v1+json' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error('npm registry read failed (' + res.status + ')');
  const response = await res.json();
  if (response.name !== '@sift-grid/react' || !response.versions ||
      typeof response.versions !== 'object') {
    throw new Error('Unexpected public npm registry metadata');
  }
  return new Set(Object.keys(response.versions));
}

function openReleasePrs() {
  const list = github('GET', pathFor('pulls?state=open&per_page=100'));
  if (!Array.isArray(list)) throw new Error('Unable to list open pull requests');
  if (list.length >= 100) throw new Error('More than 99 open PRs: review pagination first');
  return list.filter((pr) =>
    pr.head?.ref?.startsWith('release-please--branches--main') &&
    pr.head?.repo?.full_name === repo &&
    pr.base?.ref === 'main' &&
    pr.user?.login === 'github-actions[bot]' &&
    /^chore(?:\([^)]*\))?: release\b/.test(pr.title)
  );
}

function validateReleasePr(pr) {
  const files = github('GET', pathFor('pulls/' + pr.number + '/files?per_page=100'));
  if (!Array.isArray(files) || files.length < 2 || files.length >= 100) {
    throw new Error('Unexpected number of changed files in release PR #' + pr.number);
  }
  const allowed = new Set([
    'package.json', 'package-lock.json', 'CHANGELOG.md', '.release-please-manifest.json',
  ]);
  if (files.some((f) => !allowed.has(f.filename))) {
    throw new Error('Release PR #' + pr.number + ' contains an unexpected code/workflow change');
  }
  const changed = new Set(files.map((f) => f.filename));
  if (!changed.has('package.json') || !changed.has('.release-please-manifest.json') ||
      !changed.has('CHANGELOG.md')) {
    throw new Error('Release PR #' + pr.number + ' must update package, manifest and changelog');
  }
  const proposed = getJsonFile('package.json', pr.head.sha);
  const manifest = getJsonFile('.release-please-manifest.json', pr.head.sha);
  const onMain = getJsonFile('package.json', 'main');
  if (proposed.name !== '@sift-grid/react' || proposed.private === true ||
      proposed.version !== manifest['.'] ||
      !isGreater(proposed.version, onMain.version)) {
    throw new Error('Release PR contains a missing or non-increasing version');
  }
  return proposed.version;
}

const requiredCheckNames = ['test-build', 'e2e'];
function ciState(headSha) {
  const checks = github('GET', pathFor('commits/' + headSha + '/check-runs?per_page=100'));
  if (!checks || !Array.isArray(checks.check_runs)) {
    throw new Error('Unable to read GitHub check runs');
  }
  const states = [];
  for (const name of requiredCheckNames) {
    const matches = checks.check_runs
      .filter((c) => c.name === name && c.app?.slug === 'github-actions')
      .sort((a, b) => new Date(b.started_at ?? b.created_at ?? 0) -
                      new Date(a.started_at ?? a.created_at ?? 0));
    const latest = matches[0];
    if (!latest) states.push([name, 'missing']);
    else if (latest.status !== 'completed') states.push([name, 'pending']);
    else states.push([name, latest.conclusion]);
  }
  return states;
}

function dispatchCI(pr) {
  const runs = github('GET', pathFor(
    'actions/workflows/ci.yml/runs?branch=' + encodeURIComponent(pr.head.ref) +
    '&event=workflow_dispatch&per_page=100'));
  if (!runs || !Array.isArray(runs.workflow_runs)) {
    throw new Error('Unable to inspect release-PR CI runs');
  }
  const existing = runs.workflow_runs.find((r) => r.head_sha === pr.head.sha);
  if (existing) {
    console.log('CI has already been dispatched for release PR #' + pr.number +
      ' (run ' + existing.id + ')');
    return;
  }
  github('POST', pathFor('actions/workflows/ci.yml/dispatches'), { ref: pr.head.ref });
  console.log('Dispatched required Sift CI on release PR #' + pr.number);
}

async function waitForCI(pr) {
  const deadline = Date.now() + 22 * 60_000;
  while (Date.now() < deadline) {
    const states = ciState(pr.head.sha);
    if (states.every(([, status]) => status === 'success')) {
      console.log('Required CI checks passed on release PR #' + pr.number);
      return;
    }
    const failure = states.find(([, status]) =>
      !['missing', 'pending', 'success'].includes(status));
    if (failure) throw new Error('Release PR #' + pr.number +
      ' has failed required check ' + failure.join(': ') + '. Leaving PR open.');
    await delay(15_000);
  }
  throw new Error('Required checks did not finish in time; release PR remains open.');
}

async function mergeReleasePr(pr, version) {
  const fresh = github('GET', pathFor('pulls/' + pr.number));
  if (fresh.state !== 'open' || fresh.head.sha !== pr.head.sha ||
      fresh.base.ref !== 'main') {
    throw new Error('Release PR changed while CI ran. Refusing stale merge.');
  }
  const finalVersion = validateReleasePr(fresh);
  if (finalVersion !== version) throw new Error('Release version changed after CI');
  const finalChecks = ciState(fresh.head.sha);
  if (!finalChecks.every(([, conclusion]) => conclusion === 'success')) {
    throw new Error('Release checks no longer pass: refusing merge');
  }

  // This API does NOT bypass the repository's pull-request ruleset,
  // required test-build/e2e checks, or any extra protection enabled later.
  const result = github('PUT', pathFor('pulls/' + pr.number + '/merge'), {
    sha: pr.head.sha,
    merge_method: 'squash',
    commit_title: 'chore(main): release ' + version,
  });
  if (!result?.merged) {
    throw new Error('GitHub did not confirm a protected merge of PR #' + pr.number);
  }
  console.log('GitHub confirmed protected merge of release PR #' + pr.number +
    ' for ' + version);
}

function inFlightPublishForMain(headSha) {
  const runs = github('GET', pathFor(
    'actions/workflows/npm-stage.yml/runs?branch=main&per_page=50'));
  if (!runs || !Array.isArray(runs.workflow_runs)) {
    throw new Error('Unable to inspect current npm publishing jobs');
  }
  return runs.workflow_runs.some((r) => r.head_sha === headSha &&
    ['queued', 'in_progress', 'waiting', 'pending', 'requested'].includes(r.status));
}

async function ensurePublishedOrScheduled() {
  const main = github('GET', pathFor('git/ref/heads/main'));
  const headSha = main?.object?.sha;
  if (!/^[0-9a-f]{40}$/.test(headSha ?? '')) {
    throw new Error('Unable to resolve protected main SHA');
  }
  const pkg = getJsonFile('package.json', headSha);
  if (pkg.name !== '@sift-grid/react' || pkg.private === true) {
    throw new Error('Unexpected package identity on main');
  }
  validateVersion(pkg.version);
  const live = await publicNpmVersions();
  if (live.has(pkg.version)) {
    console.log('@sift-grid/react@' + pkg.version + ' is publicly available. No action.');
    return;
  }
  if (inFlightPublishForMain(headSha)) {
    console.log('Publishing workflow is already running for main ' + headSha);
    return;
  }
  // workflow_dispatch explicitly runs even when this merge used GITHUB_TOKEN.
  // npm-stage.yml validates the exact version/ref again and publishes with OIDC.
  github('POST', pathFor('actions/workflows/npm-stage.yml/dispatches'), {
    ref: 'main',
    inputs: { version: pkg.version, confirmation: 'PUBLISH' },
  });
  console.log('Dispatched tokenless OIDC publication for @sift-grid/react@' + pkg.version);
}

async function main() {
  const prs = openReleasePrs();
  if (prs.length > 1) {
    throw new Error('Multiple release-please PRs require reconciliation; refusing merge');
  }
  if (prs.length === 1) {
    const pr = prs[0];
    const version = validateReleasePr(pr);
    const checks = ciState(pr.head.sha);
    if (!checks.every(([, state]) => state === 'success')) dispatchCI(pr);
    await waitForCI(pr);
    await mergeReleasePr(pr, version);
  } else {
    console.log('No eligible release-please PR. Nothing to merge.');
  }
  // Also reconciles interrupted or failed OIDC dispatches on scheduled reruns.
  await ensurePublishedOrScheduled();
}

await main();
