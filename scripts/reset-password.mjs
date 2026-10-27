#!/usr/bin/env node
/**
 * Safe Administrator Password Reset CLI Utility
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
  console.log(" Universal Notification Gateway - Reset Admin Password ");
  console.log("=======================================================\n");

  const rawUsername = (await rl.question("Admin username to reset: ")).trim();
  if (!rawUsername) throw new Error("Username is required.");

  const newPassword = await askPassword("New password (masked): ");
  if (newPassword.length < 12 || newPassword.length > 256) {
    throw new Error("Password must be between 12 and 256 characters in length.");
  }

  const confirmPassword = await askPassword("Confirm new password (masked): ");
  if (newPassword !== confirmPassword) {
    throw new Error("Passwords do not match.");
  }

  const iterations = 210000;
  const salt = randomBytes(16);
  const hash = await derive(newPassword, salt, iterations, 32, "sha256");

  const saltB64 = salt.toString("base64");
  const hashB64 = hash.toString("base64");

  const targetEnv = (await rl.question("\nApply directly to database? [local / remote / print-only] (default: local): ")).trim().toLowerCase() || "local";

  const sql = `UPDATE admin_users SET salt='${saltB64}', password_hash='${hashB64}', iterations=${iterations}, enabled=1, updated_at=datetime('now') WHERE username='${rawUsername}'; DELETE FROM admin_sessions WHERE username='${rawUsername}';`;

  if (targetEnv === "local" || targetEnv === "remote") {
    console.log(`\nUpdating ${targetEnv} D1 database 'message_gateway'...`);
    const args = ["wrangler", "d1", "execute", "message_gateway", `--${targetEnv}`, "--command", sql];
    const npx = process.platform === "win32" ? "npx.cmd" : "npx";
    
    const child = spawn(npx, args, { stdio: "inherit" });
    child.on("close", (code) => {
      if (code === 0) {
        console.log(`\nPassword for administrator '${rawUsername}' reset successfully on ${targetEnv} D1! Existing sessions invalidated.`);
      } else {
        console.error(`\nFailed to execute D1 command (exit code ${code}).`);
      }
    });
  } else {
    console.log("\nRun this command to reset the password in D1:\n");
    console.log(`npx wrangler d1 execute message_gateway --local --command "${sql}"`);
    console.log(`npx wrangler d1 execute message_gateway --remote --command "${sql}"\n`);
  }
} catch (error) {
  console.error("\nError:", error.message);
} finally {
  rl.close();
}
