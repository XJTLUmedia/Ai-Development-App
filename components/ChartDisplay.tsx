import React from 'react';
import { ChartData } from '../types';

interface ChartDisplayProps {
  data: ChartData;
}

export const ChartDisplay: React.FC<ChartDisplayProps> = ({ data }) => {
  return (
    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
      <h5 className="text-lg font-bold text-blue-300 mb-3 text-center">{data.title}</h5>
      <div 
        className="flex justify-center items-center"
        dangerouslySetInnerHTML={{ __html: data.svg }} 
      />
    </div>
  );
};
