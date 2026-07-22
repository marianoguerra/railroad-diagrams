import * as railroad from "../dist/index.js";
import {renderOhmGrammar} from "../dist/ohm.js";

const sources = {
  javascript: `const value = alternatives(
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
  ohm: `Json {
  value = object | array | string | number | "true" | "false" | "null"
  object = "{" (member ("," member)*)? "}"
  member = string ":" value
  array = "[" (value ("," value)*)? "]"
  string = "\\\"" (~"\\\"" any)* "\\\""
  number = "-"? digit+ ("." digit+)?
}`,
};

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
const outputRule = document.querySelector("#output-rule");
const sourceLabel = document.querySelector("#source-label");
const tabs = [...document.querySelectorAll(".mode-tab")];
let activeMode = "javascript";
let renderTimer;

const editor = CodeMirror(document.querySelector("#editor"), {
  value: sources.javascript,
  mode: "javascript",
  theme: "railroad",
  lineNumbers: true,
  indentUnit: 2,
  tabSize: 2,
  lineWrapping: true,
});

function targetWidth() {
  return Math.max(260, Math.floor(output.clientWidth - 64));
}

function showError(error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const element = document.createElement("pre");
  element.className = "playground-error";
  element.textContent = message;
  output.replaceChildren(element);
  outputRule.textContent = "";
}

function render() {
  clearTimeout(renderTimer);
  try {
    const source = editor.getValue();
    const width = targetWidth();
    let svg;
    if (activeMode === "javascript") {
      const names = Object.keys(railroad);
      const evaluate = new Function(...names, `"use strict";\n${source}`);
      const result = evaluate(...names.map(name => railroad[name]));
      svg = typeof result === "string" ? result : railroad.renderSvg(result, {width});
      outputRule.textContent = "";
    } else {
      const diagrams = renderOhmGrammar(source, {width});
      const first = diagrams.entries().next().value;
      if (!first) throw new Error("The grammar has no rules to render");
      const [rule, rendered] = first;
      svg = rendered;
      outputRule.textContent = `Rule: ${rule}`;
    }
    output.innerHTML = svg;
  } catch (error) {
    showError(error);
  }
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 180);
}

editor.on("change", () => {
  sources[activeMode] = editor.getValue();
  scheduleRender();
});

for (const tab of tabs) {
  tab.addEventListener("click", () => {
    const nextMode = tab.dataset.mode;
    if (nextMode === activeMode) return;
    sources[activeMode] = editor.getValue();
    activeMode = nextMode;
    editor.setOption("mode", activeMode === "javascript" ? "javascript" : "ohm");
    editor.setValue(sources[activeMode]);
    sourceLabel.textContent = activeMode === "javascript" ? "JavaScript" : "Ohm grammar";
    for (const item of tabs) item.setAttribute("aria-selected", String(item === tab));
    editor.focus();
    render();
  });
}

new ResizeObserver(scheduleRender).observe(output);
render();
