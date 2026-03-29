#!/bin/bash
# G12 (Advisory): Verify direct spreadsheets.get({ ... }) calls include a fields param.
# Uses the TypeScript guard for actionable output and keeps the gate non-blocking.

node --import tsx scripts/check-sheets-fields-mask.ts --all --advisory
exit 0
