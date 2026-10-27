/**
 * Base provider interface and delivery outcome structures
 */

export class BaseProvider {
  /**
   * Sends a notification to a specific destination
   * @param {object} destination - Destination record from DB
   * @param {object} notification - Notification payload (topic, title, message, severity, metadata)
   * @param {object} env - Cloudflare Workers environment bindings
   * @returns {Promise<{success: boolean, httpStatus?: number, responseExcerpt?: string, errorMessage?: string}>}
   */
  async send(destination, notification, env) {
    throw new Error("Provider.send() must be implemented by subclass");
  }

  /**
   * Tests destination connectivity and configuration
   * @param {object} destination 
   * @param {object} env 
   * @returns {Promise<{success: boolean, httpStatus?: number, message: string}>}
   */
  async test(destination, env) {
    throw new Error("Provider.test() must be implemented by subclass");
  }
}
