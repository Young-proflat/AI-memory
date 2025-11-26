// Import Express framework
const express = require('express');
// Import Pinecone client for searching memories
const { searchRecords, pinecone } = require('../pineconeClient.jsx');
// Import Gemini client for generating responses and embeddings
const { generateResponse, generateEmbedding } = require('../geminiClient.jsx');

// Create a new router instance for handling response generation routes
const router = express.Router();

// POST /get-response - Generate AI response using retrieved memories
router.post('/', async (req, res, next) => {
  try {
    // Extract required fields from request body
    const { user_id, conversation_id, input } = req.body || {};

    // Validate that all required fields are provided
    if (!user_id || typeof user_id !== 'string') {
      const error = new Error('user_id is required and must be a string');
      error.status = 400;
      throw error;
    }

    if (!conversation_id || typeof conversation_id !== 'string') {
      const error = new Error('conversation_id is required and must be a string');
      error.status = 400;
      throw error;
    }

    if (!input || typeof input !== 'string') {
      const error = new Error('input is required and must be a string');
      error.status = 400;
      throw error;
    }

    // Get Pinecone index name from environment variable (default to 'ai-memory')
    const indexName = process.env.PINECONE_INDEX_NAME || 'ai-memory';

    // Step 1: Generate embedding for the input text
    console.log('Generating embedding for input query...');
    const queryVector = await generateEmbedding(input);

    // Step 2: Search for memories matching user_id and conversation_id
    // Since memories are stored in different namespaces (categories), we need to search across them
    console.log(`Searching for memories with user_id: ${user_id}, conversation_id: ${conversation_id}`);

    // Build filter for metadata using $eq syntax as required by Pinecone
    const filter = {
      user_id: { "$eq": user_id },
      conversation_id: { "$eq": conversation_id },
    };

    // List of common category namespaces to search (you can expand this or make it dynamic)
    // For now, we'll try searching in a default namespace and common ones
    const namespacesToSearch = ['', 'user-research', 'team-insights', 'community-moments', 'creative-discoveries', 'urban-notes'];
    
    let allMemories = [];
    
    // Search across multiple namespaces using vector-based query
    for (const namespace of namespacesToSearch) {
      try {
        const searchResult = await searchRecords(
          indexName,
          namespace,
          queryVector, // Pass the embedding vector instead of text
          filter,
          50 // topK
        );
        
        // Extract matches from the query response
        // Pinecone query() returns { matches: [...] } structure
        if (searchResult.matches && Array.isArray(searchResult.matches)) {
          allMemories = allMemories.concat(searchResult.matches);
        } else if (searchResult.records && Array.isArray(searchResult.records)) {
          allMemories = allMemories.concat(searchResult.records);
        } else if (searchResult.data && Array.isArray(searchResult.data)) {
          allMemories = allMemories.concat(searchResult.data);
        }
      } catch (namespaceError) {
        // If namespace doesn't exist or has no results, continue to next
        console.log(`No results in namespace: ${namespace || 'default'}`);
      }
    }

    // Step 3: Format retrieved memories as context string
    let contextString = '';
    if (allMemories.length > 0) {
      const memoryTexts = allMemories.map((match, index) => {
        // Extract content and category from metadata (query() returns matches with metadata)
        const content = match.metadata?.content || match.fields?.content || match.content || '';
        const category = match.metadata?.category || match.fields?.category || '';
        return `${index + 1}. [${category}] ${content}`;
      });
      contextString = memoryTexts.join('\n');
      console.log(`Retrieved ${allMemories.length} memories for context`);
    } else {
      console.log('No memories found for the given user_id and conversation_id');
    }

    // Step 4: Generate response from Gemini using context and input
    console.log('Generating response from Gemini...');
    const aiResponse = await generateResponse(input, contextString);

    // Step 5: Return success response with the AI response
    res.status(200).json({
      status: 'success',
      data: {
        user_id: user_id,
        conversation_id: conversation_id,
        input: input,
        memoriesFound: allMemories.length,
        response: aiResponse,
        contextUsed: contextString || 'No previous memories found',
      },
    });
  } catch (error) {
    // Pass any errors to the error handling middleware in server.jsx
    next(error);
  }
});

// Export the router to be used in the main server file
module.exports = router;

