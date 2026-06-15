export type Brand = 'default' | 'ocean' | 'forest' | 'violet' | 'ruby' | 'slate';

export const brands: Brand[] = ['default', 'ocean', 'forest', 'violet', 'ruby', 'slate'];

export const brandLabels: Record<Brand, string> = {
  default: 'Default',
  ocean: 'Ocean',
  forest: 'Forest',
  violet: 'Violet',
  ruby: 'Ruby',
  slate: 'Slate',
};

const STORAGE_KEY = 'stride-brand';

function getStored(): Brand | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && (brands as string[]).includes(v)) return v as Brand;
  } catch {
    /* noop */
  }
  return null;
}

let current = $state<Brand>('default');

export function getBrand(): Brand {
  return current;
}

export function setBrand(brand: Brand): void {
  current = brand;
  document.documentElement.setAttribute('data-brand', brand);
  try {
    localStorage.setItem(STORAGE_KEY, brand);
  } catch {
    /* noop */
  }
}

export function initBrand(): void {
  const stored = getStored();
  if (stored) setBrand(stored);
}
