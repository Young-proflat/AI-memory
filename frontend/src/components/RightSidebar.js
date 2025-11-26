import React from 'react';

function RightSidebar({ selectedNode, selectedLink }) {
  return (
    <div className="w-80 bg-slate-800 border-l border-slate-700 p-6 overflow-y-auto flex flex-col">
      <h2 className="text-xl font-bold text-slate-50 mb-6 pb-4 border-b border-slate-700">Memory Details</h2>
      
      {selectedNode ? (
        <div className="flex flex-col gap-5">
          <div className="pb-4 border-b border-slate-700">
            <strong className="block text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Type:</strong>
            <span className="text-slate-200 text-sm leading-relaxed">{selectedNode.type}</span>
          </div>
          <div className="pb-4 border-b border-slate-700">
            <strong className="block text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Label:</strong>
            <span className="text-slate-200 text-sm leading-relaxed">{selectedNode.label}</span>
          </div>
          {selectedNode.fullContent && (
            <div className="pb-4 border-b border-slate-700">
              <strong className="block text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Content:</strong>
              <p className="mt-2 p-3 bg-slate-900 rounded-md border border-slate-700 max-h-[200px] overflow-y-auto text-xs leading-relaxed text-slate-200">
                {selectedNode.fullContent}
              </p>
            </div>
          )}
          {selectedNode.namespace && (
            <div className="pb-4 border-b border-slate-700">
              <strong className="block text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Namespace:</strong>
              <span className="text-slate-200 text-sm leading-relaxed">{selectedNode.namespace}</span>
            </div>
          )}
          {selectedNode.category && (
            <div className="pb-4 border-b border-slate-700">
              <strong className="block text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Category:</strong>
              <span className="text-slate-200 text-sm leading-relaxed">{selectedNode.category}</span>
            </div>
          )}
          {selectedNode.userId && (
            <div className="pb-4 border-b border-slate-700">
              <strong className="block text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">User ID:</strong>
              <span className="text-slate-200 text-sm leading-relaxed">{selectedNode.userId}</span>
            </div>
          )}
          {selectedNode.conversationId && (
            <div className="pb-4 border-b border-slate-700">
              <strong className="block text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Conversation ID:</strong>
              <span className="text-slate-200 text-sm leading-relaxed">{selectedNode.conversationId}</span>
            </div>
          )}
          {selectedNode.metadata?.version && (
            <div className="pb-4 border-b border-slate-700">
              <strong className="block text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Version:</strong>
              <div className="flex items-center gap-2">
                <span className="text-slate-200 text-sm">v{selectedNode.metadata.version}</span>
                {selectedNode.metadata.isLatest && (
                  <span className="px-2 py-0.5 bg-green-900/50 text-green-300 text-xs rounded">Latest</span>
                )}
                {selectedNode.metadata.status === 'outdated' && (
                  <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded">Outdated</span>
                )}
              </div>
              {selectedNode.metadata.parentVersionId && (
                <p className="text-xs text-slate-400 mt-1">Parent: {selectedNode.metadata.parentVersionId.substring(0, 20)}...</p>
              )}
            </div>
          )}
          {selectedNode.metadata?.graphFilter && (
            <div className="pb-4 border-b border-slate-700">
              <strong className="block text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Graph Filter:</strong>
              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                selectedNode.metadata.graphFilter === 'update' 
                  ? 'bg-red-900/50 text-red-300' 
                  : selectedNode.metadata.graphFilter === 'extend'
                  ? 'bg-blue-900/50 text-blue-300'
                  : 'bg-purple-900/50 text-purple-300'
              }`}>
                {selectedNode.metadata.graphFilter.toUpperCase()}
              </span>
            </div>
          )}
          {selectedNode.metadata && (
            <div className="pb-4 border-b border-slate-700 last:border-b-0 last:pb-0">
              <strong className="block text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Metadata:</strong>
              <pre className="mt-2 p-3 bg-slate-900 rounded-md border border-slate-700 max-h-[300px] overflow-y-auto text-xs leading-normal text-slate-300 font-mono">
                {JSON.stringify(selectedNode.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : selectedLink ? (
        <div className="flex flex-col gap-5">
          <div className="pb-4 border-b border-slate-700">
            <strong className="block text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Relationship Type:</strong>
            <span className="text-slate-200 text-sm leading-relaxed">{selectedLink.type}</span>
          </div>
          <div className="pb-4 border-b border-slate-700">
            <strong className="block text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Source:</strong>
            <span className="text-slate-200 text-sm leading-relaxed">{selectedLink.source?.id || selectedLink.source}</span>
          </div>
          <div className="pb-4 border-b border-slate-700 last:border-b-0 last:pb-0">
            <strong className="block text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">Target:</strong>
            <span className="text-slate-200 text-sm leading-relaxed">{selectedLink.target?.id || selectedLink.target}</span>
          </div>
        </div>
      ) : (
        <div className="py-10 px-5 text-center text-slate-400 text-sm">
          <p>Select a memory node to view details</p>
        </div>
      )}
    </div>
  );
}

export default RightSidebar;
