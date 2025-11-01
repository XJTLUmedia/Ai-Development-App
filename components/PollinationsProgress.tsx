import React from 'react';

interface PollinationsProgressProps {
  completedCalls: number;
  totalCalls: number;
  statusText: string;
}

export const PollinationsProgress: React.FC<PollinationsProgressProps> = ({ completedCalls, totalCalls, statusText }) => {
  const percentage = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;
  
  return (
    <div className="w-full text-sm">
      <div className="flex items-center text-gray-300 mb-2">
        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>{statusText}</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out" 
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <div className="text-right text-xs text-gray-400 mt-1 font-mono">
        {completedCalls} / {totalCalls} API Calls
      </div>
    </div>
  );
};
