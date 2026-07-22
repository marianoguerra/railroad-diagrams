# @marianoguerra/railroad-diagrams

A dependency-free core TypeScript implementation of the align → wrap → justify algorithm from [*Automatic layout of railroad diagrams*](https://arxiv.org/abs/2509.15834), informed by the authors' [librrd reference implementation](https://github.com/epfl-systemf/librrd), producing standalone SVG strings.

## Installation

The package is ESM-only and supports Node.js 18 or newer. It also works in modern browsers through an ESM-aware bundler.

```sh
npm install @marianoguerra/railroad-diagrams
```

```ts
import { sequence, terminal, nonterminal, zeroOrMore, renderSvg } from "@marianoguerra/railroad-diagrams";

const diagram = sequence(
  terminal("["),
  zeroOrMore(nonterminal("value"), terminal(",")),
  terminal("]"),
);

const svg = renderSvg(diagram, { width: 480 });
```

The diagram language has terminals, nonterminals, n-ary sequences, positive stacks (`choice`, `alternatives`, `optional`) and reverse-flow negative stacks (`loop`, `oneOrMore`, `zeroOrMore`). `renderSvg` accepts a target `width`, `ltr`/`rtl` direction, vertical alignment and direction-aware justification policies, gaps, fonts, continuation markers, and a custom text measurement callback.

### Core API

| Export | Purpose |
| --- | --- |
| `terminal`, `nonterminal` | Create labeled stations |
| `sequence` | Connect diagrams in order |
| `choice`, `alternatives`, `optional` | Create forward-flow branches |
| `loop`, `oneOrMore`, `zeroOrMore` | Create reverse-flow repetition branches |
| `contentWidths`, `layout` | Measure and lay out diagrams without rendering |
| `renderSvg` / `toSVG` | Return a standalone SVG string |

Important rendering options include `width`, `direction`, `align`, `justify`, `gap`, `rowGap`, `fontSize`, `fontFamily`, `continuationMarker`, `measureText`, `accessibleLabel`, and `accessibleDescription`. Invalid numeric options throw `RangeError`.

The generated SVG can be themed with `--rrd-stroke`, `--rrd-text`, `--rrd-fill`, and `--rrd-terminal`. Text defaults to `--rrd-stroke` when `--rrd-text` is not set. User-provided text and metadata are XML-escaped. For non-default fonts, supply `measureText` when accurate wrapping is important.

Layout is also available independently with `layout`, and `contentWidths` exposes the min/max-content measurements used for wrapping. Narrow sequences enumerate their row partitions and prefer fewer, shallower wraps while minimizing max-content overflow, following the paper and librrd's local heuristic.

Run `npm test` or `npm run example`.

### CLI

The package installs a `railroad-diagrams` command with SVG, JSON, and gallery subcommands:

```sh
railroad-diagrams svg grammar.ohm --rule Main --width 900 -o Main.svg
railroad-diagrams svg grammar.ohm --rule Main --full -o Main.full.svg
railroad-diagrams json grammar.ohm -o grammar.json
railroad-diagrams stages grammars/01-start.ohm grammars/02-expressions.ohm -o grammar-stages
```

Omit `-o` from `svg` or `json` to write to standard output. The first rule is used when `--rule` is omitted. `stages` accepts any ordered list of Ohm grammar files and creates a self-contained HTML gallery; each filename becomes its stage name.

## Ohm grammars

The optional Ohm integration uses a semantics over Ohm's own grammar language to turn grammar rules into diagrams. Install its peer dependency and import the dedicated subpath:

```sh
npm install ohm-js
```

```ts
import { renderOhmGrammar } from "@marianoguerra/railroad-diagrams/ohm";

const diagrams = renderOhmGrammar(`
  NopLang {
    Main = ""
  }
`);

const mainSvg = diagrams.get("Main");
```

`railroadGrammar` returns the intermediate diagram model instead. Sequences, alternatives, `*`, `+`, `?`, literals, ranges, and rule applications are supported.

`renderOhmRuleFull` recursively inlines user-defined rule references to produce a full-depth diagram. Recursive cycles remain as nonterminal stations at the point where the cycle closes, keeping the output finite.

For large grammars, pass `{preserveSharedRules: true, maxNodes: 1200}` as its expansion options. Single-use rules are inlined, while shared low-level rules, built-ins, recursive cycles, and expansions beyond the structural budget remain factored as nonterminal stations.

The complete evolution of the Wafer grammar from *WebAssembly from the Ground Up* is generated under `examples/wafer-stages`. To regenerate it from a checkout of `wasmgroundup/code`:

```sh
npm run wafer-diagrams -- /path/to/wasmgroundup-code
```

Every stage includes an `overview.html` rule atlas. It places the selectively expanded start rule first, then renders every retained user-defined nonterminal below it once in breadth-first dependency order.

## Development and releases

Run `npm test` for the clean build and test suite, or `npm run release:check` to additionally build and install the exact npm tarball in a temporary project. See [CONTRIBUTING.md](CONTRIBUTING.md) and [RELEASING.md](RELEASING.md).

This project is available under the [MIT License](LICENSE).
