// Internal examples utility: extracts the book's embedded grammar templates,
// then hands ordinary Ohm sources to the generic stage gallery generator.
import {readFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {generateGrammarStages} from "../scripts/grammar-stages.js";

const waferSources = [
  ["01-noplang", "chapter02/01-noplang.js"], ["02-numbers", "chapter02/02-numbers.js"],
  ["03-expression-stub", "chapter03/01-exprStub.js"], ["04-addition", "chapter03/02-waferAdd.js"],
  ["05-addition-subtraction", "chapter03/03-waferAddSub.js"], ["06-arithmetic", "chapter03.js"],
  ["07-identifiers", "chapter04/01-identifiers.js"], ["08-primary-expressions", "chapter04/02-primaryexpr.js"],
  ["09-locals", "chapter04/03-compileLocals.js"], ["10-assignment", "chapter04.js"],
  ["11-functions", "chapter05/04-functionDecl.js"], ["12-function-calls", "chapter05.js"],
  ["13-if-expressions", "chapter06/01-ifExpr.js"], ["14-comparisons", "chapter06/03-test-comparison.js"],
  ["15-while", "chapter06/04-test-while.js"], ["16-statements", "chapter06.js"],
  ["17-extern-functions", "chapter07.js"], ["18-memory-and-arrays", "chapter09.js"],
  ["19-strings", "chapter10.js"],
];

const referenceRoot = resolve(process.argv[2] ?? "/tmp/wasmgroundup-code");
const outputRoot = fileURLToPath(new URL("wafer-stages/", import.meta.url));
const stages = await Promise.all(waferSources.map(async ([name, source]) => {
  const javascript = await readFile(resolve(referenceRoot, source), "utf8");
  const match = javascript.match(/const grammarDef = (?:String\.raw)?`([\s\S]*?)`;/);
  if (!match) throw new Error(`No grammarDef template found in ${source}`);
  return {name, source, grammarSource: match[1]};
}));

await generateGrammarStages(stages, outputRoot, {
  title: "Wafer grammar stages",
  description: `${stages.length} grammar stages from <a href="https://github.com/wasmgroundup/code">wasmgroundup/code</a>, from an empty language through strings and memory.`,
  stylesheet: "../../assets/site.css",
});
