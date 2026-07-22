import * as railroad from "../dist/index.js";
import {expandRailroadRule, railroadGrammar, renderOhmGrammar} from "../dist/ohm.js";

const examples = {
  javascript: [
    {
      id: "sequence",
      label: "Simple — conditional sequence",
      source: `return sequence(
  terminal("if"),
  nonterminal("condition"),
  terminal("then"),
  nonterminal("result"),
);`,
    },
    {
      id: "json",
      label: "Medium — JSON object",
      source: `const value = alternatives(
  terminal("null"),
  terminal("true"),
  terminal("false"),
  nonterminal("number"),
  nonterminal("string"),
);

const member = sequence(
  nonterminal("string"),
  terminal(":"),
  value,
);

return sequence(
  terminal("{"),
  optional(zeroOrMore(member, terminal(","))),
  terminal("}"),
);`,
    },
    {
      id: "wafer",
      label: "Complex — Wafer function body",
      source: `const identifier = nonterminal("identifier");
const expression = alternatives(
  nonterminal("assignment"),
  nonterminal("binary expression"),
  nonterminal("function call"),
  nonterminal("if expression"),
);
const statement = alternatives(
  sequence(terminal("let"), identifier, terminal("="), expression, terminal(";")),
  sequence(terminal("while"), expression, nonterminal("block")),
  sequence(expression, terminal(";")),
);

return sequence(
  terminal("func"),
  identifier,
  terminal("("),
  optional(oneOrMore(identifier, terminal(","))),
  terminal(")"),
  terminal("{"),
  zeroOrMore(statement),
  expression,
  terminal("}"),
);`,
    },
  ],
  ohm: [
    {id: "wafer-01", label: "Simple — Wafer 01: empty language", url: "../examples/wafer-stages/01-noplang/grammar.ohm"},
    {id: "wafer-06", label: "Medium — Wafer 06: arithmetic", url: "../examples/wafer-stages/06-arithmetic/grammar.ohm"},
    {id: "wafer-19", label: "Complex — Wafer 19: strings & comments", url: "../examples/wafer-stages/19-strings/grammar.ohm"},
  ],
};

const sourceCache = new Map(examples.javascript.map(example => [`javascript:${example.id}`, example.source]));
const selectedExample = {javascript: "sequence", ohm: "wafer-01"};

CodeMirror.defineSimpleMode("ohm", {
  start: [
    {regex: /\/\/.*$/, token: "comment"},
    {regex: /"(?:[^"\\]|\\.)*"/, token: "string"},
    {regex: /\b(?:true|false|null)\b/, token: "atom"},
    {regex: /\b[A-Z][\w]*\b/, token: "def"},
    {regex: /\b[a-z][\w]*\b/, token: "variable-2"},
    {regex: /:=|\+=|<:|=|\||\*|\+|\?|--/, token: "keyword"},
    {regex: /[{}()<>]/, token: "bracket"},
  ],
  meta: {lineComment: "//"},
});

const output = document.querySelector("#output");
const outputTitle = document.querySelector("#output-title");
const outputTabs = document.querySelector("#output-tabs");
const outputTabButtons = [...outputTabs.querySelectorAll("[data-output]")];
const outputRule = document.querySelector("#output-rule");
const sourceLabel = document.querySelector("#source-label");
const exampleSelect = document.querySelector("#example-select");
const themeToggle = document.querySelector("#theme-toggle");
const tabs = [...document.querySelectorAll(".mode-tab")];
let activeMode = "javascript";
let activeOutput = "svg";
let renderTimer;
let loadVersion = 0;

function updateThemeToggle() {
  const dark = document.documentElement.dataset.theme === "dark";
  themeToggle.textContent = dark ? "Light mode" : "Dark mode";
  themeToggle.setAttribute("aria-pressed", String(dark));
}

themeToggle.addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("rrd-theme", theme);
  updateThemeToggle();
});

updateThemeToggle();

const editor = CodeMirror(document.querySelector("#editor"), {
  value: sourceCache.get("javascript:sequence"),
  mode: "javascript",
  theme: "railroad",
  lineNumbers: true,
  indentUnit: 2,
  tabSize: 2,
  lineWrapping: true,
});

function currentKey() {
  return `${activeMode}:${selectedExample[activeMode]}`;
}

function populateExamples() {
  exampleSelect.replaceChildren(...examples[activeMode].map(example => {
    const option = document.createElement("option");
    option.value = example.id;
    option.textContent = example.label;
    option.selected = example.id === selectedExample[activeMode];
    return option;
  }));
}

async function loadExample() {
  const version = ++loadVersion;
  const key = currentKey();
  let source = sourceCache.get(key);
  if (source === undefined) {
    const example = examples[activeMode].find(item => item.id === selectedExample[activeMode]);
    if (!example?.url) throw new Error("Example source is unavailable");
    const response = await fetch(example.url);
    if (!response.ok) throw new Error(`Could not load example (${response.status})`);
    source = await response.text();
    sourceCache.set(key, source);
  }
  if (version !== loadVersion) return;
  editor.setValue(source);
  editor.clearHistory();
  editor.focus();
  render();
}

