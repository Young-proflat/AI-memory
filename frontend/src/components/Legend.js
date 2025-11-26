import React, { useState } from 'react';

function Legend() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="absolute bottom-6 left-6 z-10">
      {isExpanded ? (
        <div className="bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-lg p-3 min-w-[180px] shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold text-slate-50 uppercase tracking-wide">Legend</h4>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-slate-400 hover:text-slate-200 transition-colors"
              aria-label="Collapse legend"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <div className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0" style={{ backgroundColor: '#10B981' }}></div>
              <span>Memory</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <div className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0" style={{ backgroundColor: '#3B82F6' }}></div>
              <span>Category</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <div className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0" style={{ backgroundColor: '#F59E0B' }}></div>
              <span>User</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <div className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0" style={{ backgroundColor: '#8B5CF6' }}></div>
              <span>Conversation</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <div className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0" style={{ backgroundColor: '#EC4899' }}></div>
              <span>Namespace</span>
            </div>
            <div className="h-px bg-slate-700 my-2"></div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <div className="w-5 h-0.5 border-t-2 flex-shrink-0" style={{ borderColor: '#EC4899' }}></div>
              <span className="text-[10px]">Belongs to Namespace</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <div className="w-5 h-0.5 border-t-2 flex-shrink-0" style={{ borderColor: '#3B82F6' }}></div>
              <span className="text-[10px]">Belongs to Category</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <div className="w-5 h-0.5 border-t-2 flex-shrink-0" style={{ borderColor: '#F59E0B' }}></div>
              <span className="text-[10px]">Created by User</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <div className="w-5 h-0.5 border-t-2 flex-shrink-0" style={{ borderColor: '#8B5CF6' }}></div>
              <span className="text-[10px]">In Conversation</span>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-slate-800/95 backdrop-blur-sm border border-slate-700 rounded-lg px-3 py-2 shadow-lg hover:bg-slate-700/95 transition-colors flex items-center gap-2"
          aria-label="Expand legend"
        >
          <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Legend</span>
        </button>
      )}
    </div>
  );
}

export default Legend;
