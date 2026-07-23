import { alternatives, nonterminal, optional, renderSvg, sequence, terminal, zeroOrMore } from "../dist/index.js";
import { writeFile } from "node:fs/promises";

const value = alternatives(terminal("null"), terminal("true"), terminal("false"), nonterminal("number"), nonterminal("string"));
const member = sequence(nonterminal("string"), terminal(":"), value);
const object = sequence(terminal("{"), optional(zeroOrMore(member, terminal(","))), terminal("}"));
await writeFile(new URL("json-object.svg", import.meta.url), renderSvg(object, { width: 520 }));
await writeFile(new URL("../site/assets/json-object-wide.svg", import.meta.url), renderSvg(object, {
  width: 960,
  accessibleLabel: "Railroad diagram for a JSON object",
}));
console.log("Wrote JSON object examples");
