import {cp, mkdir, rm} from "node:fs/promises";
import {resolve} from "node:path";

const root = resolve(import.meta.dirname, "..");
const output = resolve(root, "_site");
await rm(output, {recursive: true, force: true});
await mkdir(resolve(output, "examples"), {recursive: true});
await cp(resolve(root, "site"), output, {recursive: true});
await cp(resolve(root, "dist"), resolve(output, "dist"), {recursive: true});
await cp(resolve(root, "examples/wafer-stages"), resolve(output, "examples/wafer-stages"), {recursive: true});
await cp(resolve(root, "examples/json-object.svg"), resolve(output, "examples/basic/json-object.svg"));
console.log(`Built ${output}`);
