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

test("SVG text uses a themeable color variable", () => {
  const svg = renderSvg(terminal("themed"));
  assert.match(svg, /--rrd-text:var\(--rrd-stroke\)/);
  assert.match(svg, /\.rrd-station text\{fill:var\(--rrd-text\)/);
  assert.match(svg, /\.rrd-label\{fill:var\(--rrd-text\)/);
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

test("stack connectors use fixed-radius rounded bends", () => {
  const svg = renderSvg(alternatives(terminal("a"), terminal("b")), { width: 240, radius: 10 });
  assert.match(svg, /H10q10 0 10 10V57\.5q0 10 10 10H30/);
  assert.doesNotMatch(svg, /Q30 /);
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

test("long sequences lay out without exponential partition enumeration", () => {
  const diagram = sequence(...Array.from({length: 40}, (_, i) => terminal(String(i))));
  const {node} = layout(diagram, {width: 240});
  assert.equal(node.kind, "wrapped");
  assert.match(renderSvg(diagram, {width: 240}), />39</);
});

test("SVG output has an accessible name and escaped description", () => {
  const svg = renderSvg(terminal("value"), {
    accessibleLabel: "Value <syntax>",
    accessibleDescription: "Choose A & B",
  });
  assert.match(svg, /aria-label="Value &lt;syntax&gt;"/);
  assert.match(svg, /<title>Value &lt;syntax&gt;<\/title>/);
  assert.match(svg, /<desc>Choose A &amp; B<\/desc>/);
});

test("rejects invalid numeric layout options", () => {
  assert.throws(() => layout(terminal("x"), {width: -1}), /width/);
  assert.throws(() => layout(terminal("x"), {flexAbsorb: 2}), /flexAbsorb/);
});

test("renders Unicode text and RTL sequences", () => {
  const diagram = sequence(terminal("λ"), nonterminal("値"));
  const {node} = layout(diagram, {direction: "rtl"});
  assert.equal(node.direction, "rtl");
  assert.match(renderSvg(diagram, {direction: "rtl"}), /値[\s\S]*λ/);
});
