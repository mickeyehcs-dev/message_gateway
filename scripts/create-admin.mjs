import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { randomBytes, pbkdf2 } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(pbkdf2);
const rl = createInterface({ input, output });
try {
 const username=(await rl.question("Admin username (letters, numbers, dot, underscore, hyphen): ")).trim();
 if(!/^[A-Za-z0-9._-]{1,64}$/.test(username)) throw new Error("Invalid username format.");
 const password=await rl.question("Admin password (input is visible in this terminal): ");
 if(password.length<12||password.length>256) throw new Error("Use a password between 12 and 256 characters.");
 const salt=randomBytes(16), hash=await derive(password,salt,210000,32,"sha256");
 const sql=`INSERT INTO admin_users (username, salt, password_hash, iterations, enabled) VALUES ('${username}', '${salt.toString("base64")}', '${hash.toString("base64")}', 210000, 1) ON CONFLICT(username) DO UPDATE SET salt=excluded.salt, password_hash=excluded.password_hash, iterations=excluded.iterations, enabled=1;`;
 console.log("\nRun this command from the project directory to create/reset the D1 admin user:\n");
 console.log(`npx wrangler d1 execute universal-notification-gateway --remote --command "${sql}"`);
 console.log("\nThis resets the account if the username already exists. Keep the password in a password manager.");
} finally {rl.close();}
