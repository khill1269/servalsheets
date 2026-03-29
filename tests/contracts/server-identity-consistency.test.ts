import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';

import { getMcpConfiguration, getMcpServerCard } from '../../src/server/well-known.js';
import { SERVER_INFO, VERSION } from '../../src/version.js';

describe('Server identity consistency', () => {
  it('keeps package, registry, and runtime identities intentionally aligned', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8')) as {
      name: string;
      mcpName: string;
      version: string;
    };
    const manifestJson = JSON.parse(readFileSync('manifest.json', 'utf-8')) as {
      name: string;
      version: string;
    };
    const serverJson = JSON.parse(readFileSync('server.json', 'utf-8')) as {
      name: string;
      version: string;
      packages: Array<{ identifier: string; version: string }>;
    };

    expect(manifestJson.name).toBe(packageJson.name);
    expect(serverJson.name).toBe(packageJson.mcpName);
    expect(serverJson.packages[0]?.identifier).toBe(packageJson.name);
    expect(serverJson.version).toBe(packageJson.version);
    expect(serverJson.packages[0]?.version).toBe(packageJson.version);

    expect(SERVER_INFO.name).toBe(packageJson.name);
    expect(SERVER_INFO.version).toBe(VERSION);
    expect(SERVER_INFO.name).not.toBe(packageJson.mcpName);
  });

  it('exposes the runtime name in well-known discovery instead of the registry coordinate', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8')) as {
      mcpName: string;
    };

    const config = getMcpConfiguration();
    const card = getMcpServerCard('https://api.example.com');

    expect(config.name).toBe(SERVER_INFO.name);
    expect(card.server_name).toBe(SERVER_INFO.name);
    expect(config.name).not.toBe(packageJson.mcpName);
    expect(card.server_name).not.toBe(packageJson.mcpName);
  });
});
