/**
 * Provider factory and registry
 */

import { EmailProvider } from "./email.js";
import { TelegramProvider } from "./telegram.js";
import { NtfyProvider } from "./ntfy.js";

const providers = {
  email: new EmailProvider(),
  telegram: new TelegramProvider(),
  ntfy: new NtfyProvider()
};

/**
 * Returns the appropriate delivery provider adapter for a destination type
 * @param {string} type 
 * @returns {import("./base.js").BaseProvider|null}
 */
export function getProvider(type) {
  if (!type || typeof type !== "string") return null;
  return providers[type.toLowerCase()] || null;
}

/**
 * Registers an additional custom provider
 * @param {string} type 
 * @param {import("./base.js").BaseProvider} providerInstance 
 */
export function registerProvider(type, providerInstance) {
  providers[type.toLowerCase()] = providerInstance;
}

export { EmailProvider, TelegramProvider, NtfyProvider };
