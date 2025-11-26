// Load environment variables from .env file
require('dotenv').config();

// Import dependencies
const express = require('express');
const addMemoryRouter = require('./add-memory/route.jsx');  // import memory routes from the add-memory library
const getResponseRouter = require('./get-response/route.jsx');  // import response generation routes
const visualizeRouter = require('./visualize/route.jsx');  // import visualization routes
const getGraphRouter = require('./get-graph/route.jsx');  // import Neo4j graph routes
const semanticSearchRouter = require('./semantic-search/route.jsx');  // import semantic search routes


const app = express();
const PORT = process.env.PORT || 3003;

// Enable CORS for React frontend (must be before routes)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Middleware: Parse incoming JSON requests and make data available in req.body
app.use(express.json());
// Mount the memory routes at the /add-memory path
app.use('/add-memory', addMemoryRouter);
// Mount the response generation routes at the /get-response path
app.use('/get-response', getResponseRouter);
// Mount the visualization routes at the /visualize path
app.use('/visualize', visualizeRouter);
// Mount the Neo4j graph routes at the /get-graph path
app.use('/get-graph', getGraphRouter);
// Mount the semantic search routes at the /semantic-search path
app.use('/semantic-search', semanticSearchRouter);

// Root endpoint: Health check to verify the API is running
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'AI Memory API is running',
  });
});

// Error handling middleware: Catches and handles all errors from route handlers
// This must be placed after all route definitions
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
  });
});

// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

// Export the app instance for testing or other modules
module.exports = app;
