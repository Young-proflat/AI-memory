'use client'

import React from 'react';

function LeftSidebar({
  namespaces,
  activeNamespace,
  setActiveNamespace,
  categories,
  filterCategory,
  setFilterCategory,
  userIds,
  filterUserId,
  setFilterUserId,
  onSync,
  onTestConnection,
  loading,
  activeView,
  setActiveView,
  sidebarOpen,
  showUpdates = true,
  setShowUpdates,
  showExtends = true,
  setShowExtends,
  showDerives = true,
  setShowDerives
}) {
  if (!sidebarOpen) return null;
  
  // Defensive check for setter functions
  const handleUpdateChange = (e) => {
    if (setShowUpdates && typeof setShowUpdates === 'function') {
      setShowUpdates(e.target.checked);
    } else {
      console.warn('setShowUpdates is not a function');
    }
  };
  
  const handleExtendChange = (e) => {
    if (setShowExtends && typeof setShowExtends === 'function') {
      setShowExtends(e.target.checked);
    } else {
      console.warn('setShowExtends is not a function');
    }
  };
  
  const handleDeriveChange = (e) => {
    if (setShowDerives && typeof setShowDerives === 'function') {
      setShowDerives(e.target.checked);
    } else {
      console.warn('setShowDerives is not a function');
    }
  };

  return (
    <div className="w-70 bg-slate-800 border-r border-slate-700 p-6 overflow-y-auto flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">NAVIGATION</h3>
        <button
          onClick={() => setActiveView('dashboard')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all text-sm ${
            activeView === 'dashboard'
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium'
              : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
          }`}
        >
          <span className="text-lg w-5 text-center">⊞</span>
          <span>Dashboard</span>
        </button>
        <button
          onClick={() => setActiveView('detailed')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all text-sm ${
            activeView === 'detailed'
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium'
              : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
          }`}
        >
          <span className="text-lg w-5 text-center">🔍</span>
          <span>Detailed Memory View</span>
        </button>
        <button
          onClick={() => setActiveView('semantic')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all text-sm ${
            activeView === 'semantic'
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium'
              : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
          }`}
        >
          <span className="text-lg w-5 text-center">🔎</span>
          <span>Semantic Search</span>
        </button>
        <button
          onClick={() => setActiveView('controls')}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-all text-sm ${
            activeView === 'controls'
              ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-medium'
              : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
          }`}
        >
          <span className="text-lg w-5 text-center">⚙</span>
          <span>Graph Controls</span>
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">GRAPH FILTERS</h3>
        <label className="flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors text-slate-300 text-sm hover:bg-slate-700">
          <input 
            type="checkbox" 
            checked={showUpdates ?? true}
            onChange={handleUpdateChange}
            className="w-4.5 h-4.5 cursor-pointer accent-indigo-500"
          />
          <span className="text-base w-5 text-center">↻</span>
          <span>Update</span>
        </label>
        <label className="flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors text-slate-300 text-sm hover:bg-slate-700">
          <input 
            type="checkbox" 
            checked={showExtends ?? true}
            onChange={handleExtendChange}
            className="w-4.5 h-4.5 cursor-pointer accent-indigo-500"
          />
          <span className="text-base w-5 text-center">⇄</span>
          <span>Extend</span>
        </label>
        <label className="flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-colors text-slate-300 text-sm hover:bg-slate-700">
          <input 
            type="checkbox" 
            checked={showDerives ?? true}
            onChange={handleDeriveChange}
            className="w-4.5 h-4.5 cursor-pointer accent-indigo-500"
          />
          <span className="text-base w-5 text-center">🏷</span>
          <span>Derive</span>
        </label>
      </div>

      {/* Namespace Display */}
      <div className="p-4 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Active Namespace</h3>
        <select
          className="w-full p-2.5 bg-slate-800 border border-slate-700 rounded-md text-slate-200 text-sm mb-3 cursor-pointer outline-none focus:border-indigo-500"
          value={activeNamespace}
          onChange={(e) => setActiveNamespace(e.target.value)}
        >
          <option value="">All Namespaces</option>
          {namespaces.map(ns => (
            <option key={ns} value={ns}>{ns || 'default'}</option>
          ))}
        </select>
        <div className="text-xs text-slate-400">
          <strong className="text-slate-300">Total Namespaces:</strong> {namespaces.length}
        </div>
      </div>

      {/* Additional Filters */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Additional Filters</h3>
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-1.5 font-medium">Category:</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-md text-slate-200 text-sm cursor-pointer outline-none focus:border-indigo-500"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="mb-4">
          <label className="block text-xs text-slate-400 mb-1.5 font-medium">User ID:</label>
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-md text-slate-200 text-sm cursor-pointer outline-none focus:border-indigo-500"
          >
            <option value="">All Users</option>
            {userIds.map(uid => (
              <option key={uid} value={uid}>{uid}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={onSync} 
          className="w-full py-3 border-none rounded-md text-sm font-semibold cursor-pointer transition-all mb-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={loading}
        >
          Sync & Refresh
        </button>
        <button 
          onClick={onTestConnection} 
          className="w-full py-3 border-none rounded-md text-sm font-semibold cursor-pointer transition-all mb-2 bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={loading}
        >
          Test Connection
        </button>
      </div>
    </div>
  );
}

export default LeftSidebar;
