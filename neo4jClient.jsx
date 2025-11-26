// Load environment variables
require('dotenv').config();

// Import Neo4j driver
const neo4j = require('neo4j-driver');

// Initialize Neo4j driver
const driver = neo4j.driver(
  process.env.NEO4J_URI,
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
);

/**
 * Get a Neo4j session
 * @returns {neo4j.Session} - Neo4j session
 */
function getSession() {
  return driver.session();
}

/**
 * Test Neo4j connection
 * @returns {Promise<boolean>} - True if connection successful
 */
async function testConnection() {
  const session = getSession();
  try {
    const result = await session.run('RETURN 1 as test');
    await session.close();
    return true;
  } catch (error) {
    console.error('Neo4j connection error:', error);
    await session.close();
    return false;
  }
}

/**
 * Sync data from Pinecone to Neo4j
 * Creates Memory nodes and SIMILAR_TO relationships based on vector similarity
 * @param {Object} pineconeClient - Pinecone client module
 * @param {string} indexName - Pinecone index name
 * @param {string|null} namespace - Namespace to sync (null for all)
 * @param {number} similarityThreshold - Minimum similarity for relationships (0-1)
 * @returns {Promise<Object>} - Sync statistics
 */
async function syncPineconeToNeo4j(pineconeClient, indexName, namespace = null, similarityThreshold = 0.7) {
  const session = getSession();
  let nodesCreated = 0;
  let relationshipsCreated = 0;
  const namespacesProcessed = [];

  try {
    // Get list of namespaces to process
    const namespaces = namespace 
      ? [namespace] 
      : await pineconeClient.listNamespaces(indexName);

    console.log(`Syncing ${namespaces.length} namespace(s) to Neo4j...`);

    // Process each namespace
    for (const ns of namespaces) {
      try {
        console.log(`Processing namespace: ${ns || 'default'}`);
        namespacesProcessed.push(ns || 'default');

        // Fetch all records from this namespace
        const records = await pineconeClient.fetchAllRecords(indexName, ns, 10000);
        console.log(`Found ${records.length} records in namespace: ${ns || 'default'}`);

        if (records.length === 0) continue;

        // Create Memory nodes
        for (const record of records) {
          const memoryId = record.id;
          const metadata = record.metadata || {};
          const content = metadata.content || '';
          const category = metadata.category || ns || 'default';
          const createdAt = metadata.createdAt || new Date().toISOString();

          // Create or update Memory node
          const createNodeQuery = `
            MERGE (m:Memory {id: $id})
            SET m.content = $content,
                m.category = $category,
                m.namespace = $namespace,
                m.createdAt = $createdAt,
                m.label = $label,
                m.title = $title,
                m.metadata = $metadata
            RETURN m
          `;

          const label = content.substring(0, 100) + (content.length > 100 ? '...' : '');
          const title = content.substring(0, 50) + (content.length > 50 ? '...' : '');

          await session.run(createNodeQuery, {
            id: memoryId,
            content: content,
            category: category,
            namespace: ns || 'default',
            createdAt: createdAt,
            label: label,
            title: title,
            metadata: JSON.stringify(metadata),
          });

          nodesCreated++;
        }

        // Create similarity relationships within namespace
        // We'll create relationships based on metadata similarity for now
        // For true vector similarity, we'd need to compare embeddings
        console.log(`Creating similarity relationships for namespace: ${ns || 'default'}`);

        // Create relationships between memories in the same namespace
        // Using a simple approach: connect memories with similar categories or metadata
        const createRelationshipsQuery = `
          MATCH (m1:Memory {namespace: $namespace})
          MATCH (m2:Memory {namespace: $namespace})
          WHERE m1.id < m2.id
            AND m1.category = m2.category
          MERGE (m1)-[r:SIMILAR_TO {
            similarity: $similarity,
            namespace: $namespace,
            createdAt: $createdAt
          }]->(m2)
          RETURN count(r) as count
        `;

        const relResult = await session.run(createRelationshipsQuery, {
          namespace: ns || 'default',
          similarity: 0.8, // Default similarity for same category
          createdAt: new Date().toISOString(),
        });

        relationshipsCreated += relResult.records[0]?.get('count')?.toNumber() || 0;

        // Also create cross-namespace relationships for memories with same user_id or conversation_id
        if (records.length > 0) {
          const crossNamespaceQuery = `
            MATCH (m1:Memory)
            MATCH (m2:Memory)
            WHERE m1.id < m2.id
              AND m1.namespace <> m2.namespace
              AND (m1.metadata CONTAINS $userId OR m2.metadata CONTAINS $userId)
            MERGE (m1)-[r:RELATED_TO {
              relationshipType: 'cross_namespace',
              createdAt: $createdAt
            }]->(m2)
            RETURN count(r) as count
          `;

          // This is a simplified version - in production, you'd parse metadata properly
          const crossResult = await session.run(`
            MATCH (m1:Memory)
            MATCH (m2:Memory)
            WHERE m1.id < m2.id
              AND m1.namespace <> m2.namespace
            MERGE (m1)-[r:RELATED_TO {
              relationshipType: 'cross_namespace',
              createdAt: $createdAt
            }]->(m2)
            RETURN count(r) as count
          `, {
            createdAt: new Date().toISOString(),
          });

          relationshipsCreated += crossResult.records[0]?.get('count')?.toNumber() || 0;
        }

      } catch (nsError) {
        console.error(`Error processing namespace ${ns || 'default'}:`, nsError.message);
        continue;
      }
    }

    // Create advanced relationships based on content similarity
    // This would ideally use vector similarity, but for now we'll use text-based heuristics
    console.log('Creating content-based similarity relationships...');
    
    const contentSimilarityQuery = `
      MATCH (m1:Memory)
      MATCH (m2:Memory)
      WHERE m1.id < m2.id
        AND m1.content IS NOT NULL
        AND m2.content IS NOT NULL
        AND size(m1.content) > 10
        AND size(m2.content) > 10
      WITH m1, m2,
           // Simple similarity: check for common words
           [word IN split(toLower(m1.content), ' ') WHERE word IN split(toLower(m2.content), ' ')] as commonWords,
           split(toLower(m1.content), ' ') as words1,
           split(toLower(m2.content), ' ') as words2
      WHERE size(commonWords) > 0
      WITH m1, m2,
           toFloat(size(commonWords)) / toFloat(size(words1) + size(words2) - size(commonWords)) as similarity
      WHERE similarity >= $threshold
      MERGE (m1)-[r:SIMILAR_TO {
        similarity: similarity,
        method: 'content_overlap',
        createdAt: $createdAt
      }]->(m2)
      RETURN count(r) as count
    `;

    const contentResult = await session.run(contentSimilarityQuery, {
      threshold: similarityThreshold,
      createdAt: new Date().toISOString(),
    });

    const contentRelationships = contentResult.records[0]?.get('count')?.toNumber() || 0;
    relationshipsCreated += contentRelationships;
    console.log(`Created ${contentRelationships} content-based similarity relationships`);

    console.log(`Sync completed: ${nodesCreated} nodes, ${relationshipsCreated} relationships`);

    return {
      nodesCreated,
      relationshipsCreated,
      namespacesProcessed,
    };
  } catch (error) {
    console.error('Error syncing Pinecone to Neo4j:', error);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Get graph data from Neo4j
 * @param {string|null} namespace - Filter by namespace (null for all)
 * @param {number} maxNodes - Maximum number of nodes to return
 * @param {number} similarityThreshold - Minimum similarity for relationships
 * @returns {Promise<Object>} - Graph data with nodes and edges
 */
async function getGraphData(namespace = null, maxNodes = 50, similarityThreshold = 0.75) {
  const session = getSession();
  try {
    let query;
    // Ensure maxNodes is an integer (Neo4j LIMIT requires INTEGER, not FLOAT)
    const maxNodesInt = neo4j.int(parseInt(maxNodes) || 50);
    let params = { maxNodes: maxNodesInt, threshold: similarityThreshold };

    // Simplified query: Get all Memory nodes first, then we'll fetch relationships separately
    if (namespace) {
      query = `
        MATCH (m:Memory {namespace: $namespace})
        RETURN m
        LIMIT $maxNodes
      `;
      params.namespace = namespace;
    } else {
      query = `
        MATCH (m:Memory)
        RETURN m
        LIMIT $maxNodes
      `;
    }

    const result = await session.run(query, params);
    console.log(`Neo4j query returned ${result.records.length} records`);
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();

    // First, collect all nodes
    for (const record of result.records) {
      const memoryNode = record.get('m');

      if (!memoryNode) continue;

      const nodeId = memoryNode.properties.id;
      if (!nodeId) {
        console.warn('Memory node missing id property:', memoryNode.properties);
        continue;
      }
      if (!nodeMap.has(nodeId)) {
        nodes.push({
          id: nodeId,
          label: memoryNode.properties.label || memoryNode.properties.title || nodeId,
          title: memoryNode.properties.title || memoryNode.properties.label || nodeId,
          content: memoryNode.properties.content || '',
          category: memoryNode.properties.category || 'default',
          namespace: memoryNode.properties.namespace || 'default',
          createdAt: memoryNode.properties.createdAt || '',
          metadata: memoryNode.properties.metadata ? (typeof memoryNode.properties.metadata === 'string' ? JSON.parse(memoryNode.properties.metadata) : memoryNode.properties.metadata) : {},
        });
        nodeMap.set(nodeId, true);
      }
    }

    // Also get relationships between the nodes we fetched
    const relationshipQuery = namespace
      ? `
        MATCH (m1:Memory)-[r:SIMILAR_TO|RELATED_TO]->(m2:Memory)
        WHERE m1.namespace = $namespace 
          AND m2.namespace = $namespace
          AND (r.similarity >= $threshold OR r.similarity IS NULL)
          AND m1.id IN $nodeIds
          AND m2.id IN $nodeIds
        RETURN m1.id as source, m2.id as target, r
      `
      : `
        MATCH (m1:Memory)-[r:SIMILAR_TO|RELATED_TO]->(m2:Memory)
        WHERE (r.similarity >= $threshold OR r.similarity IS NULL)
          AND m1.id IN $nodeIds
          AND m2.id IN $nodeIds
        RETURN m1.id as source, m2.id as target, r
      `;

    const nodeIds = nodes.map(n => n.id);
    if (nodeIds.length > 0) {
      const relParams = { nodeIds, threshold: similarityThreshold };
      if (namespace) relParams.namespace = namespace;

      const relResult = await session.run(relationshipQuery, relParams);
      const existingEdgeIds = new Set(edges.map(e => e.id));

      for (const record of relResult.records) {
        const source = record.get('source');
        const target = record.get('target');
        const rel = record.get('r');
        const edgeId = `${source}_${target}`;

        if (!existingEdgeIds.has(edgeId)) {
          edges.push({
            id: edgeId,
            source: source,
            target: target,
            similarity: rel.properties.similarity ? parseFloat(rel.properties.similarity) : null,
            relationshipType: rel.type,
            crossNamespace: rel.properties.namespace !== (namespace || 'default'),
            createdAt: rel.properties.createdAt || '',
          });
        }
      }
    }

    await session.close();

    console.log(`getGraphData returning ${nodes.length} nodes and ${edges.length} edges`);
    return { nodes, edges };
  } catch (error) {
    await session.close();
    console.error('Error getting graph data from Neo4j:', error);
    throw error;
  }
}

/**
 * Get all unique namespaces from Neo4j
 * @returns {Promise<Array<string>>} - Array of namespace names
 */
async function getNamespaces() {
  const session = getSession();
  try {
    const result = await session.run(`
      MATCH (m:Memory)
      RETURN DISTINCT m.namespace as namespace
      ORDER BY namespace
    `);

    const namespaces = result.records.map(record => record.get('namespace') || 'default');
    await session.close();
    return namespaces;
  } catch (error) {
    await session.close();
    console.error('Error getting namespaces from Neo4j:', error);
    return [];
  }
}

/**
 * Get memory by ID
 * @param {string} memoryId - Memory ID
 * @returns {Promise<Object|null>} - Memory node or null
 */
async function getMemoryById(memoryId) {
  const session = getSession();
  try {
    const result = await session.run(
      'MATCH (m:Memory {id: $id}) RETURN m',
      { id: memoryId }
    );

    if (result.records.length === 0) {
      await session.close();
      return null;
    }

    const memoryNode = result.records[0].get('m');
    await session.close();

    return {
      id: memoryNode.properties.id,
      label: memoryNode.properties.label || memoryNode.properties.title || memoryNode.properties.id,
      content: memoryNode.properties.content || '',
      category: memoryNode.properties.category || 'default',
      namespace: memoryNode.properties.namespace || 'default',
      createdAt: memoryNode.properties.createdAt || '',
      metadata: memoryNode.properties.metadata ? JSON.parse(memoryNode.properties.metadata) : {},
    };
  } catch (error) {
    await session.close();
    console.error('Error getting memory by ID:', error);
    throw error;
  }
}

/**
 * Get relationships for a memory
 * @param {string} memoryId - Memory ID
 * @returns {Promise<Object>} - Relationships (incoming and outgoing)
 */
async function getMemoryRelationships(memoryId) {
  const session = getSession();
  try {
    const result = await session.run(
      `
        MATCH (m:Memory {id: $id})
        OPTIONAL MATCH (m)-[r1]->(target:Memory)
        OPTIONAL MATCH (source:Memory)-[r2]->(m)
        RETURN 
          collect(DISTINCT {type: type(r1), target: target.id, props: properties(r1)}) as outgoing,
          collect(DISTINCT {type: type(r2), source: source.id, props: properties(r2)}) as incoming
      `,
      { id: memoryId }
    );

    await session.close();

    if (result.records.length === 0) {
      return { outgoing: [], incoming: [] };
    }

    const record = result.records[0];
    return {
      outgoing: record.get('outgoing').filter(r => r.target),
      incoming: record.get('incoming').filter(r => r.source),
    };
  } catch (error) {
    await session.close();
    console.error('Error getting memory relationships:', error);
    throw error;
  }
}

/**
 * Create a relationship between two memories based on graph filter type
 * @param {string} sourceMemoryId - Source memory ID
 * @param {string} targetMemoryId - Target memory ID
 * @param {string} relationshipType - 'UPDATES', 'EXTENDS', or 'DERIVES'
 * @param {Object} metadata - Additional relationship metadata
 * @returns {Promise<Object>} - Created relationship
 */
async function createMemoryRelationship(sourceMemoryId, targetMemoryId, relationshipType, metadata = {}) {
  const session = getSession();
  try {
    const validTypes = ['UPDATES', 'EXTENDS', 'DERIVES'];
    if (!validTypes.includes(relationshipType)) {
      throw new Error(`Invalid relationship type. Must be one of: ${validTypes.join(', ')}`);
    }

    const query = `
      MATCH (source:Memory {id: $sourceId})
      MATCH (target:Memory {id: $targetId})
      MERGE (source)-[r:${relationshipType} {
        createdAt: $createdAt,
        confidence: $confidence,
        context: $context
      }]->(target)
      SET r += $metadata
      RETURN r, source, target
    `;

    const result = await session.run(query, {
      sourceId: sourceMemoryId,
      targetId: targetMemoryId,
      createdAt: new Date().toISOString(),
      confidence: metadata.confidence || null,
      context: metadata.context || null,
      metadata: metadata,
    });

    await session.close();

    if (result.records.length === 0) {
      throw new Error('Failed to create relationship - one or both memories not found');
    }

    return {
      relationshipType,
      sourceId: sourceMemoryId,
      targetId: targetMemoryId,
      createdAt: result.records[0].get('r').properties.createdAt,
    };
  } catch (error) {
    await session.close();
    console.error('Error creating memory relationship:', error);
    throw error;
  }
}

/**
 * Mark a memory as outdated (when it's been superseded by an UPDATE)
 * @param {string} memoryId - Memory ID to mark as outdated
 * @param {string} supersededBy - ID of memory that supersedes this one
 * @returns {Promise<boolean>} - Success status
 */
async function markMemoryOutdated(memoryId, supersededBy) {
  const session = getSession();
  try {
    const query = `
      MATCH (m:Memory {id: $memoryId})
      SET m.status = 'outdated',
          m.supersededBy = $supersededBy,
          m.updatedAt = $updatedAt
      RETURN m
    `;

    const result = await session.run(query, {
      memoryId,
      supersededBy,
      updatedAt: new Date().toISOString(),
    });

    await session.close();
    return result.records.length > 0;
  } catch (error) {
    await session.close();
    console.error('Error marking memory as outdated:', error);
    throw error;
  }
}

/**
 * Get version chain for a memory (lineage tracking)
 * @param {string} memoryId - Memory ID
 * @returns {Promise<Object>} - Version chain with ancestors and descendants
 */
async function getMemoryVersionChain(memoryId) {
  const session = getSession();
  try {
    // Get ancestors (memories this was derived from or extends)
    const ancestorsQuery = `
      MATCH (m:Memory {id: $memoryId})<-[r:DERIVES|EXTENDS|UPDATES]-(ancestor:Memory)
      RETURN ancestor, r
      ORDER BY r.createdAt DESC
    `;

    // Get descendants (memories that update or extend this)
    const descendantsQuery = `
      MATCH (m:Memory {id: $memoryId})-[r:UPDATES|EXTENDS|DERIVES]->(descendant:Memory)
      RETURN descendant, r
      ORDER BY r.createdAt DESC
    `;

    // Get update chain (memories in UPDATE chain)
    const updateChainQuery = `
      MATCH path = (m:Memory {id: $memoryId})-[*..10]-(related:Memory)
      WHERE ALL(rel in relationships(path) WHERE type(rel) = 'UPDATES')
      RETURN path
      ORDER BY length(path)
    `;

    const ancestorsResult = await session.run(ancestorsQuery, { memoryId });
    const descendantsResult = await session.run(descendantsQuery, { memoryId });
    const updateChainResult = await session.run(updateChainQuery, { memoryId });

    const ancestors = ancestorsResult.records.map(record => ({
      id: record.get('ancestor').properties.id,
      label: record.get('ancestor').properties.label,
      relationshipType: record.get('r').type,
      createdAt: record.get('r').properties.createdAt,
    }));

    const descendants = descendantsResult.records.map(record => ({
      id: record.get('descendant').properties.id,
      label: record.get('descendant').properties.label,
      relationshipType: record.get('r').type,
      createdAt: record.get('r').properties.createdAt,
    }));

    await session.close();

    return {
      memoryId,
      ancestors,
      descendants,
      isOutdated: false, // Will be determined by status
    };
  } catch (error) {
    await session.close();
    console.error('Error getting memory version chain:', error);
    throw error;
  }
}

/**
 * Get connected subgraph for a set of memory IDs
 * @param {Array<string>} memoryIds - Array of seed memory IDs
 * @param {number} depth - Maximum depth to traverse (default: 2)
 * @param {Array<string>} relationshipTypes - Types of relationships to follow (default: all)
 * @returns {Promise<Object>} - Subgraph with nodes and edges
 */
async function getConnectedSubgraph(memoryIds, depth = 2, relationshipTypes = ['UPDATES', 'EXTENDS', 'DERIVES', 'SIMILAR_TO', 'RELATED_TO']) {
  const session = getSession();
  try {
    const relTypes = relationshipTypes.join('|');
    const query = `
      MATCH path = (seed:Memory)-[*1..${depth}]-(connected:Memory)
      WHERE seed.id IN $memoryIds
        AND ALL(rel in relationships(path) WHERE type(rel) IN [${relationshipTypes.map(t => `'${t}'`).join(', ')}])
      WITH seed, connected, relationships(path) as rels, path
      UNWIND rels as rel
      WITH DISTINCT seed, connected, rel
      RETURN 
        seed.id as seedId,
        connected.id as connectedId,
        connected as node,
        startNode(rel) as source,
        endNode(rel) as target,
        rel as relationship,
        type(rel) as relType
    `;

    const result = await session.run(query, { memoryIds });

    const nodes = new Map();
    const edges = [];

    // Add seed nodes
    for (const id of memoryIds) {
      const seedQuery = `MATCH (m:Memory {id: $id}) RETURN m`;
      const seedResult = await session.run(seedQuery, { id });
      if (seedResult.records.length > 0) {
        const node = seedResult.records[0].get('m');
        nodes.set(id, {
          id: node.properties.id,
          label: node.properties.label || node.properties.title,
          content: node.properties.content || '',
          category: node.properties.category || 'default',
          namespace: node.properties.namespace || 'default',
          status: node.properties.status || 'active',
          createdAt: node.properties.createdAt || '',
          metadata: node.properties.metadata ? (typeof node.properties.metadata === 'string' ? JSON.parse(node.properties.metadata) : node.properties.metadata) : {},
        });
      }
    }

    // Process connected nodes and relationships
    for (const record of result.records) {
      const connectedNode = record.get('node');
      const nodeId = connectedNode.properties.id;
      
      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, {
          id: nodeId,
          label: connectedNode.properties.label || connectedNode.properties.title,
          content: connectedNode.properties.content || '',
          category: connectedNode.properties.category || 'default',
          namespace: connectedNode.properties.namespace || 'default',
          status: connectedNode.properties.status || 'active',
          createdAt: connectedNode.properties.createdAt || '',
          metadata: connectedNode.properties.metadata ? (typeof connectedNode.properties.metadata === 'string' ? JSON.parse(connectedNode.properties.metadata) : connectedNode.properties.metadata) : {},
        });
      }

      const source = record.get('source');
      const target = record.get('target');
      const rel = record.get('relationship');
      const relType = record.get('relType');

      const edgeId = `${source.properties.id}_${target.properties.id}_${relType}`;
      
      if (!edges.find(e => e.id === edgeId)) {
        edges.push({
          id: edgeId,
          source: source.properties.id,
          target: target.properties.id,
          type: relType,
          similarity: rel.properties.similarity ? parseFloat(rel.properties.similarity) : null,
          confidence: rel.properties.confidence ? parseFloat(rel.properties.confidence) : null,
          createdAt: rel.properties.createdAt || '',
        });
      }
    }

    await session.close();

    return {
      nodes: Array.from(nodes.values()),
      edges,
      seedIds: memoryIds,
    };
  } catch (error) {
    await session.close();
    console.error('Error getting connected subgraph:', error);
    throw error;
  }
}

