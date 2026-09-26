import nextEnv from "@next/env";
import { readFileSync } from "node:fs";

export const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
export const SUPABASE_API_PORT = 55421;
export const SUPABASE_DB_PORT = 55432;
export const APP_PORT = 3000;
export const API_PORT = 3100;

export function loadLocalEnv() {
  Object.assign(process.env, { NODE_ENV: process.env.NODE_ENV ?? "test" });
  nextEnv.loadEnvConfig(process.cwd());
}

export function refreshFixtureEnv() {
  try {
    for (const line of readFileSync(".env.test.local", "utf8").split(/\r?\n/)) {
      const separator = line.indexOf("=");
      if (separator > 0) process.env[line.slice(0, separator)] = line.slice(separator + 1);
    }
  } catch { /* fixture generation will report the actionable error */ }
}

function hostIsLocal(hostname) { return LOCAL_HOSTS.has(hostname.replace(/^\[|\]$/g, "").toLowerCase()); }

export function validateLocalHttp(name, value, expectedPort) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`BLOCKED: ${name} must be a valid local HTTP URL.`); }
  if (!/^https?:$/.test(parsed.protocol) || !hostIsLocal(parsed.hostname) || parsed.port !== String(expectedPort)) throw new Error(`BLOCKED: ${name} must target localhost/127.0.0.1/::1:${expectedPort}.`);
  return parsed;
}

export function validateLocalDb(name, value) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error(`BLOCKED: ${name} must be a valid local PostgreSQL URL.`); }
  if (!/^postgres(ql)?:$/.test(parsed.protocol) || !hostIsLocal(parsed.hostname) || parsed.port !== String(SUPABASE_DB_PORT)) throw new Error(`BLOCKED: ${name} must target localhost/127.0.0.1/::1:${SUPABASE_DB_PORT}.`);
  return parsed;
}

export function assertLocalTestEnv(options = {}) {
  const { app = false, api = false, supabase = true, database = true, migration = true, service = false, anon = false, password = false } = options;
  const required = [];
  if (supabase) required.push("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
  if (database) required.push("DATABASE_URL");
  if (migration) required.push("MIGRATION_DATABASE_URL");
  if (service) required.push("SUPABASE_SERVICE_ROLE_KEY");
  if (anon) required.push("NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");
  if (password) required.push("E2E_TEST_USER_PASSWORD");
  const missing = [...new Set(required)].filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`BLOCKED: missing local test variables: ${missing.join(", ")}.`);
  if (supabase) {
    validateLocalHttp("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_API_PORT);
    validateLocalHttp("SUPABASE_URL", process.env.SUPABASE_URL, SUPABASE_API_PORT);
    if (process.env.NEXT_PUBLIC_SUPABASE_URL !== process.env.SUPABASE_URL) throw new Error("BLOCKED: Supabase URLs must match.");
  }
  if (database) validateLocalDb("DATABASE_URL", process.env.DATABASE_URL);
  if (migration) validateLocalDb("MIGRATION_DATABASE_URL", process.env.MIGRATION_DATABASE_URL);
  if (database && migration && process.env.DATABASE_URL !== process.env.MIGRATION_DATABASE_URL) throw new Error("BLOCKED: DATABASE_URL and MIGRATION_DATABASE_URL must match.");
  if (app) validateLocalHttp("E2E_BASE_URL", process.env.E2E_BASE_URL ?? `http://127.0.0.1:${APP_PORT}`, APP_PORT);
  if (api) validateLocalHttp("TEST_API_BASE_URL", process.env.TEST_API_BASE_URL ?? `http://127.0.0.1:${API_PORT}`, API_PORT);
}
