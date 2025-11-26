// Import Express framework
const express = require('express');
// Import Pinecone client for fetching memories
const { fetchAllRecords, listNamespaces } = require('../pineconeClient.jsx');

// Create a new router instance for visualization routes
const router = express.Router();

// GET /visualize - Fetch all memories for graph visualization
router.get('/', async (req, res, next) => {
  try {
    // Get Pinecone index name from environment variable
    const indexName = process.env.PINECONE_INDEX_NAME || 'ai-memory';
    
    // Get optional query parameters
    const { namespace, limit } = req.query;
    const maxLimit = parseInt(limit) || 1000;
    
    console.log('Fetching memories for visualization...');
    
    // Get list of namespaces to search
    const namespaces = namespace ? [namespace] : await listNamespaces(indexName);
    
    const allMemories = [];
    
    // Fetch records from each namespace
    for (const ns of namespaces) {
      try {
        const records = await fetchAllRecords(indexName, ns, maxLimit);
        allMemories.push(...records.map(record => ({
          ...record,
          namespace: ns || 'default',
        })));
      } catch (nsError) {
        console.log(`No records in namespace: ${ns || 'default'}`);
      }
    }
    
    console.log(`Fetched ${allMemories.length} memories for visualization`);
    
    // Return memories in a format suitable for graph visualization
    res.status(200).json({
      status: 'success',
      data: {
        memories: allMemories,
        total: allMemories.length,
        namespaces: namespaces,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Export the router
module.exports = router;








