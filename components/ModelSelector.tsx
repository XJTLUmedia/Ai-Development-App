
import React from 'react';
import { OpenRouterModel } from '../services/llmService';

interface ModelSelectorProps {
  model: string;
  setModel: (model: string) => void;
  disabled: boolean;
  provider: 'gemini' | 'openrouter';
  openRouterModels: OpenRouterModel[];
  isFetchingModels: boolean;
}

const GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (speed/basic tasks)' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (complex reasoning)' },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({ model, setModel, disabled, provider, openRouterModels, isFetchingModels }) => {
  return (
    <div>
      <label htmlFor="model-selector" className="block text-sm font-medium text-gray-300 mb-2">
        Select Model
      </label>
      <select
        id="model-selector"
        value={model}
        onChange={(e) => setModel(e.target.value)}
        disabled={disabled}
        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 disabled:opacity-50"
      >
        {provider === 'gemini' ? (
          GEMINI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))
        ) : (
          isFetchingModels ? (
            <option>Loading models...</option>
          ) : openRouterModels.length > 0 ? (
            openRouterModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))
          ) : (
            <option>Set API key to load models</option>
          )
        )}
      </select>
    </div>
  );
};