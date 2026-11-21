# Releasing @sift-grid/react

Sift releases are intentionally **not automatic**. Merging or tagging code does not send it to npm. Publication is a two-stage, maintainer-approved process.

## One-time setup

1. You must own or have publisher permission for the **@sift-grid** npm scope.
2. Add an npm granular access token to the GitHub repository secret **NPM_TOKEN**. Grant write access to the **@sift-grid** *package scope* (not merely npm organization administration). A **stage-only** token is recommended; the token does not need to bypass 2FA.
3. Enable two-factor authentication for the npm maintainer who will approve staged packages.
4. Recommended: Create the GitHub Actions environment **npm-publish** and configure required reviewers and deployment branch restrictions allowing only **main**. The workflow references this environment; no reviewer protection is active until you configure it.

Never paste the token into an issue, PR, commit, chat or workflow file.

## Prepare a release PR

1. Bump the version in `package.json` via PR (currently `0.1.0`).
2. Let the `Sift CI` workflow pass, including the package tarball check.
3. Merge into protected `main` only after review and required checks.

## Stage a release (manual)

1. On GitHub, go to **Actions → Stage Sift on npm → Run workflow**.
2. Select the **main** branch, enter the exact `package.json` version, and type **STAGE**.
3. The workflow verifies repo/branch/version, installs dependencies, typechecks, runs unit tests, builds, validates the packed files, and runs the Playwright browser tests.
4. The final step uses the encrypted `NPM_TOKEN` to run `npm stage publish --access public --provenance --ignore-scripts`. Nothing automatically publishes when the PR merges. Staging an unpublished package may create a public placeholder, but the staged version is not publicly installable before approval.
5. If any validation fails, staging does not happen. Never re-use an already-staged version for a second attempt; inspect or reject the existing stage first.

## Review and approve on npm

Sign in to npm, open **Staged Packages**, review the staged `@sift-grid/react` package and its provenance and files, then **Approve** with 2FA to make it publicly installable. You can instead reject it.

Equivalent CLI: `npm stage list @sift-grid/react`, `npm stage view <stage-id>`, `npm stage approve <stage-id>` (interactive 2FA).

After approval, verify `npm view @sift-grid/react version` and install it in a clean React app. Creating a corresponding GitHub release/tag is optional and should reflect the approved version.

## Replace the token with trusted publishing after the first npm version exists

npm trusted publishing uses GitHub Actions OIDC, avoiding a long-lived token. After the initial package exists:

1. Open the package's npm **Settings → Trusted publishing → Add trusted publisher**.
2. Select GitHub Actions: owner **behindthedash**, repository **sift**, workflow **npm-stage.yml**, environment **npm-publish** (if retaining the environment). Allow **stage publishing**; direct publish permission is not needed.
3. In a follow-up PR, remove the `NODE_AUTH_TOKEN` secret use and rely on the workflow's existing `id-token: write` permission with current npm CLI.
4. Verify a staged OIDC release. Then restrict token-based publishing in npm settings, delete the GitHub `NPM_TOKEN` secret and revoke the old token.

Using `npm stage publish` with 2FA approval is intentional: it separates authenticated code delivery from the human decision to make that code publicly available.

References: https://docs.npmjs.com/cli/v11/commands/npm-stage/ and https://docs.npmjs.com/trusted-publishers/
