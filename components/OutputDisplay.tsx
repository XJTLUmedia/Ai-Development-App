
import React from 'react';
import { TaskOutput, Citation } from '../types';

interface OutputDisplayProps {
  outputs: TaskOutput[];
}

const CitationLink: React.FC<{ citation: Citation, index: number }> = ({ citation, index }) => (
  <a
    href={citation.uri}
    target="_blank"
    rel="noopener noreferrer"
    title={citation.title}
    className="inline-block text-xs bg-gray-700 text-blue-400 hover:bg-gray-600 hover:text-blue-300 rounded-full px-2 py-1 transition-colors duration-200"
  >
    [{index + 1}] {citation.title || new URL(citation.uri).hostname}
  </a>
);

export const OutputDisplay: React.FC<OutputDisplayProps> = ({ outputs }) => {
  if (outputs.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500 bg-gray-900/50 rounded-lg mt-6">
        Generated output will appear here.
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold text-gray-200 mb-3">Generated Output</h3>
      <div className="space-y-4">
        {outputs.map((taskOutput) => (
          <div key={taskOutput.taskId} className="bg-gray-800 rounded-lg p-4">
            <h4 className="font-semibold text-gray-300 mb-2 border-b border-gray-700 pb-2">
              Task: {taskOutput.taskDescription}
            </h4>
            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-200 bg-gray-900/50 p-3 rounded-md overflow-x-auto">
              <code>{taskOutput.output}</code>
            </pre>
            {taskOutput.citations.length > 0 && (
              <div className="mt-3">
                <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">Sources</h5>
                <div className="flex flex-wrap gap-2">
                  {taskOutput.citations.map((citation, index) => (
                    <CitationLink key={citation.uri} citation={citation} index={index} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
