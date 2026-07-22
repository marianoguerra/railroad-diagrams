import test from "node:test";
import assert from "node:assert/strict";
import {expandRailroadRule, railroadGrammar, renderOhmGrammar, renderOhmRuleFull} from "../dist/ohm.js";

test("converts wasmgroundup's first Ohm grammar", () => {
  const source = `NopLang { Main = "" }`;
  const grammar = railroadGrammar(source);
  assert.equal(grammar.name, "NopLang");
  assert.deepEqual(grammar.rules.map(rule => rule.name), ["Main"]);
  assert.equal(grammar.rules[0].diagram.type, "sequence");
  assert.equal(grammar.rules[0].diagram.items.length, 0);
  assert.match(renderOhmGrammar(source).get("Main"), /<svg/);
});

test("semantics handles sequence, choice, repetition, optional and references", () => {
  const source = `Sample {
    Main = letter ("," letter)* end
    Value = "yes" | "no" | digit+
    Maybe = Value?
  }`;
  const grammar = railroadGrammar(source);
  assert.deepEqual(grammar.rules.map(rule => rule.name), ["Main", "Value", "Maybe"]);
  assert.equal(grammar.rules[0].diagram.type, "sequence");
  assert.equal(grammar.rules[1].diagram.type, "stack");
  assert.equal(grammar.rules[2].diagram.type, "stack");
});

test("reports invalid Ohm grammar source", () => {
  assert.throws(() => railroadGrammar("Broken { Main ="), SyntaxError);
});

test("expands user rules to full depth but terminates recursive cycles", () => {
  const source = `Deep {
    Main = Pair
    Pair = "(" Value ")"
    Value = number | Pair
    number = digit+
  }`;
  const grammar = railroadGrammar(source);
  const expanded = expandRailroadRule(grammar, "Main");
  const serialized = JSON.stringify(expanded);
  assert.ok(!serialized.includes('"text":"Pair"') || serialized.match(/"text":"Pair"/g).length === 1);
  assert.ok(!serialized.includes('"text":"Value"'));
  assert.ok(serialized.includes('"text":"("'));
  assert.ok(serialized.includes('"text":"digit"'));
  assert.match(renderOhmRuleFull(source), /<svg/);
});

test("selective expansion factors shared low-level rules", () => {
  const source = `Factored {
    Main = First Second
    First = shared "1"
    Second = shared unique
    shared = letter+
    unique = "only once"
  }`;
  const grammar = railroadGrammar(source);
  const expanded = expandRailroadRule(grammar, "Main", {preserveSharedRules: true, maxNodes: 100});
  const serialized = JSON.stringify(expanded);
  assert.equal(serialized.match(/"text":"shared"/g)?.length, 2);
  assert.ok(!serialized.includes('"text":"First"'));
  assert.ok(!serialized.includes('"text":"Second"'));
  assert.ok(!serialized.includes('"text":"unique"'));
  assert.ok(serialized.includes('"text":"only once"'));
});

test("selective expansion respects its node budget", () => {
  const source = `Budget { Main = Big BigRule BigRule BigRule BigRule = "a" "b" "c" Big = BigRule }`;
  const grammar = railroadGrammar(source);
  const expanded = expandRailroadRule(grammar, "Main", {maxNodes: 5});
  assert.match(JSON.stringify(expanded), /"text":"Big(?:Rule)?"/);
});
