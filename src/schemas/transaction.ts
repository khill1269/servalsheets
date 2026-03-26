/**
 * Tool: sheets_transaction
 * Atomic multi-operation transactions with rollback support
 *
 * Actions (6):
 * - begin: Start atomic transaction
 * - queue: Queue operation in transaction
 * - commit: Commit all queued operations
 * - rollback: Rollback transaction
 * - status: Get transaction status
 * - list: List active transactions
 */

import { z } from 'zod';

// Placeholder for actual transaction schema
// Full implementation in src/handlers/transaction.ts

export const TransactionPlaceholder = z.object({});
