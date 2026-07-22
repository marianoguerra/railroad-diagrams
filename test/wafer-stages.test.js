import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

test("contains every distinct Wafer grammar stage", async () => {
  const manifest = JSON.parse(await readFile(new URL("../examples/wafer-stages/manifest.json", import.meta.url)));
  assert.equal(manifest.length, 19);
  assert.equal(manifest[0].stage, "01-noplang");
  assert.equal(manifest.at(-1).stage, "19-strings");
  assert.deepEqual(manifest[0].rules, ["Main"]);
  assert.ok(manifest.at(-1).rules.includes("stringLiteral"));
  assert.equal(manifest.at(-1).startRule, "Module");
  assert.equal(manifest.at(-1).fullDiagram, "Module.full.svg");
  assert.equal(manifest.at(-1).overview, "overview.html");
  assert.equal(manifest.at(-1).atlasRules[0], "Module");
  assert.ok(manifest.at(-1).atlasRules.includes("identifier"));
  assert.deepEqual(manifest.at(-1).expansion, {preserveSharedRules: true, maxNodes: 1200});
});
