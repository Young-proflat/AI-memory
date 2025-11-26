import React, { useState } from 'react';
import axios from 'axios';
import GraphView from './GraphView';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3003';

function SemanticSearchView({ onNodeClick, onLinkClick, getNodeColor, getNodeSize, getLinkColor }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [searchDepth, setSearchDepth] = useState(2);
  const [includeSubgraph, setIncludeSubgraph] = useState(true);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/semantic-search`, {
        query: searchQuery,
        topK: 10,
        depth: searchDepth,
        includeSubgraph: includeSubgraph,
      });

      if (response.data.status === 'success') {
        setSearchResults(response.data.data);

        // Build graph data from subgraph if available
        if (response.data.data.subgraph) {
          const nodes = response.data.data.subgraph.nodes.map(node => ({
            id: node.id,
            type: 'memory',
            label: node.label || node.content?.substring(0, 50) || node.id,
            fullContent: node.content,
            category: node.category,
            namespace: node.namespace,
            metadata: node.metadata,
          }));

          const links = response.data.data.subgraph.edges.map(edge => ({
            source: edge.source,
            target: edge.target,
            type: edge.type,
            similarity: edge.similarity,
            confidence: edge.confidence,
          }));

          setGraphData({ nodes, links });
        } else {
          // Fallback to seed memories only
          const nodes = response.data.data.seedMemories.map(memory => ({
            id: memory.id,
            type: 'memory',
            label: memory.content?.substring(0, 50) || memory.id,
            fullContent: memory.content,
            category: memory.category,
            namespace: memory.namespace,
            metadata: memory.metadata,
          }));
          setGraphData({ nodes, links: [] });
        }
      }
    } catch (error) {
      console.error('Error performing semantic search:', error);
      alert('Search failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-900 relative overflow-hidden">
      <h1 className="text-3xl font-bold text-slate-50 py-6 px-8 m-0 border-b border-slate-700">Semantic Search</h1>
      
      <div className="p-8 border-b border-slate-700">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex gap-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter search query..."
              className="flex-1 p-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              disabled={isSearching}
            />
            <button
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-indigo-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
          
          <div className="flex gap-6 items-center text-sm">
            <label className="flex items-center gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={includeSubgraph}
                onChange={(e) => setIncludeSubgraph(e.target.checked)}
                className="w-4 h-4"
              />
              <span>Include connected subgraph</span>
            </label>
            {includeSubgraph && (
              <label className="flex items-center gap-2 text-slate-300">
                <span>Depth:</span>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={searchDepth}
                  onChange={(e) => setSearchDepth(parseInt(e.target.value) || 2)}
                  className="w-16 p-2 bg-slate-800 border border-slate-700 rounded text-slate-200"
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {searchResults && (
        <div className="p-4 bg-slate-800/50 border-b border-slate-700">
          <div className="max-w-4xl mx-auto text-sm text-slate-300">
            Found <strong className="text-slate-100">{searchResults.seedMemories.length}</strong> seed memories
            {searchResults.subgraph && (
              <> • <strong className="text-slate-100">{searchResults.subgraph.totalNodes}</strong> nodes in subgraph
              • <strong className="text-slate-100">{searchResults.subgraph.totalEdges}</strong> relationships</>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        {graphData.nodes.length > 0 ? (
          <GraphView
            graphData={graphData}
            onNodeClick={onNodeClick}
            onLinkClick={onLinkClick}
            getNodeColor={getNodeColor}
            getNodeSize={getNodeSize}
            getLinkColor={getLinkColor}
            error={null}
            onSync={() => {}}
            onTestConnection={() => {}}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
            {searchResults ? 'No results found' : 'Enter a search query to find related memories'}
          </div>
        )}
      </div>
    </div>
  );
}

export default SemanticSearchView;




