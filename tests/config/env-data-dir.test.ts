import { afterEach, describe, expect, it } from 'vitest';
import { getSessionStoreConfig, resetEnvForTest, validateEnv } from '../../src/config/env.js';

const originalEnv = { ...process.env };

describe('env DATA_DIR durability policy', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    resetEnvForTest();
  });

  it('allows the default temporary DATA_DIR outside production', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
    };

    const env = validateEnv(true);
    expect(env.DATA_DIR).toBe('/tmp/servalsheets');
  });

  it('rejects temporary DATA_DIR in production', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      DATA_DIR: '/tmp/servalsheets',
      GOOGLE_SERVICE_ACCOUNT_KEY: '{"type":"service_account"}',
    };

    expect(() => validateEnv(true)).toThrow(/DATA_DIR must point to persistent storage in production/i);
  });

  it('rejects temporary profile storage in production', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      DATA_DIR: '/var/lib/servalsheets',
      PROFILE_STORAGE_DIR: '/tmp/servalsheets-profiles',
      GOOGLE_SERVICE_ACCOUNT_KEY: '{"type":"service_account"}',
    };

    expect(() => validateEnv(true)).toThrow(
      /PROFILE_STORAGE_DIR must point to persistent storage in production/i
    );
  });

  it('rejects temporary checkpoint storage when checkpoints are enabled in production', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      DATA_DIR: '/var/lib/servalsheets',
      PROFILE_STORAGE_DIR: '/var/lib/servalsheets-profiles',
      ENABLE_CHECKPOINTS: 'true',
      CHECKPOINT_DIR: '/tmp/servalsheets-checkpoints',
      GOOGLE_SERVICE_ACCOUNT_KEY: '{"type":"service_account"}',
    };

    expect(() => validateEnv(true)).toThrow(
      /CHECKPOINT_DIR must point to persistent storage when checkpoints are enabled in production/i
    );
  });

  it('accepts a persistent DATA_DIR in production', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      DATA_DIR: '/var/lib/servalsheets',
      PROFILE_STORAGE_DIR: '/var/lib/servalsheets-profiles',
      GOOGLE_SERVICE_ACCOUNT_KEY: '{"type":"service_account"}',
    };

    expect(validateEnv(true).DATA_DIR).toBe('/var/lib/servalsheets');
  });

  it('accepts redis:// session store URLs', () => {
    process.env = {
      ...originalEnv,
      SESSION_STORE_TYPE: 'redis',
      REDIS_URL: 'redis://localhost:6379/0',
    };

    validateEnv(true);

    expect(getSessionStoreConfig()).toEqual({
      type: 'redis',
      redisUrl: 'redis://localhost:6379/0',
    });
  });

  it('accepts rediss:// session store URLs', () => {
    process.env = {
      ...originalEnv,
      SESSION_STORE_TYPE: 'redis',
      REDIS_URL: 'rediss://cache.example.com:6379',
    };

    validateEnv(true);

    expect(getSessionStoreConfig()).toEqual({
      type: 'redis',
      redisUrl: 'rediss://cache.example.com:6379',
    });
  });

  it('rejects non-redis URLs when redis session store is selected', () => {
    process.env = {
      ...originalEnv,
      SESSION_STORE_TYPE: 'redis',
      REDIS_URL: 'https://cache.example.com:6379',
    };

    expect(() => validateEnv(true)).toThrow(
      /redis.*url|REDIS_URL/i
    );
  });
});
