/**
 * Judge0 server-side utilities.
 * Never import this from client-side code — it lives in $lib/server/.
 */

import { env } from '$env/dynamic/private';

// ─── Config ─────────────────────────────────────────────────────────────────

export function getJudge0BaseUrl(): string {
  const url = env.JUDGE0_URL;
  if (!url) {
    throw new Error('JUDGE0_URL environment variable is not defined. Please set it in your .env file.');
  }
  return url.replace(/\/$/, ''); // strip trailing slash
}

function getAuthHeaders(): Record<string, string> {
  const token = env.JUDGE0_AUTH_TOKEN;
  return token ? { 'X-Auth-Token': token } : {};
}

// ─── Core fetch wrapper ──────────────────────────────────────────────────────

export async function judge0Fetch(path: string, init: RequestInit = {}): Promise<Response> {
  const base = getJudge0BaseUrl();
  const url = `${base}${path}`;

  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  for (const [k, v] of Object.entries(getAuthHeaders())) {
    headers.set(k, v);
  }

  return fetch(url, { ...init, headers });
}

// ─── Base64 helpers ──────────────────────────────────────────────────────────

export function b64encode(str: string): string {
  return Buffer.from(str, 'utf-8').toString('base64');
}

export function b64decode(encoded: string | null | undefined): string | null {
  if (!encoded) return null;
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Language {
  id: number;
  name: string;
}

export interface Status {
  id: number;
  description: string;
}

export interface SystemInfo {
  Architecture?: string;
  'CPU op-mode(s)'?: string;
  'Model name'?: string;
  Mem?: string;
  [key: string]: string | undefined;
}

export interface Statistics {
  submissions_count: number;
  statuses: {
    status: { id: number; name: string };
    count: number;
  }[];
  languages: {
    language: Language;
    count: number;
  }[];
}

export interface ConfigInfo {
  cpu_time_limit: number;
  memory_limit: number;
  max_processes_and_or_threads: number;
  maintenance_mode: boolean;
  enable_submission_delete: boolean;
  [key: string]: unknown;
}

export interface SubmissionInput {
  source_code: string;
  language_id: number;
  stdin?: string;
  expected_output?: string;
  compiler_options?: string;
  command_line_arguments?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
  wall_time_limit?: number;
  stack_limit?: number;
  number_of_runs?: number;
  redirect_stderr_to_stdout?: boolean;
  callback_url?: string;
}

export interface SubmissionResult {
  token: string;
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  exit_code: number | null;
  exit_signal: number | null;
  status: Status;
  created_at: string;
  finished_at: string | null;
  time: string | null;
  wall_time: string | null;
  memory: number | null;
  // raw base64 fields from judge0 (decoded server-side)
  source_code?: string | null;
  language?: Language;
}

export interface BatchSubmissionInput {
  submissions: SubmissionInput[];
}

export interface BatchSubmissionResult {
  submissions: SubmissionResult[];
}

// ─── Payload builders ────────────────────────────────────────────────────────

/**
 * Build a Judge0 submission payload with base64-encoded text fields.
 */
export function buildSubmissionPayload(input: SubmissionInput): Record<string, unknown> {
  return {
    ...input,
    source_code: b64encode(input.source_code),
    stdin: input.stdin != null ? b64encode(input.stdin) : undefined,
    expected_output: input.expected_output != null ? b64encode(input.expected_output) : undefined,
  };
}

/**
 * Decode base64 text fields in a submission result returned from Judge0.
 */
export function decodeSubmissionResult(raw: Record<string, unknown>): SubmissionResult {
  return {
    ...(raw as unknown as SubmissionResult),
    stdout: b64decode(raw.stdout as string | null),
    stderr: b64decode(raw.stderr as string | null),
    compile_output: b64decode(raw.compile_output as string | null),
    source_code: b64decode(raw.source_code as string | null),
  };
}

// ─── Fields to fetch when polling ────────────────────────────────────────────

export const SUBMISSION_FIELDS =
  'token,stdout,stderr,compile_output,message,exit_code,exit_signal,status,created_at,finished_at,time,wall_time,memory,language';
