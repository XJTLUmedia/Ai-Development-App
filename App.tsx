import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { FileList } from './components/FileList';
import { GoalInput } from './components/GoalInput';
import { ModelSelector } from './components/ModelSelector';
import { SearchToggle } from './components/SearchToggle';
import { TaskList } from './components/TaskList';
import { OutputDisplay } from './components/OutputDisplay';
import { FinalResultDisplay } from './components/FinalResultDisplay';
import { DataTable } from './components/DataTable';
import { storageService } from './services/storageService';
import { LLMService, OpenRouterModel, PollinationsModel, fetchOpenRouterModels, fetchPollinationsModels, parseDynamicParameters } from './services/llmService';
import { StoredFile, Task, TaskStatus, TaskOutput, DataTableData } from './types';
import { ModelProviderSelector } from './components/ModelProviderSelector';
import { ApiKeyInput } from './components/ApiKeyInput';

const App: React.FC = () => {
  const [goal, setGoal] = useState<string>('');
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [useSearch, setUseSearch] = useState<boolean>(true);
  
  const [provider, setProvider] = useState<'gemini' | 'openrouter' | 'pollinations'>('gemini');
  const [model, setModel] = useState<string>('gemini-2.5-flash');
  
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [openRouterApiKey, setOpenRouterApiKey] = useState<string>('');
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  const [pollinationsModels, setPollinationsModels] = useState<PollinationsModel[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [outputs, setOutputs] = useState<TaskOutput[]>([]);
  const [finalResult, setFinalResult] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // For DataTable module
  const [fileObjects, setFileObjects] = useState<Map<string, File>>(new Map());
  const [viewingExcelFile, setViewingExcelFile] = useState<{ name: string; data: DataTableData } | null>(null);

  const isCancelledRef = useRef(false);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Load files from storage on initial render
    setFiles(storageService.getFiles());
  }, []);

  const handleFetchPollinationsModels = useCallback(async () => {
    setIsFetchingModels(true);
    setError(null);
    try {
        const models = await fetchPollinationsModels();
        setPollinationsModels(models);
        if (models.length > 0) {
            setModel(models[0].id);
        }
    } catch (err: any) {
        console.error("Failed to fetch Pollinations models:", err);
        setError(err.message || "Could not fetch models from Pollinations.");
    } finally {
        setIsFetchingModels(false);
    }
  }, []);

  useEffect(() => {
    if (provider === 'gemini') {
        setModel('gemini-2.5-flash');
    } else if (provider === 'openrouter') {
        setModel(openRouterModels.length > 0 ? openRouterModels[0].id : '');
    } else if (provider === 'pollinations') {
        if (pollinationsModels.length === 0) {
            handleFetchPollinationsModels();
        } else {
            setModel(pollinationsModels.length > 0 ? pollinationsModels[0].id : '');
        }
    }
  }, [provider, openRouterModels, pollinationsModels, handleFetchPollinationsModels]);

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

  // Debounced fetch for OpenRouter models
  useEffect(() => {
    if (provider === 'openrouter') {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        if (openRouterApiKey.trim()) {
          handleFetchOpenRouterModels();
        } else {
          setOpenRouterModels([]); // Clear models if key is cleared
        }
      }, 500); // 500ms debounce
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [openRouterApiKey, provider, handleFetchOpenRouterModels]);


  const handleFileUploaded = async (uploadedFiles: FileList) => {
    setIsUploading(true);
    setError(null);
    try {
      const newFileObjects = new Map(fileObjects);
      for (const file of Array.from(uploadedFiles)) {
        await storageService.addFile(file);
        newFileObjects.set(file.name, file);
      }
      setFileObjects(newFileObjects);
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

    const newFileObjects = new Map(fileObjects);
    newFileObjects.delete(filename);
    setFileObjects(newFileObjects);
  };

  const handleViewFile = async (filename: string) => {
    const file = fileObjects.get(filename);
    if (file && filename.toLowerCase().endsWith('.xlsx')) {
        try {
            const data = await storageService.parseXlsxToJson(file);
            setViewingExcelFile({ name: filename, data });
        } catch (err: any) {
            setError(err.message || `Could not parse ${filename}.`);
        }
    }
  };

  const handleReset = () => {
    setGoal('');
    setTasks([]);
    setOutputs([]);
    setFinalResult(null);
    setIsProcessing(false);
    setProcessingStatus('');
    setError(null);
    storageService.clearFiles();
    setFiles([]);
    setFileObjects(new Map());
    setViewingExcelFile(null);
    isCancelledRef.current = false;
  };
  
  const handleStop = () => {
    isCancelledRef.current = true;
  };

  const handleSubmit = async () => {
    if (!goal.trim()) {
      setError('Please define a primary goal.');
      return;
    }
    
    isCancelledRef.current = false;
    setIsProcessing(true);
    setProcessingStatus('Generating plan...');
    setError(null);
    setTasks([]);
    setOutputs([]);
    setFinalResult(null);

    try {
      const apiKey = provider === 'gemini' ? geminiApiKey : openRouterApiKey;
      const llmService = new LLMService(provider, apiKey);

      let modelOptions: { [key: string]: any } = {};
        if (provider === 'pollinations') {
            const selectedModel = pollinationsModels.find(m => m.id === model);
            const dynamicParams = parseDynamicParameters(goal);
            modelOptions = { 
                maxInputChars: selectedModel?.maxInputChars,
                ...dynamicParams
            };
        }

      // Step 1: Break down goal into tasks
      const generatedTasks = await llmService.breakDownGoalIntoTasks(model, goal, files, modelOptions);
      
      if (isCancelledRef.current) {
        throw new Error('Process stopped by user.');
      }
      
      setTasks(generatedTasks);

      // Step 2: Execute tasks sequentially
      const newOutputs: TaskOutput[] = [];
      for (let i = 0; i < generatedTasks.length; i++) {
        const task = generatedTasks[i];
        if (isCancelledRef.current) {
            throw new Error('Process stopped by user.');
        }

        setProcessingStatus(`Executing task ${i + 1} of ${generatedTasks.length}...`);
        setTasks(prevTasks => prevTasks.map(t =>
          t.id === task.id ? { ...t, status: TaskStatus.IN_PROGRESS } : t
        ));
        
        const taskOutput = await llmService.executeTask(model, task, goal, newOutputs, files, useSearch, modelOptions);
        newOutputs.push(taskOutput);
        setOutputs([...newOutputs]);

        setTasks(prevTasks => prevTasks.map(t =>
          t.id === task.id ? { ...t, status: TaskStatus.COMPLETED } : t
        ));
      }

      // Step 3: Synthesize final result
      setProcessingStatus('Synthesizing final result...');
      if (isCancelledRef.current) {
        throw new Error('Process stopped by user.');
      }

      const finalSynthesizedResult = await llmService.synthesizeFinalResult(model, goal, newOutputs, modelOptions);
      setFinalResult(finalSynthesizedResult);

    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message === 'Process stopped by user.' 
        ? 'Process stopped by user.'
        : (err.message || 'An unexpected error occurred.');
      setError(errorMessage);

      setTasks(prevTasks => prevTasks.map(t =>
        t.status === TaskStatus.IN_PROGRESS ? { ...t, status: TaskStatus.FAILED } : t
      ));
    } finally {
      setIsProcessing(false);
      setProcessingStatus('');
    }
  };

  const canSubmit = goal.trim().length > 0 && !isProcessing && !isUploading && (
    (provider === 'gemini' && geminiApiKey.trim().length > 0) || 
    (provider === 'openrouter' && openRouterApiKey.trim().length > 0 && openRouterModels.length > 0) ||
    (provider === 'pollinations' && pollinationsModels.length > 0)
  );

  return (
    <>
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
              
              {provider === 'gemini' && (
                  <ApiKeyInput 
                      apiKey={geminiApiKey}
                      setApiKey={setGeminiApiKey}
                      provider={provider}
                      disabled={isProcessing}
                  />
              )}

              {provider === 'openrouter' && (
                  <ApiKeyInput 
                      apiKey={openRouterApiKey}
                      setApiKey={setOpenRouterApiKey}
                      provider={provider}
                      disabled={isProcessing}
                      isProcessing={isFetchingModels}
                  />
              )}

              <ModelSelector 
                model={model} 
                setModel={setModel} 
                disabled={isProcessing || (provider === 'openrouter' && openRouterModels.length === 0) || (provider === 'pollinations' && pollinationsModels.length === 0)}
                provider={provider}
                openRouterModels={openRouterModels}
                pollinationsModels={pollinationsModels}
                isFetchingModels={isFetchingModels}
              />
              {provider === 'pollinations' && (
                  <p className="text-xs text-gray-400 italic text-center -mt-4">
                      The free tier intelligently breaks down large documents to process complex goals, which may take longer.
                  </p>
              )}

              <GoalInput goal={goal} setGoal={setGoal} disabled={isProcessing} />
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Context Files (Optional)</label>
                <FileUpload onFileUploaded={handleFileUploaded} disabled={isProcessing || isUploading} />
                <FileList files={files.map(f => f.name)} onRemoveFile={handleRemoveFile} onViewFile={handleViewFile} disabled={isProcessing} />
              </div>

              <SearchToggle useSearch={useSearch} setUseSearch={setUseSearch} disabled={isProcessing} provider={provider} />
            </div>

            <div className="mt-8 pt-6 border-t border-gray-700 flex items-center justify-between gap-4">
              {isProcessing ? (
                  <div className="flex items-center gap-4 w-full">
                      <button
                          onClick={handleStop}
                          className="px-8 py-3 border border-transparent font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 flex items-center justify-center transition-all duration-200"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 6h12v12H6z" />
                          </svg>
                          Stop
                      </button>
                      <div className="flex items-center text-gray-300">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          <span>{processingStatus}</span>
                      </div>
                  </div>
              ) : (
                  <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="px-8 py-3 border border-transparent font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 disabled:bg-gray-600 disabled:opacity-70 flex items-center justify-center transition-all duration-200 w-full sm:w-auto"
                  >
                      Generate Plan & Execute
                  </button>
              )}
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

            <TaskList tasks={tasks} completedOutputsCount={outputs.length} />
            
            <OutputDisplay outputs={outputs} />

            {finalResult !== null && (
              <FinalResultDisplay content={finalResult} />
            )}

          </main>
          <footer className="text-center mt-8 text-xs text-gray-500">
            <p>Powered by Google Gemini, OpenRouter &amp; Pollinations</p>
          </footer>
        </div>
      </div>
      {viewingExcelFile && (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 flex items-center justify-center"
            onClick={() => setViewingExcelFile(null)}
        >
          <div 
            className="bg-gray-900 rounded-xl shadow-2xl ring-1 ring-white/10 w-full max-w-4xl m-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-200 truncate pr-4" title={viewingExcelFile.name}>
                    Viewing: {viewingExcelFile.name}
                </h3>
                <button
                    onClick={() => setViewingExcelFile(null)}
                    className="text-gray-500 hover:text-white transition-colors"
                    aria-label="Close"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <DataTable data={viewingExcelFile.data} />
          </div>
        </div>
      )}
    </>
  );
};

export default App;