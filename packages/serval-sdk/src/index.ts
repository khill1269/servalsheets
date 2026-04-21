export { ServalSheetsClient, type ServalSheetsClientConfig } from './client.js';
export { ServalTransport, type ServalTransportConfig } from './transport.js';
export {
  ServalSheetsError,
  ServalAuthError,
  ServalNotFoundError,
  ServalPermissionError,
  ServalValidationError,
} from './errors.js';
export { CoreNamespace, type SpreadsheetProperties } from './namespaces/core.js';
export {
  DataNamespace,
  type CellValue,
  type Row,
  type ReadOptions,
  type WriteOptions,
  type AppendOptions,
  type ReadResult,
  type WriteResult,
  type FindReplaceOptions,
} from './namespaces/data.js';
export {
  FormatNamespace,
  type TextFormatOptions,
  type NumberFormatOptions,
  type BackgroundOptions,
  type AlignmentOptions,
} from './namespaces/format.js';
export {
  AnalyzeNamespace,
  type AnalyzeDataOptions,
  type QuickInsightsResult,
} from './namespaces/analyze.js';
export { SessionNamespace } from './namespaces/session.js';
