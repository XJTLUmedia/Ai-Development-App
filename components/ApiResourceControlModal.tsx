
import React, { useState, useEffect } from 'react';

interface ApiResourceControlModalProps {
  docChunks: number;
  auxChunks: number;
  onConfirm: (limits: { doc: number, aux: number }) => void;
  onCancel: () => void;
}

export const ApiResourceControlModal: React.FC<ApiResourceControlModalProps> = ({ docChunks, auxChunks, onConfirm, onCancel }) => {
  const [docLimit, setDocLimit] = useState(docChunks);
  const [auxLimit, setAuxLimit] = useState(auxChunks);

  useEffect(() => {
    setDocLimit(docChunks);
    setAuxLimit(auxChunks);
  }, [docChunks, auxChunks]);

  const totalCalls = docLimit * auxLimit;
  
  const handleConfirm = () => {
    onConfirm({ doc: docLimit, aux: auxLimit });
  };

  const Slider = ({ label, value, max, onChange }: { label: string, value: number, max: number, onChange: (val: number) => void }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <span className="text-sm font-mono px-2 py-1 bg-gray-900 rounded-md">{value} / {max}</span>
      </div>
      <input
        type="range"
        min={1}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        disabled={max <= 1}
      />
    </div>
  );

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div 
        className="bg-gray-800 rounded-xl shadow-2xl ring-1 ring-white/10 w-full max-w-lg m-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-900/50 mb-4">
              <svg className="h-6 w-6 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-100">High API Usage Detected</h3>
          <p className="text-sm text-gray-400 mt-2 mb-6">
            This step requires analyzing many combinations of document and context chunks. Adjust the sliders to balance detail with speed. The most relevant chunks will be prioritized.
          </p>
        </div>

        <div className="space-y-6 my-6">
          <Slider label="Document Chunks to Use" value={docLimit} max={docChunks} onChange={setDocLimit} />
          <Slider label="Context Chunks to Use" value={auxLimit} max={auxChunks} onChange={setAuxLimit} />
        </div>

        <div className="mt-6 p-4 bg-gray-900/50 rounded-lg text-center">
            <p className="text-sm text-gray-400">Estimated Total API Calls for this Step:</p>
            <p className="text-2xl font-bold text-yellow-300 font-mono">{totalCalls}</p>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row-reverse gap-3">
          <button
            onClick={handleConfirm}
            className="w-full sm:w-auto px-6 py-2 border border-transparent font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-all duration-200"
          >
            Proceed
          </button>
          <button
              onClick={onCancel}
              className="w-full sm:w-auto px-6 py-2 border border-gray-600 font-semibold rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-all duration-200"
          >
              Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
