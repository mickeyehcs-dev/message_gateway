/**
 * Database helpers for Cloudflare D1
 * Strictly uses parameterized queries to prevent SQL injection
 */

/**
 * Executes a prepared query returning all results
 * @param {D1Database} db 
 * @param {string} query 
 * @param {any[]} params 
 * @returns {Promise<any[]>}
 */
export async function queryAll(db, query, params = []) {
  const statement = db.prepare(query);
  const bound = params.length > 0 ? statement.bind(...params) : statement;
  const result = await bound.all();
  return result.results || [];
}

/**
 * Executes a prepared query returning the first result row or null
 * @param {D1Database} db 
 * @param {string} query 
 * @param {any[]} params 
 * @returns {Promise<any|null>}
 */
export async function queryFirst(db, query, params = []) {
  const statement = db.prepare(query);
  const bound = params.length > 0 ? statement.bind(...params) : statement;
  const row = await bound.first();
  return row ?? null;
}

/**
 * Executes a mutation statement (INSERT, UPDATE, DELETE)
 * @param {D1Database} db 
 * @param {string} query 
 * @param {any[]} params 
 * @returns {Promise<{success: boolean, changes: number, lastRowId: number|null}>}
 */
export async function execute(db, query, params = []) {
  const statement = db.prepare(query);
  const bound = params.length > 0 ? statement.bind(...params) : statement;
  const result = await bound.run();
  return {
    success: result.success,
    changes: result.meta?.changes ?? 0,
    lastRowId: result.meta?.last_row_id ?? null
  };
}

/**
 * Executes a batch of prepared statements atomically
 * @param {D1Database} db 
 * @param {D1PreparedStatement[]} statements 
 * @returns {Promise<D1Result[]>}
 */
export async function executeBatch(db, statements) {
  return await db.batch(statements);
}
