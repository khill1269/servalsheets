# GWorkspace MCP - Complete Action Matrix

## All 211 Actions by Tool

### Legend
- **Risk**: 🟢 Read | 🟡 Modify | 🔴 Destructive | ⚠️ Irreversible | 💰 Costs
- **Sampling**: ⭐ = Uses LLM | ⭐⭐ = Important | ⭐⭐⭐ = Critical
- **Elicit**: ✓ = Optional | ✓✓ = Recommended | ✓✓✓ = Required
- **Stream**: ● = Supports progress | ●● = Important | ●●● = Essential
- **Snapshot**: ◆ = Should backup | ◆◆ = Important | ◆◆◆ = Required
- **Undo**: ✦ = Can undo | ✗ = Cannot undo

---

## 1. gw_spreadsheet (16 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 1 | open | 🟢 | | | | | | spreadsheets.get |
| 2 | create | 🟢 | | | | | ✦ | spreadsheets.create |
| 3 | get_metadata | 🟢 | | | | | | spreadsheets.get |
| 4 | list_sheets | 🟢 | | | | | | spreadsheets.get |
| 5 | add_sheet | 🟢 | | | | | ✦ | batchUpdate.addSheet |
| 6 | delete_sheet | 🔴 | | ✓✓ | | ◆◆ | ✦ | batchUpdate.deleteSheet |
| 7 | rename_sheet | 🟡 | | | | | ✦ | batchUpdate.updateSheetProperties |
| 8 | duplicate_sheet | 🟢 | | | | | ✦ | batchUpdate.duplicateSheet |
| 9 | copy_to | 🟢 | | | | | | sheets.copyTo |
| 10 | move_sheet | 🟢 | | | | | ✦ | batchUpdate.updateSheetProperties |
| 11 | hide_sheet | 🟢 | | | | | ✦ | batchUpdate.updateSheetProperties |
| 12 | show_sheet | 🟢 | | | | | ✦ | batchUpdate.updateSheetProperties |
| 13 | set_tab_color | 🟢 | | | | | ✦ | batchUpdate.updateSheetProperties |
| 14 | protect_sheet | 🟡 | | ✓ | | | ✦ | batchUpdate.addProtectedRange |
| 15 | unprotect_sheet | 🟡 | | ✓ | | | ✦ | batchUpdate.deleteProtectedRange |
| 16 | get_url | 🟢 | | | | | | Internal |

---

## 2. gw_cells (14 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 17 | read | 🟢 | | | | | | values.get |
| 18 | write | 🟡 | | | | ◆ | ✦ | values.update |
| 19 | append | 🟢 | | | | | ✦ | values.append |
| 20 | clear | 🔴 | | ✓✓ | | ◆◆ | ✦ | values.clear |
| 21 | batch_read | 🟢 | | | ● | | | values.batchGet |
| 22 | batch_write | 🟡 | | | ● | ◆ | ✦ | values.batchUpdate |
| 23 | batch_clear | 🔴 | | ✓✓ | ● | ◆◆ | ✦ | values.batchClear |
| 24 | find | 🟢 | ⭐ | | ● | | | Custom |
| 25 | find_replace | 🔴 | | ✓✓✓ | ● | ◆◆◆ | ✦ | batchUpdate.findReplace |
| 26 | copy | 🟢 | | | | | | batchUpdate.copyPaste |
| 27 | cut | 🟡 | | | | ◆ | ✦ | batchUpdate.cutPaste |
| 28 | fill | 🟡 | | | | ◆ | ✦ | batchUpdate.autoFill |
| 29 | sort | 🟡 | | ✓ | | ◆ | ✦ | batchUpdate.sortRange |
| 30 | transpose | 🟡 | | | | ◆ | ✦ | Custom |

---

## 3. gw_rows (10 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 31 | insert | 🟢 | | | | | ✦ | batchUpdate.insertDimension |
| 32 | delete | 🔴 | | ✓✓✓ | ●● | ◆◆◆ | ✦ | batchUpdate.deleteDimension |
| 33 | move | 🟡 | | | | ◆ | ✦ | batchUpdate.moveDimension |
| 34 | resize | 🟢 | | | | | ✦ | batchUpdate.updateDimensionProperties |
| 35 | auto_resize | 🟢 | | | | | ✦ | batchUpdate.autoResizeDimensions |
| 36 | hide | 🟢 | | | | | ✦ | batchUpdate.updateDimensionProperties |
| 37 | show | 🟢 | | | | | ✦ | batchUpdate.updateDimensionProperties |
| 38 | freeze | 🟢 | | | | | ✦ | batchUpdate.updateSheetProperties |
| 39 | group | 🟢 | | | | | ✦ | batchUpdate.addDimensionGroup |
| 40 | ungroup | 🟢 | | | | | ✦ | batchUpdate.deleteDimensionGroup |

