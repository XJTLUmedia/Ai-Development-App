import { StoredFile, Task, TaskOutput } from '../types';
import { GeminiService } from './geminiService';
import { OpenRouterService, OpenRouterModel, fetchOpenRouterModels } from './openrouterService';

export { fetchOpenRouterModels };
export type { OpenRouterModel };

export class LLMService {
  private service: GeminiService | OpenRouterService;

  constructor(provider: 'gemini' | 'openrouter', apiKey: string) {
    if (provider === 'gemini') {
      // Per guidelines, Gemini API key is from process.env
      this.service = new GeminiService(process.env.API_KEY || '');
    } else {
      this.service = new OpenRouterService(apiKey);
    }
  }

  async breakDownGoalIntoTasks(
    model: string,
    goal: string,
    files: StoredFile[],
  ): Promise<Task[]> {
    return this.service.breakDownGoalIntoTasks(model, goal, files);
  }

  async executeTask(
    model: string,
    task: Task,
    goal: string,
    completedTasks: TaskOutput[],
    files: StoredFile[],
    useSearch: boolean
  ): Promise<TaskOutput> {
    return this.service.executeTask(model, task, goal, completedTasks, files, useSearch);
  }
}
