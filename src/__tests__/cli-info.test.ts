// src/__tests__/cli-info.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { $ } from 'bun';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('aef info command', () => {
  let tmpDir: string;
  let testFile: string;

  beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'aef-test-'));
    testFile = join(tmpDir, 'test.jsonl');

    const entries = [
      '{"v":1,"id":"s1","ts":1704067200000,"type":"session.start","sid":"test","agent":"claude-code","model":"claude-3-opus"}',
      '{"v":1,"id":"m1","ts":1704067201000,"type":"message","sid":"test","role":"user","content":"Hello"}',
      '{"v":1,"id":"t1","ts":1704067202000,"type":"tool.call","sid":"test","tool":"Read","args":{"file":"test.ts"}}',
      '{"v":1,"id":"t2","ts":1704067203000,"type":"tool.result","sid":"test","tool":"Read","success":true,"result":"content"}',
      '{"v":1,"id":"m2","ts":1704067204000,"type":"message","sid":"test","role":"assistant","content":"Done"}',
      '{"v":1,"id":"s2","ts":1704067300000,"type":"session.end","sid":"test","status":"complete"}',
    ];
    await writeFile(testFile, entries.join('\n'));
  });

  afterAll(async () => {
    await rm(tmpDir, { recursive: true });
  });

  it('displays human-readable info by default', async () => {
    const result = await $`bun src/cli.ts info ${testFile}`.quiet();
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    expect(output).toContain('File:');
    expect(output).toContain('Entries: 6');
    expect(output).toContain('Sessions: 1');
    expect(output).toContain('Entry Types:');
    expect(output).toContain('session.start: 1');
    expect(output).toContain('message: 2');
    expect(output).toContain('tool.call: 1');
    expect(output).toContain('tool.result: 1');
    expect(output).toContain('Time Range:');
    expect(output).toContain('Agents: claude-code');
    expect(output).toContain('Models: claude-3-opus');
  });

  it('outputs JSON with --json flag', async () => {
    const result = await $`bun src/cli.ts info ${testFile} --json`.quiet();
    expect(result.exitCode).toBe(0);
    const info = JSON.parse(result.stdout.toString());
    expect(info.entries).toBe(6);
    expect(info.sessions).toBe(1);
    expect(info.types['session.start']).toBe(1);
    expect(info.types['message']).toBe(2);
    expect(info.types['tool.call']).toBe(1);
    expect(info.types['tool.result']).toBe(1);
    expect(info.agents).toContain('claude-code');
    expect(info.models).toContain('claude-3-opus');
    expect(info.timeRange.durationMs).toBe(100000);
  });

  it('handles multiple sessions', async () => {
    const multiSessionFile = join(tmpDir, 'multi.jsonl');
    const entries = [
      '{"v":1,"id":"s1","ts":1704067200000,"type":"session.start","sid":"sess1","agent":"agent1"}',
      '{"v":1,"id":"s2","ts":1704067300000,"type":"session.start","sid":"sess2","agent":"agent2"}',
      '{"v":1,"id":"s3","ts":1704067400000,"type":"session.end","sid":"sess1","status":"complete"}',
      '{"v":1,"id":"s4","ts":1704067500000,"type":"session.end","sid":"sess2","status":"complete"}',
    ];
    await writeFile(multiSessionFile, entries.join('\n'));

    const result = await $`bun src/cli.ts info ${multiSessionFile} --json`.quiet();
    const info = JSON.parse(result.stdout.toString());
    expect(info.sessions).toBe(2);
    expect(info.agents).toContain('agent1');
    expect(info.agents).toContain('agent2');
  });

  it('handles models in message entries', async () => {
    const multiModelFile = join(tmpDir, 'models.jsonl');
    const entries = [
      '{"v":1,"id":"s1","ts":1704067200000,"type":"session.start","sid":"test","agent":"test","model":"model1"}',
      '{"v":1,"id":"m1","ts":1704067201000,"type":"message","sid":"test","role":"assistant","content":"Hi","model":"model2"}',
      '{"v":1,"id":"s2","ts":1704067300000,"type":"session.end","sid":"test","status":"complete"}',
    ];
    await writeFile(multiModelFile, entries.join('\n'));

    const result = await $`bun src/cli.ts info ${multiModelFile} --json`.quiet();
    const info = JSON.parse(result.stdout.toString());
    expect(info.models).toContain('model1');
    expect(info.models).toContain('model2');
  });

  it('handles empty file gracefully', async () => {
    const emptyFile = join(tmpDir, 'empty.jsonl');
    await writeFile(emptyFile, '');

    const result = await $`bun src/cli.ts info ${emptyFile} --json`.quiet();
    expect(result.exitCode).toBe(0);
    const info = JSON.parse(result.stdout.toString());
    expect(info.entries).toBe(0);
    expect(info.sessions).toBe(0);
    expect(info.timeRange.start).toBeNull();
    expect(info.timeRange.end).toBeNull();
  });
});
