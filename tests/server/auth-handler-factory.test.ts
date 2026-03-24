import { beforeEach, describe, expect, it, vi } from 'vitest';

const authHandlerFactoryMocks = vi.hoisted(() => ({
  AuthHandler: vi.fn(),
}));

vi.mock('../../src/handlers/auth.js', () => ({
  AuthHandler: authHandlerFactoryMocks.AuthHandler,
}));

import {
  createServerAuthHandler,
  ensureServerAuthHandler,
} from '../../src/server/auth-handler-factory.js';

describe('auth handler factory', () => {
  beforeEach(() => {
    authHandlerFactoryMocks.AuthHandler.mockReset();
  });

  it('creates an auth handler with null google client by default', () => {
    const created = { kind: 'auth-handler' };
    authHandlerFactoryMocks.AuthHandler.mockImplementationOnce(function MockAuthHandler() {
      return created;
    });

    const result = createServerAuthHandler();

    expect(authHandlerFactoryMocks.AuthHandler).toHaveBeenCalledWith({
      googleClient: null,
    });
    expect(result).toBe(created);
  });

  it('allows google client and elicitation overrides', () => {
    const created = { kind: 'auth-handler' };
    const googleClient = { sheets: {}, drive: {} };
    const elicitationServer = { kind: 'elicitation' };
    authHandlerFactoryMocks.AuthHandler.mockImplementationOnce(function MockAuthHandler() {
      return created;
    });

    const result = createServerAuthHandler({
      googleClient: googleClient as never,
      elicitationServer: elicitationServer as never,
    });

    expect(authHandlerFactoryMocks.AuthHandler).toHaveBeenCalledWith({
      googleClient,
      elicitationServer,
    });
    expect(result).toBe(created);
  });

  it('reuses an existing auth handler when present', () => {
    const existing = { kind: 'existing-auth-handler' } as never;

    const result = ensureServerAuthHandler(existing);

    expect(result).toBe(existing);
    expect(authHandlerFactoryMocks.AuthHandler).not.toHaveBeenCalled();
  });

  it('creates an auth handler through ensure when one is not provided', () => {
    const created = { kind: 'created-auth-handler' };
    authHandlerFactoryMocks.AuthHandler.mockImplementationOnce(function MockAuthHandler() {
      return created;
    });

    const result = ensureServerAuthHandler(null, {
      tokenStorePath: '/tmp/tokens.json',
    });

    expect(authHandlerFactoryMocks.AuthHandler).toHaveBeenCalledWith({
      googleClient: null,
      tokenStorePath: '/tmp/tokens.json',
    });
    expect(result).toBe(created);
  });
});
