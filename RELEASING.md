# Releasing

## One-time setup

- Select an npm name owned by the maintainer; `railroad-diagrams` is already taken.
- Update `name` and remove `private: true` from `package.json`.
- Add `author`, `repository`, `homepage`, and `bugs` metadata.
- Put the copyright holder's name in `LICENSE`.
- Configure npm trusted publishing for the GitHub Actions release workflow.

## Release checklist

1. Confirm `main` is clean and CI passes.
2. Update `CHANGELOG.md` and the version with `npm version`.
3. Run `npm run release:check` and inspect `npm pack --dry-run`.
4. Push the version commit and tag.
5. Create a GitHub release for the tag. The release workflow publishes with provenance.
6. Verify the npm page, package contents, core import, and `/ohm` import.

The package remains deliberately private until all one-time identity fields are resolved, preventing publication under the existing third-party package name.
