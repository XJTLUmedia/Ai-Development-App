import React from 'react';
import { TaskOutput, Citation, CalendarEventData, MapData, ChartData, HtmlSnippetData } from '../types';
import { CalendarEvent } from './CalendarEvent';
import { MapDisplay } from './MapDisplay';
import { ChartDisplay } from './ChartDisplay';
import { HtmlPreview } from './HtmlPreview';

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

const renderOutput = (output: string) => {
  try {
    const parsed = JSON.parse(output);
    switch (parsed['@type']) {
      case 'CalendarEvent':
        // Basic validation
        if (parsed.summary && parsed.start && parsed.end) {
          return <CalendarEvent data={parsed as CalendarEventData} />;
        }
        break;
      case 'Map':
        if (parsed.latitude && parsed.longitude && parsed.label) {
          return <MapDisplay data={parsed as MapData} />;
        }
        break;
      case 'Chart':
        if (parsed.title && parsed.svg) {
          return <ChartDisplay data={parsed as ChartData} />;
        }
        break;
      case 'HtmlSnippet':
        if (parsed.html) {
          return <HtmlPreview data={parsed as HtmlSnippetData} />;
        }
        break;
      default:
        // Not a known special type, fall through
        break;
    }
  } catch (e) {
    // Not a JSON object, fall through to default text renderer
  }
  
  // Default renderer for code/text
  return (
    <pre className="whitespace-pre-wrap font-mono text-sm text-gray-200 bg-gray-900/50 p-3 rounded-md overflow-x-auto">
      <code>{output}</code>
    </pre>
  );
};


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
      <div className="space-y-3">
        {outputs.map((taskOutput) => (
          <details key={taskOutput.taskId} className="task-output-details">
            <summary>
              <span className="summary-content">
                Task: {taskOutput.taskDescription}
              </span>
              <svg className="summary-chevron h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </summary>
            <div className="task-output-details-body">
              <div className="pt-2">
                {renderOutput(taskOutput.output)}
              </div>
              {taskOutput.citations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-700">
                  <h5 className="text-xs font-bold text-gray-400 uppercase mb-2">Sources</h5>
                  <div className="flex flex-wrap gap-2">
                    {taskOutput.citations.map((citation, index) => (
                      <CitationLink key={citation.uri} citation={citation} index={index} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
};