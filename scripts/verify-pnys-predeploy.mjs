import fs from "node:fs";
import path from "node:path";
import { PNYS_PROJECT_ID, PNYS_PROJECT_NAME, pnysGateApplies, validatePnysEnvironment } from "./lib/pnys-env-gate.mjs";

function validateLocalLink() {
  const linkPath = path.join(process.cwd(), ".vercel", "project.json");
  if (!fs.existsSync(linkPath)) return [];
  const link = JSON.parse(fs.readFileSync(linkPath, "utf8"));
  const errors = [];
  if (link.projectName !== PNYS_PROJECT_NAME) errors.push(`Linked project must be ${PNYS_PROJECT_NAME}.`);
  if (link.projectId !== PNYS_PROJECT_ID) errors.push(`Linked project ID must be ${PNYS_PROJECT_ID}.`);
  return errors;
}

const forced = process.argv.includes("--force");
if (!forced && !pnysGateApplies(process.env)) {
  console.log("PNYS predeploy gate skipped for a non-PNYS build.");
  process.exit(0);
}

const errors = [...validateLocalLink(), ...validatePnysEnvironment(process.env)];
if (errors.length) {
  console.error("PNYS predeploy gate failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("PNYS predeploy gate passed: project, store, schemas, URL, secrets, and PIN hashes are valid.");
