'use client'

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import ForceGraph2D with SSR disabled
const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
  { ssr: false }
);

function GraphView({
  graphData,
  onNodeClick,
  onLinkClick,
  getNodeColor,
  getNodeSize,
  getLinkColor,
  error,
  onSync,
  onTestConnection
}) {
  const [isClient, setIsClient] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const graphRef = useRef(null);
  const dragElementRef = useRef(null);
  const forceGraphRef = useRef(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Auto-zoom when graph data changes
  useEffect(() => {
    if (isClient && forceGraphRef.current && graphData.nodes.length > 0) {
      // Wait for graph to render, then zoom to fit
      const timer = setTimeout(() => {
        if (forceGraphRef.current) {
          try {
            forceGraphRef.current.zoomToFit(400, 20); // 400ms duration, 20px padding
          } catch (err) {
            console.log('Auto-zoom error:', err);
          }
        }
      }, 500); // Wait 500ms for graph to stabilize

      return () => clearTimeout(timer);
    }
  }, [graphData, isClient]);

  // Handle node selection and create draggable element
  const handleNodeSelect = (node, event) => {
    const dragData = {
      id: node.id,
      label: node.label,
      content: node.fullContent || node.label,
      type: node.type,
      namespace: node.namespace,
      category: node.category,
      metadata: node.metadata,
    };
    
    setSelectedNode(node);
    window.__draggedGraphNode = dragData;
    
    // Create a draggable HTML element
    const dragElement = document.createElement('div');
    dragElement.id = 'graph-node-dragger';
    dragElement.style.position = 'fixed';
    dragElement.style.left = `${event?.clientX || 0}px`;
    dragElement.style.top = `${event?.clientY || 0}px`;
    dragElement.style.padding = '8px 12px';
    dragElement.style.backgroundColor = '#4F46E5';
    dragElement.style.color = 'white';
    dragElement.style.borderRadius = '8px';
    dragElement.style.pointerEvents = 'none';
    dragElement.style.zIndex = '10000';
    dragElement.style.opacity = '0.8';
    dragElement.textContent = `📎 ${node.label.substring(0, 30)}...`;
    dragElement.draggable = true;
    
    dragElement.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/json', JSON.stringify(dragData));
      e.dataTransfer.effectAllowed = 'copy';
    });
    
    document.body.appendChild(dragElement);
    
    // Remove after a short delay if not dragged
    setTimeout(() => {
      if (document.getElementById('graph-node-dragger')) {
        document.body.removeChild(dragElement);
      }
    }, 100);
  };

  if (error && graphData.nodes.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-slate-900 relative overflow-hidden">
        <h1 className="text-3xl font-bold text-slate-50 py-6 px-8 m-0 border-b border-slate-700">Memory Knowledge Graph</h1>
        <div className="p-10 px-8 text-slate-200">
          <p className="text-lg mb-4 text-slate-50"><strong>No memories found. Check the following:</strong></p>
          <ul className="ml-6 mb-6 leading-loose">
            <li className="mb-2 text-slate-300">Is your backend server running on port 3003?</li>
            <li className="mb-2 text-slate-300">Are environment variables set? (NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD)</li>
            <li className="mb-2 text-slate-300">Is Neo4j database running and accessible?</li>
            <li className="mb-2 text-slate-300">Have you added memories that are synced to Neo4j?</li>
            <li className="mb-2 text-slate-300">Check browser console and backend logs for errors</li>
          </ul>
          <div className="flex gap-3 mt-5">
            <button 
              onClick={onSync} 
              className="px-6 py-3 border-none rounded-md text-sm font-semibold cursor-pointer transition-all bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/40"
            >
              Sync & Refresh
            </button>
            <button 
              onClick={onTestConnection} 
              className="px-6 py-3 border-none rounded-md text-sm font-semibold cursor-pointer transition-all bg-slate-700 text-slate-200 hover:bg-slate-600"
            >
              Test Connection
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-900 relative overflow-hidden">
      <h1 className="text-3xl font-bold text-slate-50 py-6 px-8 m-0 border-b border-slate-700">Memory Knowledge Graph</h1>
      <div className="flex-1 relative overflow-hidden" ref={graphRef}>
        {isClient && (
          <ForceGraph2D
            ref={(ref) => {
              graphRef.current = ref;
              forceGraphRef.current = ref;
            }}
            graphData={graphData}
            nodeLabel={(node) => `${node.type}: ${node.label}`}
            nodeColor={getNodeColor}
            nodeVal={getNodeSize}
            linkColor={getLinkColor}
            linkWidth={2}
            onNodeClick={(node, event) => {
              onNodeClick(node);
              // Select node for dragging
              if (event) {
                handleNodeSelect(node, { clientX: event.clientX, clientY: event.clientY });
              } else {
                handleNodeSelect(node);
              }
            }}
            onLinkClick={(link) => {
              onLinkClick(link);
              // Prepare link for dragging
              const linkData = {
                id: link.source.id || link.source,
                targetId: link.target.id || link.target,
                type: link.type,
                label: `Link: ${link.type}`,
                content: `Relationship: ${link.type} between nodes`,
              };
              window.__draggedGraphNode = linkData;
              setSelectedNode({ id: linkData.id, label: linkData.label });
            }}
            onNodeRightClick={(node, event) => {
              // Right-click to select for dragging
              if (event) {
                handleNodeSelect(node, { clientX: event.clientX, clientY: event.clientY });
              } else {
                handleNodeSelect(node);
              }
            }}
            nodeCanvasObjectMode={() => 'after'}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const label = node.label || '';
              const fontSize = 12 / globalScale;
              const nodeSize = getNodeSize(node);
              
              // Draw node
              ctx.fillStyle = getNodeColor(node);
              ctx.beginPath();
              ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI, false);
              ctx.fill();
              
              // Add label
              if (globalScale > 1.5) {
                ctx.fillStyle = '#ffffff';
                ctx.font = `${fontSize}px Sans-Serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(label.substring(0, 20), node.x, node.y + nodeSize + fontSize);
              }
              
              // Make selected node appear highlighted
              if (selectedNode?.id === node.id) {
                ctx.strokeStyle = '#60A5FA';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(node.x, node.y, nodeSize + 3, 0, 2 * Math.PI, false);
                ctx.stroke();
              }
            }}
            backgroundColor="#0F172A"
            cooldownTicks={100}
            onEngineStop={() => {
              console.log('Graph rendered');
              // Auto-zoom after engine stops
              if (forceGraphRef.current && graphData.nodes.length > 0) {
                setTimeout(() => {
                  try {
                    forceGraphRef.current.zoomToFit(400, 20);
                  } catch (err) {
                    console.log('Auto-zoom error:', err);
                  }
                }, 100);
              }
            }}
          />
        )}
      </div>
      <div className="absolute bottom-4 left-4 bg-slate-800/80 text-slate-300 text-xs px-3 py-2 rounded-lg border border-slate-700">
        💡 Tip: Click nodes to select them. Right-click to select for dragging.
      </div>
      
      {/* Selected node indicator */}
      {selectedNode && (
        <div className="absolute top-4 right-4 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-10">
          Selected: {selectedNode.label?.substring(0, 40)}...
        </div>
      )}
    </div>
  );
}

export default GraphView;
