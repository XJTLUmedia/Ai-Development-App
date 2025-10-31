import React from 'react';

interface ApiKeyInputProps {
  apiKey: string;
  setApiKey: (key: string) => void;
  provider: string;
  disabled: boolean;
  onSubmit?: () => void;
  isProcessing?: boolean;
}

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ apiKey, setApiKey, onSubmit, provider, disabled, isProcessing }) => {
  const showSubmit = provider === 'openrouter' && onSubmit;

  return (
    <div className="flex items-center gap-2">
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        disabled={disabled || (isProcessing ?? false)}
        placeholder={`Enter your ${provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} API Key`}
        className="flex-grow p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 disabled:opacity-50"
      />
      {showSubmit && (
        <button
          onClick={onSubmit}
          disabled={disabled || isProcessing || !apiKey.trim()}
          className="px-6 py-3 border border-transparent font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:bg-gray-600 disabled:opacity-70 flex items-center justify-center transition-all duration-200"
        >
          {isProcessing ? (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          ) : 'Set Key'}
        </button>
      )}
    </div>
  );
};