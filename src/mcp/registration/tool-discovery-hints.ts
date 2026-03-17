/**
 * ServalSheets - Tool Discovery Hints
 *
 * Builds lightweight action-level parameter hints from the full input schemas so
 * deferred `tools/list` responses remain actionable without requiring MCP
 * resource reads.
 */

import { zodSchemaToJsonSchema } from '../../utils/schema-compat.js';
import type { ToolDefinition } from './tool-definitions.js';
import { TOOL_DEFINITIONS } from './tool-definitions.js';

type JsonRecord = Record<string, unknown>;
type HintEnumValue = string | number | boolean | null;

const MAX_DESCRIPTION_LENGTH = 160;
const MAX_NESTED_FIELDS = 12;
const MAX_ENUM_VALUES = 24;
const MAX_SUMMARY_DEPTH = 3;

export interface ParamSchemaHint {
  type?: string;
  description?: string;
  enum?: HintEnumValue[];
  required?: string[];
  properties?: Record<string, ParamSchemaHint>;
  items?: ParamSchemaHint;
}

export interface ActionParamHint {
  description?: string;
  required: string[];
  requiredOneOf?: string[][];
  optional?: string[];
  params?: Record<string, ParamSchemaHint>;
}

export interface ToolDiscoveryHint {
  actionParams: Record<string, ActionParamHint>;
  requestDescription: string;
  descriptionSuffix: string;
}

const discoveryHintCache = new Map<string, ToolDiscoveryHint | null>();

interface ActionHintOverride {
  description?: string;
  required?: string[];
  requiredOneOf?: string[][];
  optional?: string[];
  params?: string[];
}

const COMMON_COLLABORATE_PARAMS = ['spreadsheetId', 'safety', 'verbosity'];

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function collaborateAction(
  required: string[],
  extras: string[] = [],
  description?: string,
  requiredOneOf?: string[][]
): ActionHintOverride {
  return {
    ...(description ? { description } : {}),
    required,
    ...(requiredOneOf ? { requiredOneOf } : {}),
    params: uniqueStrings([...required, ...extras, ...COMMON_COLLABORATE_PARAMS]),
  };
}

