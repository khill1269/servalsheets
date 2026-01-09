/**
 * Shared auth path helpers.
 */

import { homedir } from "os";
import { join } from "path";

export function getDefaultTokenStorePath(): string {
  return join(homedir(), ".servalsheets", "tokens.encrypted");
}
