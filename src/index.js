/**
 * Universal Notification Gateway - Cloudflare Worker Entry Point
 */

import { handleRequest } from "./router.js";

export default {
  /**
   * Cloudflare Workers fetch handler
   * @param {Request} request 
   * @param {object} env 
   * @param {ExecutionContext} ctx 
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    return await handleRequest(request, env);
  }
};
