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
import type { drive_v3 } from 'googleapis';
import type { TemplateDefinition, TemplateSummary, TemplateSheet } from '../schemas/templates.js';
/**
 * Builtin template from knowledge base
 */
export interface BuiltinTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    sheets: TemplateSheet[];
}
/**
 * Template store using Google Drive appDataFolder
 */
export declare class TemplateStore {
    private driveApi;
    private folderId;
    private builtinTemplatesCache;
    constructor(driveApi: drive_v3.Drive);
    /**
     * List all user templates
     */
    list(category?: string): Promise<TemplateSummary[]>;
    /**
     * Get template by ID
     */
    get(templateId: string): Promise<TemplateDefinition | null>;
    /**
     * Create new template
     */
    create(template: Omit<TemplateDefinition, 'id' | 'created' | 'updated'>): Promise<TemplateDefinition>;
    /**
     * Update existing template
     */
    update(templateId: string, updates: Partial<Omit<TemplateDefinition, 'id' | 'created' | 'updated'>>): Promise<TemplateDefinition>;
    /**
     * Delete template
     */
    delete(templateId: string): Promise<boolean>;
    /**
     * List builtin templates from knowledge base
     */
    listBuiltinTemplates(): Promise<BuiltinTemplate[]>;
    /**
     * Get builtin template by name
     */
    getBuiltinTemplate(name: string): Promise<BuiltinTemplate | null>;
    /**
     * Ensure templates folder exists in appDataFolder
     */
    private ensureFolder;
}
//# sourceMappingURL=template-store.d.ts.map