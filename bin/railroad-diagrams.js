#!/usr/bin/env node
import {mkdir, readFile, writeFile} from "node:fs/promises";
import {basename, dirname, extname, resolve} from "node:path";
import {railroadGrammar, renderOhmRuleFull} from "../dist/ohm.js";
import {renderSvg} from "../dist/index.js";
import {generateGrammarStages} from "../scripts/grammar-stages.js";

const [command, ...arguments_] = process.argv.slice(2);
const usage = `Usage:
  railroad-diagrams svg <grammar.ohm> [-o output.svg] [--rule NAME] [--width PX] [--full]
  railroad-diagrams json <grammar.ohm> [-o output.json]
  railroad-diagrams stages <grammar.ohm>... -o <directory>
`;

try {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(usage);
  } else if (command === "svg") {
    const {input, output, options} = parse(arguments_);
    if (!input) throw new Error("svg requires an Ohm grammar file");
    const source = await readFile(input, "utf8");
    const grammar = railroadGrammar(source);
    const rule = options.rule ?? grammar.rules[0]?.name;
    if (!rule) throw new Error("The grammar contains no rules");
    const width = numberOption(options.width, 900, "width");
    const svg = options.full ? renderOhmRuleFull(source, rule, {width}) : renderSvg({...requiredRule(grammar, rule).diagram, label: rule}, {width});
    await emit(svg, output);
  } else if (command === "json") {
    const {input, output} = parse(arguments_);
    if (!input) throw new Error("json requires an Ohm grammar file");
    await emit(`${JSON.stringify(railroadGrammar(await readFile(input, "utf8")), null, 2)}\n`, output);
  } else if (command === "stages") {
    const {inputs, output} = parse(arguments_, {multiple: true});
    if (!inputs.length) throw new Error(`${command} requires one or more Ohm grammar files`);
    if (!output) throw new Error(`${command} requires --output`);
    const stages = await Promise.all(inputs.map(async input => ({
      name: basename(input, extname(input)),
      source: input,
      grammarSource: await readFile(input, "utf8"),
    })));
    await generateGrammarStages(stages, resolve(output));
  } else {
    throw new Error(`Unknown command ${JSON.stringify(command)}`);
  }
} catch (error) {
  process.stderr.write(`railroad-diagrams: ${error.message}\n\n${usage}`);
  process.exitCode = 1;
}

function parse(args, {multiple = false} = {}) {
  let input;
  const inputs = [];
  let output;
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "-o" || arg === "--output") output = valueAfter(args, ++index, arg);
    else if (arg === "--rule" || arg === "--width") options[arg.slice(2)] = valueAfter(args, ++index, arg);
    else if (arg === "--full") options.full = true;
    else if (arg.startsWith("-")) throw new Error(`Unknown option ${arg}`);
    else if (multiple) inputs.push(arg);
    else if (input) throw new Error(`Unexpected argument ${arg}`);
    else input = arg;
  }
  return {input, inputs, output, options};
}
function valueAfter(args, index, option) { if (!args[index]) throw new Error(`${option} requires a value`); return args[index]; }
function numberOption(value, fallback, name) { const number = value === undefined ? fallback : Number(value); if (!(number > 0)) throw new Error(`--${name} must be positive`); return number; }
function requiredRule(grammar, name) { const rule = grammar.rules.find(candidate => candidate.name === name); if (!rule) throw new Error(`Unknown rule ${JSON.stringify(name)}`); return rule; }
async function emit(content, output) { if (!output) process.stdout.write(content); else { await mkdir(dirname(resolve(output)), {recursive: true}); await writeFile(output, content); } }
