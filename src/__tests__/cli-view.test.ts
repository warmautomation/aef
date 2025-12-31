// src/__tests__/cli-view.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { $ } from 'bun';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('aef view command', () => {
  let tmpDir: string;
  let testFile: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'aef-test-'));
    testFile = join(tmpDir, 'test.jsonl');

    const entries = [
      '{"v":1,"id":"s1","ts":1704067200000,"type":"session.start","sid":"test","agent":"test-agent"}',
      '{"v":1,"id":"m1","ts":1704067201000,"type":"message","sid":"test","role":"user","content":"Hello"}',
      '{"v":1,"id":"s2","ts":1704067300000,"type":"session.end","sid":"test","status":"complete"}',
    ];
    await writeFile(testFile, entries.join('\n'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it('generates HTML to stdout by default', async () => {
    const result = await $`bun src/cli.ts view ${testFile}`.quiet();
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('test-agent');
    expect(output).toContain('Hello');
  });

  it('writes to file with -o option', async () => {
    const outFile = join(tmpDir, 'output.html');
    const result = await $`bun src/cli.ts view ${testFile} -o ${outFile}`.quiet();
    expect(result.exitCode).toBe(0);
    const content = await Bun.file(outFile).text();
    expect(content).toContain('<!DOCTYPE html>');
  });

  it('supports dark theme', async () => {
    const result = await $`bun src/cli.ts view ${testFile} --theme dark`.quiet();
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain('#1e1e1e');
  });
});

describe('aef view with plugins', () => {
  let tmpDir: string;
  let testFile: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'aef-test-'));
    testFile = join(tmpDir, 'test.jsonl');

    const entries = [
      '{"v":1,"id":"s1","ts":1704067200000,"type":"session.start","sid":"test","agent":"test-agent"}',
      '{"v":1,"id":"m1","ts":1704067201000,"type":"message","sid":"test","role":"user","content":"Hello"}',
      '{"v":1,"id":"s2","ts":1704067300000,"type":"session.end","sid":"test","status":"complete"}',
    ];
    await writeFile(testFile, entries.join('\n'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it('loads plugin from file path', async () => {
    const pluginFile = join(tmpDir, 'test-plugin.ts');
    await writeFile(pluginFile, `
      export default {
        namespace: 'test.*',
        name: 'Test Plugin',
        styles: '.test-plugin-loaded { display: block; }',
      };
    `);

    const result = await $`bun src/cli.ts view ${testFile} --plugin ${pluginFile}`.quiet();
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain('test-plugin-loaded');
  });
});
