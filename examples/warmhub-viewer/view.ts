#!/usr/bin/env bun
// examples/warmhub-viewer/view.ts
//
// Example script demonstrating how to use the WarmHub plugin with ALF viewer.
// Run with: bun examples/warmhub-viewer/view.ts [input.jsonl] [output.html]

import { readFileSync, writeFileSync } from 'node:fs';
import { generateHtml, PluginRegistry } from '../../src/viewer/index.js';
import type { AEFEntry } from '../../src/types.js';
import { warmhubPlugin } from './plugin.js';

const inputFile = process.argv[2] || 'examples/warmhub-viewer/sample-trace.jsonl';
const outputFile = process.argv[3] || 'warmhub-output.html';

// Read and parse the ALF JSONL file
const content = readFileSync(inputFile, 'utf-8');
const entries: AEFEntry[] = content
  .trim()
  .split('\n')
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line));

// Create a registry and register the WarmHub plugin
const registry = new PluginRegistry();
registry.register(warmhubPlugin);

console.log(`Loaded plugin: ${warmhubPlugin.name}`);
console.log(`Processing ${entries.length} entries from ${inputFile}`);

// Generate HTML with the plugin
const html = generateHtml(entries, {
  theme: 'light',
  registry,
});

// Write output
writeFileSync(outputFile, html);
console.log(`Generated: ${outputFile}`);
