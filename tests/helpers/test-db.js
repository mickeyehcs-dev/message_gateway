/**
 * Real In-Memory SQLite D1 Mock backed by Node.js built-in node:sqlite
 * Runs exact project schema migrations
 */

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function createTestDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON;");

  // Read migrations
  const m1 = readFileSync(resolve(process.cwd(), "migrations/0001_initial.sql"), "utf8");
  const m2 = readFileSync(resolve(process.cwd(), "migrations/0002_admin_users.sql"), "utf8");
  const m3 = readFileSync(resolve(process.cwd(), "migrations/0003_schema_enhancements.sql"), "utf8");

  // Execute migrations
  sqlite.exec(m1);
  sqlite.exec(m2);
  sqlite.exec(m3);

  function wrapStatement(sql, boundParams = []) {
    return {
      bind(...params) {
        return wrapStatement(sql, params);
      },
      async first() {
        const stmt = sqlite.prepare(sql);
        // Normalize params: convert boolean/undefined
        const normalized = boundParams.map(p => {
          if (p === undefined) return null;
          if (typeof p === "boolean") return p ? 1 : 0;
          return p;
        });
        const row = stmt.get(...normalized);
        return row || null;
      },
      async all() {
        const stmt = sqlite.prepare(sql);
        const normalized = boundParams.map(p => {
          if (p === undefined) return null;
          if (typeof p === "boolean") return p ? 1 : 0;
          return p;
        });
        const rows = stmt.all(...normalized);
        return { results: rows };
      },
      async run() {
        const stmt = sqlite.prepare(sql);
        const normalized = boundParams.map(p => {
          if (p === undefined) return null;
          if (typeof p === "boolean") return p ? 1 : 0;
          return p;
        });
        const result = stmt.run(...normalized);
        return {
          success: true,
          meta: {
            changes: Number(result.changes),
            last_row_id: Number(result.lastInsertRowid)
          }
        };
      }
    };
  }

  const d1 = {
    prepare(sql) {
      return wrapStatement(sql);
    },
    async batch(statements) {
      const results = [];
      sqlite.exec("BEGIN TRANSACTION;");
      try {
        for (const s of statements) {
          results.push(await s.run());
        }
        sqlite.exec("COMMIT;");
        return results;
      } catch (err) {
        sqlite.exec("ROLLBACK;");
        throw err;
      }
    },
    raw: sqlite
  };

  return d1;
}
