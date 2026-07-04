export const judge0ToLanguageMap: Record<number, string> = {
  45: 'x86asm',
  46: 'bash',
  47: 'basic',
  48: 'c',
  49: 'c',
  50: 'c',
  51: 'csharp',
  52: 'cpp',
  53: 'cpp',
  54: 'cpp',
  55: 'lisp',
  56: 'd',
  57: 'elixir',
  58: 'erlang',
  59: 'fortran',
  60: 'go',
  61: 'haskell',
  62: 'java',
  63: 'javascript',
  64: 'lua',
  65: 'ocaml',
  67: 'pascal',
  68: 'php',
  69: 'prolog',
  70: 'python',
  71: 'python',
  72: 'ruby',
  73: 'rust',
  74: 'typescript',
  75: 'c',
  76: 'cpp',
  77: 'cobol',
  78: 'kotlin',
  79: 'objc',
  80: 'r',
  81: 'scala',
  82: 'sql',
  83: 'swift',
  84: 'vb',
  85: 'perl',
  86: 'clojure',
  87: 'fsharp',
  88: 'groovy',
};

/**
 * Returns the language identifier for syntax highlighting (Shiki, Tiptap, etc.)
 * based on the Judge0 language ID.
 */
export function getLanguageName(judge0Id: string | number | undefined): string {
  if (judge0Id == null) return 'plaintext';
  const id = typeof judge0Id === 'string' ? parseInt(judge0Id, 10) : judge0Id;
  return judge0ToLanguageMap[id] || 'plaintext';
}

/**
 * Specifically for Shiki highlighting, sometimes names differ slightly or need normalized keys.
 */
export function getShikiLang(judge0Id: string | number | undefined): string {
  const lang = getLanguageName(judge0Id);
  if (lang === 'typescript') return 'typescript';
  return lang;
}
