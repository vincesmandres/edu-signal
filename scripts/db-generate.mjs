import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const migration = "drizzle-postgres/0003_m5_evidence_system.sql";

if (process.argv.length > 2) {
  const result = spawnSync("npx", ["drizzle-kit", "generate", ...process.argv.slice(2)], { stdio: "inherit", shell: true });
  process.exit(result.status ?? 1);
}

if (!existsSync(migration)) {
  console.error(`Missing migration authority: ${migration}`);
  process.exit(1);
}

console.log(`Drizzle migration history is already committed in ${migration}; no migration generated.`);
