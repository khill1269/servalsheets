/**
 * Shared auth path helpers.
 */
import { homedir } from 'os';
import { join } from 'path';
export function getDefaultTokenStorePath() {
    return join(homedir(), '.servalsheets', 'tokens.encrypted');
}
//# sourceMappingURL=auth-paths.js.map