'use client'

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Header from '../src/components/Header';
import Footer from '../src/components/Footer';
import LeftSidebar from '../src/components/LeftSidebar';
import RightSidebar from '../src/components/RightSidebar';
import GraphView from '../src/components/GraphView';
import Legend from '../src/components/Legend';
import LoadingSpinner from '../src/components/LoadingSpinner';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003';

export default function Home() {
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

    setGraphData({ nodes, links });
  }, [filterCategory, activeNamespace]);

  // Fetch memories from Pinecone API
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
  }, [filterCategory, activeNamespace, buildGraph, rawMemories]);

  // Initial fetch
  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Get unique categories and users for filters
  const categories = [...new Set(graphData.nodes.filter(n => n.type === 'category').map(n => n.category))];
  const userIds = [...new Set(graphData.nodes.filter(n => n.type === 'user').map(n => n.userId))];

  // Color nodes by type (Pinecone data structure)
  const getNodeColor = (node) => {
    switch (node.type) {
      case 'memory':
        return '#10B981'; // Emerald green
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

  // Color links by relationship type (Pinecone data structure)
  const getLinkColor = (link) => {
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
        return (
          <div className="flex-1 flex flex-col bg-slate-900 relative overflow-hidden">
            <h1 className="text-3xl font-bold text-slate-50 py-6 px-8 m-0 border-b border-slate-700">Detailed Memory View</h1>
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {graphData.nodes.filter(n => n.type === 'memory').map((node) => (
                  <div 
                    key={node.id}
                    onClick={() => handleNodeClick(node)}
                    className="p-4 bg-slate-800 rounded-lg border border-slate-700 cursor-pointer hover:border-indigo-500 transition-colors"
                  >
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">{node.label}</h3>
                    <p className="text-xs text-slate-400">{node.namespace || 'default'}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'semantic':
        return (
          <div className="flex-1 flex flex-col bg-slate-900 relative overflow-hidden">
            <h1 className="text-3xl font-bold text-slate-50 py-6 px-8 m-0 border-b border-slate-700">Semantic Search</h1>
            <div className="flex-1 p-8">
              <div className="max-w-2xl mx-auto">
                <input
                  type="text"
                  placeholder="Enter search query..."
                  className="w-full p-4 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button className="mt-4 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg hover:shadow-indigo-500/40 transition-all">
                  Search
                </button>
              </div>
            </div>
          </div>
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



