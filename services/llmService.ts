import { StoredFile, Task, TaskOutput } from '../types';
import { GeminiService } from './geminiService';
import { OpenRouterService, OpenRouterModel, fetchOpenRouterModels } from './openrouterService';
import { PollinationsService, PollinationsModel, fetchPollinationsModels, parseDynamicParameters } from './pollinationsService';

export { fetchOpenRouterModels, fetchPollinationsModels, parseDynamicParameters };
export type { OpenRouterModel, PollinationsModel };

export class LLMService {
  private service: GeminiService | OpenRouterService | PollinationsService;
  private provider: 'gemini' | 'openrouter' | 'pollinations';

  constructor(provider: 'gemini' | 'openrouter' | 'pollinations', apiKey: string) {
    this.provider = provider;
    switch (provider) {
      case 'gemini':
        this.service = new GeminiService(apiKey);
        break;
      case 'openrouter':
        this.service = new OpenRouterService(apiKey);
        break;
      case 'pollinations':
        this.service = new PollinationsService();
        break;
      default:
        // This case should not be reachable with TypeScript, but it's good practice
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }

  async breakDownGoalIntoTasks(
    model: string,
    goal: string,
    files: StoredFile[],
    options?: { [key: string]: any }
  ): Promise<Task[]> {
    if (this.service instanceof PollinationsService) {
      return this.service.breakDownGoalIntoTasks(model, goal, files, options);
    }
    // For other services, call without the options parameter
    return this.service.breakDownGoalIntoTasks(model, goal, files);
  }

  async executeTask(
    model: string,
    task: Task,
    goal: string,
    completedTasks: TaskOutput[],
    files: StoredFile[],
    useSearch: boolean,
    options?: { [key: string]: any }
  ): Promise<TaskOutput> {
     if (this.service instanceof PollinationsService) {
      return this.service.executeTask(model, task, goal, completedTasks, files, useSearch, options);
    }
    // For other services, call without the options parameter
    return this.service.executeTask(model, task, goal, completedTasks, files, useSearch);
  }

  async synthesizeFinalResult(
    model: string,
    goal: string,
    completedTasks: TaskOutput[],
    options?: { [key: string]: any }
  ): Promise<string> {
    if (this.service instanceof PollinationsService) {
      return this.service.synthesizeFinalResult(model, goal, completedTasks, options);
    }
    return this.service.synthesizeFinalResult(model, goal, completedTasks);
  }
}