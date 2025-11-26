// Load environment variables (optional safeguard if not already loaded)
require('dotenv').config();

// Import Google Generative AI SDK (legacy package aligns with gemini-embedding-001 sample)
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini client with API key from environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * Generate embedding for a given text using Gemini embedding model
 * @param {string} content - The text content to embed
 * @returns {Promise<number[]>} - The embedding vector
 */
async function generateEmbedding(content) {
  try {
    if (!content || typeof content !== 'string') {
      throw new Error('Text input must be a non-empty string');
    }

    // Get the embedding model - using gemini-embedding-001 as specified
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
    
    // Generate embedding using embedContent method
    // Note: The API structure may vary, so we handle multiple response formats
    const result = await model.embedContent(content);
    
    // Extract the embedding vector from the response
    // Response structure can be: result.embedding.values, result.embedding, or result.embeddings[0]
    let embedding = null;
    
    if (result.embeddings && Array.isArray(result.embeddings) && result.embeddings.length > 0) {
      // Handle response.embeddings array format
      embedding = result.embeddings[0].values || result.embeddings[0];
    } else if (result.embedding) {
      // Handle result.embedding format
      embedding = result.embedding.values || result.embedding;
    } else if (Array.isArray(result)) {
      // Handle direct array response
      embedding = result[0]?.values || result[0] || result;
    }
    
    if (!embedding || !Array.isArray(embedding)) {
      console.error('Unexpected embedding response structure:', JSON.stringify(result, null, 2));
      throw new Error('Invalid embedding response format');
    }
    
    return embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * Generate a response from Gemini using context and user input
 * @param {string} input - The user's input/question
 * @param {string} context - The context string from retrieved memories
 * @returns {Promise<string>} - The AI-generated response
 */
async function generateResponse(input, context = '') {
  try {
    if (!input || typeof input !== 'string') {
      throw new Error('Input must be a non-empty string');
    }

    // Get the generative model (using a text generation model, not embedding)
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    // Construct the prompt with context and user input
    const prompt = context
      ? `Based on the following context from previous conversations:\n\n${context}\n\nUser question: ${input}\n\nPlease provide a helpful response based on the context above.`
      : `User question: ${input}\n\nPlease provide a helpful response.`;
    
    // Generate response
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    return text;
  } catch (error) {
    console.error('Error generating response:', error);
    throw new Error(`Failed to generate response: ${error.message}`);
  }
}

module.exports = { generateEmbedding, generateResponse };

