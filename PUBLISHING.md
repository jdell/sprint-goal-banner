# Publishing guide

Two homes for this project: a **GitHub repo** (public source + the privacy
policy URL the store requires) and the **Chrome Web Store** (the distributed
extension).

## 1. Put it on GitHub

From inside the `sprint-goal-banner` folder:

```bash
git init
git add .
git commit -m "Sprint Goal Banner for Jira v1.0.0"
git branch -M main
```

Create an empty repo on GitHub (no README/license — you already have them), then:

```bash
git remote add origin https://github.com/<you>/sprint-goal-banner.git
git push -u origin main
```

The build zip is git-ignored, so it won't be committed — you attach it to the
GitHub Release instead (next step).

### Privacy policy URL

The store requires a public privacy-policy URL. Once the repo is pushed, use the
raw or rendered link to `PRIVACY.md`, e.g.:

```
https://github.com/<you>/sprint-goal-banner/blob/main/PRIVACY.md
```

Paste that into the **Privacy policy** field in the Web Store dashboard.

## 2. Cut a GitHub Release

1. Build the package: `bash package.sh` → produces `sprint-goal-banner-1.0.0.zip`.
2. Tag and release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

3. On GitHub → **Releases** → **Draft a new release** → choose tag `v1.0.0`,
   title `v1.0.0`, paste the body from `RELEASE_NOTES.md`, and **attach the zip**
   as a binary asset.

Alternatively with the GitHub CLI:

```bash
gh release create v1.0.0 sprint-goal-banner-1.0.0.zip \
  --title "v1.0.0" --notes-file RELEASE_NOTES.md
```

## 3. Submit to the Chrome Web Store

Follow the checklist in `README.md` → *Publishing to the Chrome Web Store*, using
`STORE_LISTING.md` for the copy and permission justifications, `PRIVACY.md`
(hosted URL from step 1) for the privacy field, `icons/icon128.png` for the icon,
and `store/screenshot-1280x800.png` for the screenshot.

## Releasing future versions

1. Bump `"version"` in `manifest.json` (e.g. `1.0.1`).
2. Add a section to `RELEASE_NOTES.md` and the version history in `README.md`.
3. `bash package.sh`, commit, tag `vX.Y.Z`, push, cut the GitHub release.
4. Upload the new zip in the Web Store dashboard and submit for review.
