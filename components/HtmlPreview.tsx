import React, { useMemo } from 'react';
import { HtmlSnippetData } from '../types';

interface HtmlPreviewProps {
  data: HtmlSnippetData;
}

export const HtmlPreview: React.FC<HtmlPreviewProps> = ({ data }) => {
  const { html, css = '', js = '' } = data;

  const srcDoc = useMemo(() => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { 
              font-family: sans-serif; 
              color: #d1d5db; /* text-gray-300 */
              background-color: #1f2937; /* bg-gray-800 */
              padding: 1rem;
            }
            ${css}
          </style>
        </head>
        <body>
          ${html}
          <script>${js}</script>
        </body>
      </html>
    `;
  }, [html, css, js]);

  return (
    <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
      <h5 className="text-base font-semibold text-gray-300 mb-3">HTML Preview</h5>
      <iframe
        srcDoc={srcDoc}
        title="HTML Preview"
        sandbox="allow-scripts"
        frameBorder="0"
        width="100%"
        height="300px"
        className="rounded-md bg-gray-800"
      />
    </div>
  );
};
