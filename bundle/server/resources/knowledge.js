/**
 * ServalSheets - Knowledge Resources
 *
 * Registers embedded knowledge files as MCP resources.
 * These resources provide Claude with deep context about:
 * - Google Sheets API patterns
 * - Formula recipes and best practices
 * - Template structures
 * - Data schemas
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
/**
 * Recursively discovers all knowledge files in the knowledge directory.
 */
function discoverKnowledgeFiles(baseDir) {
    const resources = [];
    function walkDir(dir, category = 'general') {
        if (!existsSync(dir))
            return;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                // Use directory name as category
                walkDir(fullPath, entry.name);
            }
            else if (entry.name.endsWith('.md') || entry.name.endsWith('.json')) {
                const relativePath = relative(baseDir, fullPath);
                const uri = `knowledge:///${relativePath.replace(/\\/g, '/')}`;
                const baseName = entry.name.replace(/\.(md|json)$/, '');
                const title = baseName
                    .replace(/-/g, ' ')
                    .replace(/_/g, ' ')
                    .split(' ')
                    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                const mimeType = entry.name.endsWith('.json') ? 'application/json' : 'text/markdown';
                const description = getResourceDescription(category, baseName);
                resources.push({
                    uri,
                    name: title,
                    description,
                    path: fullPath,
                    mimeType,
                    category,
                });
            }
        }
    }
    walkDir(baseDir);
    return resources;
}
/**
 * Generates a description based on category and file name.
 */
function getResourceDescription(category, baseName) {
    // Special descriptions for specific files
    if (baseName === 'workflow-patterns') {
        return 'Common multi-tool workflows and best practices for efficient Google Sheets automation';
    }
    if (baseName === 'user-intent-examples') {
        return 'Natural language examples mapping user intents to tool sequences';
    }
    if (baseName === 'natural-language-guide') {
        return 'Guide for understanding user requests and selecting appropriate tools';
    }
    const categoryDescriptions = {
        api: 'Google Sheets API reference and patterns',
        formulas: 'Formula recipes and examples',
        schemas: 'Data structure definitions',
        templates: 'Pre-built spreadsheet templates',
        general: 'ServalSheets knowledge base',
    };
    const baseDescription = categoryDescriptions[category] || categoryDescriptions['general'];
    return `${baseDescription}: ${baseName.replace(/-/g, ' ')}`;
}
/**
 * Registers all knowledge resources with the MCP server.
 */
export function registerKnowledgeResources(server) {
    const knowledgeDir = join(__dirname, '../knowledge');
    if (!existsSync(knowledgeDir)) {
        // Use console.error to write to stderr (not stdout in STDIO mode)
        console.error('[ServalSheets] Knowledge directory not found at:', knowledgeDir);
        console.error('[ServalSheets] Skipping knowledge resource registration');
        return 0;
    }
    const resources = discoverKnowledgeFiles(knowledgeDir);
    if (resources.length === 0) {
        console.error('[ServalSheets] No knowledge files found');
        return 0;
    }
    // Group resources by category for logging
    const byCategory = resources.reduce((acc, r) => {
        acc[r.category] = (acc[r.category] || 0) + 1;
        return acc;
    }, {});
    console.error('[ServalSheets] Discovered knowledge resources:');
    for (const [cat, count] of Object.entries(byCategory)) {
        console.error(`  - ${cat}: ${count} files`);
    }
    // Register each resource
    for (const resource of resources) {
        server.registerResource(resource.name, resource.uri, {
            description: resource.description,
            mimeType: resource.mimeType,
        }, async () => {
            try {
                const content = readFileSync(resource.path, 'utf-8');
                return {
                    contents: [
                        {
                            uri: resource.uri,
                            mimeType: resource.mimeType,
                            text: content,
                        },
                    ],
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                return {
                    contents: [
                        {
                            uri: resource.uri,
                            mimeType: 'text/plain',
                            text: `Error reading knowledge resource: ${errorMessage}`,
                        },
                    ],
                };
            }
        });
    }
    console.error(`[ServalSheets] Registered ${resources.length} knowledge resources`);
    return resources.length;
}
/**
 * Returns a list of all available knowledge resources (for introspection).
 */
export function listKnowledgeResources() {
    const knowledgeDir = join(__dirname, '../knowledge');
    if (!existsSync(knowledgeDir)) {
        return [];
    }
    return discoverKnowledgeFiles(knowledgeDir);
}
//# sourceMappingURL=knowledge.js.map