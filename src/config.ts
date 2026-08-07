/**
 * API Base URL Configuration
 * Uses local proxy in dev, and deployed Cloudflare Worker API in production.
 */
const metaEnv = (import.meta as any).env || {};

export const API_BASE_URL: string =
  metaEnv.VITE_API_URL ||
  (metaEnv.PROD ? 'https://arlecchino-api.p-quiz.workers.dev' : '');