---

## 4. gw_columns (10 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 41 | insert | 🟢 | | | | | ✦ | batchUpdate.insertDimension |
| 42 | delete | 🔴 | | ✓✓✓ | ●● | ◆◆◆ | ✦ | batchUpdate.deleteDimension |
| 43 | move | 🟡 | | | | ◆ | ✦ | batchUpdate.moveDimension |
| 44 | resize | 🟢 | | | | | ✦ | batchUpdate.updateDimensionProperties |
| 45 | auto_resize | 🟢 | | | | | ✦ | batchUpdate.autoResizeDimensions |
| 46 | hide | 🟢 | | | | | ✦ | batchUpdate.updateDimensionProperties |
| 47 | show | 🟢 | | | | | ✦ | batchUpdate.updateDimensionProperties |
| 48 | freeze | 🟢 | | | | | ✦ | batchUpdate.updateSheetProperties |
| 49 | group | 🟢 | | | | | ✦ | batchUpdate.addDimensionGroup |
| 50 | ungroup | 🟢 | | | | | ✦ | batchUpdate.deleteDimensionGroup |

---

## 5. gw_style (18 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 51 | set_format | 🟢 | ⭐ | | | | ✦ | batchUpdate.repeatCell |
| 52 | set_background | 🟢 | ⭐ | | | | ✦ | batchUpdate.repeatCell |
| 53 | set_text_color | 🟢 | | | | | ✦ | batchUpdate.repeatCell |
| 54 | set_font | 🟢 | | | | | ✦ | batchUpdate.repeatCell |
| 55 | set_font_size | 🟢 | | | | | ✦ | batchUpdate.repeatCell |
| 56 | set_bold | 🟢 | | | | | ✦ | batchUpdate.repeatCell |
| 57 | set_italic | 🟢 | | | | | ✦ | batchUpdate.repeatCell |
| 58 | set_underline | 🟢 | | | | | ✦ | batchUpdate.repeatCell |
| 59 | set_strikethrough | 🟢 | | | | | ✦ | batchUpdate.repeatCell |
| 60 | set_alignment | 🟢 | | | | | ✦ | batchUpdate.repeatCell |
| 61 | set_wrap | 🟢 | | | | | ✦ | batchUpdate.repeatCell |
| 62 | set_borders | 🟢 | | | | | ✦ | batchUpdate.updateBorders |
| 63 | set_number_format | 🟢 | | | | | ✦ | batchUpdate.repeatCell |
| 64 | clear_format | 🟡 | | ✓ | | ◆ | ✦ | batchUpdate.repeatCell |
| 65 | copy_format | 🟢 | | | | | ✦ | batchUpdate.copyPaste |
| 66 | add_banding | 🟢 | | | | | ✦ | batchUpdate.addBanding |
| 67 | update_banding | 🟢 | | | | | ✦ | batchUpdate.updateBanding |
| 68 | remove_banding | 🟢 | | | | | ✦ | batchUpdate.deleteBanding |

---

## 6. gw_rules (16 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 69 | add_validation | 🟢 | | | | | ✦ | batchUpdate.setDataValidation |
| 70 | update_validation | 🟢 | | | | | ✦ | batchUpdate.setDataValidation |
| 71 | remove_validation | 🟢 | | | | | ✦ | batchUpdate.setDataValidation |
| 72 | list_validations | 🟢 | | | | | | spreadsheets.get |
| 73 | add_dropdown | 🟢 | ⭐⭐ | | | | ✦ | batchUpdate.setDataValidation |
| 74 | add_checkbox | 🟢 | | | | | ✦ | batchUpdate.setDataValidation |
| 75 | add_custom_validation | 🟢 | ⭐⭐ | | | | ✦ | batchUpdate.setDataValidation |
| 76 | add_conditional_format | 🟢 | ⭐⭐⭐ | ✓ | | | ✦ | batchUpdate.addConditionalFormatRule |
| 77 | update_conditional_format | 🟢 | | | | | ✦ | batchUpdate.updateConditionalFormatRule |
| 78 | remove_conditional_format | 🟢 | | | | | ✦ | batchUpdate.deleteConditionalFormatRule |
| 79 | list_conditional_formats | 🟢 | | | | | | spreadsheets.get |
| 80 | add_color_scale | 🟢 | ⭐⭐ | | | | ✦ | batchUpdate.addConditionalFormatRule |
| 81 | add_data_bars | 🟢 | | | | | ✦ | batchUpdate.addConditionalFormatRule |
| 82 | highlight_duplicates | 🟢 | | | | | ✦ | batchUpdate.addConditionalFormatRule |
| 83 | clear_all_rules | 🔴 | | ✓✓✓ | | ◆◆ | ✦ | Multiple deletes |
| 84 | prioritize_rules | 🟢 | | | | | ✦ | Multiple updates |

