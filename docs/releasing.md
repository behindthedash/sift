# Releasing @sift-grid/react

**GitHub automatically stages releases; a human approves public publication on npm.** Staging uses `npm stage publish`, not `npm publish`. Only the maintainer's npm approval with two-factor authentication makes a version installable.

## One-time setup

1. Ensure you have package-publishing permission within the **@sift-grid** npm organization.
2. Add a **stage-only** npm granular access token with the appropriate scope permissions as the encrypted GitHub repository secret **NPM_TOKEN**. No bypass-2FA token is needed.
3. Enable npm 2FA for the maintainer who will approve the staged versions.
4. The workflow uses the GitHub Actions environment **npm-publish**. For unattended staging, do **not** require environment reviewers; restricting deployment branches to **main** is recommended. If reviewers are configured, GitHub will pause staging for their approval.

Never paste npm tokens into issues, PRs, commits, chats or workflow files.

## Automatic staging on protected main

The first merge that adds `.github/workflows/npm-stage.yml` triggers the initial `@sift-grid/react@0.1.0` staging attempt, provided the workflow remains on the main branch, the current version has not already been staged/published, and all the tests pass.

On **subsequent merges**, the workflow automatically stages a release **only when `package.json.version` changes** compared with the previous main commit. This prevents ordinary feature commits from generating releases.

The `Stage Sift on npm` workflow:

1. Verifies repository, protected `main` ref, public package name and stable SemVer version.
2. Verifies the first-workflow-install or version-change trigger using the previous main SHA.
3. Installs dependencies, typechecks, runs unit tests, builds the package, checks npm tarball contents and runs Playwright browser tests.
4. Checks npm for an already-staged or already-published matching version, to avoid duplicate staging.
5. Uses the encrypted `NPM_TOKEN` to run `npm stage publish --access public --provenance --ignore-scripts`.

A merge itself **does not make Sift installable**. npm holds the new version for your approval. The initial stage of a brand-new package may create an npm public placeholder; the staged version's contents remain unavailable until approval.

If anything fails, no new stage is created. GitHub Actions reports the failure; the maintainer should review the logs and fix the problem with another PR.

## Manual fallback

Use **Actions → Stage Sift on npm → Run workflow**, select **main**, enter the exact current `package.json` version and type **STAGE**. This is optional; normal releases do not need a manual action.

## Approve or reject on npm

Sign in to npmjs.com, open **Staged Packages**, inspect `@sift-grid/react` and its provenance, then choose **Approve** with 2FA to publish it. You may instead reject the stage.

CLI equivalents: `npm stage list @sift-grid/react`, `npm stage view <stage-id>`, `npm stage approve <stage-id>`. After approval, verify `npm view @sift-grid/react version` and install it in a clean React app.

## Move to trusted publishing after the initial release

After the first package version is approved, configure an npm trusted publisher for GitHub owner **behindthedash**, repository **sift**, workflow **npm-stage.yml**, environment **npm-publish** (if retained). Grant **stage-only** rights, not direct publish rights.

Then open a PR to remove the `NODE_AUTH_TOKEN` steps and enable OIDC, validate a staged release, delete the GitHub `NPM_TOKEN` secret and revoke the old token. Staged publishing will continue to require explicit human npm approval.

References: https://docs.npmjs.com/staged-publishing/ and https://docs.npmjs.com/trusted-publishers/
