import { createOpenAI } from '@ai-sdk/openai';
import { json } from '@sveltejs/kit';
import { streamObject } from 'ai';
import { z } from 'zod';

import { OPENAI_API_KEY } from '$env/static/private';
import { PUBLIC_DEMO_MODE } from '$env/static/public';

import { isDemoMode } from '$lib/demo-mode';

const demo = isDemoMode(PUBLIC_DEMO_MODE);
const openai = demo ? null : createOpenAI({ apiKey: OPENAI_API_KEY });

export async function POST({ request }) {
  if (demo) {
    console.log('[Demo Mode] AI generate-problem mock called');
    const mockData = {
      title: 'Sum of Two Numbers',
      contentMd:
        '<p>Write a program that reads two integers and prints their sum.</p><h2>Input</h2><p>The only line contains two integers $a$ and $b$.</p><h2>Output</h2><p>Print the sum of $a$ and $b$.</p><h2>Example</h2><p>Input:</p><pre class="rounded-md p-4 bg-muted/50 font-mono text-sm overflow-x-auto my-4 border border-border shadow-sm"><code>3 5</code></pre><p>Output:</p><pre class="rounded-md p-4 bg-muted/50 font-mono text-sm overflow-x-auto my-4 border border-border shadow-sm"><code>8</code></pre>',
      testCases: [
        { inputData: '3 5', outputData: '8' },
        { inputData: '0 0', outputData: '0' },
        { inputData: '100 200', outputData: '300' },
        { inputData: '-5 10', outputData: '5' },
      ],
    };

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(JSON.stringify(mockData));
        controller.close();
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/plain' } });
  }

  try {
    const { prompt, currentTitle } = await request.json();

    if (!prompt) {
      return json({ error: 'Prompt is required' }, { status: 400 });
    }

    const result = await streamObject({
      model: openai!('gpt-4o-mini'),
      system: `You are a competitive programming teacher. Your task is to read the user's idea and generate a formal, highly detailed programming problem.
Enforce these strict HTML formatting rules for the problem description:
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
    });

    return result.toTextStreamResponse();
  } catch (err: any) {
    console.error('AI Generation Error:', err);
    return json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
