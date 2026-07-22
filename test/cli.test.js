import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, readFile, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {resolve} from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";

const exec = promisify(execFile);
const cli = new URL("../bin/railroad-diagrams.js", import.meta.url);
const grammar = new URL("../examples/wafer-stages/02-numbers/grammar.ohm", import.meta.url);

test("CLI writes SVG and JSON representations", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "railroad-cli-"));
  const svgPath = resolve(directory, "Main.svg");
  const jsonPath = resolve(directory, "grammar.json");
  await exec(process.execPath, [cli.pathname, "svg", grammar.pathname, "--rule", "Main", "--width", "420", "-o", svgPath]);
  await exec(process.execPath, [cli.pathname, "json", grammar.pathname, "-o", jsonPath]);
  assert.match(await readFile(svgPath, "utf8"), /^<svg[^>]+width="440"/);
  const model = JSON.parse(await readFile(jsonPath, "utf8"));
  assert.equal(model.name, "Wafer");
  assert.deepEqual(model.rules.map(rule => rule.name), ["Main", "number"]);
});

test("stages builds a generic gallery from Ohm files", async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "railroad-stages-"));
  const first = resolve(directory, "01-basic.ohm");
  const second = resolve(directory, "02-list.ohm");
  const output = resolve(directory, "gallery");
  await writeFile(first, "Basic { Main = \"ok\" }\n");
  await writeFile(second, "List { Main = item*  item = \"x\" }\n");
  await exec(process.execPath, [cli.pathname, "stages", first, second, "-o", output]);
  const manifest = JSON.parse(await readFile(resolve(output, "manifest.json"), "utf8"));
  assert.deepEqual(manifest.map(stage => stage.stage), ["01-basic", "02-list"]);
  assert.equal(manifest[1].grammar, "List");
  assert.match(await readFile(resolve(output, "index.html"), "utf8"), /<h1>Grammar stages<\/h1>/);
});
