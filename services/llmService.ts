
import React from 'react';
import { StoredFile, Task, TaskOutput } from '../types';
import { GeminiService } from './geminiService';
import { OpenRouterService, OpenRouterModel, fetchOpenRouterModels } from './openrouterService';
import { PollinationsService, PollinationsModel, fetchPollinationsModels, parseDynamicParameters } from './pollinationsService';

export { fetchOpenRouterModels, fetchPollinationsModels, parseDynamicParameters };
export type { OpenRouterModel, PollinationsModel };

export class LLMService {
  public service: GeminiService | OpenRouterService | PollinationsService;
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
    options: { [key: string]: any } = {},
    limits: { doc: number, aux: number } = { doc: 0, aux: 0 },
    isCancelledRef?: React.RefObject<boolean>
  ): Promise<Task[]> {
    if (this.service instanceof PollinationsService) {
      return this.service.breakDownGoalIntoTasks(model, goal, files, options, limits, isCancelledRef);
    }
    // For other services, call without the extra parameters
    return this.service.breakDownGoalIntoTasks(model, goal, files);
  }

  async executeTask(
    model: string,
    task: Task,
    goal: string,
    completedTasks: TaskOutput[],
    files: StoredFile[],
    useSearch: boolean,
    options: { [key: string]: any } = {},
    limits: { doc: number, aux: number } = { doc: 0, aux: 0 },
    isCancelledRef?: React.RefObject<boolean>
  ): Promise<TaskOutput> {
     if (this.service instanceof PollinationsService) {
      return this.service.executeTask(model, task, goal, completedTasks, files, useSearch, options, limits, isCancelledRef);
    }
    // For other services, call without the extra parameters
    return this.service.executeTask(model, task, goal, completedTasks, files, useSearch);
  }

  async synthesizeFinalResult(
    model: string,
    goal: string,
    completedTasks: TaskOutput[],
    options: { [key: string]: any } = {},
    limits: { doc: number, aux: number } = { doc: 0, aux: 0 },
    isCancelledRef?: React.RefObject<boolean>
  ): Promise<string> {
    if (this.service instanceof PollinationsService) {
      return this.service.synthesizeFinalResult(model, goal, completedTasks, options, limits, isCancelledRef);
    }
    return this.service.synthesizeFinalResult(model, goal, completedTasks);
  }
}
