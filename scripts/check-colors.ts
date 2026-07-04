import { execSync } from 'node:child_process';

const colors = [
  'slate',
  'gray',
  'zinc',
  'neutral',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'purple',
  'fuchsia',
  'pink',
  'rose',
  'white',
  'black',
];

const prefixes = [
  'bg',
  'text',
  'border',
  'ring',
  'outline',
  'fill',
  'stroke',
  'decoration',
  'accent',
  'from',
  'via',
  'to',
  'shadow',
];

const colorPattern = `(${colors.join('|')})`;
const prefixPattern = `(${prefixes.join('|')})`;

// Matches things like text-red-500, bg-zinc-100/50, or bg-[#ff0000]
const tailwindColorRegex = `\\b${prefixPattern}-(${colorPattern}(-[0-9]+)?(\\/[0-9]+)?|\\[#?[a-fA-F0-9]+\\])\\b`;

// Matches things like style="color: #fff" or style="background: rgb(...)" or style="color: red"
const inlineStyleRegex = `style="[^"]*(#[0-9a-fA-F]{3,8}|rgb\\(|rgba\\(|hsl\\(|hsla\\(|oklch\\(|\\b(red|green|blue|orange|amber|emerald|zinc|slate|white|black|cyan|sky|indigo|teal|rose)\\b)`;

console.log('Checking for non-theme Tailwind colors and inline style colors...');

try {
  const output = execSync(
    `rg -e '${tailwindColorRegex}' -e '${inlineStyleRegex}' src --glob '!src/routes/layout.css' --line-number --color never`,
    {
      encoding: 'utf-8',
    },
  );

  if (output) {
    console.log('\nFound potential color or inline style violations:\n');
    console.log(output);
    console.log(
      '\nPlease use theme variables defined in src/routes/layout.css instead (e.g., text-primary, bg-background, border-border) rather than hardcoded colors.',
    );
    process.exit(1);
  } else {
    console.log('\nNo color violations found!');
  }
} catch (error: unknown) {
  if (error && typeof error === 'object' && 'status' in error && error.status === 1) {
    console.log('\nNo color violations found!');
  } else {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error running check:', message);
    process.exit(1);
  }
}
