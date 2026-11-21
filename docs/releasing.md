# Releasing @sift-grid/react with automatic npm Trusted Publishing

**Sift publishes directly to npm when a new package version is merged into protected `main`, using GitHub Actions OIDC.** No npm token or manual staged-package approval is needed.

## One-time npm configuration — validate before November 23, 2026 at 21:14 UTC

The newly created trusted-publisher configuration has to successfully publish within 48 hours. The user's npm account displays the validation deadline **November 23, 2026, 9:14 PM UTC**. If no OIDC publish succeeds before that time, npm expires the configuration and a maintainer must delete/re-create it.

In npm package [@sift-grid/react](https://www.npmjs.com/package/@sift-grid/react) → **Settings → Trusted publishing**, verify these exact settings:

| Setting | Value |
| --- | --- |
| Provider | GitHub Actions |
| Owner | `behindthedash` |
| Repository | `sift` |
| Workflow filename | `npm-stage.yml` (name only) |
| Environment name | `npm-publish` |
| Allowed actions | **Allow npm publish: Enabled** |
| Optional | `npm dist-tag` permission; not needed to publish to `latest` |

The workflow filename remains `npm-stage.yml` for compatibility with the existing trusted-publisher configuration even though the workflow's display name becomes **Publish Sift to npm**. npm matches the *filename*, not the display name. The GitHub Actions job must use the `npm-publish` environment if the trusted publisher is configured with that environment.

For fully unattended publication, the GitHub environment should have no required reviewer gate, but should restrict deployment branches to `main`. Keep `main` protected with passing CI requirements and PR reviews, because a merged version bump will now release publicly.

## Initial OIDC validation release: v0.1.1

This migration PR bumps `package.json` from the already approved `0.1.0` to `0.1.1`. **Merging the PR after checking trusted-publisher permissions triggers a live public npm publish**. The workflow cannot be fully tested before merge because npm authenticates the exact `main` workflow identity.

The automatic pipeline:

1. Runs on `main` for changes to `package.json` or the workflow definition. It verifies the canonical repository, protected branch and exact package version.
2. Compares the version to the previous `main` commit. Merges that leave the version unchanged skip publishing.
3. Installs dependencies without credentials, runs TypeScript checks, unit tests, builds a distributable, checks the packed files, and runs Playwright.
4. Checks public npm registry metadata for an already-published version, failing closed if the registry cannot be read.
5. Publishes `@sift-grid/react@0.1.1` (or the next version) directly with `npm publish --access public --provenance --ignore-scripts`. OIDC uses GitHub's `id-token: write` job permission; there is no `NPM_TOKEN` fallback.
6. Confirm success in GitHub Actions and with `npm view @sift-grid/react version`. The npm configuration's **unvalidated** banner should disappear after the successful publication.

## Manual fallback

The **Actions → Publish Sift to npm → Run workflow** action can be run on `main` with the exact `package.json.version` and the exact confirmation text `PUBLISH`. **This publishes publicly**, so use only when you intend to release. It does not create a private stage.

## Security after validation

Once `0.1.1` publishes successfully using OIDC:

1. In GitHub repository Actions secrets, delete the old `NPM_TOKEN` secret.
2. Revoke the corresponding npm access token in your npm account.
3. In npm package Settings → Publishing access, select **Require two-factor authentication and disallow tokens**. Trusted publishing continues to work because OIDC uses short-lived credentials, not a traditional token.
4. Protect `main` and optionally create automation to open version-bump PRs. The workflow automates *publishing after a version bump*, not deciding what release version to create.

npm documentation: https://docs.npmjs.com/trusted-publishers/