const ACTION_HINT_OVERRIDES: Record<string, Record<string, ActionHintOverride>> = {
  sheets_appsscript: {
    get: {
      requiredOneOf: [['scriptId', 'spreadsheetId']],
      description:
        'Get project metadata. Provide either scriptId directly or spreadsheetId to auto-resolve the bound project.',
    },
    get_content: {
      requiredOneOf: [['scriptId', 'spreadsheetId']],
      description:
        'Get script files. Provide either scriptId directly or spreadsheetId to auto-resolve the bound project.',
    },
    update_content: {
      requiredOneOf: [['scriptId', 'spreadsheetId']],
      description:
        'Update project files. Requires files plus either scriptId directly or spreadsheetId to auto-resolve the bound project.',
    },
    create_trigger: {
      requiredOneOf: [['scriptId', 'spreadsheetId']],
      description:
        'Create a trigger. Requires functionName and triggerType plus either scriptId directly or spreadsheetId to auto-resolve the bound project.',
    },
    list_triggers: {
      requiredOneOf: [['scriptId', 'spreadsheetId']],
      description:
        'List triggers. Provide either scriptId directly or spreadsheetId to auto-resolve the bound project.',
    },
    delete_trigger: {
      requiredOneOf: [['scriptId', 'spreadsheetId']],
      description:
        'Delete a trigger. Requires triggerId plus either scriptId directly or spreadsheetId to auto-resolve the bound project.',
    },
    update_trigger: {
      requiredOneOf: [['scriptId', 'spreadsheetId']],
      description:
        'Update a trigger. Requires triggerId plus either scriptId directly or spreadsheetId to auto-resolve the bound project.',
    },
  },
  sheets_format: {
    auto_fit: {
      requiredOneOf: [['range', 'sheetId']],
      description: 'Auto-fit rows or columns. Provide either a range or a numeric sheetId.',
    },
  },
  sheets_connectors: {
    configure: {
      description:
        'Configure a connector. If connectorId or credentials are omitted, the server can prompt for them. API-key connectors can open a local setup page via MCP URL elicitation.',
    },
  },
  sheets_webhook: {
    register: {
      description:
        'Register a webhook endpoint. Requires Redis-backed webhook storage plus an HTTPS webhookUrl.',
    },
    unregister: {
      description: 'Remove a registered webhook. Requires the Redis-backed webhook store.',
    },
    list: {
      description: 'List registered webhooks. Requires the Redis-backed webhook store.',
    },
    get: {
      description: 'Get details for one webhook. Requires the Redis-backed webhook store.',
    },
    test: {
      description:
        'Send a test delivery to an existing webhook. Requires the Redis-backed webhook store.',
    },
    get_stats: {
      description: 'Get webhook delivery statistics. Requires the Redis-backed webhook store.',
    },
    watch_changes: {
      description:
        'Create a native Drive files.watch channel. Does not require Redis, but without Redis the channel is not persisted for renewal or later listing.',
    },
  },
  sheets_collaborate: {
    share_add: collaborateAction(
      ['spreadsheetId', 'type', 'role'],
      ['emailAddress', 'domain', 'sendNotification', 'emailMessage', 'expirationTime'],
      'Add a sharing permission. If type=user or group, include emailAddress. If type=domain, include domain.'
    ),
    share_update: collaborateAction(['spreadsheetId', 'permissionId', 'role'], ['expirationTime']),
    share_remove: collaborateAction(['spreadsheetId', 'permissionId']),
    share_list: collaborateAction(['spreadsheetId']),
    share_get: collaborateAction(['spreadsheetId', 'permissionId']),
    share_transfer_ownership: collaborateAction(['spreadsheetId', 'newOwnerEmail']),
    share_set_link: collaborateAction(
      ['spreadsheetId', 'enabled'],
      ['type', 'role', 'allowFileDiscovery']
    ),
    share_get_link: collaborateAction(['spreadsheetId']),
    comment_add: collaborateAction(['spreadsheetId', 'content'], ['anchor']),
    comment_update: collaborateAction(['spreadsheetId', 'commentId', 'content']),
    comment_delete: collaborateAction(['spreadsheetId', 'commentId']),
    comment_list: collaborateAction(
      ['spreadsheetId'],
      ['includeDeleted', 'commentPageToken', 'maxResults']
    ),
    comment_get: collaborateAction(['spreadsheetId', 'commentId']),
    comment_resolve: collaborateAction(['spreadsheetId', 'commentId']),
    comment_reopen: collaborateAction(['spreadsheetId', 'commentId']),
    comment_add_reply: collaborateAction(['spreadsheetId', 'commentId', 'content']),
    comment_update_reply: collaborateAction(['spreadsheetId', 'commentId', 'replyId', 'content']),
    comment_delete_reply: collaborateAction(['spreadsheetId', 'commentId', 'replyId']),
    version_list_revisions: collaborateAction(['spreadsheetId'], ['pageSize', 'pageToken']),
    version_get_revision: collaborateAction(['spreadsheetId', 'revisionId']),
    version_restore_revision: collaborateAction(['spreadsheetId', 'revisionId']),
    version_keep_revision: collaborateAction(['spreadsheetId', 'revisionId', 'keepForever']),
    version_create_snapshot: collaborateAction(
      ['spreadsheetId'],
      ['name', 'description', 'destinationFolderId']
    ),
    version_list_snapshots: collaborateAction(['spreadsheetId']),
    version_restore_snapshot: collaborateAction(['spreadsheetId', 'snapshotId']),
    version_delete_snapshot: collaborateAction(['spreadsheetId', 'snapshotId']),
    version_compare: collaborateAction(
      ['spreadsheetId'],
      ['revisionId', 'revisionId1', 'revisionId2', 'sheetId']
    ),
    version_export: collaborateAction(['spreadsheetId'], ['revisionId', 'format']),
    approval_create: collaborateAction(
      ['spreadsheetId', 'range', 'approvers'],
      ['requiredApprovals', 'message', 'expirationDays']
    ),
    approval_approve: collaborateAction(['spreadsheetId', 'approvalId']),
    approval_reject: collaborateAction(['spreadsheetId', 'approvalId']),
    approval_get_status: collaborateAction(['spreadsheetId', 'approvalId']),
    approval_list_pending: collaborateAction(['spreadsheetId']),
    approval_delegate: collaborateAction(['spreadsheetId', 'approvalId', 'delegateTo']),
    approval_cancel: collaborateAction(['spreadsheetId', 'approvalId']),
    list_access_proposals: collaborateAction(['spreadsheetId'], ['pageToken', 'pageSize']),
    resolve_access_proposal: collaborateAction(['spreadsheetId', 'proposalId', 'decision']),
    label_list: collaborateAction(
      [],
      ['fileId', 'includeLabels'],
      'List Drive labels for a spreadsheet or Drive file. Provide fileId directly or spreadsheetId as the default file target.',
      [['fileId', 'spreadsheetId']]
    ),
    label_apply: collaborateAction(
      ['labelId'],
      ['fileId', 'labelFields'],
      'Apply a Drive label. Requires labelId plus either fileId directly or spreadsheetId as the default file target.',
      [['fileId', 'spreadsheetId']]
    ),
    label_remove: collaborateAction(
      ['labelId'],
      ['fileId'],
      'Remove a Drive label. Requires labelId plus either fileId directly or spreadsheetId as the default file target.',
      [['fileId', 'spreadsheetId']]
    ),
  },
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function truncateDescription(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_DESCRIPTION_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_DESCRIPTION_LENGTH - 1).trimEnd()}...`;
}

function isHintEnumValue(value: unknown): value is HintEnumValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function decodeJsonPointerSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function dereference(root: JsonRecord, ref: string): JsonRecord | null {
  if (!ref.startsWith('#/')) {
    return null;
  }

  let current: unknown = root;
  for (const segment of ref.slice(2).split('/').map(decodeJsonPointerSegment)) {
    if (!current || typeof current !== 'object') {
      return null;
    }
    current = (current as JsonRecord)[segment];
  }

  return asRecord(current);
}

function resolveSchemaNode(
  node: unknown,
  root: JsonRecord,
  seenRefs: Set<string> = new Set()
): JsonRecord | null {
  const record = asRecord(node);
  if (!record) {
    return null;
  }

  const ref = record['$ref'];
  if (typeof ref !== 'string') {
    return record;
  }

  if (seenRefs.has(ref)) {
    return record;
  }

  const resolved = dereference(root, ref);
  if (!resolved) {
    return record;
  }

  const nextSeenRefs = new Set(seenRefs);
  nextSeenRefs.add(ref);
  return resolveSchemaNode(resolved, root, nextSeenRefs) ?? resolved;
}

function inferTypeFromEnum(values: HintEnumValue[]): string | undefined {
  if (values.length === 0) {
    return undefined; // OK: Explicit empty — empty array input
  }

  const distinctTypes = new Set(values.map((value) => (value === null ? 'null' : typeof value)));
  if (distinctTypes.size !== 1) {
    return undefined; // OK: Explicit empty — mixed types, cannot infer
  }

  return [...distinctTypes][0];
}

function readSchemaType(schema: JsonRecord): string | undefined {
  const typeValue = schema['type'];
  if (typeof typeValue === 'string') {
    return typeValue;
  }

  if (Array.isArray(typeValue)) {
    const parts = typeValue.filter((entry): entry is string => typeof entry === 'string');
    if (parts.length > 0) {
      return parts.join(' | ');
    }
  }

  if (asRecord(schema['properties'])) {
    return 'object';
  }

  if (schema['items'] !== undefined) {
    return 'array';
  }

  return undefined; // OK: Explicit empty — unrecognized JSON Schema type node
}

function summarizeSchemaNode(
  node: unknown,
  root: JsonRecord,
  depth = 0,
  seenRefs: Set<string> = new Set()
): ParamSchemaHint | undefined {
  const schema = resolveSchemaNode(node, root, seenRefs);
  if (!schema) {
    return undefined; // OK: Explicit empty — schema node could not be resolved
  }

  const hint: ParamSchemaHint = {};
  const enumValues = Array.isArray(schema['enum'])
    ? schema['enum'].filter(isHintEnumValue).slice(0, MAX_ENUM_VALUES)
    : [];
  const constValue = isHintEnumValue(schema['const']) ? [schema['const']] : [];
  const summarizedEnum = enumValues.length > 0 ? enumValues : constValue;

  const type = readSchemaType(schema) ?? inferTypeFromEnum(summarizedEnum);
  if (type) {
    hint.type = type;
  }

  if (summarizedEnum.length > 0) {
    hint.enum = summarizedEnum;
  }

  if (typeof schema['description'] === 'string' && schema['description'].trim().length > 0) {
    hint.description = truncateDescription(schema['description']);
  }

  if (depth < MAX_SUMMARY_DEPTH) {
    const required = Array.isArray(schema['required'])
      ? (schema['required'] as unknown[])
          .filter((value): value is string => typeof value === 'string')
          .slice(0, MAX_NESTED_FIELDS)
      : [];
    if (required.length > 0) {
      hint.required = required;
    }

    const properties = asRecord(schema['properties']);
    if (properties) {
      const propertyHints: Record<string, ParamSchemaHint> = {};
      for (const [key, value] of Object.entries(properties).slice(0, MAX_NESTED_FIELDS)) {
        const nested = summarizeSchemaNode(value, root, depth + 1, seenRefs);
        if (nested) {
          propertyHints[key] = nested;
        }
      }

      if (Object.keys(propertyHints).length > 0) {
        hint.properties = propertyHints;
      }
    }

    if (schema['items'] !== undefined) {
      const items = summarizeSchemaNode(schema['items'], root, depth + 1, seenRefs);
      if (items) {
        hint.items = items;
      }
    }
  }

  return Object.keys(hint).length > 0 ? hint : undefined;
}

function getSchemaVariants(schema: JsonRecord): JsonRecord[] {
  const directAction = getActionName(schema);
  if (directAction) {
    return [schema];
  }

  const variants: JsonRecord[] = [];
  for (const key of ['oneOf', 'anyOf', 'allOf'] as const) {
    const entries = schema[key];
    if (!Array.isArray(entries)) {
      continue;
    }

    for (const entry of entries) {
      const record = asRecord(entry);
      if (!record) {
        continue;
      }
      variants.push(...getSchemaVariants(record));
    }
  }

  return variants;
}

function getActionName(schema: JsonRecord): string | null {
  const properties = asRecord(schema['properties']);
  const actionSchema = asRecord(properties?.['action']);
  if (!actionSchema) {
    return null;
  }

  const constValue = actionSchema['const'];
  if (typeof constValue === 'string') {
    return constValue;
  }

  const enumValues = Array.isArray(actionSchema['enum']) ? actionSchema['enum'] : undefined;
  if (enumValues?.length === 1 && typeof enumValues[0] === 'string') {
    return enumValues[0];
  }

  return null;
}

function getRequiredFields(schema: JsonRecord): string[] {
  return Array.isArray(schema['required'])
    ? (schema['required'] as unknown[])
        .filter((value): value is string => typeof value === 'string' && value !== 'action')
        .sort()
    : [];
}

function getOptionalFields(schema: JsonRecord, required: string[]): string[] {
  const properties = asRecord(schema['properties']);
  if (!properties) {
    return [];
  }

  return Object.keys(properties)
    .filter((key) => key !== 'action' && !required.includes(key))
    .sort();
}

function pickParamHints(
  root: JsonRecord,
  properties: JsonRecord | null,
  paramNames: string[],
  existing?: Record<string, ParamSchemaHint>
): Record<string, ParamSchemaHint> | undefined {
  const params: Record<string, ParamSchemaHint> = {};

  for (const paramName of paramNames) {
    const paramSchema = properties?.[paramName];
    if (paramSchema !== undefined) {
      const hint = summarizeSchemaNode(paramSchema, root);
      if (hint) {
        params[paramName] = hint;
        continue;
      }
    }

    if (existing?.[paramName]) {
      params[paramName] = existing[paramName]!;
    }
  }

  return Object.keys(params).length > 0 ? params : undefined;
}

function applyActionHintOverrides(
  toolName: string,
  actionParams: Record<string, ActionParamHint>,
  root: JsonRecord,
  requestSchema: JsonRecord
): Record<string, ActionParamHint> {
  const overrides = ACTION_HINT_OVERRIDES[toolName];
  if (!overrides) {
    return actionParams;
  }

  const requestProperties = asRecord(requestSchema['properties']);
  const merged: Record<string, ActionParamHint> = { ...actionParams };

  for (const [action, override] of Object.entries(overrides)) {
    const current = merged[action] ?? { required: [] };
    const required = override.required ?? current.required ?? [];
    const requiredOneOf = override.requiredOneOf ?? current.requiredOneOf;
    const params =
      override.params !== undefined
        ? pickParamHints(root, requestProperties, override.params, current.params)
        : current.params;

    const conditionallyRequired = new Set((requiredOneOf ?? []).flat());
    const optional =
      override.optional ??
      (override.params !== undefined
        ? override.params.filter(
            (param) => !required.includes(param) && !conditionallyRequired.has(param)
          )
        : current.optional);

    merged[action] = {
      ...current,
      ...(override.description ? { description: override.description } : {}),
      required,
      ...(requiredOneOf && requiredOneOf.length > 0 ? { requiredOneOf } : {}),
      ...(optional && optional.length > 0 ? { optional } : {}),
      ...(params ? { params } : {}),
    };
  }

  return merged;
}

function getRequirementPreview(hint: ActionParamHint): string[] {
  const preview = [...hint.required];
  if (hint.requiredOneOf) {
    preview.push(...hint.requiredOneOf.map((group) => group.join(' or ')));
  }
  return preview;
}

function formatActionSummary(action: string, hint: ActionParamHint): string {
  const preview = getRequirementPreview(hint);
  if (preview.length === 0) {
    return `${action}(no extra required fields)`;
  }
  return `${action}(${preview.join(', ')})`;
}

function buildRequestDescription(actionParams: Record<string, ActionParamHint>): string {
  const entries = Object.entries(actionParams);
  if (entries.length === 0) {
    return 'Action-specific required fields and compact param hints are exposed inline in x-servalsheets.actionParams.';
  }

  const preview = entries.slice(0, 10).map(([action, hint]) => formatActionSummary(action, hint));
  const summary = `Required fields by action: ${preview.join('; ')}.`;

  if (entries.length <= 10) {
    return `${summary} Full map, including compact param types/enums, is also available in x-servalsheets.actionParams.`;
  }

  return `${summary} Showing 10 of ${entries.length} actions. Full map, including compact param types/enums, is in x-servalsheets.actionParams.`;
}

function buildDescriptionSuffix(): string {
  return 'Required params by action and compact param types/enums are inline in the input schema request description and x-servalsheets.actionParams.';
}

function buildToolDiscoveryHint(tool: ToolDefinition): ToolDiscoveryHint | null {
  const jsonSchema = zodSchemaToJsonSchema(tool.inputSchema);
  const root = asRecord(jsonSchema);
  if (!root) {
    return null;
  }
  const properties = asRecord(root['properties']);
  const requestSchema = asRecord(properties?.['request']);
  if (!requestSchema) {
    return null;
  }

  const variants = getSchemaVariants(requestSchema);
  const actionParams: Record<string, ActionParamHint> = {};
  for (const variant of variants) {
    const action = getActionName(variant);
    if (!action || actionParams[action]) {
      continue;
    }

    const propertiesForVariant = asRecord(variant['properties']);
    const actionSchema = asRecord(propertiesForVariant?.['action']);
    const required = getRequiredFields(variant);
    const optional = getOptionalFields(variant, required);
    const params: Record<string, ParamSchemaHint> = {};

    for (const [paramName, paramSchema] of Object.entries(propertiesForVariant ?? {})) {
      if (paramName === 'action') {
        continue;
      }

      const hint = summarizeSchemaNode(paramSchema, root);
      if (hint) {
        params[paramName] = hint;
      }
    }

    actionParams[action] = {
      ...(typeof actionSchema?.['description'] === 'string' && {
        description: actionSchema['description'],
      }),
      required,
      ...(optional.length > 0 && { optional }),
      ...(Object.keys(params).length > 0 && { params }),
    };
  }

  const enrichedActionParams = applyActionHintOverrides(
    tool.name,
    actionParams,
    root,
    requestSchema
  );

  if (Object.keys(enrichedActionParams).length === 0) {
    return null;
  }

  return {
    actionParams: enrichedActionParams,
    requestDescription: buildRequestDescription(enrichedActionParams),
    descriptionSuffix: buildDescriptionSuffix(),
  };
}

export function getToolDiscoveryHint(toolName: string): ToolDiscoveryHint | null {
  if (discoveryHintCache.has(toolName)) {
    return discoveryHintCache.get(toolName) ?? null;
  }

  const tool = TOOL_DEFINITIONS.find((definition) => definition.name === toolName);
  const hint = tool ? buildToolDiscoveryHint(tool) : null;
  discoveryHintCache.set(toolName, hint);
  return hint;
}
