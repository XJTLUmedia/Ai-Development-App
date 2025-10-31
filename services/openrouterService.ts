import { StoredFile, Task, TaskStatus, TaskOutput, Citation } from '../types';

export interface OpenRouterModel {
    id: string;
    name: string;
}

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

export const fetchOpenRouterModels = async (apiKey: string): Promise<OpenRouterModel[]> => {
    if (!apiKey) return [];
    try {
        const response = await fetch(`${OPENROUTER_API_BASE}/models`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error("OpenRouter API Error Body:", errorBody);
            throw new Error(`OpenRouter API error (${response.status}): ${response.statusText}`);
        }
        const { data } = await response.json();
        return data.map((model: any) => ({ id: model.id, name: model.name || model.id })).sort((a:OpenRouterModel,b:OpenRouterModel) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error("Failed to fetch OpenRouter models:", error);
        if (error instanceof Error && error.message.includes("404")) {
             throw new Error("OpenRouter API error:  - No endpoints found matching your data policy (Free model publication). Configure: https://openrouter.ai/settings/privacy");
        }
        if (error instanceof Error && error.message.includes("429")) {
             throw new Error("OpenRouter API error (429): The model is temporarily rate-limited. Please wait a moment or try a different model.");
        }
        throw new Error("Could not fetch models from OpenRouter. Please check your API key.");
    }
};

export class OpenRouterService {
    private apiKey: string;
    private headers: HeadersInit;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
        this.headers = {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
        };
    }
    
    private stripMarkdown(text: string): string {
      return text.replace(/```json\n?([\s\S]*?)\n?```/, '$1').trim();
    }

    private extractCitationsFromText(text: string): { output: string, citations: Citation[] } {
        const urlRegex = /(https?:\/\/[^\s)]+)/g;
        const citations: Citation[] = [];
        let output = text;

        // Check for a "References" or "Sources" section to extract URLs from
        const sourcesSectionMatch = text.match(/(sources|references|citations):?\s*\n((.|\n)*)/im);
        if(sourcesSectionMatch) {
            const urls = sourcesSectionMatch[2].match(urlRegex);
            if(urls) {
                urls.forEach(url => {
                    citations.push({
                        uri: url,
                        title: new URL(url).hostname,
                    });
                });
                // Clean the sources section from the main output
                output = text.substring(0, sourcesSectionMatch.index).trim();
            }
        }
        
        return { output, citations };
    }

    async breakDownGoalIntoTasks(
        model: string,
        goal: string,
        files: StoredFile[],
    ): Promise<Task[]> {
        const fileContext = files.map(f => `File: ${f.name}\nContent:\n${f.content}`).join('\n\n---\n\n');
        const prompt = `
Based on the primary goal and the provided file contents, break down the goal into a series of smaller, actionable tasks.
Each task should be a single, clear step towards achieving the main goal.
Return the tasks as a JSON array of objects, where each object has an "id" (a short, unique, hyphenated string) and a "description".

Primary Goal:
${goal}

${files.length > 0 ? `File Contents:\n${fileContext}` : ''}

Provide ONLY the JSON array of tasks. Do not include any other text, commentary, or markdown formatting.
`;
        const body = JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }]
        });

        const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
            method: 'POST',
            headers: this.headers,
            body: body
        });
        
        if (!response.ok) {
            const errorBody = await response.text();
            console.error("OpenRouter Plan Generation Error:", errorBody);
            throw new Error(`OpenRouter API error (${response.status}): ${response.statusText}`);
        }
        
        const data = await response.json();
        const rawContent = data.choices[0]?.message?.content;
        
        if (!rawContent) {
            throw new Error("OpenRouter returned an empty response. The selected model may not be suitable for this task.");
        }

        try {
            const jsonString = this.stripMarkdown(rawContent);
            const tasksJson = JSON.parse(jsonString);
            return tasksJson.map((task: any) => ({ ...task, status: TaskStatus.PENDING }));
        } catch (e) {
            console.error("Failed to parse task list JSON from OpenRouter:", e, "\nRaw content:", rawContent);
            throw new Error("OpenRouter could not generate a valid task list. Please try a different model.");
        }
    }

    async executeTask(
        model: string,
        task: Task,
        goal: string,
        completedTasks: TaskOutput[],
        files: StoredFile[],
        useSearch: boolean
    ): Promise<TaskOutput> {
        
        const fileContext = files.map(f => `File: ${f.name}\nContent:\n${f.content}`).join('\n\n---\n\n');
        const completedTasksContext = completedTasks.map(t => `Completed Task: ${t.taskDescription}\nOutput:\n${t.output}`).join('\n\n');
        
        const modelToUse = useSearch ? `${model}:online` : model;

        const prompt = `
You are an expert developer assistant. Your task is to generate the output for a specific step in a larger project.
Base your answer ONLY on the context provided.
Primary Goal: ${goal}
File Contents: ${fileContext}
Completed Tasks Context: ${completedTasksContext}

Current Task: "${task.description}"

Based on the provided context, generate the precise output for the task.
Do not add any extra commentary, greetings, or explanations beyond what the task requires.
If you use web search, please cite your sources with full URLs in a "References" section at the end.
`;

        const body = {
            model: modelToUse,
            messages: [{ role: 'user', content: prompt }]
        };

        const response = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("OpenRouter Task Execution Error:", errorBody);
            throw new Error(`OpenRouter API error (${response.status}): ${response.statusText}`);
        }
        
        const data = await response.json();
        const rawContent = data.choices[0]?.message?.content;

        if (!rawContent) {
          return { taskId: task.id, taskDescription: task.description, output: "The model returned an empty response.", citations: [] };
        }

        const { output, citations } = this.extractCitationsFromText(rawContent);

        return {
            taskId: task.id,
            taskDescription: task.description,
            output: output,
            citations: citations,
        };
    }
}