---

## 7. gw_charts (14 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 85 | create | 🟢 | ⭐⭐⭐ | ✓✓ | | | ✦ | batchUpdate.addChart |
| 86 | update | 🟢 | ⭐ | | | | ✦ | batchUpdate.updateChartSpec |
| 87 | delete | 🟡 | | ✓ | | | ✦ | batchUpdate.deleteEmbeddedObject |
| 88 | list | 🟢 | | | | | | spreadsheets.get |
| 89 | get | 🟢 | | | | | | spreadsheets.get |
| 90 | move | 🟢 | | | | | ✦ | batchUpdate.updateEmbeddedObjectPosition |
| 91 | resize | 🟢 | | | | | ✦ | batchUpdate.updateEmbeddedObjectPosition |
| 92 | update_data_range | 🟢 | | | | | ✦ | batchUpdate.updateChartSpec |
| 93 | update_title | 🟢 | | | | | ✦ | batchUpdate.updateChartSpec |
| 94 | update_legend | 🟢 | | | | | ✦ | batchUpdate.updateChartSpec |
| 95 | export | 🟢 | | | | | | Render + download |
| 96 | create_pivot | 🟢 | ⭐⭐⭐ | ✓✓ | | | ✦ | batchUpdate.updateCells |
| 97 | update_pivot | 🟢 | | | | | ✦ | batchUpdate.updateCells |
| 98 | delete_pivot | 🟡 | | ✓ | | | ✦ | batchUpdate.updateCells |

---

## 8. gw_formulas (12 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 99 | generate | 🟢 | ⭐⭐⭐ | | | | | LLM Sampling |
| 100 | explain | 🟢 | ⭐⭐⭐ | | | | | LLM Sampling |
| 101 | optimize | 🟢 | ⭐⭐ | | | | | LLM Sampling |
| 102 | fix | 🟢 | ⭐⭐⭐ | ✓ | | | | LLM Sampling |
| 103 | audit | 🟢 | ⭐ | | ● | | | Analysis |
| 104 | find_errors | 🟢 | | | ● | | | Analysis |
| 105 | find_circular | 🟢 | | | | | | Analysis |
| 106 | trace_precedents | 🟢 | | | | | | Analysis |
| 107 | trace_dependents | 🟢 | | | | | | Analysis |
| 108 | apply_formula | 🟡 | | ✓✓ | | ◆ | ✦ | values.update |
| 109 | add_named_range | 🟢 | | | | | ✦ | batchUpdate.addNamedRange |
| 110 | list_named_ranges | 🟢 | | | | | | spreadsheets.get |

---

## 9. gw_filter (10 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 111 | apply | 🟢 | ⭐ | | | | ✦ | batchUpdate.setBasicFilter |
| 112 | clear | 🟢 | | | | | ✦ | batchUpdate.clearBasicFilter |
| 113 | get | 🟢 | | | | | | spreadsheets.get |
| 114 | sort | 🟡 | ⭐ | ✓ | | ◆ | ✦ | batchUpdate.sortRange |
| 115 | create_view | 🟢 | | | | | ✦ | batchUpdate.addFilterView |
| 116 | update_view | 🟢 | | | | | ✦ | batchUpdate.updateFilterView |
| 117 | delete_view | 🟢 | | | | | ✦ | batchUpdate.deleteFilterView |
| 118 | list_views | 🟢 | | | | | | spreadsheets.get |
| 119 | find_duplicates | 🟢 | ⭐ | | ●● | | | Custom |
| 120 | deduplicate | 🔴 | | ✓✓✓ | ●● | ◆◆◆ | ✦ | batchUpdate.deleteDuplicates |

---

