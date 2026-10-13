/**
 * Local development Postgres with no Docker or installer: npm run db:local
 * Data lives in ./.local-db (git-ignored) and persists between runs. Stop with Ctrl+C.
 * Connection string: postgresql://fit:fit@localhost:5433/fittrack
 */
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(".local-db");
const fresh = !fs.existsSync(path.join(dir, "PG_VERSION"));
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "fit", password: "fit", port: 5433, persistent: true });

if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("fittrack");

console.log("Local Postgres ready on localhost:5433 (db: fittrack, user/password: fit/fit). Press Ctrl+C to stop.");

const stop = async () => {
  await pg.stop().catch(() => null);
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
