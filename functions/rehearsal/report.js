/**
 * How a rehearsal run reads.
 *
 * Failures first and in full — the run is a pre-flight check, so the useful
 * output is "here is what will break on finals night", not a wall of green.
 */

const AREA_TITLES = {
  season: "The season ran",
  championship: "Championship week",
  gates: "Who gets scored",
  champion: "League champions",
  payout: "What the title paid",
  rollover: "Season rollover",
  profile: "Profiles after reset",
  scale: "Scale",
  idempotency: "Doing it twice",
};

const SYMBOLS = { pass: "  ok  ", fail: " FAIL ", warn: " warn " };

/**
 * @param {Array<{area: string, name: string, status: string, detail: string}>} findings
 * @param {{quiet?: boolean}} [options]
 * @returns {number} the number of failures.
 */
function report(findings, { quiet = false } = {}) {
  const failures = findings.filter((f) => f.status === "fail");
  const warnings = findings.filter((f) => f.status === "warn");
  const passes = findings.filter((f) => f.status === "pass");

  if (!quiet) {
    const areas = [...new Set(findings.map((f) => f.area))];
    for (const area of areas) {
      console.log(`\n${AREA_TITLES[area] || area}`);
      for (const finding of findings.filter((f) => f.area === area)) {
        const line = `  [${SYMBOLS[finding.status]}] ${finding.name}`;
        console.log(finding.detail ? `${line}\n${" ".repeat(11)}${finding.detail}` : line);
      }
    }
  }

  console.log(`\n${"=".repeat(78)}`);
  console.log(
    `REHEARSAL: ${passes.length} passed, ${failures.length} failed, ${warnings.length} to decide`
  );
  console.log("=".repeat(78));

  if (failures.length > 0) {
    console.log("\nWhat breaks on finals night:\n");
    for (const finding of failures) {
      console.log(`  * [${finding.area}] ${finding.name}`);
      console.log(`      ${finding.detail}\n`);
    }
  }

  if (warnings.length > 0) {
    console.log("\nCalls for the team, not the harness:\n");
    for (const finding of warnings) {
      console.log(`  * [${finding.area}] ${finding.name}`);
      console.log(`      ${finding.detail}\n`);
    }
  }

  return failures.length;
}

module.exports = { report };
