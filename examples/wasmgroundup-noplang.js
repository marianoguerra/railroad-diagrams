import {mkdir, writeFile} from "node:fs/promises";
import {renderOhmGrammar} from "../dist/index.js";

// The first Ohm grammar in wasmgroundup/code, chapter02/01-noplang.js.
const grammarDef = `
  NopLang {
    Main = ""
  }
`;

const outputDir = new URL("wasmgroundup/", import.meta.url);
await mkdir(outputDir, {recursive: true});
for (const [ruleName, svg] of renderOhmGrammar(grammarDef, {width: 320})) {
  await writeFile(new URL(`${ruleName}.svg`, outputDir), svg);
}
console.log("Wrote examples/wasmgroundup/Main.svg");
