import test from "node:test";
import assert from "node:assert/strict";
import { alternatives, contentWidths, layout, loop, nonterminal, renderSvg, sequence, terminal } from "../dist/index.js";

test("content widths distinguish fully wrapped and unwrapped sequences", () => {
  const d = sequence(terminal("one"), terminal("two"), nonterminal("value"));
  const w = contentWidths(d);
  assert.ok(w.min < w.max);
});

test("narrow sequences wrap and retain every station", () => {
  const d = sequence(terminal("alpha"), terminal("beta"), terminal("gamma"), terminal("delta"));
  const { node } = layout(d, { width: 180 });
  assert.equal(node.kind, "wrapped");
  assert.match(renderSvg(d, { width: 180 }), /alpha[\s\S]*delta/);
});

test("positive and negative stacks render branches and reverse loop flow", () => {
  const d = alternatives(terminal("yes"), loop(nonterminal("item"), terminal(",")));
  const { node } = layout(d, { width: 420 });
  assert.equal(node.kind, "stack");
  assert.equal(node.bottom?.node.kind, "stack");
  assert.equal(node.bottom?.node.bottom?.node.direction, "rtl");
  assert.ok((renderSvg(d).match(/rrd-rail/g) ?? []).length > 5);
});

test("SVG output escapes content and metadata", () => {
  const svg = renderSvg(terminal("<&", { id: "a\"b", className: "custom" }));
  assert.match(svg, /&lt;&amp;/);
  assert.match(svg, /id="a&quot;b"/);
  assert.match(svg, /class="rrd rrd-station rrd-terminal custom"/);
});

test("justification rails reach both row edges", () => {
  const svg = renderSvg(sequence(terminal("{"), terminal("}")), { width: 300 });
  assert.match(svg, /M0 14\.5H0/);
  assert.match(svg, /H300/);
});

test("stack connectors are painted behind their children", () => {
  const svg = renderSvg(alternatives(terminal("a"), terminal("b")), { width: 240 });
  const stack = svg.indexOf("rrd-stack");
  const connector = svg.indexOf("rrd-rail", stack);
  const station = svg.indexOf("rrd-station", stack);
  assert.ok(connector < station);
});

test("all rails are globally behind station content", () => {
  const svg = renderSvg(sequence(nonterminal("string"), terminal(":"), alternatives(terminal("null"), terminal("true"))));
  assert.ok(svg.indexOf('class="rrd-rails"') < svg.indexOf('class="rrd-content"'));
});

test("justification adds rail instead of stretching station boxes", () => {
  const { node } = layout(alternatives(terminal("short"), terminal("also short")), { width: 400 });
  assert.equal(node.top?.node.kind, "row");
  const station = node.top?.node.children?.[0]?.node;
  assert.equal(station?.kind, "station");
  assert.ok(station.width < 150);
});