## 10. gw_share (14 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 121 | add_permission | 🔴 | | ✓✓✓ | | | ✦ | Drive permissions.create |
| 122 | update_permission | 🔴 | | ✓✓ | | | ✦ | Drive permissions.update |
| 123 | remove_permission | 🔴 | | ✓✓ | | | ✦ | Drive permissions.delete |
| 124 | list_permissions | 🟢 | | | | | | Drive permissions.list |
| 125 | transfer_ownership | ⚠️ | | ✓✓✓ | | | ✗ | Drive permissions.update |
| 126 | set_link_sharing | 🔴 | | ✓✓ | | | ✦ | Drive permissions |
| 127 | get_sharing_link | 🟢 | | | | | | Internal |
| 128 | add_comment | 🟢 | ⭐ | | | | ✦ | Drive comments.create |
| 129 | reply_comment | 🟢 | | | | | ✦ | Drive replies.create |
| 130 | resolve_comment | 🟢 | | | | | ✦ | Drive comments.update |
| 131 | delete_comment | 🟢 | | | | | ✦ | Drive comments.delete |
| 132 | list_comments | 🟢 | | | | | | Drive comments.list |
| 133 | protect_range | 🟡 | ⭐ | | | | ✦ | batchUpdate.addProtectedRange |
| 134 | unprotect_range | 🟡 | | ✓ | | | ✦ | batchUpdate.deleteProtectedRange |

---

## 11. gw_files (12 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 135 | export_pdf | 🟢 | | | ●● | | | Drive files.export |
| 136 | export_xlsx | 🟢 | | | ●● | | | Drive files.export |
| 137 | export_csv | 🟢 | | | ●● | | | Drive files.export |
| 138 | import_csv | 🟡 | | ✓✓ | ●● | ◆◆ | ✦ | values + processing |
| 139 | import_xlsx | 🟡 | | ✓✓ | ●● | ◆◆ | ✦ | Processing |
| 140 | list_versions | 🟢 | | | | | | Drive revisions.list |
| 141 | get_version | 🟢 | | | | | | Drive revisions.get |
| 142 | restore_version | 🔴 | | ✓✓✓ | | ◆◆◆ | ✦ | Drive + processing |
| 143 | create_backup | 🟢 | | | | | | Custom |
| 144 | list_backups | 🟢 | | | | | | Custom |
| 145 | restore_backup | 🔴 | | ✓✓ | | ◆◆ | ✦ | Custom |
| 146 | delete_backup | 🟡 | | ✓ | | | | Custom |

---

## 12. gw_triggers (10 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 147 | create_time | 🟡 | ⭐ | ✓✓ | | | ✦ | Apps Script |
| 148 | create_on_edit | 🟡 | | ✓✓ | | | ✦ | Apps Script |
| 149 | create_on_change | 🟡 | | ✓✓ | | | ✦ | Apps Script |
| 150 | create_on_open | 🟡 | | ✓✓ | | | ✦ | Apps Script |
| 151 | create_on_form | 🟡 | | ✓✓ | | | ✦ | Apps Script |
| 152 | list | 🟢 | | | | | | Apps Script |
| 153 | get | 🟢 | | | | | | Apps Script |
| 154 | delete | 🟢 | | ✓ | | | ✦ | Apps Script |
| 155 | enable | 🟡 | | ✓ | | | ✦ | Apps Script |
| 156 | disable | 🟢 | | | | | ✦ | Apps Script |

---

## 13. gw_scripts (12 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 157 | create | 🟢 | ⭐⭐⭐ | ✓✓✓ | | | ✦ | projects.create |
| 158 | get_content | 🟢 | | | | | | projects.getContent |
| 159 | update_content | 🟡 | ⭐⭐ | | | ◆ | ✦ | projects.updateContent |
| 160 | delete | 🟡 | | ✓ | | | ✦ | projects.delete |
| 161 | run | 🔴 | | ✓✓✓ | ●● | | ✗ | scripts.run |
| 162 | run_function | 🔴 | | ✓✓✓ | ●● | | ✗ | scripts.run |
| 163 | list_functions | 🟢 | | | | | | projects.getContent |
| 164 | deploy | 🔴 | | ✓✓✓ | ● | | ✦ | deployments.create |
| 165 | undeploy | 🟡 | | ✓ | | | ✦ | deployments.delete |
| 166 | list_deployments | 🟢 | | | | | | deployments.list |
| 167 | get_logs | 🟢 | | | | | | processes.list |
| 168 | debug | 🟢 | ⭐⭐ | | | | | Custom |

---

