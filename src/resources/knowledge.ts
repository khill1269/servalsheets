export const knowledgeResource = {
  uri: 'sheets://knowledge',
  name: 'Sheet Knowledge Graph',
  description: 'Inferred relationships between columns, tables, and metrics',
  mimeType: 'application/json',
};

/**
 * List all knowledge resources for search indexing.
 * Returns the static knowledge graph entry. In future, this could be
 * expanded to include dynamically discovered knowledge from analysis results.
 */
export async function listKnowledgeResources(): Promise<
  Array<{ uri: string; contents: { mimeType: string; text: string } }>
> {
  return [
    {
      uri: knowledgeResource.uri,
      contents: {
        mimeType: knowledgeResource.mimeType,
        text: JSON.stringify({
          description: knowledgeResource.description,
          relationships: [],
          lastUpdated: new Date().toISOString(),
        }),
      },
    },
  ];
}
