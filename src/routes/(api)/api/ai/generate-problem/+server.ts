import { createOpenAI } from '@ai-sdk/openai';
import { json } from '@sveltejs/kit';
import { extractJsonMiddleware, streamObject, wrapLanguageModel } from 'ai';
import { z } from 'zod';

import { env } from '$env/dynamic/private';

let hasCheckedModels = false;

export async function POST({ request }) {
  try {
    const apiKey = env.OPENAI_API_KEY || '';
    const baseURL = env.OPENAI_BASE_URL || undefined;
    const modelName = env.OPENAI_MODEL || 'gpt-4o-mini';

    if (!hasCheckedModels) {
      hasCheckedModels = true;
      console.log('[AI Config]', {
        hasApiKey: !!apiKey,
        apiKeyPrefix: apiKey ? apiKey.substring(0, 7) + '...' : 'none',
        baseURL,
        modelName,
      });

      if (baseURL) {
        try {
          const modelsUrl = baseURL.endsWith('/') ? `${baseURL}models` : `${baseURL}/models`;
          console.log('[AI Fetching Models from]', modelsUrl);
          const modelsRes = await fetch(modelsUrl, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          });
          if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            const modelsList = modelsData.data || [];
            const exists = modelsList.some((m: any) => m.id === modelName);
            console.log(
              `[AI Model Validation] Model "${modelName}" ${exists ? 'exists' : 'does NOT exist'} in the provider's model list.`,
            );
          } else {
            console.error('[AI Models Fetch Failed]:', modelsRes.status, await modelsRes.text());
          }
        } catch (modelsErr) {
          console.error('[AI Models Fetch Error]:', modelsErr);
        }
      }
    }

    const openai = createOpenAI({
      apiKey,
      baseURL: baseURL || undefined,
      fetch: async (url, options) => {
        console.log('[AI Fetch Interceptor Request]', url.toString(), options ? options.method : 'GET');
        if (options && options.body) {
          console.log('[AI Fetch Interceptor Body]', options.body.toString());
          try {
            const body = JSON.parse(options.body as string);
            if (body.response_format && body.response_format.type === 'json_schema') {
              console.log('[AI Fetch Interceptor] MATCHED json_schema. Rewriting to json_object...');
              body.response_format = { type: 'json_object' };
              options.body = JSON.stringify(body);
            } else {
              console.log('[AI Fetch Interceptor] Passed request without modification.');
            }
          } catch (e) {
            console.error('[AI Fetch Interceptor JSON Parse Error]', e);
          }
        }
        return fetch(url, options);
      },
    });

    const { prompt, currentTitle } = await request.json();

    if (!prompt) {
      return json({ error: 'Prompt is required' }, { status: 400 });
    }

    console.log('[AI Request Starting] Calling streamObject...');

    const result = await streamObject({
      model: wrapLanguageModel({
        model: openai.chat(modelName),
        middleware: extractJsonMiddleware(),
      }),
      system: `You are a competitive programming teacher. Your task is to read the user's idea and generate a formal, highly detailed programming problem.
You MUST output a JSON object with the following keys and structure:
{
  "title": "A concise and clear title for the problem.",
  "contentMd": "HTML formatted string. Use standard HTML tags for structure, but use $ and $$ delimiters for math.",
  "testCases": [
    {
      "inputData": "The exact standard input for the test case.",
      "outputData": "The exact standard output for the test case."
    }
  ]
}

Enforce these strict HTML formatting rules for the problem description (contentMd):
1. Do NOT include a "Description" or "Problem Statement" heading. Start the description text immediately with standard <p> tags.
2. Use <h2> tags for the section headers: "Input", "Output", and "Example".
3. Inside the Example section, use <p>Input:</p> followed by <pre class="rounded-md p-4 bg-muted/50 font-mono text-sm overflow-x-auto my-4 border border-border shadow-sm"><code>[data]</code></pre>, then <p>Output:</p> followed by <pre class="rounded-md p-4 bg-muted/50 font-mono text-sm overflow-x-auto my-4 border border-border shadow-sm"><code>[data]</code></pre>.
4. CRITICAL: For math formatting, ALWAYS use raw $math$ (inline) and $$math$$ (block) delimiters. Never generate raw KaTeX/MathML HTML spans.
5. If a test case has no input, strictly set \`inputData\` to an empty string "". NEVER output the literal text "[Empty Input]".
6. Because you are responding in JSON, you MUST double-escape all LaTeX commands so they survive JSON parsing. For example, output \\\\le instead of \\le, \\\\frac instead of \\frac, and n\\\\ (1 \\\\le n) instead of n\\ (1 \\le n).

Here is the exact HTML string template you must follow:
"<p>Your task is to calculate the number of bit strings of length $n$.</p><p>For example, if $n = 3$, the correct answer is $8$, because the possible bit strings are 000, 001, 010, 011, 100, 101, 110, and 111.</p><h2>Input</h2><p>The only input line has an integer $n\\\\ (1 \\\\le n \\\\le 10^6)$.</p><h2>Output</h2><p>Print the result modulo $10^9+7$.</p><h2>Example</h2><p>Input:</p><pre class=\\"rounded-md p-4 bg-muted/50 font-mono text-sm overflow-x-auto my-4 border border-border shadow-sm\\"><code>3</code></pre><p>Output:</p><pre class=\\"rounded-md p-4 bg-muted/50 font-mono text-sm overflow-x-auto my-4 border border-border shadow-sm\\"><code>8</code></pre>"

You must also generate 3 to 5 robust edge-case test cases.`,
      prompt: `Current Title: ${currentTitle || 'None'}\nProblem Idea: ${prompt}`,
      schema: z.object({
        title: z.string().describe('A concise and clear title for the problem.'),
        contentMd: z
          .string()
          .describe(
            'HTML formatted string. Use standard HTML tags for structure, but use $ and $$ delimiters for math.',
          ),
        testCases: z
          .array(
            z.object({
              inputData: z.string().describe('The exact standard input for the test case.'),
              outputData: z.string().describe('The exact standard output for the test case.'),
            }),
          )
          .describe('An array of 3 to 5 test cases.'),
      }),
      providerOptions: {
        openai: {
          strictJsonSchema: baseURL ? false : undefined,
        },
      },
      onFinish: (event) => {
        console.log('[AI Stream Finished]', {
          hasObject: !!event.object,
          objectKeys: event.object ? Object.keys(event.object) : [],
          error: event.error ? event.error.toString() : 'none',
        });
        if (event.error) {
          console.error('[AI Stream Validation Error Detail]:', event.error);
        }
      },
    });

    return result.toTextStreamResponse({
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err: any) {
    console.error('AI Generation Error:', err);
    if (err.status) console.error('Error Status:', err.status);
    if (err.headers) console.error('Error Headers:', err.headers);
    if (err.data) console.error('Error Data:', err.data);
    if (err.response) console.error('Error Response:', err.response);
    return json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
