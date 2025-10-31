import React from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js';

interface FinalResultDisplayProps {
  content: string;
}

// Configure marked to use highlight.js for syntax highlighting
marked.setOptions({
  highlight: function(code, lang) {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  },
  langPrefix: 'hljs language-', // for CSS classes
  gfm: true,
  breaks: true,
});

export const FinalResultDisplay: React.FC<FinalResultDisplayProps> = ({ content }) => {
  // Parse markdown content into an HTML string
  const parsedHtml = marked.parse(content);

  return (
    <div className="mt-8">
      <h3 className="text-2xl font-bold text-gray-100 mb-4 pb-2 border-b-2 border-blue-500">Final Result</h3>
      <div 
        className="bg-gray-800 rounded-lg p-6 shadow-inner markdown-preview"
        dangerouslySetInnerHTML={{ __html: parsedHtml }}
      />
    </div>
  );
};