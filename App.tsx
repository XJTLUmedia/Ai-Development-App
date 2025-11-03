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
import { StoredFile, Task, TaskStatus, TaskOutput, DataTableData, ChatHistoryItem } from './types';
import { ModelProviderSelector } from './components/ModelProviderSelector';
import { ApiKeyInput } from './components/ApiKeyInput';
import { PollinationsProgress } from './components/PollinationsProgress';
import { ApiResourceControlModal } from './components/ApiResourceControlModal';
import { PollinationsService } from './services/pollinationsService';
import * as api from './services/apiService';
import { marked } from 'marked';


// NOTE: Due to platform constraints, the AuthModal and HistoryModal components are defined
// within App.tsx. In a typical React application, these would be in their own files
// (e.g., components/AuthModal.tsx).

// #region AuthModal Component
interface AuthModalProps {
  mode: 'login' | 'register';
  onClose: () => void;
  onSuccess: (username: string) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ mode, onClose, onSuccess }) => {
    const [currentMode, setCurrentMode] = useState(mode);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            const action = currentMode === 'login' ? api.login : api.register;
            const response = await action({ username, password });
            api.setToken(response.token);
            onSuccess(response.username);
        } catch (err: any) {
            setError(err.message || `An error occurred during ${currentMode}.`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">{currentMode === 'login' ? 'Login' : 'Sign Up'}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>

                {error && <div className="mb-4 p-3 bg-red-900/50 text-red-300 border border-red-500 rounded-md">{error}</div>}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Username"
                        required
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200"
                    />
                    <input 
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                        className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-200"
                    />
                    <button type="submit" disabled={isLoading} className="w-full px-8 py-3 font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600">
                        {isLoading ? 'Processing...' : (currentMode === 'login' ? 'Login' : 'Create Account')}
                    </button>
                </form>
                <div className="text-center mt-4">
                    <button onClick={() => setCurrentMode(currentMode === 'login' ? 'register' : 'login')} className="text-sm text-blue-400 hover:underline">
                        {currentMode === 'login' ? 'Need an account? Sign Up' : 'Already have an account? Login'}
                    </button>
                </div>
            </div>
        </div>
    );
};
// #endregion

