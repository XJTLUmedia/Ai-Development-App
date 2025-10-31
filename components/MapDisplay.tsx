import React from 'react';
import { MapData } from '../types';

interface MapDisplayProps {
  data: MapData;
}

export const MapDisplay: React.FC<MapDisplayProps> = ({ data }) => {
  const { latitude, longitude, label, zoom = 14 } = data;
  const mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}&z=${zoom}`;

  return (
    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
      <h5 className="text-lg font-bold text-blue-300 mb-3">{label}</h5>
      
      <div className="space-y-2 text-sm text-gray-300">
        <p>
            <span className="font-semibold text-gray-400">Latitude:</span> {latitude.toFixed(6)}
        </p>
        <p>
            <span className="font-semibold text-gray-400">Longitude:</span> {longitude.toFixed(6)}
        </p>
      </div>

      <div className="mt-5">
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          Open on Map
        </a>
      </div>
    </div>
  );
};
