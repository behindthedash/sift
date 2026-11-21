# Releasing @sift-grid/react with npm Trusted Publishing

**GitHub automatically stages each version bump, with no npm token.** npm requires a separate maintainer approval with 2FA before the staged package becomes publicly installable.

## Required one-time configuration in npm (do this before merging the OIDC PR)

Open [Sift's npm package settings](https://www.npmjs.com/package/@sift-grid/react) while signed into a maintainer account, then select **Settings → Trusted publishing → Add trusted publisher → GitHub Actions**.

Fill in these **exact** fields:

| Field | Value |
| --- | --- |
| Organization or user | `behindthedash` |
| Repository | `sift` |
| Workflow filename | `npm-stage.yml` (filename only, not the full path) |
| Environment name | `npm-publish` |
| Allowed actions | **Stage publishing only**. Do not enable direct `npm publish` or `npm dist-tag` rights. |

The workflow's stage job uses the existing `npm-publish` GitHub Actions environment. For unattended staging, **do not require GitHub environment reviewers**; restricting deployment branches to `main` is recommended. If reviewers are enabled, GitHub requires their approval before staging.

The publisher record on npm must match the GitHub workflow **and environment exactly**. npm recommends using a newly configured trusted publisher within **two days**; plan a version-bump test promptly.

## Automatic release behavior

- First release `0.1.0` has already been approved on npm. **This migration does not bump the version or upload a new package.**
- Subsequent PRs that increment `package.json.version` are verified by protected-main CI; merging them triggers the `Stage Sift on npm` workflow automatically.
- Normal source or workflow changes that do not change the package version do **not** stage a new version.
- The workflow still supports a manual **Actions → Stage Sift on npm → Run workflow** fallback from `main`; provide the exact version and type `STAGE`.

The workflow verifies repo, `main`, package identity and version; runs typecheck, unit tests, build, package integrity checks and Playwright browser tests; then checks publicly visible npm registry metadata to skip already-published versions.

**npm stage list cannot use GitHub OIDC credentials.** To avoid a permanent secret just for that read, the workflow does not query private staged versions. If a version is already pending staging, npm itself rejects the duplicate attempt; investigate the npm Staged Packages page before retrying.

Only the final `npm stage publish --access public --provenance --ignore-scripts` operation uses an npm-issued ephemeral OIDC trust token. It has no `NPM_TOKEN` fallback. A misconfigured or missing trusted publisher causes the staging action to fail safely without public publication.

## Validate the migration and retire the secret

1. **Add the stage-only trusted publisher** on npm before merging the OIDC PR.
2. Merge the OIDC PR once its GitHub CI checks pass. The unchanged `0.1.0` version means the merge should not create another stage.
3. In a **separate version-bump PR**, increase the patch version (e.g. from `0.1.0` to `0.1.1`), have CI pass, and merge into protected `main`.
4. Confirm the `Stage Sift on npm` action reports success using OIDC and find that exact version in npm's **Staged Packages**.
5. Review and approve the stage with your npm account's 2FA. Verify with `npm view @sift-grid/react version`.
6. **Only after an OIDC stage succeeds**, go to [Sift GitHub Actions secrets](https://github.com/behindthedash/sift/settings/secrets/actions) to delete `NPM_TOKEN`, then revoke the old token on npm. Consider disabling traditional token publishing in npm package settings as additional protection.

No credentials should be pasted into issues, commits, workflow files or chat.

Official npm references: [Trusted publishing](https://docs.npmjs.com/trusted-publishers/) · [Staged publishing](https://docs.npmjs.com/staged-publishing/)
