/**
 * Live API Tests for sheets_collaborate Tool
 *
 * Tests sharing, comments, and collaboration operations against the real Google API.
 * Requires TEST_REAL_API=true environment variable.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LiveApiClient } from '../setup/live-api-client.js';
import { TestSpreadsheetManager, TestSpreadsheet } from '../setup/test-spreadsheet-manager.js';
import {
  loadTestCredentials,
  shouldRunIntegrationTests,
} from '../../helpers/credential-loader.js';

const runLiveTests = shouldRunIntegrationTests();

describe.skipIf(!runLiveTests)('sheets_collaborate Live API Tests', () => {
  let client: LiveApiClient;
  let manager: TestSpreadsheetManager;
  let testSpreadsheet: TestSpreadsheet;

  beforeAll(async () => {
    const credentials = await loadTestCredentials();
    if (!credentials) {
      throw new Error('Test credentials not available');
    }
    client = new LiveApiClient(credentials, { trackMetrics: true });
    manager = new TestSpreadsheetManager(client);
  });

  afterAll(async () => {
    await manager.cleanup();
  });

  beforeEach(async () => {
    testSpreadsheet = await manager.createTestSpreadsheet('collaborate');
  });

  describe('Sharing Operations', () => {
    describe('share_list action', () => {
      it('should list current permissions', async () => {
        const response = await client.drive.permissions.list({
          fileId: testSpreadsheet.id,
          fields: 'permissions(id,type,role,emailAddress)',
        });

        expect(response.status).toBe(200);
        expect(response.data.permissions).toBeDefined();
        // Should have at least owner permission
        expect(response.data.permissions!.length).toBeGreaterThanOrEqual(1);

        const ownerPermission = response.data.permissions!.find(
          (p) => p.role === 'owner'
        );
        expect(ownerPermission).toBeDefined();
      });
    });

    describe('share_add action', () => {
      it('should add reader permission', async () => {
        // Note: In tests, we use 'anyone' type to avoid needing a real email
        const response = await client.drive.permissions.create({
          fileId: testSpreadsheet.id,
          requestBody: {
            type: 'anyone',
            role: 'reader',
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.id).toBeDefined();
        expect(response.data.role).toBe('reader');
      });

      it('should add commenter permission', async () => {
        const response = await client.drive.permissions.create({
          fileId: testSpreadsheet.id,
          requestBody: {
            type: 'anyone',
            role: 'commenter',
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.role).toBe('commenter');
      });
    });

    describe('share_update action', () => {
      it('should update permission role', async () => {
        // First add a permission
        const addResponse = await client.drive.permissions.create({
          fileId: testSpreadsheet.id,
          requestBody: {
            type: 'anyone',
            role: 'reader',
          },
        });

        const permissionId = addResponse.data.id!;

        // Update to commenter
        const updateResponse = await client.drive.permissions.update({
          fileId: testSpreadsheet.id,
          permissionId,
          requestBody: {
            role: 'commenter',
          },
        });

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.data.role).toBe('commenter');
      });
    });

    describe('share_remove action', () => {
      it('should remove permission', async () => {
        // First add a permission
        const addResponse = await client.drive.permissions.create({
          fileId: testSpreadsheet.id,
          requestBody: {
            type: 'anyone',
            role: 'reader',
          },
        });

        const permissionId = addResponse.data.id!;

        // Remove it
        const deleteResponse = await client.drive.permissions.delete({
          fileId: testSpreadsheet.id,
          permissionId,
        });

        expect(deleteResponse.status).toBe(204);

        // Verify it's gone
        const listResponse = await client.drive.permissions.list({
          fileId: testSpreadsheet.id,
          fields: 'permissions(id)',
        });

        const removedPermission = listResponse.data.permissions!.find(
          (p) => p.id === permissionId
        );
        expect(removedPermission).toBeUndefined();
      });
    });
  });

  describe('Protected Range Operations', () => {
    let sheetId: number;

    beforeEach(async () => {
      const meta = await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
      });
      sheetId = meta.data.sheets![0].properties!.sheetId!;
    });

    describe('protect_range action', () => {
      it('should protect a range with warning only', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addProtectedRange: {
                  protectedRange: {
                    range: {
                      sheetId,
                      startRowIndex: 0,
                      endRowIndex: 5,
                      startColumnIndex: 0,
                      endColumnIndex: 3,
                    },
                    description: 'Header rows - edit with caution',
                    warningOnly: true,
                  },
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
        const protectedRangeId =
          response.data.replies![0].addProtectedRange?.protectedRange
            ?.protectedRangeId;
        expect(protectedRangeId).toBeDefined();
      });

      it('should protect entire sheet except certain ranges', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addProtectedRange: {
                  protectedRange: {
                    range: {
                      sheetId,
                    },
                    description: 'Entire sheet protected',
                    warningOnly: false,
                    unprotectedRanges: [
                      {
                        sheetId,
                        startRowIndex: 5,
                        endRowIndex: 100,
                        startColumnIndex: 1,
                        endColumnIndex: 5,
                      },
                    ],
                  },
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
      });
    });

    describe('unprotect_range action', () => {
      it('should remove protection from a range', async () => {
        // First add protection
        const addResponse = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                addProtectedRange: {
                  protectedRange: {
                    range: {
                      sheetId,
                      startRowIndex: 0,
                      endRowIndex: 1,
                      startColumnIndex: 0,
                      endColumnIndex: 1,
                    },
                    warningOnly: true,
                  },
                },
              },
            ],
          },
        });

        const protectedRangeId =
          addResponse.data.replies![0].addProtectedRange?.protectedRange
            ?.protectedRangeId;

        // Remove protection
        const deleteResponse = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                deleteProtectedRange: {
                  protectedRangeId,
                },
              },
            ],
          },
        });

        expect(deleteResponse.status).toBe(200);
      });
    });
  });

  describe('Developer Metadata Operations', () => {
    let sheetId: number;

    beforeEach(async () => {
      const meta = await client.sheets.spreadsheets.get({
        spreadsheetId: testSpreadsheet.id,
      });
      sheetId = meta.data.sheets![0].properties!.sheetId!;
    });

    describe('metadata_create action', () => {
      it('should add developer metadata to spreadsheet', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                createDeveloperMetadata: {
                  developerMetadata: {
                    metadataKey: 'app_version',
                    metadataValue: '1.0.0',
                    location: {
                      spreadsheet: true,
                    },
                    visibility: 'DOCUMENT',
                  },
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
        const metadataId =
          response.data.replies![0].createDeveloperMetadata?.developerMetadata
            ?.metadataId;
        expect(metadataId).toBeDefined();
      });

      it('should add metadata to specific sheet', async () => {
        const response = await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                createDeveloperMetadata: {
                  developerMetadata: {
                    metadataKey: 'sheet_type',
                    metadataValue: 'data',
                    location: {
                      sheetId,
                    },
                    visibility: 'DOCUMENT',
                  },
                },
              },
            ],
          },
        });

        expect(response.status).toBe(200);
      });
    });

    describe('metadata_search action', () => {
      it('should find metadata by key', async () => {
        // First create metadata
        await client.sheets.spreadsheets.batchUpdate({
          spreadsheetId: testSpreadsheet.id,
          requestBody: {
            requests: [
              {
                createDeveloperMetadata: {
                  developerMetadata: {
                    metadataKey: 'test_key',
                    metadataValue: 'test_value',
                    location: { spreadsheet: true },
                    visibility: 'DOCUMENT',
                  },
                },
              },
            ],
          },
        });

        // Search for it
        const response =
          await client.sheets.spreadsheets.developerMetadata.search({
            spreadsheetId: testSpreadsheet.id,
            requestBody: {
              dataFilters: [
                {
                  developerMetadataLookup: {
                    metadataKey: 'test_key',
                  },
                },
              ],
            },
          });

        expect(response.status).toBe(200);
        expect(response.data.matchedDeveloperMetadata).toBeDefined();
        expect(response.data.matchedDeveloperMetadata!.length).toBeGreaterThan(
          0
        );
      });
    });
  });

  describe('File Properties Operations', () => {
    describe('get_file_info action', () => {
      it('should get file metadata', async () => {
        const response = await client.drive.files.get({
          fileId: testSpreadsheet.id,
          fields: 'id,name,mimeType,createdTime,modifiedTime,owners,capabilities',
        });

        expect(response.status).toBe(200);
        expect(response.data.id).toBe(testSpreadsheet.id);
        expect(response.data.mimeType).toBe(
          'application/vnd.google-apps.spreadsheet'
        );
        expect(response.data.createdTime).toBeDefined();
        expect(response.data.modifiedTime).toBeDefined();
      });
    });

    describe('rename_file action', () => {
      it('should rename spreadsheet', async () => {
        const newName = `SERVAL_TEST_renamed_${Date.now()}`;

        const response = await client.drive.files.update({
          fileId: testSpreadsheet.id,
          requestBody: {
            name: newName,
          },
        });

        expect(response.status).toBe(200);
        expect(response.data.name).toBe(newName);
      });
    });
  });

  describe('Revision History', () => {
    describe('list_revisions action', () => {
      it('should list file revisions', async () => {
        // Make some changes first
        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A1',
          valueInputOption: 'RAW',
          requestBody: { values: [['Change 1']] },
        });

        await client.sheets.spreadsheets.values.update({
          spreadsheetId: testSpreadsheet.id,
          range: 'TestData!A2',
          valueInputOption: 'RAW',
          requestBody: { values: [['Change 2']] },
        });

        const response = await client.drive.revisions.list({
          fileId: testSpreadsheet.id,
          fields: 'revisions(id,modifiedTime,lastModifyingUser)',
        });

        expect(response.status).toBe(200);
        expect(response.data.revisions).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle permission denied gracefully', async () => {
      // Try to share with invalid email format
      await expect(
        client.drive.permissions.create({
          fileId: testSpreadsheet.id,
          requestBody: {
            type: 'user',
            role: 'reader',
            emailAddress: 'not-a-valid-email',
          },
        })
      ).rejects.toThrow();
    });

    it('should handle non-existent file', async () => {
      await expect(
        client.drive.permissions.list({
          fileId: 'non-existent-file-id-12345',
        })
      ).rejects.toThrow();
    });
  });

  describe('Performance Metrics', () => {
    it('should track collaboration API latency', async () => {
      client.resetMetrics();

      // Make a few collaboration API calls
      await client.trackOperation('permissionsList', 'GET', () =>
        client.drive.permissions.list({
          fileId: testSpreadsheet.id,
          fields: 'permissions(id,type,role)',
        })
      );

      await client.trackOperation('filesGet', 'GET', () =>
        client.drive.files.get({
          fileId: testSpreadsheet.id,
          fields: 'id,name',
        })
      );

      const stats = client.getStats();
      expect(stats.totalRequests).toBeGreaterThanOrEqual(2);
      expect(stats.avgDuration).toBeGreaterThan(0);
    });
  });
});
