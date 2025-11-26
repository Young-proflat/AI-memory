# AI Memory Application - Mind Weave

> A full-stack semantic memory management system with knowledge graph visualization, designed to store, retrieve, and visualize human-like memory relationships using vector embeddings and graph databases.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.1.0-black.svg)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14.0.0-black.svg)](https://nextjs.org/)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Project Requirements](#project-requirements)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Project Structure](#project-structure)

---

## 🎯 Overview

**Mind Weave** is an AI-powered semantic memory management application that mimics human memory organization by:

- **Storing semantic memories** as vector embeddings in Pinecone
- **Creating relationships** between memories (UPDATE, EXTEND, DERIVE) in Neo4j
- **Enabling semantic search** with connected subgraph retrieval
- **Visualizing knowledge graphs** interactively with relationship filtering
- **Tracking versioning and lineage** to show how information evolves over time

The system accepts natural language input, converts it to semantic embeddings using Google Gemini AI, stores them in Pinecone for similarity search, and maintains relationship graphs in Neo4j for advanced querying and visualization.

---

## ✨ Features

### ✅ Fully Implemented

1. **REST API for Natural Language Input**
   - Accepts natural language text input
   - Generates vector embeddings using Google Gemini
   - Stores memories in Pinecone with metadata
   - Supports categorization via namespaces

2. **Memory Relationship Management**
   - **UPDATE**: Supersedes previous information and marks outdated memories
   - **EXTEND**: Adds context while retaining original memory as valid
   - **DERIVE**: Creates inferred insights based on patterns and similarity
   - Relationships stored in both Pinecone metadata and Neo4j graph

3. **Semantic Search with Subgraph Retrieval**
   - Vector-based similarity search across multiple namespaces
   - Retrieves connected subgraph from Neo4j
   - Configurable depth and relationship type filtering
   - Returns seed memories + connected nodes with relationships

4. **Knowledge Graph Visualization**
   - Interactive force-directed graph (Force Graph 2D)
   - Selectable nodes and edges
   - Filter by relationship type (UPDATE, EXTEND, DERIVE)
   - Filter by namespace/category
   - Search within graph
   - Dark theme UI with responsive design

5. **Versioning and Lineage Tracking**
   - Memory version numbers
   - Parent-child version chains
   - `isLatest` flag for current versions
   - Status tracking (`active`, `outdated`, `superseded`)
   - Timestamp tracking

6. **Dual Database Architecture**
   - Pinecone for vector similarity search
   - Neo4j for graph relationship queries
   - Automatic synchronization between databases

### ⚠️ Partially Implemented

1. **Graph Filter Enforcement**
   - Metadata stored correctly
   - Neo4j relationships created for UPDATE/EXTEND/DERIVE
   - Visual distinction in graph (partial)
   - Some filter types need enhanced UI indicators

2. **Memory Status Management**
   - UPDATE relationships mark memories as outdated in Neo4j
   - Pinecone metadata updated with status
   - Graph visualization shows status (could be enhanced)
---

## 🎯 Project Requirements

This project was built to achieve the following requirements:

### ✅ Implemented Requirements

| Requirement | Status | Implementation |
|------------|--------|----------------|
| REST API with natural language input | ✅ Complete | `POST /add-memory` |
| Convert to semantic memory objects with embeddings | ✅ Complete | Gemini embeddings, Pinecone storage |
| UPDATE relationship (supersede & mark outdated) | ✅ Complete | Neo4j relationships + metadata updates |
| EXTEND relationship (add context, retain original) | ✅ Complete | Neo4j EXTENDS relationships |
| DERIVE relationship (inferred insights) | ✅ Complete | Similarity-based DERIVES relationships |
| Semantic search and retrieval | ✅ Complete | `POST /semantic-search` with subgraph |
| Connected subgraph retrieval | ✅ Complete | Neo4j graph traversal |
| Web dashboard visualization | ✅ Complete | React + Force Graph 2D |
| Selectable nodes & relationship types | ✅ Complete | Interactive graph with filters |
| Memory metadata display | ✅ Complete | Right sidebar with details |
| Versioning and lineage | ✅ Complete | Version numbers, parent chains, status |
| Show information changes over time | ✅ Complete | Version tracking, timestamps |
| Identify most up-to-date memories | ✅ Complete | `isLatest` flag, status tracking |
| Timestamps | ✅ Complete | `createdAt` in all memories |
| Graph navigation controls | ✅ Partial | Basic controls, could be enhanced |


## 🛠 Tech Stack

### Backend
- **Framework**: Express.js 5.1.0
- **AI/ML**: 
  - Google Gemini AI (`@google/generative-ai`) for embeddings and responses
  - `gemini-embedding-001` model for vector generation
- **Vector Database**: Pinecone (`@pinecone-database/pinecone`)
- **Graph Database**: Neo4j (`neo4j-driver`)
- **Environment**: dotenv for configuration

### Frontend
- **Framework**: Next.js 14 with React 18
- **Graph Visualization**: `react-force-graph-2d`
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Build Tool**: Next.js built-in

### Development Tools
- **Process Manager**: nodemon (dev)
- **Testing**: Custom test scripts (see `scripts/` directory)

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Client (Browser)                     │
│  ┌──────────────┐  ┌──────────────┐      │
│  │  Graph View  │  │ Search View  │      │
│  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST
┌────────────────────────┴────────────────────────────────────┐
│                    Express Server (Port 3003)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ /add-    │  │/semantic-│  │ /get-    │   │
│  │ memory   │  │ search   │  │ graph    │   │
│  └──────────┘  └──────────┘  └──────────┘   │
└──────┬───────────────┬──────────────┬──────────────┬───────┘
       │               │              │              │
   ┌───┴───┐      ┌───┴───┐     ┌───┴───┐     ┌───┴───┐
   │Gemini │      │Pinecone│    │ Neo4j  │    │Gemini │
   │Embed- │      │Vector  │    │ Graph  │    │LLM    │
   │dings  │      │Storage │    │Database│    │       │
   └───────┘      └────────┘    └────────┘    └───────┘
```

### Data Flow

1. **Memory Creation**:
   - User input → Gemini (embedding) → Pinecone (vector storage) → Neo4j (node creation)

2. **Relationship Creation**:
   - Update → Pinecone (metadata) → Neo4j (relationship edges)

3. **Search**:
   - Query → Gemini (embedding) → Pinecone (similarity search) → Neo4j (subgraph expansion)

4. **Visualization**:
   - Neo4j (graph data) → Express API → React Frontend → Force Graph 2D

---

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd AI-Memory
   ```

2. **Install backend dependencies**
   ```bash
   npm i
   ```

3. **Install frontend dependencies**
   ```bash
   cd frontend
   npm i
   cd ..
   ```

4. **Configure environment variables**

   Create a `.env` file in the root directory:
   ```env
   # Gemini AI Configuration
   GEMINI_API_KEY=your_gemini_api_key_here

   # Pinecone Configuration
   PINECONE_API_KEY=your_pinecone_api_key_here
   PINECONE_INDEX_NAME=ai-memory

   # Server Configuration
   PORT=3003

   # Neo4j Configuration
   NEO4J_URI= "enter your uri of NEO4J"
   NEO4J_USER="Enter your user"
   NEO4J_PASSWORD="your_neo4j_password"
   ```

   Create a `.env.local` file in the `frontend/` directory:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3003
   ```

### Running the Application

1. **Start the backend server** (from root directory)
   ```bash
   npm run dev
   ```
   The API will run on e.g `http://localhost:3003`

2. **Start the frontend** (in a new terminal)
   ```bash
   cd frontend
   npm run dev
   ```
   The frontend will run on e.g `http://localhost:3000`

## 📚 API Documentation

```
http://localhost:3003
```
## 📁 Project Structure

```
AI-Memory/
├── frontend/                  # Next.js frontend application
│   ├── app/                  # Next.js app directory
│   │   ├── layout.js        # Root layout
│   │   ├── page.js          # Main dashboard page
│   │   └── globals.css      # Global styles
│   ├── src/                  # React source code
│   │   ├── components/      # React components
│   │   │   ├── GraphView.js # Graph visualization
│   │   │   ├── Header.js    # Top navigation
│   │   │   ├── LeftSidebar.js # Navigation sidebar
│   │   │   ├── RightSidebar.js # Memory details panel
│   │   │   ├── Footer.js    # Footer
│   │   │   ├── Legend.js    # Graph legend
│   │   │   ├── LoadingSpinner.js # Loading indicator
│   │   │   └── SemanticSearchView.js # Search interface
│   │   ├── App.js           # Main React app (if not using Next.js)
│   │   └── index.js         # React entry point
│   ├── package.json         # Frontend dependencies
│   └── tailwind.config.js   # Tailwind CSS configuration
│
├── add-memory/               # Backend route: Add memory
│   └── route.jsx
│
├── get-graph/                # Backend route: Neo4j graph data
│   └── route.jsx
│
├── get-response/             # Backend route: AI responses (legacy)
│   └── route.jsx
│
├── semantic-search/          # Backend route: Semantic search with subgraph
│   └── route.jsx
│
├── visualize/                # Backend route: Basic visualization data
│   └── route.jsx
│
├── scripts/                  # Test scripts
│   ├── testAddMemory.js     # Test memory creation
│   ├── testGetResponse.js   # Test response generation
│   ├── testSemanticSearch.js # Test semantic search
│   ├── testGraphFilters.js  # Test graph filters
│   └── testAll.js           # Run all tests
│
├── geminiClient.jsx          # Google Gemini AI client
├── pineconeClient.jsx        # Pinecone vector database client
├── neo4jClient.jsx           # Neo4j graph database client
├── server.jsx                # Express server
├── package.json              # Backend dependencies
├── .env                      # Environment variables (create this)
│
├── CODEBASE_ANALYSIS.md      # Detailed feature analysis
├── IMPLEMENTATION_PLAN.md    # Relationship implementation plan
├── GRAPH_FILTER_INFO.md      # Graph filter documentation
└── README.md                 # This file
```

##  Project Application Mockup

**Home**

<img width="1366" height="768" alt="Screenshot (702)" src="https://github.com/user-attachments/assets/fe902ef3-e43c-4824-8b46-a46970597b43" />

**Application memory view** 

<img width="1366" height="768" alt="Screenshot (703)" src="https://github.com/user-attachments/assets/95d7d15e-1f9e-46d8-a16c-3d8c5150e4ef" />

**Semantic Search**

<img width="1366" height="768" alt="Screenshot (704)" src="https://github.com/user-attachments/assets/7cc59115-3930-4159-bb1f-96b6d1d49958" />
---

**Note**: Make sure your `.env` file is configured and both Pinecone and Neo4j are accessible before running tests.


**Built with ❤️ for semantic memory management**
