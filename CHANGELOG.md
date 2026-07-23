# Changelog

All notable changes will be documented here, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.3] - 2026-07-23

### Fixed

- Connect wrapped sequences cleanly at their entry, exit, and row continuations.
- Route wrapped RTL branches through their correct physical endpoints.
- Regenerate Wafer examples during Pages builds from the committed Ohm grammars.

## [0.1.2] - 2026-07-23

### Fixed

- Render stack branch connectors with symmetric, fixed-radius rounded bends.

## [0.1.1] - 2026-07-23

### Fixed

- Make station text, labels, and continuation markers themeable with `--rrd-text`, defaulting to `--rrd-stroke`.

## [0.1.0] - 2026-07-23

### Added

- Width-aware railroad diagram modeling, layout, and standalone SVG rendering.
- Optional Ohm grammar conversion through the `/ohm` package subpath.
- RTL layout, wrapping, justification, styling hooks, and accessible SVG metadata.

[Unreleased]: https://github.com/marianoguerra/railroad-diagrams/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/marianoguerra/railroad-diagrams/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/marianoguerra/railroad-diagrams/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/marianoguerra/railroad-diagrams/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/marianoguerra/railroad-diagrams/releases/tag/v0.1.0
