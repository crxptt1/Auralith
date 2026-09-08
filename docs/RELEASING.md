# Publishing releases and enabling updates

## Repository and privacy

The configured repository is `crxptt1/Auralith`. Both `desktop/update-config.json` (runtime) and `package.json → build.publish` (packaging) point to it. This is a **public release feed**. While the repository is private, anonymous users cannot check or download updates. Make it public before distributing a version intended to auto-update. Do not embed a personal access token in the application. GitHub Pages is not required.

The current 2.1.1 binaries have updater support; an end-to-end update from your GitHub Releases cannot be verified until accessible release files exist.

## Release a new version

1. Work from this repository root. Install dependencies with `npm ci` and provide the documented `vendor/ffmpeg.exe`.
2. Change the version with `npm version 2.1.2 --no-git-tag-version` (example). Update `CHANGELOG.md` and the bilingual notes in `src/components/Updates.tsx`.
3. Run `npm test`, `npm run build` and `node scripts/check-recording.mjs`.
4. Build locally without publishing: `npx electron-builder --win portable nsis --publish never`.
5. Create a GitHub Release with the matching tag, for example `v2.1.2`, and attach the **Setup.exe**, its **.blockmap**, and **latest.yml** generated together in `release/`. Attach **Portable.exe** as a separate manual download. Do not rename generated files or combine metadata from different builds.
6. Publish the release (not a draft and not a prerelease for the stable updater).
7. On a test machine with the previous Setup version installed, check for updates, download, then choose save/install/restart. Check that the new version starts and the project/audio remain intact.

If `latest.yml` is absent, do not write it by hand: verify `build.publish` and regenerate the package with electron-builder. Publishing via electron-builder using `--publish always` is also possible, but needs a release-scoped GitHub credential in your build environment. Never commit that credential. Nothing in this workspace was uploaded automatically.

## Behavior in the app

- Installed Windows builds use `electron-updater` with the NSIS target.
- By default, one check runs 15 seconds after launch. The user can disable startup checks in Settings.
- Checking does not download or install. Download and install/restart each require a click.
- Installation first saves the active project and is blocked while recording or processing. Closing the app does not silently install a downloaded update.
- Portable and development builds show that automatic installation is unsupported. Download a new Portable release manually.
- Network failures, private repositories and missing release metadata produce a retryable error. They do not block audio work.

The current app binaries are unsigned; do not describe checksum verification as publisher-signature verification. If you introduce signing later, configure it consistently for subsequent releases and test that migration.

## Upstream references

- [electron-builder v26 auto-update guide](https://www.electron.build/v26/docs/features/auto-update/)
- [GitHub publish configuration](https://www.electron.build/v26/docs/publish/)

## Dependency audit

The 2026-09-09 npm audit reports a moderate `adm-zip` 0.6.0 advisory concerning extraction through destination symlinks (GHSA-vwc7-r8mq-g2x9). The project importer reads entries as buffers and writes validated managed files; it does not use the affected extract-to-destination APIs. No downgrade to an older release was applied. Recheck advisories before future releases.
