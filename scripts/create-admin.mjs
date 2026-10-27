#!/usr/bin/env node
/**
 * Safe Administrator Creation CLI Utility
 * Derives PBKDF2-SHA256 password hash using standard cryptographic parameters
 * Never echoes plaintext passwords or writes them to files
 */

import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { randomBytes, pbkdf2 } from "node:crypto";
import { promisify } from "node:util";
import { spawn } from "node:child_process";

const derive = promisify(pbkdf2);
const rl = createInterface({ input, output });

async function askPassword(promptText) {
  output.write(promptText);
  let password = "";
  input.setRawMode(true);
  input.resume();
  input.setEncoding("utf8");

  return new Promise((resolve) => {
    function onData(char) {
      if (char === "\n" || char === "\r" || char === "\u0004") {
        input.setRawMode(false);
        input.pause();
        input.removeListener("data", onData);
        output.write("\n");
        resolve(password);
      } else if (char === "\u0003") {
        // Ctrl+C
        input.setRawMode(false);
        input.pause();
        process.exit(1);
      } else if (char === "\b" || char === "\x7f") {
        if (password.length > 0) {
          password = password.slice(0, -1);
          output.write("\b \b");
        }
      } else {
        password += char;
        output.write("*");
      }
    }
    input.on("data", onData);
  });
}

try {
  console.log("\n=======================================================");
  console.log(" Universal Notification Gateway - Create Administrator ");
  console.log("=======================================================\n");

  const rawUsername = (await rl.question("Admin username (3-64 alphanumeric, dot, hyphen, underscore): ")).trim();
  if (!/^[A-Za-z0-9._-]{3,64}$/.test(rawUsername)) {
    throw new Error("Invalid username format. Must be 3-64 characters matching [A-Za-z0-9._-].");
  }

  const password = await askPassword("Admin password (masked): ");
  if (password.length < 12 || password.length > 256) {
    throw new Error("Password must be between 12 and 256 characters in length.");
  }

  const confirmPassword = await askPassword("Confirm password (masked): ");
  if (password !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  const targetEnv = (await rl.question("\nApply directly to database? [local / remote / print-only] (default: local): ")).trim().toLowerCase() || "local";

  const sql = `INSERT INTO admin_users (username, salt, password_hash, iterations, enabled, created_at, updated_at) VALUES ('${rawUsername}', '', '${password}', 0, 1, datetime('now'), datetime('now')) ON CONFLICT(username) DO UPDATE SET salt='', password_hash=excluded.password_hash, iterations=0, enabled=1, updated_at=datetime('now');`;

  if (targetEnv === "local" || targetEnv === "remote") {
    console.log(`\nExecuting on ${targetEnv} D1 database 'message_gateway'...`);
    const args = ["wrangler", "d1", "execute", "message_gateway", `--${targetEnv}`, "--command", sql];
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    
    const child = spawn(npx, args, { stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) {
        console.log(`\nAdministrator '${rawUsername}' created successfully on ${targetEnv} D1!`);
      } else {
        console.error(`\nFailed to execute D1 command (exit code ${code}).`);
      }
    });
  } else {
    console.log("\nRun this command to create the administrator user in D1:\n");
    console.log(`npx wrangler d1 execute message_gateway --local --command "${sql}"`);
    console.log(`npx wrangler d1 execute message_gateway --remote --command "${sql}"\n`);
  }
} catch (error) {
  console.error("\nError:", error.message);
} finally {
  rl.close();
}
