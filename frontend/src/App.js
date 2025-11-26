import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Header from './components/Header';
import Footer from './components/Footer';
import LeftSidebar from './components/LeftSidebar';
import RightSidebar from './components/RightSidebar';
import GraphView from './components/GraphView';
import Legend from './components/Legend';
import LoadingSpinner from './components/LoadingSpinner';
import SemanticSearchView from './components/SemanticSearchView';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3003';

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [rawMemories, setRawMemories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [activeNamespace, setActiveNamespace] = useState('');
  const [namespaces, setNamespaces] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState('dashboard');
  const [showUpdates, setShowUpdates] = useState(true);
  const [showExtends, setShowExtends] = useState(true);
  const [showDerives, setShowDerives] = useState(true);

  // Build graph structure from Pinecone memories
  const buildGraph = useCallback((memories) => {
    const nodes = [];
    const links = [];
    const nodeMap = new Map();
    const categoryNodes = new Map();
    const userNodes = new Map();
    const conversationNodes = new Map();
    const namespaceNodes = new Map();

    // Filter memories if filters are applied
    let filteredMemories = memories;
    if (filterCategory) {
      filteredMemories = filteredMemories.filter(m => 
        m.metadata?.category === filterCategory || m.namespace === filterCategory
      );
    }
    if (activeNamespace) {
      filteredMemories = filteredMemories.filter(m => 
        m.namespace === activeNamespace
      );
    }
    // Filter by search query
    if (searchQuery && searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase().trim();
      filteredMemories = filteredMemories.filter(m => {
        const content = (m.metadata?.content || '').toLowerCase();
        const category = (m.metadata?.category || m.namespace || '').toLowerCase();
        const memoryId = (m.id || '').toLowerCase();
        return content.includes(queryLower) || 
               category.includes(queryLower) || 
               memoryId.includes(queryLower);
      });
    }

    // Create nodes and links from Pinecone memories
    filteredMemories.forEach((memory, index) => {
      const memoryId = memory.id || `memory_${index}`;
      const category = memory.metadata?.category || memory.namespace || 'uncategorized';
      const userId = memory.metadata?.user_id || 'unknown';
      const conversationId = memory.metadata?.conversation_id || 'unknown';
      const content = memory.metadata?.content || 'No content';
      const namespace = memory.namespace || 'default';

      // Create namespace node
      if (!namespaceNodes.has(namespace)) {
        nodes.push({
          id: `namespace_${namespace}`,
          type: 'namespace',
          label: namespace,
          namespace: namespace,
        });
        namespaceNodes.set(namespace, true);
      }

      // Create memory node
      if (!nodeMap.has(memoryId)) {
        nodes.push({
          id: memoryId,
          type: 'memory',
          label: content.substring(0, 50) + (content.length > 50 ? '...' : ''),
          fullContent: content,
          category: category,
          userId: userId,
          conversationId: conversationId,
          namespace: namespace,
          metadata: memory.metadata,
          relationships: {
            updates: [],
            extends: [],
            derives: [],
            updatedBy: [],
            extendedBy: [],
            derivedFrom: []
          }
        });
        nodeMap.set(memoryId, true);
      }

      // Create category node
      if (!categoryNodes.has(category)) {
        nodes.push({
          id: `category_${category}`,
          type: 'category',
          label: category,
          category: category,
        });
        categoryNodes.set(category, true);
      }

      // Create user node
      if (userId !== 'unknown' && !userNodes.has(userId)) {
        nodes.push({
          id: `user_${userId}`,
          type: 'user',
          label: userId,
          userId: userId,
        });
        userNodes.set(userId, true);
      }

      // Create conversation node
      if (conversationId !== 'unknown' && !conversationNodes.has(conversationId)) {
        nodes.push({
          id: `conv_${conversationId}`,
          type: 'conversation',
          label: conversationId.substring(0, 20),
          conversationId: conversationId,
        });
        conversationNodes.set(conversationId, true);
      }

      // Create links
      links.push({
        source: memoryId,
        target: `namespace_${namespace}`,
        type: 'belongs_to_namespace',
      });

      links.push({
        source: memoryId,
        target: `category_${category}`,
        type: 'belongs_to',
      });

      if (userId !== 'unknown') {
        links.push({
          source: memoryId,
          target: `user_${userId}`,
          type: 'created_by',
        });
      }

      if (conversationId !== 'unknown') {
        links.push({
          source: memoryId,
          target: `conv_${conversationId}`,
          type: 'in_conversation',
        });
      }
    });

    // Add Neo4j relationships (UPDATES, EXTENDS, DERIVES) if available
    if (window.__neo4jRelationships && Array.isArray(window.__neo4jRelationships)) {
      window.__neo4jRelationships.forEach(rel => {
        // Only add if both source and target nodes exist in our graph
        const sourceNode = nodes.find(n => n.id === rel.source);
        const targetNode = nodes.find(n => n.id === rel.target);
        
        if (sourceNode && targetNode) {
          // Check if link already exists
          const linkExists = links.some(l => 
            (l.source === rel.source || l.source?.id === rel.source) &&
            (l.target === rel.target || l.target?.id === rel.target) &&
            l.type === rel.type
          );
          
          if (!linkExists) {
            links.push({
              source: rel.source,
              target: rel.target,
              type: rel.type,
              similarity: rel.similarity,
              data: rel.data
            });
          }
          
          // Store relationship information in nodes for detailed view
          if (rel.type === 'UPDATES') {
            if (!sourceNode.relationships) sourceNode.relationships = { updates: [], extends: [], derives: [], updatedBy: [], extendedBy: [], derivedFrom: [] };
            sourceNode.relationships.updates.push({
              targetId: rel.target,
              targetLabel: targetNode.label,
              similarity: rel.similarity,
              data: rel.data
            });
            if (!targetNode.relationships) targetNode.relationships = { updates: [], extends: [], derives: [], updatedBy: [], extendedBy: [], derivedFrom: [] };
            targetNode.relationships.updatedBy.push({
              sourceId: rel.source,
              sourceLabel: sourceNode.label,
              similarity: rel.similarity,
              data: rel.data
            });
          } else if (rel.type === 'EXTENDS') {
            if (!sourceNode.relationships) sourceNode.relationships = { updates: [], extends: [], derives: [], updatedBy: [], extendedBy: [], derivedFrom: [] };
            sourceNode.relationships.extends.push({
              targetId: rel.target,
              targetLabel: targetNode.label,
              similarity: rel.similarity,
              data: rel.data
            });
            if (!targetNode.relationships) targetNode.relationships = { updates: [], extends: [], derives: [], updatedBy: [], extendedBy: [], derivedFrom: [] };
            targetNode.relationships.extendedBy.push({
              sourceId: rel.source,
              sourceLabel: sourceNode.label,
              similarity: rel.similarity,
              data: rel.data
            });
          } else if (rel.type === 'DERIVES') {
            if (!sourceNode.relationships) sourceNode.relationships = { updates: [], extends: [], derives: [], updatedBy: [], extendedBy: [], derivedFrom: [] };
            sourceNode.relationships.derives.push({
              targetId: rel.target,
              targetLabel: targetNode.label,
              similarity: rel.similarity,
              data: rel.data
            });
            if (!targetNode.relationships) targetNode.relationships = { updates: [], extends: [], derives: [], updatedBy: [], extendedBy: [], derivedFrom: [] };
            targetNode.relationships.derivedFrom.push({
              sourceId: rel.source,
              sourceLabel: sourceNode.label,
              similarity: rel.similarity,
              data: rel.data
            });
          }
        }
      });
    }

    // Filter links based on graph filter checkboxes
    let filteredLinks = links;
    if (!showUpdates) {
      filteredLinks = filteredLinks.filter(link => link.type !== 'UPDATES');
    }
    if (!showExtends) {
      filteredLinks = filteredLinks.filter(link => link.type !== 'EXTENDS');
    }
    if (!showDerives) {
      filteredLinks = filteredLinks.filter(link => link.type !== 'DERIVES');
    }

    setGraphData({ nodes, links: filteredLinks });
  }, [filterCategory, activeNamespace, showUpdates, showExtends, showDerives, searchQuery]);

  // Fetch memories from Pinecone API and relationships from Neo4j
  const fetchMemories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch from Pinecone /visualize endpoint
      const response = await axios.get(`${API_BASE_URL}/visualize`);
      
      if (response.data.status === 'success') {
        const memories = response.data.data.memories;
        const uniqueNamespaces = [...new Set(memories.map(m => m.namespace || 'default'))];
        setNamespaces(uniqueNamespaces);
        setRawMemories(memories);
        
        // Also fetch Neo4j graph relationships (UPDATES, EXTENDS, DERIVES)
        try {
          const graphResponse = await axios.get(`${API_BASE_URL}/get-graph`, {
            params: { maxNodes: 1000 }
          });
          
          if (graphResponse.data.status === 'success' && graphResponse.data.data.edges) {
            // Store Neo4j relationships for merging in buildGraph
            window.__neo4jRelationships = graphResponse.data.data.edges.map(edge => ({
              source: edge.source,
              target: edge.target,
              type: edge.relationshipType || edge.type || 'RELATED_TO',
              similarity: edge.similarity,
              data: edge.data
            }));
          }
        } catch (neo4jErr) {
          console.log('Neo4j relationships not available:', neo4jErr.message);
          window.__neo4jRelationships = [];
        }
        
        buildGraph(memories);
      } else {
        throw new Error('Failed to fetch memories from Pinecone');
      }
    } catch (err) {
      console.error('Error fetching memories from Pinecone:', err);
      setError(err.message || 'Failed to load Pinecone data');
    } finally {
      setLoading(false);
    }
  }, [buildGraph]);

  // Rebuild graph when filters change
  useEffect(() => {
    if (rawMemories.length > 0) {
      buildGraph(rawMemories);
    }
  }, [filterCategory, activeNamespace, showUpdates, showExtends, showDerives, searchQuery, buildGraph, rawMemories]);

  // Initial fetch
  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Get unique categories and users for filters
  const categories = [...new Set(graphData.nodes.filter(n => n.type === 'category').map(n => n.category))];
  const userIds = [...new Set(graphData.nodes.filter(n => n.type === 'user').map(n => n.userId))];

  // Color nodes by type and status (Pinecone data structure + status)
  const getNodeColor = (node) => {
    // Check if memory is outdated
    if (node.type === 'memory' && (node.metadata?.status === 'outdated' || node.metadata?.isLatest === false)) {
      return '#6B7280'; // Gray for outdated memories
    }
    
    switch (node.type) {
      case 'memory':
        return '#10B981'; // Emerald green for active memories
      case 'category':
        return '#3B82F6'; // Blue
      case 'user':
        return '#F59E0B'; // Amber
      case 'conversation':
        return '#8B5CF6'; // Purple
      case 'namespace':
        return '#EC4899'; // Pink
      default:
        return '#6B7280'; // Gray
    }
  };

  // Size nodes by type (Pinecone data structure)
  const getNodeSize = (node) => {
    switch (node.type) {
      case 'memory':
        return 6;
      case 'category':
        return 14;
      case 'user':
        return 12;
      case 'conversation':
        return 10;
      case 'namespace':
        return 16;
      default:
        return 6;
    }
  };

  // Color links by relationship type (Pinecone data structure + Graph filters)
  const getLinkColor = (link) => {
    // Graph filter relationships (from Neo4j)
    if (link.type === 'UPDATES') {
      return '#EF4444'; // Red for updates
    }
    if (link.type === 'EXTENDS') {
      return '#3B82F6'; // Blue for extensions
    }
    if (link.type === 'DERIVES') {
      return '#8B5CF6'; // Purple for derived
    }
    if (link.type === 'SIMILAR_TO' || link.type === 'RELATED_TO') {
      return '#10B981'; // Green for similarity
    }
    
    // Original Pinecone relationships
    switch (link.type) {
      case 'belongs_to_namespace':
        return '#EC4899'; // Pink
      case 'belongs_to':
        return '#3B82F6'; // Blue
      case 'created_by':
        return '#F59E0B'; // Amber
      case 'in_conversation':
        return '#8B5CF6'; // Purple
      default:
        return 'rgba(255, 255, 255, 0.3)';
    }
  };

  // Test connection
  const testConnection = async () => {
    try {
      setLoading(true);
      await fetchMemories();
    } catch (err) {
      setError('Connection test failed: ' + err.message);
    }
  };

  // Handle node click
  const handleNodeClick = (node) => {
    setSelectedNode(node);
    setSelectedLink(null);
  };

  // Handle link click
  const handleLinkClick = (link) => {
    setSelectedLink(link);
    setSelectedNode(null);
  };

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Render view based on activeView
  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return (
          <>
            <GraphView
              graphData={graphData}
              onNodeClick={handleNodeClick}
              onLinkClick={handleLinkClick}
              getNodeColor={getNodeColor}
              getNodeSize={getNodeSize}
              getLinkColor={getLinkColor}
              error={error}
              onSync={fetchMemories}
              onTestConnection={testConnection}
            />
            <Legend />
          </>
        );
      case 'detailed':
        // Filter memories based on graph filter checkboxes
        let filteredMemoryNodes = graphData.nodes.filter(n => n.type === 'memory');
        
        // Filter by relationship types if checkboxes are unchecked
        if (!showUpdates || !showExtends || !showDerives) {
          filteredMemoryNodes = filteredMemoryNodes.filter(node => {
            const rels = node.relationships || {};
            // Show node if it has at least one relationship of the enabled types
            const hasUpdates = showUpdates && (rels.updates?.length > 0 || rels.updatedBy?.length > 0);
            const hasExtends = showExtends && (rels.extends?.length > 0 || rels.extendedBy?.length > 0);
            const hasDerives = showDerives && (rels.derives?.length > 0 || rels.derivedFrom?.length > 0);
            
            // If all filters are disabled, show all nodes
            if (!showUpdates && !showExtends && !showDerives) {
              return true;
            }
            
            // Show node if it has at least one enabled relationship type
            return hasUpdates || hasExtends || hasDerives;
          });
        }
        
        return (
          <div className="flex-1 flex flex-col bg-slate-900 relative overflow-hidden">
            <h1 className="text-3xl font-bold text-slate-50 py-6 px-8 m-0 border-b border-slate-700">Detailed Memory View</h1>
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMemoryNodes.map((node) => {
                  const rels = node.relationships || {};
                  const hasUpdates = (rels.updates?.length > 0 || rels.updatedBy?.length > 0) && showUpdates;
                  const hasExtends = (rels.extends?.length > 0 || rels.extendedBy?.length > 0) && showExtends;
                  const hasDerives = (rels.derives?.length > 0 || rels.derivedFrom?.length > 0) && showDerives;
                  
                  return (
                    <div 
                      key={node.id}
                      onClick={() => handleNodeClick(node)}
                      className="p-4 bg-slate-800 rounded-lg border border-slate-700 cursor-pointer hover:border-indigo-500 transition-colors"
                    >
                      <h3 className="text-sm font-semibold text-slate-300 mb-2">{node.label}</h3>
                      <p className="text-xs text-slate-400 mb-3">{node.namespace || 'default'}</p>
                      
                      {/* Graph Filter Information */}
                      <div className="space-y-2 mt-3">
                        {/* Show graphFilter type from metadata - this shows if memory is marked as update, extend, or derive */}
                        {node.metadata?.graphFilter && (
                          <div className="mb-2 p-2 bg-slate-900/50 rounded border border-slate-600">
                            <div className="text-xs font-semibold text-slate-400 mb-1">Graph Filter Type:</div>
                            <span className={`text-xs px-2 py-1 rounded border ${
                              node.metadata.graphFilter.toLowerCase() === 'update' 
                                ? 'bg-red-500/20 text-red-300 border-red-500/30' 
                                : node.metadata.graphFilter.toLowerCase() === 'extend'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            }`}>
                              {node.metadata.graphFilter === 'update' && '↻ '}
                              {node.metadata.graphFilter === 'extend' && '⇄ '}
                              {node.metadata.graphFilter === 'derive' && '🏷 '}
                              {node.metadata.graphFilter.charAt(0).toUpperCase() + node.metadata.graphFilter.slice(1)}
                            </span>
                            <p className="text-xs text-slate-500 mt-1">
                              This memory is marked as <strong>{node.metadata.graphFilter}</strong> in Pinecone metadata
                            </p>
                          </div>
                        )}
                        
                        {/* Relationship Information from Neo4j */}
                        <div className="p-2 bg-slate-900/50 rounded border border-slate-600">
                          <div className="text-xs font-semibold text-slate-400 mb-2">Relationships (Neo4j):</div>
                          <div className="space-y-2">
                            {hasUpdates && (
                              <div className="space-y-1">
                                <div className="text-xs text-slate-500">Update Relationships:</div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {rels.updates?.length > 0 && (
                                    <span className="text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded border border-red-500/30">
                                      ↻ Updates {rels.updates.length} memory{rels.updates.length !== 1 ? 'ies' : 'y'}
                                    </span>
                                  )}
                                  {rels.updatedBy?.length > 0 && (
                                    <span className="text-xs px-2 py-1 bg-red-500/20 text-red-300 rounded border border-red-500/30">
                                      Updated by {rels.updatedBy.length} memory{rels.updatedBy.length !== 1 ? 'ies' : 'y'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            {hasExtends && (
                              <div className="space-y-1">
                                <div className="text-xs text-slate-500">Extend Relationships:</div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {rels.extends?.length > 0 && (
                                    <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                                      ⇄ Extends {rels.extends.length} memory{rels.extends.length !== 1 ? 'ies' : 'y'}
                                    </span>
                                  )}
                                  {rels.extendedBy?.length > 0 && (
                                    <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">
                                      Extended by {rels.extendedBy.length} memory{rels.extendedBy.length !== 1 ? 'ies' : 'y'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            {hasDerives && (
                              <div className="space-y-1">
                                <div className="text-xs text-slate-500">Derive Relationships:</div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {rels.derives?.length > 0 && (
                                    <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                                      🏷 Derives from {rels.derives.length} memory{rels.derives.length !== 1 ? 'ies' : 'y'}
                                    </span>
                                  )}
                                  {rels.derivedFrom?.length > 0 && (
                                    <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
                                      Derived by {rels.derivedFrom.length} memory{rels.derivedFrom.length !== 1 ? 'ies' : 'y'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                            {!hasUpdates && !hasExtends && !hasDerives && (
                              <span className="text-xs text-slate-500 italic">No Neo4j relationships found</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Full content preview */}
                      {node.fullContent && (
                        <p className="text-xs text-slate-500 mt-3 line-clamp-2">
                          {node.fullContent.substring(0, 100)}...
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              {filteredMemoryNodes.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-lg mb-2">No memories found</p>
                  <p className="text-sm">Try adjusting your filters or search query</p>
                </div>
              )}
            </div>
          </div>
        );
      case 'semantic':
        return (
          <SemanticSearchView 
            onNodeClick={handleNodeClick}
            onLinkClick={handleLinkClick}
            getNodeColor={getNodeColor}
            getNodeSize={getNodeSize}
            getLinkColor={getLinkColor}
          />
        );
      case 'controls':
        return (
          <div className="flex-1 flex flex-col bg-slate-900 relative overflow-hidden">
            <h1 className="text-3xl font-bold text-slate-50 py-6 px-8 m-0 border-b border-slate-700">Graph Controls</h1>
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="max-w-2xl space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Node Size Multiplier</label>
                  <input type="range" min="0.5" max="2" step="0.1" defaultValue="1" className="w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Link Width</label>
                  <input type="range" min="1" max="5" step="0.5" defaultValue="2" className="w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Physics Strength</label>
                  <input type="range" min="0" max="1" step="0.1" defaultValue="0.5" className="w-full" />
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading && graphData.nodes.length === 0) {
    return (
      <div className="flex flex-col h-screen w-screen bg-slate-900">
        <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
        <div className="flex flex-1 overflow-hidden">
          {sidebarOpen && (
            <div className="w-70 bg-slate-800 border-r border-slate-700 p-6">
              <LoadingSpinner message="Loading memories from Pinecone..." />
            </div>
          )}
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-900">
      <Header searchQuery={searchQuery} setSearchQuery={setSearchQuery} onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />
      
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar
          namespaces={namespaces}
          activeNamespace={activeNamespace}
          setActiveNamespace={setActiveNamespace}
          categories={categories}
          filterCategory={filterCategory}
          setFilterCategory={setFilterCategory}
          userIds={userIds}
          filterUserId={''}
          setFilterUserId={() => {}}
          onSync={fetchMemories}
          onTestConnection={testConnection}
          loading={loading}
          activeView={activeView}
          setActiveView={setActiveView}
          sidebarOpen={sidebarOpen}
          showUpdates={showUpdates}
          setShowUpdates={setShowUpdates}
          showExtends={showExtends}
          setShowExtends={setShowExtends}
          showDerives={showDerives}
          setShowDerives={setShowDerives}
        />

        <div className="flex-1 flex flex-col bg-slate-900 relative overflow-hidden">
          {renderView()}
        </div>

        <RightSidebar
          selectedNode={selectedNode}
          selectedLink={selectedLink}
        />
      </div>

      <Footer />
    </div>
  );
}

export default App;
