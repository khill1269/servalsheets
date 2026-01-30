/**
 * DiscoveryClient
 *
 * @purpose Fetches Google API schemas dynamically from Discovery API v1 to detect new fields, deprecations, API version changes
 * @category Infrastructure
 * @usage Use with SchemaCache for schema validation; fetches sheets/drive API schemas, caches locally for 30 days
 * @dependencies logger
 * @stateful No - stateless HTTP client for Discovery API
 * @singleton No - can be instantiated per discovery request
 *
 * @example
 * const client = new DiscoveryClient();
 * const schema = await client.discover('sheets', 'v4'); // Fetch latest schema
 * if (schema.deprecations.length > 0) logger.warn('API has deprecations:', schema.deprecations);
 */
import { logger } from '../utils/logger.js';
/**
 * Google Discovery API Client
 */
export class DiscoveryApiClient {
    cache = new Map();
    enabled;
    cacheTTL;
    timeout;
    constructor(config = {}) {
        // Phase 2.2: Enable Discovery API by default for schema validation
        // Users can disable by setting DISCOVERY_API_ENABLED=false
        this.enabled = config.enabled ?? process.env['DISCOVERY_API_ENABLED'] !== 'false';
        this.cacheTTL = config.cacheTTL ?? parseInt(process.env['DISCOVERY_CACHE_TTL'] ?? '86400', 10);
        this.timeout = config.timeout ?? 30000;
    }
    /**
     * Check if Discovery API is enabled
     */
    isEnabled() {
        return this.enabled;
    }
    /**
     * Get API schema from Discovery API
     */
    async getApiSchema(api, version) {
        if (!this.enabled) {
            throw new Error('Discovery API is not enabled. Set DISCOVERY_API_ENABLED=true');
        }
        const cacheKey = `${api}-${version}`;
        const cached = this.cache.get(cacheKey);
        // Return cached schema if still valid
        if (cached && Date.now() < cached.expiresAt) {
            logger.debug('Using cached Discovery schema', { api, version });
            return cached.schema;
        }
        // Fetch from Discovery API
        logger.info('Fetching schema from Discovery API', { api, version });
        const baseUrl = this.getDiscoveryUrl(api, version);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(baseUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'ServalSheets/1.0 (Discovery API Client)',
                },
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`Discovery API returned ${response.status}: ${response.statusText}`);
            }
            const schema = (await response.json());
            // Cache the schema
            const now = Date.now();
            this.cache.set(cacheKey, {
                schema,
                timestamp: now,
                expiresAt: now + this.cacheTTL * 1000,
            });
            logger.info('Successfully fetched and cached Discovery schema', {
                api,
                version,
                schemaCount: Object.keys(schema.schemas || {}).length,
                resourceCount: Object.keys(schema.resources || {}).length,
            });
            return schema;
        }
        catch (error) {
            clearTimeout(timeoutId);
            const err = error;
            if (err.name === 'AbortError') {
                throw new Error(`Discovery API request timed out after ${this.timeout}ms`);
            }
            throw new Error(`Failed to fetch Discovery schema: ${err.message}`);
        }
    }
    /**
     * List available versions for an API
     */
    async listAvailableVersions(api) {
        if (!this.enabled) {
            throw new Error('Discovery API is not enabled. Set DISCOVERY_API_ENABLED=true');
        }
        const listUrl = this.getApiListUrl(api);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        try {
            const response = await fetch(listUrl, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'ServalSheets/1.0 (Discovery API Client)',
                },
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`Discovery API returned ${response.status}: ${response.statusText}`);
            }
            const data = (await response.json());
            const versions = (data.items || [])
                .filter((item) => item.name === api)
                .map((item) => item.version);
            logger.info('Listed available API versions', { api, versions });
            return versions;
        }
        catch (error) {
            clearTimeout(timeoutId);
            const err = error;
            if (err.name === 'AbortError') {
                throw new Error(`Discovery API request timed out after ${this.timeout}ms`);
            }
            throw new Error(`Failed to list API versions: ${err.message}`);
        }
    }
    /**
     * Compare current schema with a new schema
     */
    compareSchemas(api, version, currentSchema, newSchema) {
        const comparison = {
            api,
            version,
            newFields: [],
            deprecatedFields: [],
            changedFields: [],
            newMethods: [],
            removedMethods: [],
            hasChanges: false,
        };
        // Compare schemas (object types)
        this.compareSchemaObjects(currentSchema.schemas, newSchema.schemas, comparison);
        // Compare methods
        this.compareMethods(currentSchema.resources, newSchema.resources, comparison);
        comparison.hasChanges =
            comparison.newFields.length > 0 ||
                comparison.deprecatedFields.length > 0 ||
                comparison.changedFields.length > 0 ||
                comparison.newMethods.length > 0 ||
                comparison.removedMethods.length > 0;
        return comparison;
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        logger.info('Cleared Discovery API cache');
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        const entries = Array.from(this.cache.values());
        return {
            entries: entries.length,
            oldestEntry: entries.length > 0 ? Math.min(...entries.map((e) => e.timestamp)) : null,
            newestEntry: entries.length > 0 ? Math.max(...entries.map((e) => e.timestamp)) : null,
        };
    }
    /**
     * Get Discovery API URL for an API
     */
    getDiscoveryUrl(api, version) {
        if (api === 'sheets') {
            return `https://sheets.googleapis.com/$discovery/rest?version=${version}`;
        }
        else {
            return `https://www.googleapis.com/discovery/v1/apis/drive/${version}/rest`;
        }
    }
    /**
     * Get API list URL
     */
    getApiListUrl(api) {
        return `https://www.googleapis.com/discovery/v1/apis?name=${api}`;
    }
    /**
     * Compare schema objects recursively
     */
    compareSchemaObjects(currentSchemas, newSchemas, comparison, path = '') {
        if (!currentSchemas || !newSchemas)
            return;
        // Find new schemas
        for (const [name, schema] of Object.entries(newSchemas)) {
            const currentPath = path ? `${path}.${name}` : name;
            if (!currentSchemas[name]) {
                comparison.newFields.push({
                    path: currentPath,
                    type: schema.type,
                    description: schema.description || '',
                });
            }
            else {
                // Compare properties
                if (schema.properties) {
                    this.compareProperties(currentSchemas[name]?.properties, schema.properties, comparison, currentPath);
                }
                // Check for type changes
                if (schema.type !== currentSchemas[name]?.type) {
                    comparison.changedFields.push({
                        path: currentPath,
                        oldType: currentSchemas[name]?.type || 'unknown',
                        newType: schema.type,
                    });
                }
            }
            // Check for deprecation
            if (schema.deprecated && !currentSchemas[name]?.deprecated) {
                comparison.deprecatedFields.push({
                    path: currentPath,
                    deprecationMessage: schema.description || 'Field is deprecated',
                });
            }
        }
    }
    /**
     * Compare properties recursively
     */
    compareProperties(currentProps, newProps, comparison, path) {
        if (!currentProps || !newProps)
            return;
        for (const [name, prop] of Object.entries(newProps)) {
            const currentPath = `${path}.${name}`;
            if (!currentProps[name]) {
                comparison.newFields.push({
                    path: currentPath,
                    type: prop.type || prop.$ref || 'unknown',
                    description: prop.description || '',
                });
            }
            else {
                // Check for type changes
                const oldType = currentProps[name]?.type || currentProps[name]?.$ref;
                const newType = prop.type || prop.$ref;
                if (oldType && newType && oldType !== newType) {
                    comparison.changedFields.push({
                        path: currentPath,
                        oldType,
                        newType,
                    });
                }
                // Recursively compare nested properties
                if (prop.properties) {
                    this.compareProperties(currentProps[name]?.properties, prop.properties, comparison, currentPath);
                }
            }
            // Check for deprecation
            if (prop.deprecated && !currentProps[name]?.deprecated) {
                comparison.deprecatedFields.push({
                    path: currentPath,
                    deprecationMessage: prop.description || 'Property is deprecated',
                });
            }
        }
    }
    /**
     * Compare methods recursively
     */
    compareMethods(currentResources, newResources, comparison, path = '') {
        if (!currentResources || !newResources)
            return;
        for (const [resourceName, resource] of Object.entries(newResources)) {
            const currentPath = path ? `${path}.${resourceName}` : resourceName;
            if (resource.methods) {
                for (const [methodName, method] of Object.entries(resource.methods)) {
                    const methodPath = `${currentPath}.${methodName}`;
                    // Check if method exists in current schema
                    const currentMethod = currentResources[resourceName]?.methods?.[methodName];
                    if (!currentMethod) {
                        comparison.newMethods.push({
                            name: methodPath,
                            description: method.description || '',
                        });
                    }
                    else if (method.deprecated && !currentMethod.deprecated) {
                        comparison.deprecatedFields.push({
                            path: methodPath,
                            deprecationMessage: method.description || 'Method is deprecated',
                        });
                    }
                }
            }
            // Recursively compare nested resources
            if (resource.resources) {
                this.compareMethods(currentResources[resourceName]?.resources, resource.resources, comparison, currentPath);
            }
        }
        // Find removed methods
        for (const [resourceName, resource] of Object.entries(currentResources)) {
            const currentPath = path ? `${path}.${resourceName}` : resourceName;
            if (resource.methods) {
                for (const methodName of Object.keys(resource.methods)) {
                    if (!newResources[resourceName]?.methods?.[methodName]) {
                        comparison.removedMethods.push(`${currentPath}.${methodName}`);
                    }
                }
            }
            // Recursively check nested resources
            if (resource.resources && newResources[resourceName]?.resources) {
                this.compareMethods(resource.resources, newResources[resourceName]?.resources, comparison, currentPath);
            }
        }
    }
}
/**
 * Global Discovery API client instance
 */
let globalDiscoveryClient = null;
/**
 * Get or create global Discovery API client
 */
export function getDiscoveryApiClient() {
    if (!globalDiscoveryClient) {
        globalDiscoveryClient = new DiscoveryApiClient({
            // Phase 2.2: Enabled by default, disable with DISCOVERY_API_ENABLED=false
            enabled: process.env['DISCOVERY_API_ENABLED'] !== 'false',
            cacheTTL: process.env['DISCOVERY_CACHE_TTL']
                ? parseInt(process.env['DISCOVERY_CACHE_TTL'], 10)
                : undefined,
        });
    }
    return globalDiscoveryClient;
}
/**
 * Reset global Discovery API client
 */
export function resetDiscoveryApiClient() {
    if (globalDiscoveryClient) {
        globalDiscoveryClient.clearCache();
    }
    globalDiscoveryClient = null;
}
//# sourceMappingURL=discovery-client.js.map