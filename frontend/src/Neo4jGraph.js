import React, { useState, useEffect, useCallback, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3003';

function Neo4jGraph({ onSwitchView }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [filterNamespace, setFilterNamespace] = useState('');
  const [maxNodes, setMaxNodes] = useState(50);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.75);
  const [namespaces, setNamespaces] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [graphStats, setGraphStats] = useState({
    totalNodes: 0,
    totalLinks: 0,
    avgSimilarity: 0,
  });
  const fgRef = useRef();

  // Fetch namespaces from Neo4j
  const fetchNamespaces = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/get-graph/namespaces`);
      if (response.data.status === 'success') {
        setNamespaces(response.data.data.namespaces || []);
      }
    } catch (err) {
      console.error('Error fetching namespaces:', err);
    }
  }, []);

  // Fetch graph data from Neo4j
  const fetchGraphData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(`${API_BASE_URL}/get-graph`, {
        params: {
          namespace: filterNamespace || null,
          maxNodes: maxNodes,
          similarityThreshold: similarityThreshold,
        },
      });
      
      if (response.data.status === 'success') {
        const { nodes, edges } = response.data.data;
        
        // Transform nodes to graph format
        const graphNodes = nodes.map(node => ({
          id: node.id,
          label: node.data?.label || node.id,
          title: node.data?.title || node.data?.label || node.id,
          content: node.data?.content || '',
          category: node.data?.category || node.data?.namespace || 'default',
          namespace: node.data?.namespace || 'default',
          createdAt: node.data?.createdAt || '',
          metadata: node.data || {},
          // Visual properties
          nodeType: 'memory',
        }));

        // Transform edges to graph format
        const graphLinks = edges.map(edge => ({
          source: edge.source,
          target: edge.target,
          id: edge.id,
          similarity: edge.data?.similarity || 0,
          relationshipType: edge.data?.relationshipType || edge.relationshipType || 'SIMILAR_TO',
          crossNamespace: edge.data?.crossNamespace || false,
          // Visual properties
          linkType: edge.data?.relationshipType || 'SIMILAR_TO',
        }));

        setGraphData({ nodes: graphNodes, links: graphLinks });

        // Calculate statistics
        const similarities = graphLinks
          .map(link => link.similarity)
          .filter(sim => sim > 0);
        const avgSimilarity = similarities.length > 0
          ? similarities.reduce((a, b) => a + b, 0) / similarities.length
          : 0;

        setGraphStats({
          totalNodes: graphNodes.length,
          totalLinks: graphLinks.length,
          avgSimilarity: avgSimilarity,
        });
      } else {
        throw new Error('Failed to fetch graph data');
      }
    } catch (err) {
      console.error('Error fetching graph data:', err);
      setError(err.message || 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  }, [filterNamespace, maxNodes, similarityThreshold]);

  // Sync data from Pinecone to Neo4j
  const syncData = useCallback(async () => {
    try {
      setSyncStatus('syncing');
      const response = await axios.post(`${API_BASE_URL}/get-graph/sync`, {
        namespace: filterNamespace || null,
        similarityThreshold: similarityThreshold,
      });
      if (response.data.status === 'success') {
        setSyncStatus({
          nodesCreated: response.data.data.nodesCreated,
          relationshipsCreated: response.data.data.relationshipsCreated,
        });
        // Refresh graph data after sync
        setTimeout(() => {
          fetchGraphData();
        }, 1000);
      }
    } catch (err) {
      console.error('Error syncing data:', err);
      setSyncStatus('error');
    }
  }, [filterNamespace, similarityThreshold, fetchGraphData]);

  // Initial fetch
  useEffect(() => {
    fetchNamespaces();
    fetchGraphData();
  }, [fetchNamespaces, fetchGraphData]);

  // Color nodes by namespace/category - matching reference image style with distinct clusters
  const getNodeColor = (node) => {
    // Color palette similar to reference image (distinct, vibrant clusters)
    const colors = {
      'user-research': '#42A5F5',        // Blue cluster
      'team-insights': '#AB47BC',        // Purple cluster
      'community-moments': '#66BB6A',    // Green cluster
      'creative-discoveries': '#FFA726',  // Orange/Yellow cluster
      'urban-notes': '#EF5350',          // Red cluster
      'customer-reflections': '#26A69A', // Teal/Cyan cluster
      'default': '#78909C',              // Gray
    };
    
    // Use namespace first, then category, then default
    const namespace = node.namespace || node.category || 'default';
    return colors[namespace] || colors[node.category] || colors['default'];
  };

  // Size nodes based on connections - matching reference image with varied sizes
  const getNodeSize = (node) => {
    const linkCount = graphData.links.filter(
      link => link.source === node.id || link.target === node.id
    ).length;
    // More dramatic size variation like reference: 6-30 pixels
    // Central/highly connected nodes are much larger
    if (linkCount === 0) return 6;
    if (linkCount <= 2) return 8;
    if (linkCount <= 5) return 12;
    if (linkCount <= 10) return 18;
    if (linkCount <= 15) return 24;
    return 30; // Very highly connected nodes
  };

  // Color links by relationship type and similarity - matching reference style
  const getLinkColor = (link) => {
    if (link.relationshipType === 'SIMILAR_TO') {
      // Color by similarity with more subtle tones (like reference)
      const similarity = link.similarity || 0;
      if (similarity >= 0.85) return '#81C784'; // Light green
      if (similarity >= 0.75) return '#64B5F6'; // Light blue
      if (similarity >= 0.65) return '#BA68C8'; // Light purple
      if (similarity >= 0.55) return '#FFB74D'; // Light orange
      return '#90A4AE'; // Gray for weak connections
    }
    if (link.relationshipType === 'RELATED_TO') {
      return '#F06292'; // Pink for cross-namespace
    }
    return '#A1887F'; // Brown default
  };

  // Width links by similarity - matching reference with varied thickness
  const getLinkWidth = (link) => {
    const similarity = link.similarity || 0.5;
    // More variation: 1px to 5px based on similarity (like reference)
    if (similarity >= 0.85) return 5; // Thick for strong connections
    if (similarity >= 0.75) return 4;
    if (similarity >= 0.65) return 3;
    if (similarity >= 0.55) return 2;
    return 1.5; // Thin for weak connections
  };

  // Handle node click
  const handleNodeClick = (node) => {
    setSelectedNode(node);
    setSelectedLink(null);
    
    // Center on node
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(2, 1000);
    }
  };

  // Handle link click
  const handleLinkClick = (link) => {
    setSelectedLink(link);
    setSelectedNode(null);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading Neo4j graph data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={fetchGraphData}>Retry</button>
        <div style={{ marginTop: '20px', padding: '15px', background: '#1a1f3a', borderRadius: '8px' }}>
          <p style={{ color: '#a0a0a0', marginBottom: '10px' }}>
            <strong>No data in Neo4j?</strong>
          </p>
          <p style={{ color: '#a0a0a0', fontSize: '14px' }}>
            Click "Sync from Pinecone" to import your memories and create similarity relationships.
          </p>
        </div>
      </div>
    );
  }

  // Show empty state if no data
  if (!loading && graphData.nodes.length === 0) {
    return (
      <div className="app-container">
        <div className="sidebar">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h1 style={{ margin: 0 }}>Neo4j Graph Visualization</h1>
            {onSwitchView && (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => onSwitchView('pinecone')}
                  style={{
                    padding: '5px 10px',
                    background: '#2d3550',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Pinecone
                </button>
                <button
                  onClick={() => onSwitchView('neo4j')}
                  style={{
                    padding: '5px 10px',
                    background: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Neo4j
                </button>
              </div>
            )}
          </div>
          
          <div style={{ 
            padding: '30px', 
            background: '#0f1425', 
            borderRadius: '8px',
            textAlign: 'center',
            marginTop: '50px'
          }}>
            <h2 style={{ color: '#e0e0e0', marginBottom: '15px' }}>No Data in Neo4j</h2>
            <p style={{ color: '#a0a0a0', marginBottom: '20px' }}>
              Your Neo4j graph is empty. Sync your Pinecone memories to see similarity-based relationships!
            </p>
            <button 
              onClick={syncData} 
              className="refresh-btn"
              style={{ 
                background: '#2196F3',
                fontSize: '16px',
                padding: '12px 24px'
              }}
            >
              Sync from Pinecone
            </button>
            <div style={{ marginTop: '30px', padding: '20px', background: '#1a1f3a', borderRadius: '8px', textAlign: 'left' }}>
              <h3 style={{ color: '#4CAF50', marginBottom: '10px' }}>What makes Neo4j different?</h3>
              <ul style={{ color: '#a0a0a0', fontSize: '14px', lineHeight: '1.8' }}>
                <li><strong>Pinecone View:</strong> Shows memories connected to categories, users, and conversations</li>
                <li><strong>Neo4j View:</strong> Shows memories connected to <strong>other memories</strong> based on content similarity</li>
                <li>Nodes cluster together when they're similar</li>
                <li>Relationship strength is visualized by link color and thickness</li>
                <li>Highly connected memories appear larger</li>
              </ul>
            </div>
          </div>
        </div>
        <div className="graph-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#a0a0a0', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>📊</div>
            <p>Graph will appear here after syncing data</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1 style={{ margin: 0 }}>Neo4j Graph Visualization</h1>
          {onSwitchView && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => onSwitchView('pinecone')}
                style={{
                  padding: '5px 10px',
                  background: '#2d3550',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Pinecone
              </button>
              <button
                onClick={() => onSwitchView('neo4j')}
                style={{
                  padding: '5px 10px',
                  background: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Neo4j
              </button>
            </div>
          )}
        </div>
        
        <div className="stats">
          <div className="stat-item">
            <span className="stat-label">Nodes:</span>
            <span className="stat-value">{graphStats.totalNodes}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Relationships:</span>
            <span className="stat-value">{graphStats.totalLinks}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Avg Similarity:</span>
            <span className="stat-value">
              {graphStats.avgSimilarity.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="filters">
          <h3>Filters & Controls</h3>
          
          <div className="filter-group">
            <label>Namespace:</label>
            <select
              value={filterNamespace}
              onChange={(e) => setFilterNamespace(e.target.value)}
            >
              <option value="">All Namespaces</option>
              {namespaces.map(ns => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label>Max Nodes: {maxNodes}</label>
            <input
              type="range"
              min="10"
              max="200"
              value={maxNodes}
              onChange={(e) => setMaxNodes(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div className="filter-group">
            <label>Similarity Threshold: {similarityThreshold.toFixed(2)}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={similarityThreshold}
              onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <button onClick={fetchGraphData} className="refresh-btn">
            Refresh Graph
          </button>

          <button 
            onClick={syncData} 
            className="refresh-btn"
            style={{ 
              background: '#2196F3',
              marginTop: '10px'
            }}
            disabled={syncStatus === 'syncing'}
          >
            {syncStatus === 'syncing' ? 'Syncing...' : 'Sync from Pinecone'}
          </button>

          {syncStatus && typeof syncStatus === 'object' && (
            <div style={{ 
              marginTop: '10px', 
              padding: '10px', 
              background: '#0f1425', 
              borderRadius: '4px',
              fontSize: '12px',
              color: '#4CAF50'
            }}>
              <div>Nodes: {syncStatus.nodesCreated}</div>
              <div>Relationships: {syncStatus.relationshipsCreated}</div>
            </div>
          )}
        </div>

        {selectedNode && (
          <div className="node-details">
            <h3>Node Details</h3>
            <div className="detail-item">
              <strong>ID:</strong> {selectedNode.id}
            </div>
            <div className="detail-item">
              <strong>Label:</strong> {selectedNode.label}
            </div>
            {selectedNode.content && (
              <div className="detail-item">
                <strong>Content:</strong>
                <p className="content-text">{selectedNode.content}</p>
              </div>
            )}
            {selectedNode.namespace && (
              <div className="detail-item">
                <strong>Namespace:</strong> {selectedNode.namespace}
              </div>
            )}
            {selectedNode.category && (
              <div className="detail-item">
                <strong>Category:</strong> {selectedNode.category}
              </div>
            )}
            {selectedNode.createdAt && (
              <div className="detail-item">
                <strong>Created:</strong> {new Date(selectedNode.createdAt).toLocaleString()}
              </div>
            )}
            <div className="detail-item">
              <strong>Connections:</strong>{' '}
              {graphData.links.filter(
                link => link.source === selectedNode.id || link.target === selectedNode.id
              ).length}
            </div>
          </div>
        )}

        {selectedLink && (
          <div className="node-details">
            <h3>Relationship Details</h3>
            <div className="detail-item">
              <strong>Type:</strong> {selectedLink.relationshipType || selectedLink.linkType}
            </div>
            {selectedLink.similarity !== undefined && (
              <div className="detail-item">
                <strong>Similarity:</strong> {selectedLink.similarity.toFixed(3)}
              </div>
            )}
            <div className="detail-item">
              <strong>Source:</strong> {selectedLink.source.id || selectedLink.source}
            </div>
            <div className="detail-item">
              <strong>Target:</strong> {selectedLink.target.id || selectedLink.target}
            </div>
            {selectedLink.crossNamespace && (
              <div className="detail-item">
                <strong>Cross-Namespace:</strong> Yes
              </div>
            )}
          </div>
        )}

        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          background: '#0f1425', 
          borderRadius: '8px',
          fontSize: '12px',
          color: '#a0a0a0'
        }}>
          <h4 style={{ color: '#e0e0e0', marginBottom: '10px' }}>Neo4j Graph Features</h4>
          <div style={{ marginBottom: '10px', padding: '8px', background: '#1a1f3a', borderRadius: '4px' }}>
            <strong style={{ color: '#4CAF50' }}>Key Difference:</strong>
            <p style={{ margin: '5px 0 0 0', fontSize: '11px' }}>
              This view shows <strong>similarity relationships</strong> between memories, 
              not just category/user connections. Nodes cluster based on content similarity.
            </p>
          </div>
          <h4 style={{ color: '#e0e0e0', marginBottom: '10px', marginTop: '15px' }}>Relationship Colors</h4>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#00FF88', fontSize: '16px' }}>━━</span> Very High Similarity (≥0.85)
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#4CAF50', fontSize: '16px' }}>━━</span> High Similarity (0.75-0.85)
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#FFC107', fontSize: '16px' }}>━━</span> Medium Similarity (0.65-0.75)
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#FF9800', fontSize: '16px' }}>━━</span> Low Similarity (0.55-0.65)
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#E91E63', fontSize: '16px' }}>━━</span> Cross-Namespace Related
          </div>
          <div style={{ marginTop: '15px', padding: '8px', background: '#1a1f3a', borderRadius: '4px', fontSize: '11px' }}>
            <strong>Tip:</strong> Larger nodes have more connections. 
            Closer nodes are more similar. Use the similarity threshold slider to filter relationships.
          </div>
        </div>
      </div>

      <div className="graph-container">
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          nodeLabel={(node) => `${node.label || node.id}`}
          nodeColor={getNodeColor}
          nodeVal={getNodeSize}
          linkColor={getLinkColor}
          linkWidth={getLinkWidth}
          // Enhanced arrow visualization
          linkDirectionalArrowLength={8}
          linkDirectionalArrowRelPos={1}
          linkDirectionalArrowColor={(link) => getLinkColor(link)}
          linkDirectionalParticles={1}
          linkDirectionalParticleSpeed={(link) => {
            const similarity = link.similarity || 0.5;
            return similarity * 0.005;
          }}
          linkDirectionalParticleWidth={2}
          linkCurvature={0.1}
          linkOpacity={0.6}
          nodeOpacity={1}
          nodeRelSize={6}
          // Enhanced physics for natural clustering like the reference image
          d3AlphaDecay={0.022}
          d3VelocityDecay={0.4}
          warmupTicks={100}
          // Stronger forces to create distinct clusters
          linkDistance={(link) => {
            const similarity = link.similarity || 0.5;
            // Closer nodes for higher similarity (creates tight clusters)
            return 80 - (similarity * 50);
          }}
          linkStrength={(link) => {
            const similarity = link.similarity || 0.5;
            // Stronger links for higher similarity
            return similarity * 0.6;
          }}
          // Charge force - nodes repel each other to create spacing
          nodeCharge={(node) => {
            const linkCount = graphData.links.filter(
              l => l.source === node.id || l.target === node.id
            ).length;
            // Larger nodes (more connected) have stronger repulsion
            return -2000 - (linkCount * 100);
          }}
          onNodeClick={handleNodeClick}
          onLinkClick={handleLinkClick}
          onNodeHover={(node) => {
            if (node) {
              document.body.style.cursor = 'pointer';
            } else {
              document.body.style.cursor = 'default';
            }
          }}
          onLinkHover={(link) => {
            if (link) {
              document.body.style.cursor = 'pointer';
            } else {
              document.body.style.cursor = 'default';
            }
          }}
          // Custom node rendering with labels and glow - matching reference style
          nodeCanvasObject={(node, ctx, globalScale) => {
            const label = (node.label || node.id).substring(0, 15);
            const fontSize = Math.max(10, 14 / Math.sqrt(globalScale));
            ctx.font = `bold ${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            // Get node properties
            const linkCount = graphData.links.filter(
              l => l.source === node.id || l.target === node.id
            ).length;
            const nodeSize = getNodeSize(node);
            const nodeColor = getNodeColor(node);
            
            // Draw glow effect for well-connected nodes (like central nodes in reference)
            if (linkCount > 3) {
              const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, nodeSize * 2);
              gradient.addColorStop(0, nodeColor);
              gradient.addColorStop(0.5, nodeColor + '80');
              gradient.addColorStop(1, nodeColor + '00');
              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.arc(node.x, node.y, nodeSize * 2.5, 0, 2 * Math.PI, false);
              ctx.fill();
            }
            
            // Reset fillStyle after gradient
            ctx.fillStyle = nodeColor;
            
            // Draw node with border for better visibility
            ctx.fillStyle = nodeColor;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI, false);
            ctx.fill();
            ctx.stroke();
            
            // Draw label with background for readability
            if (globalScale < 2) {
              const textWidth = ctx.measureText(label).width;
              const padding = 4;
              
              // Label background
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              ctx.fillRect(
                node.x - textWidth / 2 - padding,
                node.y + nodeSize + fontSize / 2 - padding,
                textWidth + padding * 2,
                fontSize + padding * 2
              );
              
              // Label text
              ctx.fillStyle = '#ffffff';
              ctx.fillText(label, node.x, node.y + nodeSize + fontSize);
            }
          }}
          backgroundColor="#0a0e27"
          cooldownTicks={200}
          onEngineStop={() => console.log('Neo4j graph rendered with advanced clustering')}
        />
      </div>
    </div>
  );
}

export default Neo4jGraph;

