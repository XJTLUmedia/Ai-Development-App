import { StoredFile, Task, TaskStatus, TaskOutput } from '../types';
import { processAndSynthesize } from './pollinationsProcessor';

export interface PollinationsModel {
    id: string;
    name: string;
    maxInputChars?: number;
}

interface DynamicParams {
  temperature?: number;
  reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high';
  system_prompt?: string;
}

const POLLINATIONS_TEXT_API_BASE = 'https://text.pollinations.ai';
const POLLINATIONS_MODELS_URL = 'https://text.pollinations.ai/models';

export const parseDynamicParameters = (goal: string): DynamicParams => {
    const params: DynamicParams = {};
    const lowerGoal = goal.toLowerCase();

    // Temperature: Adjusts creativity
    if (/\b(creative|imaginative|wild|artistic|unconventional)\b/.test(lowerGoal)) {
        params.temperature = 1.5;
    } else if (/\b(precise|strict|exact|formal|literal|technical)\b/.test(lowerGoal)) {
        params.temperature = 0.2;
    }

    // Reasoning Effort: Adjusts thinking time
    if (/\b(deeply|thoroughly|complex|analyze|detailed plan)\b/.test(lowerGoal)) {
        params.reasoning_effort = 'high';
    } else if (/\b(quick|brief|extract|simple|fast|summarize)\b/.test(lowerGoal)) {
        params.reasoning_effort = 'low';
    }

    // System Prompt (Persona): Sets the AI's personality
    const personaMatch = lowerGoal.match(/act as (a|an) ([\w\s]+?)(?=[,.]|$)/);
    if (personaMatch && personaMatch[2]) {
        params.system_prompt = `You are ${personaMatch[2].trim()}.`;
    }

    return params;
}

