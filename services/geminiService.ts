import { GoogleGenAI, Type } from "@google/genai";
import { StoredFile, Task, TaskStatus, TaskOutput, Citation } from '../types';

export class GeminiService {
    private ai: GoogleGenAI;

    constructor(apiKey: string) {
        this.ai = new GoogleGenAI({ apiKey });
    }

    async breakDownGoalIntoTasks(
        model: string,
        goal: string,
        files: StoredFile[]
    ): Promise<Task[]> {
        const fileContext = files.map(f => `File: ${f.name}\nContent:\n${f.content}`).join('\n\n---\n\n');
        const prompt = `
Based on the primary goal and the provided file contents, break down the goal into a series of smaller, actionable tasks.
Each task should be a single, clear step towards achieving the main goal.
Return the tasks as a JSON array of objects, where each object has an "id" (a short, unique, hyphenated string) and a "description".

Primary Goal:
${goal}

${files.length > 0 ? `File Contents:\n${fileContext}` : ''}

Provide a JSON array of tasks in the following format:
[
  {"id": "task-1", "description": "First task description..."},
  {"id": "task-2", "description": "Second task description..."}
]
`;

        const response = await this.ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            id: { type: Type.STRING },
                            description: { type: Type.STRING },
                        },
                        required: ['id', 'description'],
                    }
                }
            }
        });

        try {
            const tasksJson = JSON.parse(response.text);
            return tasksJson.map((task: any) => ({ ...task, status: TaskStatus.PENDING }));
        } catch (e) {
            console.error("Failed to parse task list JSON from Gemini:", e);
            throw new Error("Gemini could not generate a valid task list from the model's response.");
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
        const prompt = `
You are an expert developer assistant. Your task is to generate the output for a specific step in a larger project.

Primary Goal:
${goal}

${files.length > 0 ? `File Contents:\n${fileContext}`: ''}

${completedTasks.length > 0 ? `Context from previously completed tasks:\n${completedTasksContext}` : ''}

Current Task to Execute:
${task.description}

Based on all the provided context, generate the precise output required to complete this task.
If the task involves writing code, provide only the code.
If it involves explaining a concept, provide a clear and concise explanation.
If it involves creating a file, provide the full file content.
Do not add any extra commentary, greetings, or explanations beyond what the task requires.
`;
        const config: any = {};
        if (useSearch) {
            config.tools = [{ googleSearch: {} }];
        }

        const response = await this.ai.models.generateContent({
            model: model,
            contents: prompt,
            config: config,
        });

        const output = response.text;
        const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
        const citations: Citation[] = [];
        if (groundingMetadata?.groundingChunks) {
            for (const chunk of groundingMetadata.groundingChunks) {
                if (chunk.web) {
                    citations.push({
                        uri: chunk.web.uri,
                        title: chunk.web.title || 'Source',
                    });
                }
            }
        }

        return {
            taskId: task.id,
            taskDescription: task.description,
            output: output,
            citations: citations,
        };
    }

    async synthesizeFinalResult(
        model: string,
        goal: string,
        completedTasks: TaskOutput[]
    ): Promise<string> {
        const completedTasksContext = completedTasks
            .map(t => `Task: ${t.taskDescription}\nOutput:\n${t.output}`)
            .join('\n\n---\n\n');

        const prompt = `
You are a master synthesizer. Your job is to take a user's original goal and the raw outputs from a series of automated tasks, and transform them into a final, polished, and coherent result.

**Primary Goal:**
${goal}

**Individual Task Outputs:**
---
${completedTasksContext}
---

**Your Instructions:**
1.  Carefully review the Primary Goal. This is the ultimate objective.
2.  Analyze the individual task outputs. These are the raw materials and building blocks.
3.  Synthesize a single, final response that directly and completely fulfills the Primary Goal.
4.  **DO NOT** simply list or repeat the task outputs. Integrate them intelligently.
5.  If the goal was to create a single artifact (e.g., a summary, a document, a piece of code), your response should be ONLY that artifact.
6.  If the goal was a question, your response should be the final, complete answer.
7.  The final output should be clean, well-formatted, and ready for the user. Eliminate any redundancy or intermediate steps present in the task outputs.

Produce ONLY the final, synthesized result.
`;

        const response = await this.ai.models.generateContent({
            model: model,
            contents: prompt,
        });

        return response.text;
    }
}