#!/usr/bin/env bun
/**
 * AEF CLI
 *
 * Command-line interface for AEF utilities.
 */

import { resolve } from 'node:path';
import { Command } from 'commander';
import { validateAEFFile } from './validator.js';
import { validateSemantics, type SemanticValidationResult } from './semantic-validator.js';
import { reactpocAdapter } from './adapters/reactpoc.js';
import { claudeCodeAdapter } from './adapters/claude-code.js';
import { generateHtml } from './viewer/html.js';
import { PluginRegistry } from './viewer/registry.js';
import type { ViewerPlugin } from './viewer/plugin.js';
import type { LogAdapter } from './adapters/adapter.js';
import type { AEFEntry, SessionStart, Message } from './types.js';
import type { ViewerOptions } from './viewer/types.js';

const program = new Command();

program
  .name('aef')
  .description('Agent Event Format utilities')
  .version('0.1.0');

program
  .command('validate <file>')
  .description('Validate an AEF JSONL file')
  .option('--no-semantic', 'Skip semantic validation')
  .action(async (file: string, options: { semantic: boolean }) => {
    console.log(`Validating ${file}...`);

    // Syntactic validation
    const syntacticResult = await validateAEFFile(file);

    const validCount = syntacticResult.stats.core + syntacticResult.stats.extension;
    console.log(`\nSyntactic: ${syntacticResult.stats.total} entries, ${validCount} valid, ${syntacticResult.stats.invalid} invalid`);

    if (!syntacticResult.valid) {
      console.error(`\nSyntactic errors:`);
      for (const [line, errors] of syntacticResult.lineErrors) {
        console.error(`  Line ${line}:`);
        for (const err of errors) {
          console.error(`    - ${err}`);
        }
      }
    }

    // Semantic validation (if enabled and syntactic passed)
    let semanticResult: SemanticValidationResult | undefined;
    if (options.semantic && syntacticResult.valid) {
      // Re-read file and parse entries for semantic validation
      const fileHandle = Bun.file(file);
      const text = await fileHandle.text();
      const lines = text.split('\n').filter((line) => line.trim() !== '');
      const entries: AEFEntry[] = lines.map((line) => JSON.parse(line) as AEFEntry);

      semanticResult = validateSemantics(entries);

      console.log(`Semantic:  ${semanticResult.errors.length} errors, ${semanticResult.warnings.length} warnings`);

      if (semanticResult.errors.length > 0) {
        console.error(`\nSemantic errors:`);
        for (const error of semanticResult.errors) {
          console.error(`  [${error.rule}] ${error.specRef}: ${error.message}`);
          console.error(`    Affected: ${error.entryIds.join(', ')}`);
        }
      }

      if (semanticResult.warnings.length > 0) {
        console.warn(`\nSemantic warnings:`);
        for (const warning of semanticResult.warnings) {
          console.warn(`  [${warning.rule}] ${warning.specRef}: ${warning.message}`);
        }
      }
    }

    // Exit code
    const valid = syntacticResult.valid && (!semanticResult || semanticResult.valid);
    if (valid) {
      console.log('\n✓ Valid AEF file');
      process.exit(0);
    } else {
      console.error('\n✗ Invalid AEF file');
      process.exit(1);
    }
  });

program
  .command('convert <file>')
  .description('Convert a log file to AEF format')
  .option('-a, --adapter <name>', 'Adapter to use (reactpoc, claude-code)', 'reactpoc')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(async (file: string, options: { adapter: string; output?: string }) => {
    const adapters: Record<string, LogAdapter<AsyncIterable<string>>> = {
      reactpoc: reactpocAdapter,
      'claude-code': claudeCodeAdapter,
    };

    const adapter = adapters[options.adapter];
    if (!adapter) {
      console.error(`Unknown adapter: ${options.adapter}`);
      console.error(`Available: ${Object.keys(adapters).join(', ')}`);
      process.exit(1);
    }

    console.log(`Converting ${file} using ${adapter.name} adapter...`);

    const fileHandle = Bun.file(file);
    const text = await fileHandle.text();
    const lines = text.split('\n');

    async function* lineGenerator(): AsyncIterable<string> {
      for (const line of lines) {
        yield line;
      }
    }

    const entries: string[] = [];
    for await (const entry of adapter.parse(lineGenerator())) {
      entries.push(JSON.stringify(entry));
    }

    const output = entries.join('\n') + '\n';

    if (options.output) {
      await Bun.write(options.output, output);
      console.log(`Wrote ${entries.length} AEF entries to ${options.output}`);
    } else {
      console.log(output);
    }
  });

