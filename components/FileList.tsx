import React from 'react';

interface FileListProps {
  files: string[];
  onRemoveFile: (filename: string) => void;
  disabled: boolean;
}

export const FileList: React.FC<FileListProps> = ({ files, onRemoveFile, disabled }) => {
  if (files.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-2">
      <h4 className="text-sm font-medium text-gray-400">Uploaded files:</h4>
      <ul className="max-h-32 overflow-y-auto rounded-lg bg-gray-900/50 p-2">
        {files.map((filename) => (
          <li key={filename} className="flex items-center justify-between text-sm text-gray-300 py-1 px-2 rounded hover:bg-gray-700">
            <span className="truncate">{filename}</span>
            <button
              onClick={() => onRemoveFile(filename)}
              disabled={disabled}
              className="text-gray-500 hover:text-red-400 disabled:opacity-50"
              aria-label={`Remove ${filename}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