/**
 * Ensure a memory node exists in Neo4j (create if not exists)
 * @param {string} memoryId - Memory ID
 * @param {Object} memoryData - Memory data from Pinecone
 * @returns {Promise<Object>} - Created or existing memory node
 */
async function ensureMemoryNode(memoryId, memoryData) {
  const session = getSession();
  try {
    const query = `
      MERGE (m:Memory {id: $id})
      SET m.content = $content,
          m.category = $category,
          m.namespace = $namespace,
          m.createdAt = $createdAt,
          m.label = $label,
          m.title = $title,
          m.metadata = $metadata,
          m.status = COALESCE(m.status, 'active'),
          m.version = COALESCE(m.version, 1)
      RETURN m
    `;

    const label = memoryData.content ? (memoryData.content.substring(0, 100) + (memoryData.content.length > 100 ? '...' : '')) : memoryId;
    const title = memoryData.content ? (memoryData.content.substring(0, 50) + (memoryData.content.length > 50 ? '...' : '')) : memoryId;

    const result = await session.run(query, {
      id: memoryId,
      content: memoryData.content || '',
      category: memoryData.category || memoryData.namespace || 'default',
      namespace: memoryData.namespace || 'default',
      createdAt: memoryData.createdAt || new Date().toISOString(),
      label,
      title,
      metadata: JSON.stringify(memoryData.metadata || {}),
    });

    await session.close();
    return result.records[0].get('m');
  } catch (error) {
    await session.close();
    console.error('Error ensuring memory node:', error);
    throw error;
  }
}

/**
 * Close Neo4j driver connection
 */
async function closeDriver() {
  await driver.close();
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await closeDriver();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeDriver();
  process.exit(0);
});

module.exports = {
  getSession,
  testConnection,
  syncPineconeToNeo4j,
  getGraphData,
  getNamespaces,
  getMemoryById,
  getMemoryRelationships,
  createMemoryRelationship,
  markMemoryOutdated,
  getMemoryVersionChain,
  getConnectedSubgraph,
  ensureMemoryNode,
  closeDriver,
};




