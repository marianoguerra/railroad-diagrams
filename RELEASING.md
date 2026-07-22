# Releasing

## One-time setup

- Configure npm trusted publishing for the GitHub Actions release workflow.

## Release checklist

1. Confirm `main` is clean and CI passes.
2. Update `CHANGELOG.md` and the version with `npm version`.
3. Run `npm run release:check` and inspect `npm pack --dry-run`.
4. Push the version commit and tag.
5. Create a GitHub release for the tag. The release workflow publishes with provenance.
6. Verify the npm page, package contents, core import, and `/ohm` import.