program
  .command('view <file>')
  .description('Generate HTML viewer for an AEF JSONL file')
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .option('--theme <theme>', 'Color theme (light, dark)', 'light')
  .option('--collapsed', 'Collapse tool results by default')
  .option('--plugin <path...>', 'Plugin file(s) to load')
  .action(async (file: string, options: { output?: string; theme: string; collapsed?: boolean; plugin?: string[] }) => {
    // Create registry and load plugins
    const registry = new PluginRegistry();

    if (options.plugin) {
      for (const pluginPath of options.plugin) {
        try {
          // Resolve relative paths to absolute
          const absolutePath = resolve(process.cwd(), pluginPath);
          const module = await import(absolutePath);
          const plugin: ViewerPlugin = module.default || module;
          registry.register(plugin);
          console.error(`Loaded plugin: ${plugin.name}`);
        } catch (err) {
          console.error(`Failed to load plugin ${pluginPath}:`, err);
          process.exit(1);
        }
      }

      // Initialize all registered plugins
      await registry.initialize();
    }

    const fileHandle = Bun.file(file);
    const text = await fileHandle.text();
    const lines = text.split('\n').filter((line) => line.trim() !== '');
    const entries: AEFEntry[] = lines.map((line) => JSON.parse(line) as AEFEntry);

    const viewerOptions: ViewerOptions = {
      theme: options.theme as 'light' | 'dark',
      collapsedTools: options.collapsed ?? false,
    };

    const html = generateHtml(entries, viewerOptions, registry);

    if (options.output) {
      await Bun.write(options.output, html);
      console.error(`Wrote HTML viewer to ${options.output}`);
    } else {
      console.log(html);
    }
  });

program
  .command('info <file>')
  .description('Display metadata about an AEF JSONL file')
  .option('--json', 'Output in JSON format')
  .action(async (file: string, options: { json?: boolean }) => {
    const fileHandle = Bun.file(file);
    const size = fileHandle.size;
    const text = await fileHandle.text();
    const lines = text.split('\n').filter((line) => line.trim() !== '');
    const entries: AEFEntry[] = lines.map((line) => JSON.parse(line) as AEFEntry);

    // Gather metadata
    const typeCounts: Record<string, number> = {};
    const sessions = new Set<string>();
    const agents = new Set<string>();
    const models = new Set<string>();
    let minTs = Infinity;
    let maxTs = -Infinity;

    for (const entry of entries) {
      typeCounts[entry.type] = (typeCounts[entry.type] || 0) + 1;
      sessions.add(entry.sid);
      if (entry.ts < minTs) minTs = entry.ts;
      if (entry.ts > maxTs) maxTs = entry.ts;

      if (entry.type === 'session.start') {
        const session = entry as SessionStart;
        if (session.agent) agents.add(session.agent);
        if (session.model) models.add(session.model);
      }

      // Also check for model in message entries
      if (entry.type === 'message') {
        const message = entry as Message;
        if (message.model) models.add(message.model);
      }
    }

    const duration = maxTs > minTs ? maxTs - minTs : 0;

    const info = {
      file: file,
      size: size,
      entries: entries.length,
      sessions: sessions.size,
      types: typeCounts,
      timeRange: {
        start: minTs !== Infinity ? new Date(minTs).toISOString() : null,
        end: maxTs !== -Infinity ? new Date(maxTs).toISOString() : null,
        durationMs: duration,
      },
      agents: [...agents],
      models: [...models],
    };

    if (options.json) {
      console.log(JSON.stringify(info, null, 2));
    } else {
      console.log(`File: ${info.file}`);
      console.log(`Size: ${formatBytes(info.size)}`);
      console.log(`Entries: ${info.entries}`);
      console.log(`Sessions: ${info.sessions}`);
      console.log(`\nEntry Types:`);
      for (const [type, count] of Object.entries(info.types).sort()) {
        console.log(`  ${type}: ${count}`);
      }
      if (info.timeRange.start && info.timeRange.end) {
        console.log(`\nTime Range:`);
        console.log(`  Start: ${info.timeRange.start}`);
        console.log(`  End: ${info.timeRange.end}`);
        console.log(`  Duration: ${formatDuration(info.timeRange.durationMs)}`);
      }
      if (info.agents.length > 0) {
        console.log(`\nAgents: ${info.agents.join(', ')}`);
      }
      if (info.models.length > 0) {
        console.log(`Models: ${info.models.join(', ')}`);
      }
    }
  });

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

program.parse();
