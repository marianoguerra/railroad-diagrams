# railroad-diagrams

A dependency-free TypeScript implementation of the align → wrap → justify algorithm from [*Automatic layout of railroad diagrams*](https://arxiv.org/abs/2509.15834), informed by the authors' [librrd reference implementation](https://github.com/epfl-systemf/librrd), producing standalone SVG strings.

```ts
import { sequence, terminal, nonterminal, zeroOrMore, renderSvg } from "railroad-diagrams";

const diagram = sequence(
  terminal("["),
  zeroOrMore(nonterminal("value"), terminal(",")),
  terminal("]"),
);

const svg = renderSvg(diagram, { width: 480 });
```

The diagram language has terminals, nonterminals, n-ary sequences, positive stacks (`choice`, `alternatives`, `optional`) and reverse-flow negative stacks (`loop`, `oneOrMore`, `zeroOrMore`). `renderSvg` accepts a target `width`, `ltr`/`rtl` direction, vertical alignment and direction-aware justification policies, gaps, fonts, continuation markers, and a custom text measurement callback.

Layout is also available independently with `layout`, and `contentWidths` exposes the min/max-content measurements used for wrapping. Narrow sequences enumerate their row partitions and prefer fewer, shallower wraps while minimizing max-content overflow, following the paper and librrd's local heuristic.

Run `npm test` or `npm run example`.

## Ohm grammars

The optional Ohm integration uses a semantics over Ohm's own grammar language to turn grammar rules into diagrams:

```ts
import { renderOhmGrammar } from "railroad-diagrams";

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