// #region HistoryModal Component
interface HistoryModalProps {
    onClose: () => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ onClose }) => {
    const [history, setHistory] = useState<ChatHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const data = await api.getHistory();
                setHistory(data);
            } catch (err: any) {
                setError(err.message || "Failed to load history.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, []);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content !max-w-3xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Chat History</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
                </div>
                <div className="max-h-[70vh] overflow-y-auto pr-2">
                    {isLoading && <p>Loading history...</p>}
                    {error && <p className="text-red-400">{error}</p>}
                    {!isLoading && !error && history.length === 0 && <p>No history found.</p>}
                    <div className="space-y-4">
                        {history.map(item => (
                            <details key={item.id} className="bg-gray-900/50 rounded-lg">
                                <summary className="p-4 cursor-pointer font-semibold text-gray-200">
                                    {item.goal}
                                </summary>
                                <div className="p-4 border-t border-gray-700">
                                    <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: marked.parse(item.result) }}/>
                                </div>
                            </details>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
// #endregion


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
  
  const [apiProgress, setApiProgress] = useState({ completed: 0, total: 0 });
  const [totalEstimatedCalls, setTotalEstimatedCalls] = useState(0);
  const [currentStageChunks, setCurrentStageChunks] = useState<{ doc: number, aux: number } | null>(null);

  const [apiResourceControl, setApiResourceControl] = useState<{
    docChunks: number;
    auxChunks: number;
    onConfirm: (limits: { doc: number, aux: number }) => void;
    onCancel: () => void;
  } | null>(null);

  // For DataTable module
  const [fileObjects, setFileObjects] = useState<Map<string, File>>(new Map());
  const [viewingExcelFile, setViewingExcelFile] = useState<{ name: string; data: DataTableData } | null>(null);
  
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<'login' | 'register' | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const isCancelledRef = useRef(false);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
      const user = api.getUserFromToken();
      if (user) {
          setIsAuthenticated(true);
          setCurrentUser(user.username);
      }
  }, []);

  useEffect(() => {
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

  useEffect(() => {
    if (provider === 'openrouter') {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        if (openRouterApiKey.trim()) {
          handleFetchOpenRouterModels();
        } else {
          setOpenRouterModels([]);
        }
      }, 500);
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
    setApiProgress({ completed: 0, total: 0 });
    setTotalEstimatedCalls(0);
    setCurrentStageChunks(null);
    setApiResourceControl(null);
    isCancelledRef.current = false;
  };
  
  const handleStop = () => {
    isCancelledRef.current = true;
    setProcessingStatus("Stopping process...");
    setApiResourceControl(null);
  };
  
  const handleAuthSuccess = (username: string) => {
    setIsAuthenticated(true);
    setCurrentUser(username);
    setShowAuthModal(null);
  };

  const handleLogout = () => {
    api.removeToken();
    setIsAuthenticated(false);
    setCurrentUser(null);
  };

  const executePollinationsFlow = async () => {
    isCancelledRef.current = false;
    setIsProcessing(true);
    setError(null);
    setTasks([]);
    setOutputs([]);
    setFinalResult(null);
    setApiProgress({ completed: 0, total: 0 });
    setTotalEstimatedCalls(0);

    const llmService = new LLMService('pollinations', '');
    const pollService = llmService.service as PollinationsService;
    const selectedModel = pollinationsModels.find(m => m.id === model);
    const dynamicParams = parseDynamicParameters(goal);
    const modelOptionsBase = { 
        maxInputChars: selectedModel?.maxInputChars,
        ...dynamicParams
    };
    const fileContext = files.map(f => f.content).join('\n\n');

    let cumulativeCompleted = 0;
    
    const runPlanningStage = async (limits: { doc: number, aux: number }) => {
      try {
        setProcessingStatus('Stage 1/3: Breaking down goal...');
        const planningEstimates = pollService.estimateApiCalls(modelOptionsBase, fileContext, goal);
        setCurrentStageChunks({ doc: planningEstimates.mainCount, aux: planningEstimates.auxCount });

        const initialTotal = limits.doc * limits.aux || planningEstimates.total;
        setTotalEstimatedCalls(initialTotal);
        
        let lastReportedCompletedForStage = 0;
        const planningProgressHandler = (progress: { completed: number; total: number; stage?: string }) => {
          if (isCancelledRef.current) return;
          lastReportedCompletedForStage = progress.completed;
          setApiProgress({ completed: cumulativeCompleted + progress.completed, total: initialTotal });
        };

        const generatedTasks = await llmService.breakDownGoalIntoTasks(model, goal, files, { ...modelOptionsBase, onProgress: planningProgressHandler }, limits, isCancelledRef);
        if (isCancelledRef.current) throw new Error('Process stopped by user.');
        
        cumulativeCompleted += lastReportedCompletedForStage;
        setTasks(generatedTasks);

        let executionAndSynthEstimate = 0;
        let tempOutputs: TaskOutput[] = [];
        for (const task of generatedTasks) {
            const completedTasksContext = tempOutputs.map(t => `Completed Task: ${t.taskDescription}\nOutput:\n${t.output}`).join('\n\n');
            const taskEstimates = pollService.estimateApiCalls(modelOptionsBase, fileContext, completedTasksContext);
            executionAndSynthEstimate += taskEstimates.total;
            tempOutputs.push({ taskId: task.id, taskDescription: task.description, output: '[ESTIMATED_OUTPUT]', citations: [] });
        }
        const fullOutputContext = tempOutputs.map(t => `Task: ${t.taskDescription}\nOutput:\n${t.output}`).join('\n\n---\n\n');
        const synthesisEstimates = pollService.estimateApiCalls(modelOptionsBase, fullOutputContext, goal);
        executionAndSynthEstimate += synthesisEstimates.total;

        setTotalEstimatedCalls(prevTotal => prevTotal + executionAndSynthEstimate);

        await runExecutionLoop(generatedTasks, []);

      } catch (err) {
        handleFlowError(err);
      }
    };
    
    const runExecutionLoop = async (tasksToRun: Task[], completedOutputs: TaskOutput[]) => {
        const newOutputs = [...completedOutputs];
        for (let i = 0; i < tasksToRun.length; i++) {
            if (isCancelledRef.current) throw new Error('Process stopped by user.');
            const task = tasksToRun[i];
            
            const runExecutionStage = async (limits: { doc: number, aux: number }) => {
                try {
                    setProcessingStatus(`Stage 2/3: Executing task ${i + 1} of ${tasksToRun.length}...`);
                    setTasks(prevTasks => prevTasks.map(t =>
                      t.id === task.id ? { ...t, status: TaskStatus.IN_PROGRESS } : t
                    ));
                    
                    const completedTasksContext = newOutputs.map(t => `Completed Task: ${t.taskDescription}\nOutput:\n${t.output}`).join('\n\n');
                    const taskEstimates = pollService.estimateApiCalls(modelOptionsBase, fileContext, completedTasksContext);
                    setCurrentStageChunks({ doc: taskEstimates.mainCount, aux: taskEstimates.auxCount });

                    let lastReportedCompletedForStage = 0;
                    const taskProgressHandler = (progress: { completed: number; total: number; stage?: 'processing' | 'synthesis' }) => {
                        if (isCancelledRef.current) return;
                        lastReportedCompletedForStage = progress.completed;
                        
                        const baseText = `Stage 2/3: Executing task ${i + 1} of ${tasksToRun.length}...`;
                        let stageText = '';
                        if (progress.stage) {
                            stageText = progress.stage === 'synthesis' ? ' (synthesizing part...)' : ' (processing parts...)';
                        }
                        setProcessingStatus(baseText + stageText);
                        
                        setApiProgress(prev => ({ ...prev, completed: cumulativeCompleted + progress.completed }));
                    };
        
                    const taskOutput = await llmService.executeTask(model, task, goal, newOutputs, files, useSearch, { ...modelOptionsBase, onProgress: taskProgressHandler }, limits, isCancelledRef);
                    if (isCancelledRef.current) throw new Error('Process stopped by user.');

                    cumulativeCompleted += lastReportedCompletedForStage;
                    newOutputs.push(taskOutput);
                    setOutputs([...newOutputs]);
        
                    setTasks(prevTasks => prevTasks.map(t =>
                      t.id === task.id ? { ...t, status: TaskStatus.COMPLETED } : t
                    ));
                } catch (err) {
                    handleFlowError(err);
                    throw err; 
                }
            };
            
            const completedTasksContext = newOutputs.map(t => `Completed Task: ${t.taskDescription}\nOutput:\n${t.output}`).join('\n\n');
            const taskEstimates = pollService.estimateApiCalls(modelOptionsBase, fileContext, completedTasksContext);
            setApiProgress(prev => ({ ...prev, total: totalEstimatedCalls }));

            if (taskEstimates.total > 5) {
                await new Promise<void>(resolve => {
                    setApiResourceControl({
                        docChunks: taskEstimates.mainCount,
                        auxChunks: taskEstimates.auxCount,
                        onConfirm: async (limits) => {
                            setApiResourceControl(null);
                            await runExecutionStage(limits);
                            resolve();
                        },
                        onCancel: () => {
                            setApiResourceControl(null);
                            handleStop();
                            resolve();
                        }
                    });
                });
            } else {
                await runExecutionStage({ doc: 0, aux: 0 });
            }
        }
        await runSynthesisStage(newOutputs);
    };

    const runSynthesisStage = async (finalOutputs: TaskOutput[]) => {
        const run = async (limits: { doc: number, aux: number }) => {
            try {
                setProcessingStatus('Stage 3/3: Synthesizing final result...');
                if (isCancelledRef.current) throw new Error('Process stopped by user.');
                
                const fullOutputContext = finalOutputs.map(t => `Task: ${t.taskDescription}\nOutput:\n${t.output}`).join('\n\n---\n\n');
                const synthesisEstimates = pollService.estimateApiCalls(modelOptionsBase, fullOutputContext, goal);
                setCurrentStageChunks({ doc: synthesisEstimates.mainCount, aux: synthesisEstimates.auxCount });
                setApiProgress(prev => ({...prev, total: totalEstimatedCalls }));
        
                let lastReportedCompletedForStage = 0;
                const synthesisProgressHandler = (progress: { completed: number, total: number }) => {
                    if (isCancelledRef.current) return;
                    lastReportedCompletedForStage = progress.completed;
                    setApiProgress(prev => ({ ...prev, completed: cumulativeCompleted + progress.completed }));
                };
                
                const finalSynthesizedResult = await llmService.synthesizeFinalResult(model, goal, finalOutputs, { ...modelOptionsBase, onProgress: synthesisProgressHandler }, limits, isCancelledRef);
                setFinalResult(finalSynthesizedResult);

                api.saveChatHistory(goal, finalSynthesizedResult);

                setIsProcessing(false);
                setProcessingStatus('');
            } catch(err) {
                handleFlowError(err);
            }
        };

        const fullOutputContext = finalOutputs.map(t => `Task: ${t.taskDescription}\nOutput:\n${t.output}`).join('\n\n---\n\n');
        const synthesisEstimates = pollService.estimateApiCalls(modelOptionsBase, fullOutputContext, goal);
        if (synthesisEstimates.total > 5) {
             setApiResourceControl({
                docChunks: synthesisEstimates.mainCount,
                auxChunks: synthesisEstimates.auxCount,
                onConfirm: (limits) => { setApiResourceControl(null); run(limits); },
                onCancel: () => { setApiResourceControl(null); handleStop(); }
            });
        } else {
            await run({ doc: 0, aux: 0 });
        }
    };
    
    const handleFlowError = (err: any) => {
        console.error(err);
        const errorMessage = err.message === 'Process stopped by user.' 
            ? 'Process stopped by user.'
            : (err.message || 'An unexpected error occurred.');
        setError(errorMessage);
        setTasks(prevTasks => prevTasks.map(t =>
            t.status === TaskStatus.IN_PROGRESS ? { ...t, status: TaskStatus.FAILED } : t
        ));
        setIsProcessing(false);
        setProcessingStatus('');
    };

    const planningEstimates = pollService.estimateApiCalls(modelOptionsBase, fileContext, goal);
    setApiProgress({ completed: 0, total: planningEstimates.total });
    if (planningEstimates.total > 5) {
        setApiResourceControl({
            docChunks: planningEstimates.mainCount,
            auxChunks: planningEstimates.auxCount,
            onConfirm: (limits) => { setApiResourceControl(null); runPlanningStage(limits); },
            onCancel: () => { setApiResourceControl(null); handleStop(); setIsProcessing(false); }
        });
    } else {
        await runPlanningStage({ doc: 0, aux: 0 });
    }
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
    setFinalResult(null);
    isCancelledRef.current = false;

    if (provider === 'pollinations') {
      executePollinationsFlow();
      return;
    }

    try {
      const apiKey = provider === 'gemini' ? geminiApiKey : openRouterApiKey;
      const llmService = new LLMService(provider, apiKey);

      setProcessingStatus('Stage 1/3: Breaking down goal...');
      const generatedTasks = await llmService.breakDownGoalIntoTasks(model, goal, files, {}, {doc:0, aux:0}, isCancelledRef);
      
      if (isCancelledRef.current) throw new Error('Process stopped by user.');
      
      setTasks(generatedTasks);

      const newOutputs: TaskOutput[] = [];
      for (let i = 0; i < generatedTasks.length; i++) {
        const task = generatedTasks[i];
        if (isCancelledRef.current) throw new Error('Process stopped by user.');
        
        setProcessingStatus(`Stage 2/3: Executing task ${i + 1} of ${generatedTasks.length}...`);
        setTasks(prevTasks => prevTasks.map(t =>
          t.id === task.id ? { ...t, status: TaskStatus.IN_PROGRESS } : t
        ));
        
        const taskOutput = await llmService.executeTask(model, task, goal, newOutputs, files, useSearch, {}, {doc:0, aux:0}, isCancelledRef);
        newOutputs.push(taskOutput);
        setOutputs([...newOutputs]);

        setTasks(prevTasks => prevTasks.map(t =>
          t.id === task.id ? { ...t, status: TaskStatus.COMPLETED } : t
        ));
      }

      setProcessingStatus('Stage 3/3: Synthesizing final result...');
      if (isCancelledRef.current) throw new Error('Process stopped by user.');

      const finalSynthesizedResult = await llmService.synthesizeFinalResult(model, goal, newOutputs, {}, {doc:0, aux:0}, isCancelledRef);
      setFinalResult(finalSynthesizedResult);

      api.saveChatHistory(goal, finalSynthesizedResult);

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
          <header className="mb-8">
              <div className="flex justify-between items-center">
                  <div className="text-left">
                      <h1 className="text-4xl font-bold text-gray-100">AI Dev Assistant</h1>
                      <p className="text-md text-gray-400 mt-2">
                        Define a goal, provide context, and let the AI execute a plan.
                      </p>
                  </div>
                  <div className="text-right space-x-2">
                      {isAuthenticated ? (
                          <>
                              <span className="text-gray-300 text-sm">Welcome, {currentUser}!</span>
                              <button onClick={() => setShowHistoryModal(true)} className="px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 rounded-md">History</button>
                              <button onClick={handleLogout} className="px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 rounded-md">Logout</button>
                          </>
                      ) : (
                          <>
                              <button onClick={() => setShowAuthModal('login')} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Login</button>
                              <button onClick={() => setShowAuthModal('register')} className="px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-700 rounded-lg">Sign Up</button>
                          </>
                      )}
                  </div>
              </div>
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
                  <div className="flex items-center justify-between gap-4 w-full">
                      <button
                          onClick={handleStop}
                          className="px-8 py-3 border border-transparent font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 flex items-center justify-center transition-all duration-200"
                      >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 6h12v12H6z" />
                          </svg>
                          Stop
                      </button>
                      <div className="flex-grow min-w-0">
                          {provider === 'pollinations' && apiProgress.total > 0 ? (
                            <PollinationsProgress
                              completedCalls={apiProgress.completed}
                              totalCalls={totalEstimatedCalls}
                              statusText={processingStatus}
                              docChunks={currentStageChunks?.doc}
                              auxChunks={currentStageChunks?.aux}
                            />
                          ) : (
                            <div className="flex items-center text-gray-300">
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>{processingStatus}</span>
                            </div>
                          )}
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
      
      {showAuthModal && <AuthModal mode={showAuthModal} onClose={() => setShowAuthModal(null)} onSuccess={handleAuthSuccess} />}
      {showHistoryModal && <HistoryModal onClose={() => setShowHistoryModal(false)} />}

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
      {apiResourceControl && (
        <ApiResourceControlModal
            docChunks={apiResourceControl.docChunks}
            auxChunks={apiResourceControl.auxChunks}
            onConfirm={apiResourceControl.onConfirm}
            onCancel={apiResourceControl.onCancel}
        />
      )}
    </>
  );
};

export default App;