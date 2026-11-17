import { randomBytes, scryptSync } from "node:crypto";

let pin = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) pin += chunk;
pin = pin.trim();

if (!/^\d{1,6}$/.test(pin)) {
  process.stderr.write("PIN must contain 1 to 6 digits.\n");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const hash = scryptSync(pin, salt, 32, { N: 16384, r: 8, p: 1 }).toString("hex");
process.stdout.write(`scrypt$${salt}$${hash}`);
