// Loads every deployed module so Node's coverage counts it.
//
// `node --test --experimental-test-coverage` only reports files that were
// loaded during the run, so a module no test ever requires was invisible to
// the 70/80/85 gate — nine of them, admin.js included (site review Q-H2).
// Requiring each one here makes every uncovered line show up as uncovered,
// and pins that each module at least loads in isolation (a bad top-level
// require would otherwise surface at deploy time). One-off CLI scripts under
// src/scripts are excluded from the gate (package.json) and from this loader:
// several run on require.
process.env.DATA_NAMESPACE = process.env.DATA_NAMESPACE || "test-ns";

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { readdirSync, statSync } = require("node:fs");
const { join, relative } = require("node:path");

const SRC = __dirname;
const EXCLUDED_DIRS = new Set(["scripts", "node_modules"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!EXCLUDED_DIRS.has(name)) walk(full, out);
    } else if (name.endsWith(".js") && !name.endsWith(".test.js")) {
      out.push(full);
    }
  }
  return out;
}

describe("every deployed module loads", () => {
  const modules = walk(SRC).sort();
  test("finds the source tree", () => {
    assert.ok(modules.length > 150, `only ${modules.length} modules found`);
  });
  for (const file of modules) {
    test(relative(SRC, file), () => {
      const loaded = require(file);
      assert.ok(loaded !== undefined, "module has no exports object");
    });
  }
});
