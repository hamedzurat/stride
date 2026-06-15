/**
 * Judge0 server-side utilities.
 * Never import this from client-side code — it lives in $lib/server/.
 */

import { env } from '$env/dynamic/private';
import { PUBLIC_DEMO_MODE } from '$env/static/public';

import { isDemoMode } from '$lib/demo-mode';

// ─── Config ─────────────────────────────────────────────────────────────────

const demo = isDemoMode(PUBLIC_DEMO_MODE);

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

// ─── Mock data (demo mode) ───────────────────────────────────────────────────

const mockLanguages = [
  { id: 50, name: 'C (GCC 9.2.0)' },
  { id: 54, name: 'C++ (GCC 9.2.0)' },
  { id: 60, name: 'Go (1.13.5)' },
  { id: 62, name: 'Java (OpenJDK 13.0.1)' },
  { id: 63, name: 'JavaScript (Node.js 12.14.0)' },
  { id: 68, name: 'PHP (7.4.1)' },
  { id: 70, name: 'Python (2.7.17)' },
  { id: 71, name: 'Python (3.8.1)' },
  { id: 73, name: 'Rust (1.40.0)' },
  { id: 74, name: 'TypeScript (3.7.4)' },
];

const mockStatuses = [
  { id: 1, description: 'In Queue' },
  { id: 2, description: 'Processing' },
  { id: 3, description: 'Accepted' },
  { id: 4, description: 'Wrong Answer' },
  { id: 5, description: 'Time Limit Exceeded' },
  { id: 6, description: 'Compilation Error' },
  { id: 7, description: 'Runtime Error (SIGSEGV)' },
  { id: 8, description: 'Runtime Error (SIGXFSZ)' },
  { id: 9, description: 'Runtime Error (SIGFPE)' },
  { id: 10, description: 'Runtime Error (SIGABRT)' },
  { id: 11, description: 'Runtime Error (NZEC)' },
  { id: 12, description: 'Runtime Error (Other)' },
  { id: 13, description: 'Internal Error' },
  { id: 14, description: 'Exec Format Error' },
];

function pickStatus(): { id: number; description: string } {
  const r = Math.random();
  if (r < 0.6) return { id: 3, description: 'Accepted' };
  if (r < 0.75) return { id: 4, description: 'Wrong Answer' };
  if (r < 0.85) return { id: 5, description: 'Time Limit Exceeded' };
  if (r < 0.92) return { id: 6, description: 'Compilation Error' };
  return { id: 11, description: 'Runtime Error (NZEC)' };
}

function mockResult() {
  const status = pickStatus();
  return {
    token: crypto.randomUUID(),
    stdout: status.id === 3 ? b64encode('mock output') : null,
    stderr: status.id === 6 ? b64encode('error: expected expression') : null,
    compile_output: status.id === 6 ? b64encode('Compilation failed with errors') : null,
    message: null,
    exit_code: status.id === 3 ? 0 : 1,
    exit_signal: null,
    status,
    created_at: new Date().toISOString(),
    finished_at: new Date(Date.now() + 200).toISOString(),
    time: '0.012',
    wall_time: '0.018',
    memory: 4096,
    source_code: b64encode('print("hello")'),
  };
}

function mockResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function mockJudge0Fetch(path: string, method: string): Response {
  console.log(`[Demo Mode] Judge0 mock: ${method} ${path}`);

  if (path.startsWith('/languages')) {
    return mockResponse(mockLanguages);
  }
  if (path.startsWith('/statuses')) {
    return mockResponse(mockStatuses);
  }
  if (path.startsWith('/config')) {
    return mockResponse({ cpu_time_limit: 5, memory_limit: 256000, maintenance_mode: false });
  }
  if (path.startsWith('/system')) {
    return mockResponse({ Architecture: 'x86_64', 'Model name': 'Mock CPU' });
  }
  if (path.startsWith('/statistics')) {
    return mockResponse({ submissions_count: 0, statuses: [], languages: [] });
  }
  if (path === '/workers' || path.startsWith('/workers?')) {
    return mockResponse([{ id: 'mock-worker' }]);
  }

  if (path.startsWith('/submissions/batch')) {
    if (method === 'POST') {
      const count = 4;
      const results = Array.from({ length: count }, () => mockResult());
      return mockResponse(results.map((r) => ({ token: r.token })));
    }
    if (method === 'GET') {
      const inQueue = Array.from({ length: 4 }, () => ({
        ...mockResult(),
        status: { id: 3, description: 'Accepted' },
      }));
      return mockResponse({ submissions: inQueue });
    }
  }

  if (path.startsWith('/submissions/')) {
    return mockResponse(mockResult());
  }

  if (path.startsWith('/submissions')) {
    if (method === 'POST') {
      const isWait = path.includes('wait=true');
      if (isWait) {
        return mockResponse(mockResult());
      }
      return mockResponse({ token: crypto.randomUUID() });
    }
  }

  return mockResponse({});
}

// ─── Core fetch wrapper ──────────────────────────────────────────────────────

export async function judge0Fetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (demo) {
    return mockJudge0Fetch(path, init.method ?? 'GET');
  }

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
