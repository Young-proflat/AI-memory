import React from 'react';

function LoadingSpinner({ message = 'Loading memories from Pinecone...' }) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-slate-200">
      <div className="border-[3px] border-slate-700 border-t-indigo-500 rounded-full w-10 h-10 animate-spin mb-5"></div>
      <p className="text-slate-400 text-sm">{message}</p>
    </div>
  );
}

export default LoadingSpinner;
