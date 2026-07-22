import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const workspace = mkdtempSync(join(tmpdir(), "railroad-diagrams-package-"));
const cache = join(workspace, "npm-cache");
const pack = JSON.parse(execFileSync("npm", ["pack", "--json", "--ignore-scripts", "--provenance=false", "--cache", cache], {
  cwd: root,
  encoding: "utf8",
}))[0];
const tarball = join(root, pack.filename);

try {
  writeFileSync(join(workspace, "package.json"), JSON.stringify({type: "module", dependencies: {package: `file:${tarball}`}}));
  execFileSync("npm", ["install", "--ignore-scripts", "--cache", cache], {cwd: workspace, stdio: "pipe"});
  const installed = JSON.parse(readFileSync(join(workspace, "node_modules/package/package.json"), "utf8"));
  assert.deepEqual(installed.files, ["dist", "bin", "scripts/grammar-stages.js", "README.md", "LICENSE", "CHANGELOG.md"]);
  const core = await import(pathToFileURL(join(workspace, "node_modules/package/dist/index.js")));
  assert.equal(typeof core.renderSvg, "function");
  assert.equal("railroadGrammar" in core, false);
  assert.match(core.renderSvg(core.terminal("ok")), /^<svg/);
  console.log(`Package smoke test passed (${pack.size} bytes, ${pack.entryCount} files).`);
} finally {
  rmSync(tarball, {force: true});
  rmSync(workspace, {recursive: true, force: true});
}
