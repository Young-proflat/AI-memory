// Import  framework
const express = require('express');
const { generateEmbedding } = require('../geminiClient.jsx');
const { upsertVector } = require('../pineconeClient.jsx');
const { ensureMemoryNode } = require('../neo4jClient.jsx');

// Create a new router instance for handling memory-related routes
const router = express.Router();

// GET /add-memory - Health check endpoint (Pinecone doesn't support direct retrieval in this setup)
router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Memory API endpoint is running. Use POST to add memories.',
  });
});

// POST /add-memory - Create a new semantic memory entry with embedding
router.post('/', async (req, res, next) => {
  try {
    // Extract required fields from request body: content (natural language string), category (namespace), and metadata (JSON)
    const { content, category, metadata, graphFilter } = req.body || {};

    // Validate that all required fields are provided
    if (!content || typeof content !== 'string') {
      const error = new Error('Content is required and must be a string');
      error.status = 400;
      throw error;
    }

    if (!category || typeof category !== 'string') {
      const error = new Error('Category is required and must be a string');
      error.status = 400;
      throw error;
    }

    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      const error = new Error('Metadata is required and must be a JSON object');
      error.status = 400;
      throw error;
    }

    // Validate graph filter if provided
    const validFilters = ['update', 'extend', 'derive'];
    const filterType = graphFilter && validFilters.includes(graphFilter.toLowerCase()) 
      ? graphFilter.toLowerCase() 
      : 'extend'; // Default to extend

    // Generate unique ID for the memory entry
    const memoryId = Date.now().toString(36) + Math.random().toString(36).substring(2);

    // Step 1: Generate embedding for the content using Gemini
    console.log('Generating embedding for content...');
    const embedding = await generateEmbedding(content);

    // Step 2: Prepare metadata with additional information including versioning
    const enrichedMetadata = {
      ...metadata,
      content: content, // Store original content in metadata
      category: category, // Store category in metadata for reference
      createdAt: new Date().toISOString(), // Add timestamp
      graphFilter: filterType, // Add graph filter type
      version: 1, // Initial version
      isLatest: true, // New memories are latest by default
      status: 'active', // Active status by default
    };

    // Step 3: Get Pinecone index name from environment variable (default to 'ai-memory')
    const indexName = process.env.PINECONE_INDEX_NAME || 'ai-memory';

    // Step 4: Upsert the vector to Pinecone with category as namespace
    console.log(`Upserting vector to Pinecone index: ${indexName}, namespace: ${category}`);
    const pineconeResult = await upsertVector(
      indexName,
      category, // Use category as namespace
      memoryId,
      embedding,
      enrichedMetadata
    );

    // Step 4.5: Ensure memory exists in Neo4j for graph relationships
    try {
      await ensureMemoryNode(memoryId, {
        id: memoryId,
        content: content,
        category: category,
        namespace: category,
        createdAt: new Date().toISOString(),
        metadata: enrichedMetadata,
      });
      console.log(`Memory node ensured in Neo4j: ${memoryId}`);
    } catch (neo4jError) {
      console.error('Error ensuring memory node in Neo4j:', neo4jError.message);
      // Continue even if Neo4j fails - Pinecone storage succeeded
    }

    // Step 5: Return success response with created memory information
    res.status(201).json({
      status: 'created',
      data: {
        id: memoryId,
        content: content,
        category: category,
        graphFilter: filterType,
        metadata: enrichedMetadata,
        embeddingLength: embedding.length,
        pineconeResult: pineconeResult,
      },
    });
  } catch (error) {
    // Pass any errors to the error handling middleware in server.jsx
    next(error);
  }
});

// Export the router to be used in the main server file
module.exports = router;