## 14. gw_query (16 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 169 | run_query | 💰 | ⭐⭐ | ✓✓✓ | ●● | | ✗ | jobs.query |
| 170 | preview_query | 🟢 | | | | | | jobs.query (dryRun) |
| 171 | list_datasets | 🟢 | | | | | | datasets.list |
| 172 | list_tables | 🟢 | | | | | | tables.list |
| 173 | get_schema | 🟢 | | | | | | tables.get |
| 174 | preview_table | 🟢 | | | | | | tabledata.list |
| 175 | query_to_sheet | 🟡 | | ✓ | ●● | ◆ | ✦ | jobs.query + values |
| 176 | create_connected | 🟢 | | | | | ✦ | DataSources |
| 177 | refresh_connected | 💰 | | ✓ | ● | | ✗ | DataSources.refresh |
| 178 | schedule_refresh | 💰 | | ✓✓✓ | | | ✦ | Custom |
| 179 | delete_connected | 🟡 | | ✓ | | | ✦ | DataSources.delete |
| 180 | list_connected | 🟢 | | | | | | spreadsheets.get |
| 181 | sheet_to_bigquery | 🟢 | | | ●● | | | BigQuery upload |
| 182 | create_data_source | 🟢 | | | | | ✦ | DataSources |
| 183 | update_data_source | 🟢 | | | | | ✦ | DataSources |
| 184 | delete_data_source | 🟡 | | ✓ | | | ✦ | DataSources |

---

## 15. gw_workflow (12 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 185 | build_crm | 🟢 | ⭐⭐⭐ | ✓✓✓ | ●●● | | ✦ | Multiple batched |
| 186 | build_dashboard | 🟢 | ⭐⭐⭐ | ✓✓✓ | ●●● | | ✦ | Multiple batched |
| 187 | build_tracker | 🟢 | ⭐⭐⭐ | ✓✓✓ | ●●● | | ✦ | Multiple batched |
| 188 | build_budget | 🟢 | ⭐⭐⭐ | ✓✓✓ | ●●● | | ✦ | Multiple batched |
| 189 | build_inventory | 🟢 | ⭐⭐⭐ | ✓✓✓ | ●●● | | ✦ | Multiple batched |
| 190 | build_report | 🟢 | ⭐⭐⭐ | ✓✓ | ●●● | | ✦ | Multiple batched |
| 191 | import_and_setup | 🟡 | | ✓✓ | ●● | ◆◆ | ✦ | Multiple |
| 192 | clean_data | 🔴 | ⭐⭐⭐ | ✓✓✓ | ●●● | ◆◆◆ | ✦ | Multiple |
| 193 | apply_template | 🟡 | | ✓✓ | ●● | ◆◆ | ✦ | Multiple |
| 194 | analyze_and_recommend | 🟢 | ⭐⭐⭐ | | ●● | | | Analysis + Sampling |
| 195 | migrate_format | 🟡 | ⭐ | ✓ | ●● | ◆ | ✦ | Multiple |
| 196 | suggest_improvements | 🟢 | ⭐⭐⭐ | | | | | Analysis + Sampling |

---

## 16. gw_help (6 actions)

| # | Action | Risk | Samp | Elicit | Stream | Snap | Undo | API Method |
|---|--------|------|------|--------|--------|------|------|------------|
| 197 | list_tools | 🟢 | | | | | | Internal |
| 198 | describe_tool | 🟢 | | | | | | Internal |
| 199 | suggest_tool | 🟢 | ⭐⭐ | | | | | Sampling |
| 200 | list_actions | 🟢 | | | | | | Internal |
| 201 | explain_action | 🟢 | ⭐⭐ | | | | | Sampling |
| 202 | search_docs | 🟢 | ⭐⭐ | | | | | Sampling |

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| **Total Actions** | 202 base |
| **🟢 Read Operations** | 89 (44%) |
| **🟡 Modify Operations** | 63 (31%) |
| **🔴 Destructive Operations** | 24 (12%) |
| **💰 Cost Operations** | 4 (2%) |
| **⚠️ Irreversible** | 1 (<1%) |
| **Actions with Sampling** | 42 (21%) |
| **Actions with Elicitation** | 51 (25%) |
| **Actions with Streaming** | 35 (17%) |
| **Actions with Snapshot** | 26 (13%) |
| **Actions with Undo** | 172 (85%) |

### High-Risk Summary
- **Destructive Actions**: 24 (require confirmation)
- **Security Actions**: 9 (permission changes)
- **Cost Actions**: 4 (BigQuery operations)
- **Irreversible Actions**: 1 (transfer_ownership)
- **Side Effect Actions**: 2 (script run)

---

*Complete action matrix for GWorkspace MCP Server implementation*
