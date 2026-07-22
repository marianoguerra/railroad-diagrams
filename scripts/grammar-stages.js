import {mkdir, rm, writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {expandRailroadRule, railroadGrammar, renderOhmGrammar} from "../dist/ohm.js";
import {renderSvg} from "../dist/index.js";

export const stageExpansionOptions = {preserveSharedRules: true, maxNodes: 1200};

/** Generate a browsable gallery from ordinary Ohm grammar sources. */
export async function generateGrammarStages(stages, outputRoot, {title = "Grammar stages", description, stylesheet, log = console.log} = {}) {
  await rm(outputRoot, {recursive: true, force: true});
  await mkdir(outputRoot, {recursive: true});
  const indexEntries = [];
  const manifest = [];
  for (const stage of stages) {
    const {name: stageName, source: sourcePath = `${stageName}.ohm`, grammarSource} = stage;
    const grammar = railroadGrammar(grammarSource);
    const stageDir = resolve(outputRoot, stageName);
    await mkdir(stageDir, {recursive: true});
    await writeFile(resolve(stageDir, "grammar.ohm"), `${grammarSource.trim()}\n`);
    const startRule = grammar.rules[0]?.name;
    if (!startRule) throw new Error(`Grammar ${JSON.stringify(grammar.name)} has no rules`);
    const fullDiagram = `${startRule}.full.svg`;
    await writeFile(resolve(stageDir, fullDiagram), renderSvg({...expandRailroadRule(grammar, startRule, stageExpansionOptions), label: startRule}, {width: 1200}));
    const atlasRules = collectRuleAtlas(grammar, startRule);
    await writeFile(resolve(stageDir, "overview.html"), renderAtlasPage(stageName, sourcePath, atlasRules));
    const links = [];
    for (const [ruleName, svg] of renderOhmGrammar(grammarSource, {width: 900})) {
      await writeFile(resolve(stageDir, `${ruleName}.svg`), svg);
      links.push(`<li><a href="${stageName}/${ruleName}.svg">${escapeHtml(ruleName)}</a></li>`);
    }
    indexEntries.push(`<section><h2>${escapeHtml(stageName)}</h2><p><code>${escapeHtml(sourcePath)}</code> · ${grammar.rules.length} rules · <a href="${stageName}/grammar.ohm">grammar</a> · <strong><a href="${stageName}/overview.html">rule atlas</a></strong> · <a href="${stageName}/${fullDiagram}">expanded ${escapeHtml(startRule)}</a></p><ul>${links.join("")}</ul></section>`);
    manifest.push({stage: stageName, source: sourcePath, grammar: grammar.name, startRule, fullDiagram, overview: "overview.html", atlasRules: atlasRules.map(({name}) => name), expansion: stageExpansionOptions, rules: grammar.rules.map(rule => rule.name)});
    log(`${stageName}: ${grammar.rules.length} diagrams from ${sourcePath}`);
  }
  await writeFile(resolve(outputRoot, "index.html"), renderIndex(title, description ?? `${stages.length} Ohm grammar stages.`, stylesheet, indexEntries));
  await writeFile(resolve(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function collectRuleAtlas(grammar, startRule) {
  const known = new Set(grammar.rules.map(rule => rule.name));
  const queued = new Set([startRule]);
  const queue = [startRule];
  const atlas = [];
  while (queue.length) {
    const name = queue.shift();
    const diagram = expandRailroadRule(grammar, name, stageExpansionOptions);
    atlas.push({name, diagram});
    for (const reference of referencedRules(diagram)) if (known.has(reference) && !queued.has(reference)) { queued.add(reference); queue.push(reference); }
  }
  return atlas;
}

function referencedRules(diagram, found = new Set()) {
  if (diagram.type === "nonterminal") found.add(diagram.text);
  else if (diagram.type === "sequence") diagram.items.forEach(item => referencedRules(item, found));
  else if (diagram.type === "stack") { referencedRules(diagram.top, found); referencedRules(diagram.bottom, found); }
  return found;
}

const escapeHtml = value => value.replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);

function renderIndex(title, description, stylesheet, entries) {
  const style = stylesheet ? `<link rel="stylesheet" href="${escapeHtml(stylesheet)}">` : `<style>body{font:16px system-ui;max-width:1100px;margin:2rem auto;padding:0 1rem;color:#222}section{border-top:1px solid #ddd;padding:1rem 0}ul{columns:4;line-height:1.7}code{background:#f3f3f3;padding:.15rem .3rem}@media(max-width:700px){ul{columns:2}}</style>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title>${style}</head><body><main><h1>${escapeHtml(title)}</h1><p>${description}</p>${entries.join("\n")}</main></body></html>\n`;
}

function renderAtlasPage(stageName, sourcePath, atlasRules) {
  const navigation = atlasRules.map(({name}) => `<li><a href="#rule-${encodeURIComponent(name)}">${escapeHtml(name)}</a></li>`).join("");
  const diagrams = atlasRules.map(({name, diagram}, index) => `<section id="rule-${encodeURIComponent(name)}"${index === 0 ? ' class="start-rule"' : ""}><h2>${escapeHtml(name)}</h2><div class="diagram">${renderSvg(diagram, {width: 1200})}</div></section>`).join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(stageName)} rule atlas</title><style>*{box-sizing:border-box}body{margin:0;color:#17202a;font:15px system-ui;background:#f6f7f9}aside{position:fixed;inset:0 auto 0 0;width:230px;overflow:auto;padding:1rem;background:#fff;border-right:1px solid #ccd2d8}main{margin-left:230px;padding:1.25rem;max-width:1500px}h1{font-size:1.25rem}h2{font-family:ui-monospace,monospace}.diagram{overflow:auto;background:#fff;border:1px solid #dce1e5;border-radius:8px}.diagram svg{display:block;max-width:none}section{margin-bottom:2rem;scroll-margin-top:1rem}.start-rule{border-bottom:3px solid #788;padding-bottom:2rem}@media(max-width:800px){aside{position:static;width:auto}main{margin:0}}</style></head><body><aside><h1>${escapeHtml(stageName)}</h1><p><code>${escapeHtml(sourcePath)}</code></p><p><a href="../">All stages</a> · <a href="grammar.ohm">grammar</a></p><ol>${navigation}</ol></aside><main>${diagrams}</main></body></html>\n`;
}
