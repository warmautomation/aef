import { readFile } from 'fs/promises';
import { join } from 'path';
import type { AEFEntry } from '../types.js';

const FIXTURES_DIR = join(import.meta.dir, 'fixtures');

/**
 * Load a fixture file and parse it into AEF entries
 */
export async function loadFixture(relativePath: string): Promise<AEFEntry[]> {
  const filePath = join(FIXTURES_DIR, relativePath);
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim() !== '');
  return lines.map((line) => JSON.parse(line) as AEFEntry);
}

/**
 * Load a fixture file and return raw lines (for testing stream validation)
 */
export async function loadFixtureLines(relativePath: string): Promise<string[]> {
  const filePath = join(FIXTURES_DIR, relativePath);
  const content = await readFile(filePath, 'utf-8');
  return content.split('\n').filter((line) => line.trim() !== '');
}