function targetWidth() {
  return Math.max(260, Math.floor(output.clientWidth - 64));
}

function showError(error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const element = document.createElement("pre");
  element.className = "playground-error";
  element.textContent = message;
  output.classList.remove("atlas-active");
  output.replaceChildren(element);
  outputRule.textContent = "";
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

function renderRuleAtlas(source, width) {
  const grammar = railroadGrammar(source);
  const startRule = grammar.rules[0]?.name;
  if (!startRule) throw new Error(`Grammar ${JSON.stringify(grammar.name)} has no rules`);
  const known = new Set(grammar.rules.map(rule => rule.name));
  const queued = new Set([startRule]);
  const queue = [startRule];
  const rules = [];
  while (queue.length) {
    const name = queue.shift();
    const diagram = expandRailroadRule(grammar, name, {preserveSharedRules: true, maxNodes: 1200});
    rules.push({name, diagram});
    for (const reference of referencedRules(diagram)) {
      if (known.has(reference) && !queued.has(reference)) {
        queued.add(reference);
        queue.push(reference);
      }
    }
  }

  const atlas = document.createElement("div");
  atlas.className = "rule-atlas";
  const navigation = document.createElement("aside");
  const heading = document.createElement("strong");
  heading.textContent = `${grammar.name} rules`;
  const list = document.createElement("ol");
  const content = document.createElement("div");
  content.className = "atlas-rules";
  const diagramWidth = Math.max(320, width - 190);
  rules.forEach(({name, diagram}, index) => {
    const id = `atlas-rule-${index}`;
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = `#${id}`;
    link.textContent = name;
    item.append(link);
    list.append(item);
    const section = document.createElement("section");
    section.id = id;
    section.className = index === 0 ? "atlas-rule start-rule" : "atlas-rule";
    const title = document.createElement("h3");
    title.textContent = name;
    const diagramElement = document.createElement("div");
    diagramElement.className = "atlas-diagram";
    diagramElement.innerHTML = railroad.renderSvg(diagram, {width: diagramWidth});
    section.append(title, diagramElement);
    content.append(section);
  });
  navigation.append(heading, list);
  atlas.append(navigation, content);
  output.classList.add("atlas-active");
  output.replaceChildren(atlas);
  outputRule.textContent = `${rules.length} rules`;
}

function render() {
  clearTimeout(renderTimer);
  try {
    const source = editor.getValue();
    const width = targetWidth();
    if (activeMode === "javascript") {
      const names = Object.keys(railroad);
      const evaluate = new Function(...names, `"use strict";\n${source}`);
      const result = evaluate(...names.map(name => railroad[name]));
      const svg = typeof result === "string" ? result : railroad.renderSvg(result, {width});
      output.classList.remove("atlas-active");
      output.innerHTML = svg;
      outputRule.textContent = "";
    } else if (activeOutput === "atlas") {
      renderRuleAtlas(source, width);
    } else {
      const diagrams = renderOhmGrammar(source, {width});
      const first = diagrams.entries().next().value;
      if (!first) throw new Error("The grammar has no rules to render");
      const [rule, rendered] = first;
      output.classList.remove("atlas-active");
      output.innerHTML = rendered;
      outputRule.textContent = `Rule: ${rule}`;
    }
  } catch (error) {
    showError(error);
  }
}

for (const tab of outputTabButtons) {
  tab.addEventListener("click", () => {
    activeOutput = tab.dataset.output;
    for (const item of outputTabButtons) item.setAttribute("aria-selected", String(item === tab));
    outputTitle.textContent = activeOutput === "atlas" ? "Rule atlas" : "SVG output";
    output.scrollTo(0, 0);
    render();
  });
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 180);
}

editor.on("change", () => {
  sourceCache.set(currentKey(), editor.getValue());
  scheduleRender();
});

exampleSelect.addEventListener("change", async () => {
  sourceCache.set(currentKey(), editor.getValue());
  selectedExample[activeMode] = exampleSelect.value;
  try {
    await loadExample();
  } catch (error) {
    showError(error);
  }
});

for (const tab of tabs) {
  tab.addEventListener("click", async () => {
    const nextMode = tab.dataset.mode;
    if (nextMode === activeMode) return;
    sourceCache.set(currentKey(), editor.getValue());
    activeMode = nextMode;
    outputTabs.hidden = activeMode !== "ohm";
    if (activeMode === "javascript") {
      activeOutput = "svg";
      outputTitle.textContent = "SVG output";
      for (const item of outputTabButtons) item.setAttribute("aria-selected", String(item.dataset.output === "svg"));
    }
    editor.setOption("mode", activeMode === "javascript" ? "javascript" : "ohm");
    sourceLabel.textContent = activeMode === "javascript" ? "JavaScript" : "Ohm grammar";
    for (const item of tabs) item.setAttribute("aria-selected", String(item === tab));
    populateExamples();
    try {
      await loadExample();
    } catch (error) {
      showError(error);
    }
  });
}

populateExamples();
new ResizeObserver(scheduleRender).observe(output);
render();
