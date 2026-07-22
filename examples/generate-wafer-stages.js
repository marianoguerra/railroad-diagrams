import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import {resolve, basename} from "node:path";
import {fileURLToPath} from "node:url";
import {expandRailroadRule, railroadGrammar, renderOhmGrammar, renderSvg} from "../dist/index.js";

const stages = [
  ["01-noplang", "chapter02/01-noplang.js"],
  ["02-numbers", "chapter02/02-numbers.js"],
  ["03-expression-stub", "chapter03/01-exprStub.js"],
  ["04-addition", "chapter03/02-waferAdd.js"],
  ["05-addition-subtraction", "chapter03/03-waferAddSub.js"],
  ["06-arithmetic", "chapter03.js"],
  ["07-identifiers", "chapter04/01-identifiers.js"],
  ["08-primary-expressions", "chapter04/02-primaryexpr.js"],
  ["09-locals", "chapter04/03-compileLocals.js"],
  ["10-assignment", "chapter04.js"],
  ["11-functions", "chapter05/04-functionDecl.js"],
  ["12-function-calls", "chapter05.js"],
  ["13-if-expressions", "chapter06/01-ifExpr.js"],
  ["14-comparisons", "chapter06/03-test-comparison.js"],
  ["15-while", "chapter06/04-test-while.js"],
  ["16-statements", "chapter06.js"],
  ["17-extern-functions", "chapter07.js"],
  ["18-memory-and-arrays", "chapter09.js"],
  ["19-strings", "chapter10.js"],
];

const referenceRoot = resolve(process.argv[2] ?? "/tmp/wasmgroundup-code");
const outputRoot = fileURLToPath(new URL("wafer-stages/", import.meta.url));
await rm(outputRoot, {recursive: true, force: true});
await mkdir(outputRoot, {recursive: true});

const indexEntries = [];
const manifest = [];
const expansionOptions = {preserveSharedRules: true, maxNodes: 1200};
for (const [stageName, sourcePath] of stages) {
  const javascript = await readFile(resolve(referenceRoot, sourcePath), "utf8");
  const match = javascript.match(/const grammarDef = (?:String\.raw)?`([\s\S]*?)`;/);
  if (!match) throw new Error(`No grammarDef template found in ${sourcePath}`);
  const grammarSource = match[1];
  const grammar = railroadGrammar(grammarSource);
  const diagrams = renderOhmGrammar(grammarSource, {width: 900});
  const stageDir = resolve(outputRoot, stageName);
  await mkdir(stageDir, {recursive: true});
  await writeFile(resolve(stageDir, "grammar.ohm"), `${grammarSource.trim()}\n`);

  const startRule = grammar.rules[0].name;
  const fullDiagramFilename = `${startRule}.full.svg`;
  const expandedStart = expandRailroadRule(grammar, startRule, expansionOptions);
  await writeFile(
    resolve(stageDir, fullDiagramFilename),
    renderSvg({...expandedStart, label: startRule}, {width: 1200}),
  );

  const atlasRules = collectRuleAtlas(grammar, startRule);
  const atlasFilename = "overview.html";
  await writeFile(resolve(stageDir, atlasFilename), renderAtlasPage(stageName, sourcePath, atlasRules));

  const ruleLinks = [];
  for (const [ruleName, svg] of diagrams) {
    const filename = `${ruleName}.svg`;
    await writeFile(resolve(stageDir, filename), svg);
    ruleLinks.push(`<li><a href="${stageName}/${filename}">${escapeHtml(ruleName)}</a></li>`);
  }
  indexEntries.push(`<section><h2>${escapeHtml(stageName)}</h2><p><code>${escapeHtml(sourcePath)}</code> · ${grammar.rules.length} rules · <a href="${stageName}/grammar.ohm">grammar</a> · <strong><a href="${stageName}/${atlasFilename}">rule atlas</a></strong> · <a href="${stageName}/${fullDiagramFilename}">expanded ${escapeHtml(startRule)}</a></p><ul>${ruleLinks.join("")}</ul></section>`);
  manifest.push({stage: stageName, source: sourcePath, grammar: grammar.name, startRule, fullDiagram: fullDiagramFilename, overview: atlasFilename, atlasRules: atlasRules.map(({name}) => name), expansion: expansionOptions, rules: grammar.rules.map(rule => rule.name)});
  console.log(`${stageName}: ${grammar.rules.length} diagrams from ${sourcePath}`);
}

await writeFile(resolve(outputRoot, "index.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Wafer grammar stages</title>
<style>body{font:16px system-ui;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#222}section{border-top:1px solid #ddd;padding:1rem 0}ul{columns:4;line-height:1.7}code{background:#f3f3f3;padding:.15rem .3rem}@media(max-width:700px){ul{columns:2}}</style></head>
<body><h1>Wafer railroad diagrams</h1><p>${stages.length} distinct grammar stages from <a href="https://github.com/wasmgroundup/code">wasmgroundup/code</a>.</p>${indexEntries.join("\n")}</body></html>\n`);
await writeFile(resolve(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
}

function collectRuleAtlas(grammar, startRule) {
  const knownRules = new Set(grammar.rules.map(rule => rule.name));
  const queued = new Set([startRule]);
  const queue = [startRule];
  const atlas = [];
  while (queue.length) {
    const name = queue.shift();
    const diagram = expandRailroadRule(grammar, name, expansionOptions);
    atlas.push({name, diagram});
    for (const reference of referencedRules(diagram)) {
      if (knownRules.has(reference) && !queued.has(reference)) {
        queued.add(reference);
        queue.push(reference);
      }
    }
  }
  return atlas;
}

function referencedRules(diagram, found = new Set()) {
  if (diagram.type === "nonterminal") found.add(diagram.text);
  else if (diagram.type === "sequence") diagram.items.forEach(item => referencedRules(item, found));
  else if (diagram.type === "stack") {
    referencedRules(diagram.top, found);
    referencedRules(diagram.bottom, found);
  }
  return found;
}

function renderAtlasPage(stageName, sourcePath, atlasRules) {
  const navigation = atlasRules.map(({name}) => `<li><a href="#rule-${encodeURIComponent(name)}">${escapeHtml(name)}</a></li>`).join("");
  const diagrams = atlasRules.map(({name, diagram}, index) => `<section id="rule-${encodeURIComponent(name)}"${index === 0 ? ' class="start-rule"' : ""}><h2>${escapeHtml(name)}</h2><div class="diagram">${renderSvg(diagram, {width: 1200})}</div></section>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(stageName)} rule atlas</title>
<style>*{box-sizing:border-box}body{margin:0;color:#222;font:15px system-ui;background:#fafafa}aside{position:fixed;inset:0 auto 0 0;width:230px;overflow:auto;padding:1rem;background:#fff;border-right:1px solid #ccc}main{margin-left:230px;padding:1.25rem;max-width:1500px}h1{font-size:1.25rem}h2{margin:.2rem 0 .5rem;font-family:ui-monospace,monospace}ul{padding-left:1.2rem;line-height:1.6}.diagram{overflow:auto;background:#fff;border:1px solid #ddd}.diagram svg{display:block;max-width:none}section{margin:0 0 2rem;scroll-margin-top:1rem}.start-rule{border-bottom:3px solid #888;padding-bottom:2rem}@media(max-width:800px){aside{position:static;width:auto;border-right:0}main{margin:0}}</style></head>
<body><aside><h1>${escapeHtml(stageName)}</h1><p><code>${escapeHtml(sourcePath)}</code></p><p><a href="grammar.ohm">Ohm grammar</a></p><ol>${navigation}</ol></aside><main>${diagrams}</main></body></html>\n`;
}
