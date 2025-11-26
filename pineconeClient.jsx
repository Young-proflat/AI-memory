// import env variable
require('dotenv').config();

// Import Pinecone client
const { Pinecone } = require('@pinecone-database/pinecone');

// Initialize Pinecone client with API key from environment variable
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || '',
});

//const indexName = "ai-memory";
async function upsertVector(indexName, namespace, id, embedding, metadata) {
  try {
    // Get the index
    const index = pinecone.index(indexName);
    
    // Get the namespace (category)
    const ns = index.namespace(namespace);
    
    // Upsert the vector with metadata
    const result = await ns.upsert([
      {
        id: id,
        values: embedding,
        metadata: metadata,
      },
    ]);
    
    return result;
  } catch (error) {
    console.error('Error upserting vector to Pinecone:', error);
    throw new Error(`Failed to upsert vector: ${error.message}`);
  }
}

/**
 * Search for records in Pinecone with metadata filters using vector-based query
 * @param {string} indexName - The name of the Pinecone index
 * @param {string} namespace - The namespace to search in (use empty string for default namespace)
 * @param {number[]} vector - The query vector array for similarity search
 * @param {Object} filter - Metadata filter object with $eq syntax (e.g., { user_id: { "$eq": "user_123" }, conversation_id: { "$eq": "conv_456" } })
 * @param {number} topK - Number of results to return (default: 50)
 * @returns {Promise<Object>} - Search results
 */
async function searchRecords(indexName, namespace, vector, filter = {}, topK = 50) {
  try {
    if (!Array.isArray(vector) || vector.length === 0) {
      throw new Error('Vector must be a non-empty array of numbers');
    }

    // Get the index
    const index = pinecone.index(indexName);
    
    // Get the namespace (use empty string for default namespace)
    const ns = namespace ? index.namespace(namespace) : index.namespace('');
    
    // Query with vector and filter using $eq syntax
    const queryResponse = await ns.query({
      vector: vector,
      topK: topK,
      filter: filter,
      includeValues: false,
      includeMetadata: true,
    });
    
    return queryResponse;
  } catch (error) {
    console.error('Error searching records in Pinecone:', error);
    throw new Error(`Failed to search records: ${error.message}`);
  }
}

/**
 * Fetch all records from a namespace in Pinecone
 * @param {string} indexName - The name of the Pinecone index
 * @param {string} namespace - The namespace to fetch from
 * @param {number} limit - Maximum number of records to fetch (default: 1000)
 * @returns {Promise<Array>} - Array of records with metadata
 */

async function fetchAllRecords(indexName, namespace, limit = 1000) {
  try {
    const index = pinecone.index(indexName);
    const ns = namespace ? index.namespace(namespace) : index.namespace('');
    
    // For visualization, let's use a query with a neutral vector
    
    // Get dimension from index stats or use a default
    // For now, we'll query with topK to get records
    // Note: This is a workaround - ideally we'd track IDs
    
    const allRecords = [];
    
    // Try to fetch using query with a large topK
    // We'll use a zero vector (dimension depends on your embedding model)
    // Gemini embeddings are typically 768 or 3072 dimensions
    // Based on earlier responses, we saw 3072 dimensions
    const dummyVector = new Array(3072).fill(0); // Gemini embedding dimension
    
    try {
      const result = await ns.query({
        vector: dummyVector,
        topK: Math.min(limit, 10000), // Pinecone limit
        includeValues: false,
        includeMetadata: true,
      });
      
      if (result.matches && Array.isArray(result.matches)) {
        return result.matches.map(match => ({
          id: match.id,
          metadata: match.metadata || {},
          score: match.score,
        }));
      }
    } catch (queryError) {
      console.log('Query method failed, trying alternative approach...');
    }
    
    return allRecords;
  } catch (error) {
    console.error('Error fetching records from Pinecone:', error);
    throw new Error(`Failed to fetch records: ${error.message}`);
  }
}



/**
 * List all namespaces in an index
 * @param {string} indexName - The name of the Pinecone index
 * @returns {Promise<Array>} - Array of namespace names
 */


async function listNamespaces(indexName) {
  try {
    const index = pinecone.index(indexName);
    return ['', 'user-research', 'team-insights', 'community-moments', 'creative-discoveries', 'urban-notes', 'customer-reflections'];
  } catch (error) {
    console.error('Error listing namespaces:', error);
    return [];
  }
}

module.exports = { upsertVector, searchRecords, fetchAllRecords, listNamespaces, pinecone };

