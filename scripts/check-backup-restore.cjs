/* Exercise the real XLSX parser, migrations and restore in a disposable profile. */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const Module = require("node:module");

// better-sqlite3 is built for Electron, so use its Node ABI without opening UI.
if (!process.versions.electron) {
  const result = require("node:child_process").spawnSync(
    require("electron"),
    [__filename, ...process.argv.slice(2)],
    { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

const tempRoot = fs.realpathSync(os.tmpdir());
const profile = fs.mkdtempSync(path.join(tempRoot, "pos-restore-check-"));
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "electron")
    return {
      app: {
        getPath(name) {
          assert.equal(name, "userData");
          return profile;
        },
      },
    };
  return originalLoad.call(this, request, parent, isMain);
};
const ts = require("typescript");
require.extensions[".ts"] = (module, file) => {
  module._compile(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    file,
  );
};

const Database = require("better-sqlite3");
const database = require("../src/main/db/database.ts");
const core = require("../src/main/db/backup-core.ts");
const workbook = require("../src/main/backup/workbook.ts");
const auth = require("../src/main/auth/index.ts");
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
const stable = (value) =>
  JSON.stringify(value, (_, entry) =>
    typeof entry === "bigint" ? { bigint: entry.toString() } : entry,
  );
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

function tableDigest(db, name) {
  const columns = db
    .prepare(`PRAGMA table_xinfo(${quote(name)})`)
    .all()
    .filter((column) => Number(column.hidden) === 0)
    .map((column) => column.name)
    .sort();
  const rows = db
    .prepare(`SELECT ${columns.map(quote).join(", ")} FROM ${quote(name)}`)
    .safeIntegers(true)
    .raw()
    .all()
    .map(stable)
    .sort();
  return digest(stable([columns, rows]));
}

function schemaDifferences(source, target) {
  const tables = source
    .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table'")
    .all();
  for (const table of tables) {
    const targetTable = target
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(table.name);
    if (!targetTable) {
      console.log(`Schema: missing destination table ${table.name}`);
      continue;
    }
    const oldColumns = source
      .prepare(`PRAGMA table_xinfo(${quote(table.name)})`)
      .all();
    const newColumns = target
      .prepare(`PRAGMA table_xinfo(${quote(table.name)})`)
      .all();
    const withoutOrder = (columns) =>
      columns
        .map(({ cid, ...column }) => column)
        .sort((a, b) => a.name.localeCompare(b.name));
    if (stable(withoutOrder(oldColumns)) !== stable(withoutOrder(newColumns))) {
      console.log(`Schema column metadata differs: ${table.name}`);
      for (const column of oldColumns) {
        const next = newColumns.find((entry) => entry.name === column.name);
        if (!next) console.log(`  missing column: ${column.name}`);
        else
          for (const key of ["type", "notnull", "pk", "hidden", "dflt_value"])
            if (column[key] !== next[key])
              console.log(
                `  ${column.name}.${key}: ${stable(column[key])} -> ${stable(next[key])}`,
              );
      }
    }
  }
}

async function run() {
  const inputPath = process.argv[2];
  assert.ok(
    inputPath,
    "Usage: node scripts/check-backup-restore.cjs <backup.xlsx>",
  );
  const parsed = await workbook.parseBackupWorkbook(fs.readFileSync(inputPath));
  const source = new Database(Buffer.from(parsed.snapshot), { readonly: true });
  source.pragma("query_only = ON");
  const live = database.initDatabase();
  try {
    const before = core.captureDatabaseSnapshot();
    try {
      core.validateDatabaseSnapshot(parsed.snapshot);
    } catch (error) {
      schemaDifferences(source, live);
      assert.equal(
        digest(core.captureDatabaseSnapshot()),
        digest(before),
        "Validation must not modify the destination",
      );
      throw error;
    }
    const triggers = live
      .prepare(
        "SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name",
      )
      .all();
    const localMarker = tableDigest(live, "_migration_round_quantities");
    core.replaceDatabaseFromSnapshot(parsed.snapshot, parsed.settingsJson);
    auth.clearAuthAfterRestore();
    const tables = source
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all();
    const ignored = new Set([
      "_migration_round_quantities",
      "app_backup_preferences",
      "auth_sessions",
      "auth_login_attempts",
    ]);
    for (const { name } of tables) {
      if (ignored.has(name)) continue;
      assert.equal(
        tableDigest(live, name),
        tableDigest(source, name),
        `Restored data differs in ${name}`,
      );
    }
    assert.equal(
      tableDigest(live, "_migration_round_quantities"),
      localMarker,
      "Keep the local migration marker",
    );
    assert.equal(
      live.prepare("SELECT COUNT(*) n FROM auth_sessions").get().n,
      0,
    );
    assert.equal(
      live.prepare("SELECT COUNT(*) n FROM auth_login_attempts").get().n,
      0,
    );
    assert.equal(
      live
        .prepare(
          "SELECT settings_json FROM app_backup_preferences WHERE id = 1 AND restore_pending = 1",
        )
        .get().settings_json,
      parsed.settingsJson,
    );
    assert.deepEqual(
      live
        .prepare(
          "SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name",
        )
        .all(),
      triggers,
    );
    assert.equal(live.pragma("integrity_check", { simple: true }), "ok");
    assert.equal(live.pragma("foreign_key_check").length, 0);
    assert.equal(live.pragma("foreign_keys", { simple: true }), 1);
    console.log(
      "PASS: real XLSX restored into a fresh temporary installation; table data, sequences, credentials, settings and triggers preserved.",
    );

    const owner = auth.listUsers().find((user) => user.isOwner);
    assert.ok(owner);
    const testPassword = crypto.randomUUID();
    const testUser = await auth.createUser(
      {
        displayName: "Restore check",
        username: "restore.check",
        email: "restore-check@example.test",
        phone: null,
        password: testPassword,
        role: "cashier",
        permissions: [],
        mustChangePassword: false,
      },
      owner.id,
    );
    await assert.rejects(
      auth.login(999, {
        identifier: testUser.username,
        password: "incorrect-password",
      }),
    );
    assert.equal(
      (
        await auth.login(999, {
          identifier: testUser.username,
          password: testPassword,
        })
      ).user.id,
      testUser.id,
    );
    auth.logout(999);
    assert.equal(
      (
        await auth.login(999, {
          identifier: testUser.email,
          password: testPassword,
        })
      ).user.id,
      testUser.id,
    );
    auth.logout(999);
    console.log(
      "PASS: restored authentication accepts username/email and rejects an incorrect password.",
    );

    // Simulate a failed write after replacement has already deleted/inserted rows.
    const failTable = tables.find(
      ({ name }) =>
        !ignored.has(name) &&
        name !== "sqlite_sequence" &&
        source.prepare(`SELECT COUNT(*) n FROM ${quote(name)}`).get().n > 1,
    )?.name;
    assert.ok(
      failTable,
      "Need at least one table with two records to exercise rollback",
    );
    const beforeFailure = digest(core.captureDatabaseSnapshot());
    const originalPrepare = live.prepare;
    let writes = 0;
    live.prepare = function (sql) {
      const statement = originalPrepare.call(this, sql);
      if (!sql.startsWith(`INSERT INTO ${quote(failTable)} (`))
        return statement;
      return new Proxy(statement, {
        get(target, key) {
          if (key === "run")
            return (...values) => {
              writes += 1;
              if (writes === 2) throw new Error("SIMULATED_WRITE_FAILURE");
              return target.run(...values);
            };
          return Reflect.get(target, key);
        },
      });
    };
    try {
      assert.throws(
        () =>
          core.replaceDatabaseFromSnapshot(
            parsed.snapshot,
            parsed.settingsJson,
          ),
        /SIMULATED_WRITE_FAILURE/,
      );
    } finally {
      live.prepare = originalPrepare;
    }
    assert.equal(
      digest(core.captureDatabaseSnapshot()),
      beforeFailure,
      "A failed write must roll back all data and schema changes",
    );
    assert.equal(live.pragma("foreign_keys", { simple: true }), 1);
    assert.deepEqual(
      live
        .prepare(
          "SELECT name, sql FROM sqlite_master WHERE type = 'trigger' ORDER BY name",
        )
        .all(),
      triggers,
    );
    console.log(
      "PASS: failed write rolls back every row and trigger and restores foreign-key enforcement.",
    );

    // Only recognized timestamp defaults are equivalent; real constraint changes
    // and arbitrary date expressions must still be rejected before loading data.
    for (const kind of ["timestamp-default", "check-constraint"]) {
      const modified = new Database(Buffer.from(parsed.snapshot));
      try {
        const table = kind === "timestamp-default" ? "customers" : "products";
        const { sql } = modified
          .prepare(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?",
          )
          .get(table);
        const replacement =
          kind === "timestamp-default"
            ? sql.replace(/datetime\('now'\)/g, "datetime('now', '+1 day')")
            : `${sql.slice(0, sql.lastIndexOf(")"))}, CHECK (purchase_price >= 0)${sql.slice(sql.lastIndexOf(")"))}`;
        assert.notEqual(
          replacement,
          sql,
          "The test must alter the source table definition",
        );
        // Disable defensive mode only in this disposable negative-test copy.
        modified.unsafeMode(true);
        modified.pragma("writable_schema = ON");
        modified
          .prepare(
            "UPDATE sqlite_master SET sql = ? WHERE type = 'table' AND name = ?",
          )
          .run(replacement, table);
        modified.pragma("writable_schema = OFF");
        modified.unsafeMode(false);
        const current = digest(core.captureDatabaseSnapshot());
        assert.throws(
          () =>
            core.replaceDatabaseFromSnapshot(
              modified.serialize(),
              parsed.settingsJson,
            ),
          new RegExp(`tabla ${table}`),
        );
        assert.equal(
          digest(core.captureDatabaseSnapshot()),
          current,
          "Keep the destination unchanged after rejecting modified constraints",
        );
      } finally {
        modified.close();
      }
    }
    console.log(
      "PASS: unrecognized date defaults and altered CHECK constraints remain rejected.",
    );

    const damaged = new Database(Buffer.from(parsed.snapshot));
    try {
      damaged.exec("CREATE TABLE unsupported_backup_data (value TEXT)");
      const current = core.captureDatabaseSnapshot();
      assert.throws(
        () =>
          core.replaceDatabaseFromSnapshot(
            damaged.serialize(),
            parsed.settingsJson,
          ),
        /tablas distintas/,
      );
      assert.equal(
        digest(core.captureDatabaseSnapshot()),
        digest(current),
        "Reject invalid schema before replacing data",
      );
    } finally {
      damaged.close();
    }
    console.log(
      "PASS: incompatible backup is rejected without changing the destination.",
    );
  } finally {
    source.close();
    database.closeDatabase();
  }
}

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    database.closeDatabase();
    const resolved = fs.realpathSync(profile);
    assert.equal(path.dirname(resolved).toLowerCase(), tempRoot.toLowerCase());
    assert.ok(path.basename(resolved).startsWith("pos-restore-check-"));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
