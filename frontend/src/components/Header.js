'use client'

import React from 'react';

function Header({ searchQuery, setSearchQuery, onToggleSidebar, sidebarOpen }) {
  return (
    <div className="flex justify-between items-center px-6 py-3 bg-slate-800 border-b border-slate-700 h-15 flex-shrink-0">
      <div className="flex items-center gap-4">
        <button 
          onClick={onToggleSidebar}
          className="bg-transparent border-none text-slate-400 text-2xl cursor-pointer p-0 w-6 h-6 flex items-center justify-center transition-colors hover:text-slate-200"
        >
          {sidebarOpen ? '×' : '☰'}
        </button>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md flex items-center justify-center text-white font-bold text-lg">
            M
          </div>
          <span className="text-lg font-semibold text-slate-200">Mind Weave</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 gap-2 min-w-[250px]">
          <span className="text-slate-500 text-base">🔍</span>
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none text-slate-200 text-sm outline-none flex-1 placeholder:text-slate-500"
          />
        </div>
        <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-lg cursor-pointer transition-colors hover:bg-slate-600">
          ⚬
        </div>
      </div>
    </div>
  );
}

export default Header;
