import React, { useState, useEffect, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { FileList } from './components/FileList';
import { GoalInput } from './components/GoalInput';
import { ModelSelector } from './components/ModelSelector';
import { SearchToggle } from './components/SearchToggle';
import { TaskList } from './components/TaskList';
import { OutputDisplay } from './components/OutputDisplay';
import { storageService } from './services/storageService';
import { LLMService, OpenRouterModel, fetchOpenRouterModels } from './services/llmService';
import { StoredFile, Task, TaskStatus, TaskOutput } from './types';
import { ModelProviderSelector } from './components/ModelProviderSelector';
import { ApiKeyInput } from './components/ApiKeyInput';

const App: React.FC = () => {
  const [goal, setGoal] = useState<string>('');
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [useSearch, setUseSearch] = useState<boolean>(true);
  
  const [provider, setProvider] = useState<'gemini' | 'openrouter'>('gemini');
  const [model, setModel] = useState<string>('gemini-2.5-flash');
  
  const [openRouterApiKey, setOpenRouterApiKey] = useState<string>('');
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [outputs, setOutputs] = useState<TaskOutput[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load files from storage on initial render
    setFiles(storageService.getFiles());
  }, []);

  useEffect(() => {
    if (provider === 'gemini') {
        setModel('gemini-2.5-flash');
    } else {
        setModel(openRouterModels.length > 0 ? openRouterModels[0].id : '');
    }
  }, [provider, openRouterModels]);

  const handleFetchOpenRouterModels = useCallback(async () => {
    if (!openRouterApiKey) {
      setOpenRouterModels([]);
      return;
    };
    setIsFetchingModels(true);
    setError(null);
    try {
        const models = await fetchOpenRouterModels(openRouterApiKey);
        setOpenRouterModels(models);
        if (models.length > 0) {
            setModel(models[0].id);
        }
    } catch (err: any) {
        console.error("Failed to fetch OpenRouter models:", err);
        setError(err.message || "Could not fetch models from OpenRouter. Please check your API key.");
    } finally {
        setIsFetchingModels(false);
    }
  }, [openRouterApiKey]);

  const handleFileUploaded = async (uploadedFiles: FileList) => {
    setIsUploading(true);
    setError(null);
    try {
      for (const file of Array.from(uploadedFiles)) {
        await storageService.addFile(file);
      }
      setFiles(storageService.getFiles());
    } catch (err: any) {
      setError(err.message || 'Failed to upload and process file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = (filename: string) => {
    storageService.removeFile(filename);
    setFiles(storageService.getFiles());
  };

  const handleReset = () => {
    setGoal('');
    setTasks([]);
    setOutputs([]);
    setIsProcessing(false);
    setError(null);
    storageService.clearFiles();
    setFiles([]);
  };

  const handleSubmit = async () => {
    if (!goal.trim()) {
      setError('Please define a primary goal.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTasks([]);
    setOutputs([]);

    try {
      // The LLMService dispatcher handles which provider/key to use
      const llmService = new LLMService(provider, openRouterApiKey);

      // Step 1: Break down goal into tasks
      const generatedTasks = await llmService.breakDownGoalIntoTasks(model, goal, files);
      setTasks(generatedTasks);

      // Step 2: Execute tasks sequentially
      const newOutputs: TaskOutput[] = [];
      for (const task of generatedTasks) {
        setTasks(prevTasks => prevTasks.map(t =>
          t.id === task.id ? { ...t, status: TaskStatus.IN_PROGRESS } : t
        ));

        const taskOutput = await llmService.executeTask(model, task, goal, newOutputs, files, useSearch);
        newOutputs.push(taskOutput);
        setOutputs([...newOutputs]);

        setTasks(prevTasks => prevTasks.map(t =>
          t.id === task.id ? { ...t, status: TaskStatus.COMPLETED } : t
        ));
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred.');
      setTasks(prevTasks => prevTasks.map(t =>
        t.status === TaskStatus.IN_PROGRESS ? { ...t, status: TaskStatus.FAILED } : t
      ));
    } finally {
      setIsProcessing(false);
    }
  };

  const canSubmit = goal.trim().length > 0 && !isProcessing && !isUploading && (provider === 'gemini' || (provider === 'openrouter' && openRouterApiKey.trim().length > 0 && openRouterModels.length > 0));

  return (
    <div className="bg-gray-900 text-gray-100 min-h-screen font-sans">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-4xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-100">AI Dev Assistant</h1>
          <p className="text-md text-gray-400 mt-2">
            Define your goal, provide context files, and let the AI generate a plan and execute it.
          </p>
        </header>

        <main className="bg-gray-800/50 rounded-xl p-6 shadow-2xl ring-1 ring-white/10">
          <div className="space-y-6">
            <ModelProviderSelector provider={provider} setProvider={setProvider} disabled={isProcessing} />
            
            {provider === 'openrouter' && (
                <ApiKeyInput 
                    apiKey={openRouterApiKey}
                    setApiKey={setOpenRouterApiKey}
                    onSubmit={handleFetchOpenRouterModels}
                    provider={provider}
                    disabled={isProcessing}
                    isProcessing={isFetchingModels}
                />
            )}

            <ModelSelector 
              model={model} 
              setModel={setModel} 
              disabled={isProcessing || (provider === 'openrouter' && openRouterModels.length === 0)}
              provider={provider}
              openRouterModels={openRouterModels}
              isFetchingModels={isFetchingModels}
            />

            <GoalInput goal={goal} setGoal={setGoal} disabled={isProcessing} />
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Context Files (Optional)</label>
              <FileUpload onFileUploaded={handleFileUploaded} disabled={isProcessing || isUploading} />
              <FileList files={files.map(f => f.name)} onRemoveFile={handleRemoveFile} disabled={isProcessing} />
            </div>

            <SearchToggle useSearch={useSearch} setUseSearch={setUseSearch} disabled={isProcessing} provider={provider} />
          </div>

          <div className="mt-8 pt-6 border-t border-gray-700 flex items-center justify-between gap-4">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-8 py-3 border border-transparent font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:bg-gray-600 disabled:opacity-70 flex items-center justify-center transition-all duration-200 w-full sm:w-auto"
            >
              {isProcessing ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Processing...
                </>
              ) : 'Generate Plan & Execute'}
            </button>
            <button
                onClick={handleReset}
                disabled={isProcessing}
                className="px-6 py-3 border border-gray-600 font-semibold rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 disabled:opacity-50 transition-all duration-200"
            >
                Reset
            </button>
          </div>

          {error && (
            <div className="mt-6 p-4 bg-red-900/50 border border-red-500 text-red-300 rounded-lg">
              <p><span className="font-bold">Error:</span> {error}</p>
            </div>
          )}

          <TaskList tasks={tasks} />
          <OutputDisplay outputs={outputs} />
        </main>
        <footer className="text-center mt-8 text-xs text-gray-500">
          <p>Powered by Google Gemini &amp; OpenRouter</p>
        </footer>
      </div>
    </div>
  );
};

export default App;