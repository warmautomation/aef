#!/usr/bin/env bun
/**
 * ALF CLI
 *
 * Command-line interface for ALF utilities.
 */

import { Command } from 'commander';
import { validateALFFile } from './validator.js';
import { reactpocAdapter } from './adapters/reactpoc.js';
import { claudeCodeAdapter } from './adapters/claude-code.js';
import type { LogAdapter } from './adapters/adapter.js';

const program = new Command();

program
  .name('alf')
  .description('Agent Log Format utilities')
  .version('0.1.0');

program
  .command('validate <file>')
  .description('Validate an ALF JSONL file')
  .action(async (file: string) => {
    console.log(`Validating ${file}...`);
    const result = await validateALFFile(file);

    if (result.valid) {
      console.log('Valid ALF file');
      process.exit(0);
    } else {
      console.error(`Found ${result.lineErrors.size} invalid entries:`);
      for (const [line, errors] of result.lineErrors) {
        console.error(`  Line ${line}:`);
        for (const err of errors) {
          console.error(`    - ${err}`);
        }
      }
      process.exit(1);
    }
  });

program
  .command('convert <file>')
  .description('Convert a log file to ALF format')
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
      console.log(`Wrote ${entries.length} ALF entries to ${options.output}`);
    } else {
      console.log(output);
    }
  });

program.parse();
