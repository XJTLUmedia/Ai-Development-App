
import React from 'react';

interface ModelProviderSelectorProps {
  provider: 'gemini' | 'openrouter' | 'pollinations';
  setProvider: (provider: 'gemini' | 'openrouter' | 'pollinations') => void;
  disabled: boolean;
}

export const ModelProviderSelector: React.FC<ModelProviderSelectorProps> = ({ provider, setProvider, disabled }) => {
  const providers = [
    { id: 'gemini', name: 'Google Gemini' },
    { id: 'openrouter', name: 'OpenRouter' },
    { id: 'pollinations', name: 'Pollinations (Free)' },
  ];

  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">LLM Provider</label>
      <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <legend className="sr-only">LLM Provider Selection</legend>
        {providers.map((p) => (
          <div key={p.id}>
            <label
              htmlFor={p.id}
              className={`flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all duration-200 border-2 ${
                provider === p.id ? 'bg-blue-900/50 border-blue-500' : 'bg-gray-700/50 border-gray-600 hover:border-gray-500'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="radio"
                id={p.id}
                name="provider"
                value={p.id}
                checked={provider === p.id}
                onChange={() => setProvider(p.id as 'gemini' | 'openrouter' | 'pollinations')}
                disabled={disabled}
                className="sr-only"
              />
              <span className="text-sm font-semibold text-gray-200">{p.name}</span>
            </label>
          </div>
        ))}
      </fieldset>
    </div>
  );
};
