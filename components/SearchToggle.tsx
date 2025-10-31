import React from 'react';

interface SearchToggleProps {
  useSearch: boolean;
  setUseSearch: (useSearch: boolean) => void;
  disabled: boolean;
  provider: 'gemini' | 'openrouter';
}

export const SearchToggle: React.FC<SearchToggleProps> = ({ useSearch, setUseSearch, disabled, provider }) => {
  const toggleClasses = useSearch ? 'bg-blue-600' : 'bg-gray-600';
  const dotClasses = useSearch ? 'translate-x-5' : 'translate-x-0';
  const labelText = provider === 'gemini' 
    ? "Use Google Search for up-to-date information" 
    : "Use OpenRouter Web Search for up-to-date information";

  return (
    <div>
      <label htmlFor="search-toggle" className={`flex items-center ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
        <div className="relative">
          <input 
            type="checkbox" 
            id="search-toggle" 
            className="sr-only" 
            checked={useSearch}
            onChange={() => setUseSearch(!useSearch)}
            disabled={disabled}
          />
          <div className={`block w-11 h-6 rounded-full transition-colors duration-200 ${toggleClasses}`}></div>
          <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ${dotClasses}`}></div>
        </div>
        <div className="ml-3 text-sm font-medium text-gray-300">
          {labelText}
        </div>
      </label>
    </div>
  );
};