// Import Express framework
const express = require('express');
const { getGraphData, getNamespaces, syncPineconeToNeo4j } = require('../neo4jClient.jsx');
const pineconeClient = require('../pineconeClient.jsx');

// Create a new router instance for handling graph data routes
const router = express.Router();

// Helper function to process graph data (shared by GET and POST)
async function processGraphData(req, res, next) {
  try {
    // Support both query params (GET) and body (POST)
    const params = req.method === 'POST' ? req.body : req.query;
    const { 
      namespace = null, // New: filter by namespace
      maxNodes = 50, 
      similarityThreshold = 0.75,
      sync = false, // New: option to sync from Pinecone first
    } = params || {};

    const maxNodesNum = parseInt(maxNodes) || 50;
    const thresholdNum = parseFloat(similarityThreshold) || 0.75;
    const shouldSync = sync === 'true' || sync === true;

    // Optionally sync from Pinecone to Neo4j first
    if (shouldSync) {
      try {
        const indexName = process.env.PINECONE_INDEX_NAME || 'ai-memory';
        console.log(`Syncing data from Pinecone to Neo4j - namespace: ${namespace || 'all'}`);
        const syncResult = await syncPineconeToNeo4j(
          pineconeClient,
          indexName,
          namespace,
          thresholdNum
        );
        console.log(`Sync completed: ${syncResult.nodesCreated} nodes, ${syncResult.relationshipsCreated} relationships`);
      } catch (syncError) {
        console.error('Error syncing from Pinecone:', syncError.message);
        // Continue even if sync fails - use existing Neo4j data
      }
    }

    console.log(`Fetching graph data from Neo4j - namespace: ${namespace || 'all'}, maxNodes: ${maxNodesNum}, threshold: ${thresholdNum}`);

    // Get graph data from Neo4j
    const graphData = await getGraphData(namespace, maxNodesNum, thresholdNum);

    // Transform Neo4j data to frontend format
    const nodes = graphData.nodes.map((node) => ({
      id: node.id,
        type: 'memory',
        data: {
        label: node.label,
        title: node.title || node.label,
        content: node.content || '',
        category: node.category || node.namespace || 'default',
        namespace: node.namespace || 'default',
        createdAt: node.createdAt || '',
        ...node.metadata,
      },
    }));

    const edges = graphData.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
                  type: 'smoothstep',
      label: edge.similarity ? edge.similarity.toFixed(2) : '',
      relationshipType: edge.relationshipType || 'SIMILAR_TO',
                  data: {
        similarity: edge.similarity || 0,
        relationshipType: edge.relationshipType || 'SIMILAR_TO',
        crossNamespace: edge.crossNamespace || false,
      },
    }));

    console.log(`Graph data prepared: ${nodes.length} nodes, ${edges.length} edges`);

    res.status(200).json({
      status: 'success',
      data: {
        nodes,
        edges,
        totalMemories: nodes.length,
        nodesDisplayed: nodes.length,
        edgesDisplayed: edges.length,
        namespace: namespace || 'all',
      },
    });
  } catch (error) {
    console.error('Error processing graph data:', error);
    next(error);
  }
}

// GET endpoint for graph data
router.get('/', processGraphData);

// POST endpoint for graph data
router.post('/', processGraphData);

// GET endpoint to list all available namespaces
router.get('/namespaces', async (req, res, next) => {
  try {
    const namespaces = await getNamespaces();
    res.status(200).json({
      status: 'success',
      data: {
        namespaces,
      },
    });
  } catch (error) {
    console.error('Error getting namespaces:', error);
    next(error);
  }
});

// POST endpoint to sync data from Pinecone to Neo4j
router.post('/sync', async (req, res, next) => {
  try {
    const { namespace = null, similarityThreshold = 0.7 } = req.body || {};
    const indexName = process.env.PINECONE_INDEX_NAME || 'ai-memory';
    
    console.log(`Manual sync requested - namespace: ${namespace || 'all'}`);
    
    const syncResult = await syncPineconeToNeo4j(
      pineconeClient,
      indexName,
      namespace,
      parseFloat(similarityThreshold) || 0.7
    );
    
    res.status(200).json({
      status: 'success',
      data: {
        message: 'Sync completed successfully',
        nodesCreated: syncResult.nodesCreated,
        relationshipsCreated: syncResult.relationshipsCreated,
        namespacesProcessed: syncResult.namespacesProcessed,
      },
    });
  } catch (error) {
    console.error('Error syncing from Pinecone:', error);
    next(error);
  }
});

module.exports = router;
