/**
 * TemplateStore
 *
 * @purpose Manages spreadsheet templates using Google Drive appDataFolder
 * @category Storage
 * @usage Store, retrieve, and manage user-specific spreadsheet templates
 * @dependencies Google Drive API v3
 * @stateful No - uses Drive API for persistence
 * @singleton No - instantiated per handler
 *
 * Storage location: Google Drive appDataFolder (hidden, user-specific)
 * Required scope: https://www.googleapis.com/auth/drive.appdata
 *
 * @example
 * const store = new TemplateStore(driveApi);
 * const templates = await store.list();
 * const template = await store.get('template-id');
 */
import { logger } from '../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
/**
 * Template storage configuration
 */
const TEMPLATES_FOLDER = 'servalsheets-templates';
const TEMPLATE_MIME_TYPE = 'application/json';
const APP_DATA_SPACE = 'appDataFolder';
/**
 * Template store using Google Drive appDataFolder
 */
export class TemplateStore {
    driveApi;
    folderId = null;
    builtinTemplatesCache = null;
    constructor(driveApi) {
        this.driveApi = driveApi;
    }
    /**
     * List all user templates
     */
    async list(category) {
        await this.ensureFolder();
        try {
            const response = await this.driveApi.files.list({
                spaces: APP_DATA_SPACE,
                q: `'${this.folderId}' in parents and mimeType='${TEMPLATE_MIME_TYPE}' and trashed=false`,
                fields: 'files(id, name, description, createdTime, modifiedTime, appProperties)',
                pageSize: 100,
            });
            const files = response.data.files || [];
            const templates = [];
            for (const file of files) {
                const appProps = file.appProperties || {};
                const templateCategory = appProps['category'] || '';
                // Apply category filter if provided
                if (category && templateCategory !== category) {
                    continue;
                }
                templates.push({
                    id: file.id,
                    name: appProps['templateName'] || file.name || 'Unnamed',
                    description: file.description || undefined,
                    category: templateCategory || undefined,
                    version: appProps['version'] || '1.0.0',
                    created: file.createdTime || undefined,
                    updated: file.modifiedTime || undefined,
                    sheetCount: parseInt(appProps['sheetCount'] || '1', 10),
                });
            }
            return templates;
        }
        catch (error) {
            logger.error('Failed to list templates', { error });
            throw new Error(`Failed to list templates: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get template by ID
     */
    async get(templateId) {
        try {
            // Get file metadata
            const metaResponse = await this.driveApi.files.get({
                fileId: templateId,
                fields: 'id, name, description, appProperties, createdTime, modifiedTime',
            });
            // Get file content
            const contentResponse = await this.driveApi.files.get({
                fileId: templateId,
                alt: 'media',
            });
            const content = contentResponse.data;
            const meta = metaResponse.data;
            const appProps = meta.appProperties || {};
            return {
                id: meta.id,
                name: appProps['templateName'] || meta.name || 'Unnamed',
                description: meta.description || undefined,
                category: appProps['category'] || undefined,
                version: appProps['version'] || '1.0.0',
                created: meta.createdTime || undefined,
                updated: meta.modifiedTime || undefined,
                sheets: content.sheets || [],
                namedRanges: content.namedRanges,
                metadata: content.metadata,
            };
        }
        catch (error) {
            const err = error;
            if (err.code === 404) {
                return null;
            }
            logger.error('Failed to get template', { templateId, error });
            throw new Error(`Failed to get template: ${err.message}`);
        }
    }
    /**
     * Create new template
     */
    async create(template) {
        await this.ensureFolder();
        const now = new Date().toISOString();
        const fileContent = {
            name: template.name,
            description: template.description,
            category: template.category,
            version: template.version || '1.0.0',
            sheets: template.sheets,
            namedRanges: template.namedRanges,
            metadata: template.metadata,
        };
        try {
            const response = await this.driveApi.files.create({
                requestBody: {
                    name: `${template.name.replace(/[^a-zA-Z0-9-_]/g, '_')}.json`,
                    description: template.description,
                    mimeType: TEMPLATE_MIME_TYPE,
                    parents: [this.folderId],
                    appProperties: {
                        templateName: template.name,
                        category: template.category || '',
                        version: template.version || '1.0.0',
                        sheetCount: String(template.sheets.length),
                    },
                },
                media: {
                    mimeType: TEMPLATE_MIME_TYPE,
                    body: JSON.stringify(fileContent, null, 2),
                },
                fields: 'id, name, createdTime',
            });
            logger.info('Created template', {
                templateId: response.data.id,
                name: template.name,
            });
            return {
                ...fileContent,
                id: response.data.id,
                created: now,
                updated: now,
            };
        }
        catch (error) {
            logger.error('Failed to create template', { error });
            throw new Error(`Failed to create template: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Update existing template
     */
    async update(templateId, updates) {
        // Get existing template
        const existing = await this.get(templateId);
        if (!existing) {
            throw new Error(`Template not found: ${templateId}`);
        }
        // Merge updates
        const updated = {
            ...existing,
            name: updates.name ?? existing.name,
            description: updates.description ?? existing.description,
            category: updates.category ?? existing.category,
            version: updates.version ?? existing.version,
            sheets: updates.sheets ?? existing.sheets,
            namedRanges: updates.namedRanges ?? existing.namedRanges,
            metadata: updates.metadata ?? existing.metadata,
            updated: new Date().toISOString(),
        };
        const fileContent = {
            name: updated.name,
            description: updated.description,
            category: updated.category,
            version: updated.version,
            sheets: updated.sheets,
            namedRanges: updated.namedRanges,
            metadata: updated.metadata,
        };
        try {
            await this.driveApi.files.update({
                fileId: templateId,
                requestBody: {
                    description: updated.description,
                    appProperties: {
                        templateName: updated.name,
                        category: updated.category || '',
                        version: updated.version || '1.0.0',
                        sheetCount: String(updated.sheets.length),
                    },
                },
                media: {
                    mimeType: TEMPLATE_MIME_TYPE,
                    body: JSON.stringify(fileContent, null, 2),
                },
            });
            logger.info('Updated template', { templateId, name: updated.name });
            return updated;
        }
        catch (error) {
            logger.error('Failed to update template', { templateId, error });
            throw new Error(`Failed to update template: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Delete template
     */
    async delete(templateId) {
        try {
            // Note: appDataFolder files cannot be trashed, only permanently deleted
            await this.driveApi.files.delete({
                fileId: templateId,
            });
            logger.info('Deleted template', { templateId });
            return true;
        }
        catch (error) {
            const err = error;
            if (err.code === 404) {
                return false; // Already deleted
            }
            logger.error('Failed to delete template', { templateId, error });
            throw new Error(`Failed to delete template: ${err.message}`);
        }
    }
    /**
     * List builtin templates from knowledge base
     */
    async listBuiltinTemplates() {
        if (this.builtinTemplatesCache) {
            return Array.from(this.builtinTemplatesCache.values());
        }
        const templates = [];
        const knowledgePath = path.join(process.cwd(), 'src', 'knowledge', 'templates');
        try {
            const files = await fs.readdir(knowledgePath);
            for (const file of files) {
                if (!file.endsWith('.json'))
                    continue;
                try {
                    const content = await fs.readFile(path.join(knowledgePath, file), 'utf-8');
                    const data = JSON.parse(content);
                    // Handle both single template and array of templates
                    const templateArray = Array.isArray(data) ? data : [data];
                    for (const template of templateArray) {
                        if (template.id && template.name && template.sheets) {
                            templates.push({
                                id: template.id,
                                name: template.name,
                                description: template.description || '',
                                category: template.category || file.replace('.json', ''),
                                sheets: template.sheets,
                            });
                        }
                    }
                }
                catch (parseError) {
                    logger.warn('Failed to parse builtin template file', { file, error: parseError });
                }
            }
            // Cache the results
            this.builtinTemplatesCache = new Map(templates.map((t) => [t.id, t]));
            logger.debug('Loaded builtin templates', { count: templates.length });
            return templates;
        }
        catch (error) {
            logger.warn('Failed to load builtin templates', { error });
            return [];
        }
    }
    /**
     * Get builtin template by name
     */
    async getBuiltinTemplate(name) {
        const templates = await this.listBuiltinTemplates();
        return (templates.find((t) => t.id === name || t.name.toLowerCase() === name.toLowerCase()) || null);
    }
    /**
     * Ensure templates folder exists in appDataFolder
     */
    async ensureFolder() {
        if (this.folderId)
            return;
        try {
            // Search for existing folder
            const response = await this.driveApi.files.list({
                spaces: APP_DATA_SPACE,
                q: `name='${TEMPLATES_FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                fields: 'files(id)',
                pageSize: 1,
            });
            const existingFile = response.data.files?.[0];
            if (existingFile?.id) {
                this.folderId = existingFile.id;
                return;
            }
            // Create folder
            const createResponse = await this.driveApi.files.create({
                requestBody: {
                    name: TEMPLATES_FOLDER,
                    mimeType: 'application/vnd.google-apps.folder',
                    parents: [APP_DATA_SPACE],
                },
                fields: 'id',
            });
            this.folderId = createResponse.data.id;
            logger.info('Created templates folder in appDataFolder', { folderId: this.folderId });
        }
        catch (error) {
            logger.error('Failed to ensure templates folder', { error });
            throw new Error(`Failed to initialize template storage: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
//# sourceMappingURL=template-store.js.map