export const fetchPollinationsModels = async (): Promise<PollinationsModel[]> => {
    try {
        const response = await fetch(POLLINATIONS_MODELS_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch models from Pollinations API (${response.status})`);
        }
        const models: any[] = await response.json();
        
        const anonymousModels = models
            .filter(model => model.tier === 'anonymous')
            .map(model => ({
                id: model.name,
                name: model.description,
                maxInputChars: model.maxInputChars,
            }));
            
        return anonymousModels;
    } catch (error) {
        console.error("Failed to fetch or process Pollinations models:", error);
        throw new Error("Could not fetch models from Pollinations. The service may be unavailable.");
    }
};

export class PollinationsService {
    constructor() {}

    private stripMarkdown(text: string): string {
      return text.replace(/```json\n?([\s\S]*?)\n?```/, '$1').trim();
    }
    
    private async callApi(model: string, messages: { role: string; content: string }[], options: { [key: string]: any }): Promise<string> {
        try {
            const body: { [key: string]: any } = {
                model,
                messages,
                stream: false
            };

            if (options.temperature) body.temperature = options.temperature;
            if (options.reasoning_effort) body.reasoning_effort = options.reasoning_effort;
            
            // Add system prompt from options if it exists and isn't already in messages
            if (options.system_prompt && messages.every(m => m.role !== 'system')) {
                messages.unshift({ role: 'system', content: options.system_prompt });
            }

            const response = await fetch(`${POLLINATIONS_TEXT_API_BASE}/openai`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error("Pollinations API Error:", errorBody);
                throw new Error(`Pollinations API error (${response.status}): ${response.statusText}`);
            }

            const data = await response.json();
            return data.choices?.[0]?.message?.content || '';
        } catch (error) {
            console.error("Pollinations API call failed:", error);
            if (error instanceof Error) throw error;
            throw new Error("Could not connect to the Pollinations service. The service might be down or the API endpoint is incorrect.");
        }
    }

    async breakDownGoalIntoTasks(
        model: string,
        goal: string,
        files: StoredFile[],
        options: { [key: string]: any } = {}
    ): Promise<Task[]> {
        const fileContext = files.map(f => `File: ${f.name}\nContent:\n${f.content}`).join('\n\n---\n\n');
        
        const processingSystemPrompt = "You are an AI assistant that breaks down a goal into a list of smaller, actionable tasks based on provided context. You MUST respond with ONLY a valid JSON array of tasks, where each task has a unique 'id' and a 'description'.";

        const processingPromptTemplate = (mainChunk: string, auxChunk: string) => `
Based on the primary goal and the following chunk of file contents, suggest a list of actionable tasks.

Primary Goal:
${auxChunk}

File Content Chunk:
---
${mainChunk || 'No file content provided in this chunk.'}
---

Respond with ONLY the JSON array of tasks.
`;

        const synthesisSystemPrompt = `You are a master synthesizer. Your job is to combine partial task lists from a previous step into a single, coherent, and de-duplicated final JSON task list.`;
        
        const synthesisPromptTemplate = (partialResults: string) => `
The following are several lists of tasks generated from different parts of a document. 
Combine them into a single, coherent, and de-duplicated final task list in the required JSON format.

Primary Goal:
${goal}

Partial Task Lists (in JSON format):
---
${partialResults}
---

Provide ONLY the final, combined JSON array of tasks.
`;
        
        const onProgress = options.onProgress || (() => {});

        const rawContent = await processAndSynthesize(
            this.callApi.bind(this),
            model,
            options,
            processingSystemPrompt,
            processingPromptTemplate,
            synthesisSystemPrompt,
            synthesisPromptTemplate,
            fileContext, // main content
            goal, // auxiliary context
            onProgress
        );
        
        if (!rawContent) {
            throw new Error("Pollinations returned an empty response for task planning.");
        }

        try {
            const jsonString = this.stripMarkdown(rawContent);
            const tasksJson = JSON.parse(jsonString);
            return tasksJson.map((task: any) => ({ ...task, status: TaskStatus.PENDING }));
        } catch (e) {
            console.error("Failed to parse final task list JSON from Pollinations:", e, "\nRaw content:", rawContent);
            throw new Error("Pollinations could not generate a valid final task list.");
        }
    }

    async executeTask(
        model: string,
        task: Task,
        goal: string,
        completedTasks: TaskOutput[],
        files: StoredFile[],
        useSearch: boolean,
        options: { [key: string]: any } = {}
    ): Promise<TaskOutput> {
        const fileContext = files.map(f => `File: ${f.name}\nContent:\n${f.content}`).join('\n\n---\n\n');
        const completedTasksContext = completedTasks.map(t => `Completed Task: ${t.taskDescription}\nOutput:\n${t.output}`).join('\n\n');
        
        const processingSystemPrompt = `You are an expert assistant executing a single task. Your output MUST strictly follow the special formatting rules provided (JSON for specific types like CalendarEvent, Map, Chart, HtmlSnippet; raw text/code for all other tasks). Do not add any extra commentary or explanations.`;
        
        const processingPromptTemplate = (mainChunk: string, auxChunk: string) => `
Primary Goal: ${goal}
Current Task: "${task.description}"

File Contents Chunk:
---
${mainChunk || 'No file content provided in this chunk.'}
---

Context from previously completed tasks Chunk:
---
${auxChunk || 'No context from previous tasks in this chunk.'}
---

Based on the provided context chunks, generate the precise output required to complete this task, or a partial output if the context is incomplete. Adhere strictly to the special output formatting rules.
`;

        const synthesisSystemPrompt = `You are a master synthesizer. Your job is to combine partial outputs into one single, final, and complete output that directly addresses the task.`;
        
        const synthesisPromptTemplate = (partialResults: string) => `
The following are several partial outputs generated to fulfill a single task. 
The task was: "${task.description}". 

Combine these partial outputs into one single, final, and complete output that directly addresses the task, maintaining all details and adhering strictly to the special output formatting rules.

Partial Outputs:
---
${partialResults}
---

Produce ONLY the final, synthesized output.
`;
        
        const onProgress = options.onProgress || (() => {});

        const rawContent = await processAndSynthesize(
            this.callApi.bind(this),
            model,
            options,
            processingSystemPrompt,
            processingPromptTemplate,
            synthesisSystemPrompt,
            synthesisPromptTemplate,
            fileContext, // main content
            completedTasksContext, // auxiliary context
            onProgress
        );
        
        if (!rawContent) {
          return { taskId: task.id, taskDescription: task.description, output: "The model returned an empty response.", citations: [] };
        }
        
        return {
            taskId: task.id,
            taskDescription: task.description,
            output: rawContent,
            citations: [],
        };
    }

    async synthesizeFinalResult(
        model: string,
        goal: string,
        completedTasks: TaskOutput[],
        options: { [key: string]: any } = {}
    ): Promise<string> {
        const fullContext = completedTasks
            .map(t => `Task: ${t.taskDescription}\nOutput:\n${t.output}`)
            .join('\n\n---\n\n');

        const processingSystemPrompt = `You are a synthesizer. Your job is to create a polished, partial result that contributes to the user's Primary Goal by intelligently integrating the provided chunk of task outputs.`;
        
        const processingPromptTemplate = (mainChunk: string, auxChunk: string) => `
Primary Goal: ${auxChunk}

Individual Task Outputs Chunk:
---
${mainChunk}
---

Based on this chunk of outputs, provide a partial synthesis that contributes to the final goal. Do not include raw JSON; describe it in a human-readable way.
`;
        const synthesisSystemPrompt = `You are a master synthesizer. Your job is to combine partial summaries into a single, final, polished result that fulfills the original goal.`;

        const synthesisPromptTemplate = (partialResults: string) => `
The following are several partial summaries. Synthesize them into a single, final, polished result that fulfills the original goal: '${goal}'. 

Preserve all important information from the partial summaries. Integrate them intelligently. The final output should be clean, well-formatted, and ready for the user.

Partial Summaries:
---
${partialResults}
---

Produce ONLY the final, synthesized result.
`;
        
        const onProgress = options.onProgress || (() => {});

        const result = await processAndSynthesize(
            this.callApi.bind(this),
            model,
            options,
            processingSystemPrompt,
            processingPromptTemplate,
            synthesisSystemPrompt,
            synthesisPromptTemplate,
            fullContext, // main content
            goal, // auxiliary context
            onProgress
        );
        
        return result || "The model could not synthesize a final result.";
    }
}