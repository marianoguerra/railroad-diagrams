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
