import { StoredFile, Task, TaskStatus, TaskOutput, Citation } from '../types';

export interface PollinationsModel {
    id: string;
    name: string;
    maxInputChars?: number;
}

const POLLINATIONS_API_BASE = 'https://text.pollinations.ai';
// Use a conservative, hardcoded character limit to prevent API errors.
const POLLINATIONS_SAFE_CHAR_LIMIT = 5000;


export const fetchPollinationsModels = async (): Promise<PollinationsModel[]> => {
    try {
        const response = await fetch(`${POLLINATIONS_API_BASE}/models`);
        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Pollinations API Error Body:", errorBody);
            throw new Error(`Pollinations API error (${response.status}): ${response.statusText}`);
        }
        const data = await response.json();
        
        if (!Array.isArray(data)) {
            console.error("Unexpected response format from Pollinations /models endpoint:", data);
            throw new Error("Could not parse models from Pollinations due to unexpected format.");
        }

        return data
            .filter((model: any) => model.tier === 'anonymous' && model.name && model.description) // Only show free, anonymous models
            .map((model: any) => ({ 
                id: model.name, // The 'name' field from the API is the model ID
                name: `${model.description} (${model.name})`, // Create a descriptive name for the UI
                maxInputChars: model.maxInputChars,
            }))
            .sort((a: PollinationsModel, b: PollinationsModel) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error("Failed to fetch Pollinations models:", error);
        throw new Error("Could not fetch models from Pollinations.");
    }
};

type SynthesisStrategy = 'document_assembly' | 'code_assembly' | 'best_answer_selection' | 'list_generation';

export class PollinationsService {
    private headers: HeadersInit;

    constructor() {
        this.headers = {
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
                output = text.substring(0, sourcesSectionMatch.index).trim();
            }
        }
        
        return { output, citations };
    }

    private async generateTasksForChunk(
        model: string,
        goal: string,
        contextChunk: string,
        chunkNumber: number,
        totalChunks: number
    ): Promise<any[]> {
         const prompt = `
You are part of a multi-step planning process. Your goal is to break down a large project into actionable tasks based on a specific chunk of the provided context.

Primary Goal: ${goal}

This is chunk ${chunkNumber} of ${totalChunks} of the total context.

Context Chunk:
---
${contextChunk}
---

Based on the primary goal and THIS CHUNK of context, identify and list the specific, actionable tasks required.
Do not generate tasks that would require information from other chunks. Focus only on what can be determined from the context provided here.
Return the tasks as a JSON array of objects, where each object has an "id" and a "description". Ensure the 'id' is a short, unique, hyphenated string.

Provide ONLY the JSON array of tasks. Do not include any other text, commentary, or markdown formatting. The JSON must be valid.
`;
        const body = JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }]
        });
        const response = await fetch(`${POLLINATIONS_API_BASE}/openai`, {
            method: 'POST',
            headers: this.headers,
            body: body
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Pollinations Plan Generation Error for chunk ${chunkNumber}:`, errorBody);
            // Return empty array for this chunk to avoid failing the whole process
            return [];
        }
        const data = await response.json();
        const rawContent = data.choices[0]?.message?.content;
        if (!rawContent) return [];

        try {
            const jsonString = this.stripMarkdown(rawContent);
            return JSON.parse(jsonString);
        } catch (e) {
            console.error(`Failed to parse task list JSON from Pollinations for chunk ${chunkNumber}:`, e, "\nRaw content:", rawContent);
            return []; // Return empty on parsing error
        }
    }


    async breakDownGoalIntoTasks(
        model: string,
        goal: string,
        files: StoredFile[],
        options?: { maxInputChars?: number }
    ): Promise<Task[]> {
        const fileContext = files.map(f => `File: ${f.name}\nContent:\n${f.content}`).join('\n\n---\n\n');
        
        const basePromptTemplate = (context: string) => `
Based on the primary goal and the provided file contents, break down the goal into a series of smaller, actionable tasks.
Each task should be a single, clear step towards achieving the main goal.
Return the tasks as a JSON array of objects, where each object has an "id" (a short, unique, hyphenated string) and a "description".

Primary Goal:
${goal}

${files.length > 0 ? `File Contents:\n${context}` : ''}

Provide ONLY the JSON array of tasks. Do not include any other text, commentary, or markdown formatting. The JSON must be valid.
`;
        const fullPrompt = basePromptTemplate(fileContext);

        // If context fits within the safe limit, use the standard approach
        if (fullPrompt.length <= POLLINATIONS_SAFE_CHAR_LIMIT) {
            const body = JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: fullPrompt }]
            });

            const response = await fetch(`${POLLINATIONS_API_BASE}/openai`, {
                method: 'POST',
                headers: this.headers,
                body: body
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error("Pollinations Plan Generation Error:", errorBody);
                throw new Error(`Pollinations API error (${response.status}): ${errorBody}`);
            }

            const data = await response.json();
            const rawContent = data.choices[0]?.message?.content;

            if (!rawContent) {
                throw new Error("Pollinations returned an empty response for planning.");
            }

            try {
                const jsonString = this.stripMarkdown(rawContent);
                const tasksJson = JSON.parse(jsonString);
                return tasksJson.map((task: any) => ({ ...task, status: TaskStatus.PENDING }));
            } catch (e) {
                console.error("Failed to parse task list JSON from Pollinations:", e, "\nRaw content:", rawContent);
                throw new Error("Pollinations could not generate a valid task list.");
            }
        }
        
        // --- Context is too large, begin chunking logic ---
        console.warn(`Context is too large for planning (${fullPrompt.length} > ${POLLINATIONS_SAFE_CHAR_LIMIT}). Chunking file context...`);
        
        const promptOverhead = basePromptTemplate('').length + 1000; // Estimate overhead of instructions, goal, etc. + buffer
        const chunkSize = POLLINATIONS_SAFE_CHAR_LIMIT - promptOverhead;
        const contextChunks: string[] = [];
        
        let currentChunk = "";
        const fileContents = files.map(f => `File: ${f.name}\nContent:\n${f.content}`);
        for (const content of fileContents) {
            if (currentChunk.length + content.length > chunkSize) {
                if (currentChunk) contextChunks.push(currentChunk);
                // If a single file is larger than the chunk size, it will be split.
                let contentLeft = content;
                while(contentLeft.length > chunkSize) {
                    contextChunks.push(contentLeft.substring(0, chunkSize));
                    contentLeft = contentLeft.substring(chunkSize);
                }
                currentChunk = contentLeft;
            } else {
                currentChunk += (currentChunk ? '\n\n---\n\n' : '') + content;
            }
        }
        if (currentChunk) contextChunks.push(currentChunk);

        console.log(`Split context into ${contextChunks.length} chunks.`);

        const allTasks: Task[] = [];
        for (let i = 0; i < contextChunks.length; i++) {
            const chunkTasks = await this.generateTasksForChunk(model, goal, contextChunks[i], i + 1, contextChunks.length);
            const uniqueChunkTasks = chunkTasks.map((task: any) => ({
                id: `chunk${i + 1}-${task.id}`,
                description: task.description,
                status: TaskStatus.PENDING
            }));
            allTasks.push(...uniqueChunkTasks);
        }

        if (allTasks.length === 0) {
            throw new Error("The planning process across multiple chunks failed to produce any tasks. The content may be too complex or the model may be unable to process the chunks.");
        }
        
        return allTasks;
    }


    private async getSummarizedContext(model: string, task: Task, contextToSummarize: string): Promise<string> {
        const summarizationPrompt = `
CONTEXT:
---
${contextToSummarize}
---
The above context is a (potentially truncated) set of files and prior work. Your job is to act as a compression step.

Based on the context, what is the essential information needed to perform the following task?

TASK: "${task.description}"

Summarize the absolutely critical information from the context that is required to complete this task. Be concise and focus only on the relevant details.
`;
        const body = JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: summarizationPrompt }]
        });

        const response = await fetch(`${POLLINATIONS_API_BASE}/openai`, {
            method: 'POST',
            headers: this.headers,
            body: body
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Pollinations Summarization Error:", errorBody);
            throw new Error(`Pollinations API error during context summarization (${response.status}): ${errorBody}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "";
    }


    async executeTask(
        model: string,
        task: Task,
        goal: string,
        completedTasks: TaskOutput[],
        files: StoredFile[],
        useSearch: boolean,
        options?: { maxInputChars?: number }
    ): Promise<TaskOutput> {
        
        const searchInstruction = useSearch ? 'If you need to, use web search to find up-to-date information. Please cite your sources with full URLs in a "References" section at the end.' : '';
        
        const fileContext = files.map(f => `File: ${f.name}\nContent:\n${f.content}`).join('\n\n---\n\n');
        const completedTasksContext = completedTasks.map(t => `Completed Task: ${t.taskDescription}\nOutput:\n${t.output}`).join('\n\n');

        let contextForPrompt = `
${fileContext ? `File Contents:\n${fileContext}` : ''}
${completedTasksContext ? `Completed Tasks Context:\n${completedTasksContext}` : ''}
`;
        let promptTemplate = (context: string) => `
You are an expert developer assistant. Your task is to generate the output for a specific step in a larger project.
Base your answer ONLY on the context provided.
Primary Goal: ${goal}
${context}
Current Task: "${task.description}"

Based on the provided context, generate the precise output for the task.
Do not add any extra commentary, greetings, or explanations beyond what the task requires.

**SPECIAL INSTRUCTIONS FOR OUTPUT FORMATTING:**
Your output format depends on the nature of the task. Follow these rules precisely:

1.  **For Calendar Events:** If the task is to create a calendar event, appointment, or meeting, you MUST format the output as a single, valid JSON object. Do not wrap it in markdown.
    {
      "@type": "CalendarEvent",
      "summary": "Event Title",
      "description": "A brief description of the event.",
      "start": "YYYY-MM-DDTHH:mm:ss",
      "end": "YYYY-MM-DDTHH:mm:ss",
      "location": "Event Location"
    }

2.  **For Geographic Locations/Maps:** If the task involves finding a location or coordinates, you MUST format the output as a single, valid JSON object:
    {
      "@type": "Map",
      "latitude": 40.7128,
      "longitude": -74.0060,
      "label": "A descriptive label for the pin"
    }

3.  **For Data Visualization/Charts:** If the task is to create a chart or graph, you MUST generate a self-contained SVG string representing that chart. Format the output as a single, valid JSON object:
    {
      "@type": "Chart",
      "title": "Title of the Chart",
      "svg": "<svg width='400' height='200' xmlns='http://www.w3.org/2000/svg'>...</svg>"
    }
    **IMPORTANT SVG REQUIREMENTS:** The SVG must be visually appealing on a dark background. Use light-colored text (e.g., white, #d1d5db) and vibrant, distinct colors for data elements.

4.  **For HTML UI Components:** If the task is to create a piece of UI, you MUST format the output as a single, valid JSON object.
    {
      "@type": "HtmlSnippet",
      "html": "<div>Your HTML here</div>",
      "css": "div { color: hotpink; }",
      "js": "console.log('Hello from the snippet');"
    }

5.  **For ALL OTHER tasks (e.g., writing code, explaining concepts):** Provide the output as plain text, markdown, or a code block. Do not wrap it in JSON.
${searchInstruction}
`;

        let finalPrompt = promptTemplate(contextForPrompt);

        if (finalPrompt.length > POLLINATIONS_SAFE_CHAR_LIMIT) {
            console.warn(`Context is too large for execution (${finalPrompt.length} > ${POLLINATIONS_SAFE_CHAR_LIMIT}). Summarizing...`);

            const promptOverhead = 1000; // Reserve space for the summarization prompt's own instructions
            const maxContextSizeForSummarization = POLLINATIONS_SAFE_CHAR_LIMIT - promptOverhead;
            
            const contextToSummarize = contextForPrompt.length > maxContextSizeForSummarization
                ? contextForPrompt.substring(0, maxContextSizeForSummarization) + "\n\n...[CONTEXT TRUNCATED]..."
                : contextForPrompt;

            const summarizedContext = await this.getSummarizedContext(model, task, contextToSummarize);
            
            promptTemplate = (context: string) => `
You are an expert developer assistant. Your task is to generate the output for a specific step in a larger project.
Primary Goal: ${goal}
Relevant Context (summarized from a larger body of text):
${context}
Current Task: "${task.description}"

Based ONLY on the summarized context and the primary goal, generate the precise output required to complete this task.
Do not add any extra commentary, greetings, or explanations beyond what the task requires.
${searchInstruction}
`;
            finalPrompt = promptTemplate(summarizedContext);
        }

        const body = {
            model: model,
            messages: [{ role: 'user', content: finalPrompt }]
        };

        const response = await fetch(`${POLLINATIONS_API_BASE}/openai`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            // Re-clone the response to read the body safely in case of error
            const errorResponse = response.clone();
            let errorBody = 'Could not read error body.';
            try {
                errorBody = await errorResponse.text();
            } catch (e) {
                 console.error("Could not read error response body", e)
            }
            console.error("Pollinations Task Execution Error:", errorBody);
            throw new Error(`Pollinations API error (${response.status}): ${errorBody}`);
        }
        
        const data = await response.json();
        const rawContent = data.choices[0]?.message?.content;

        if (!rawContent) {
          return { taskId: task.id, taskDescription: task.description, output: "The model returned an empty response.", citations: [] };
        }

        const strippedContent = this.stripMarkdown(rawContent);

        try {
            // Check if the output is one of our special JSON objects
            const parsed = JSON.parse(strippedContent);
            if (parsed['@type']) {
                return {
                    taskId: task.id,
                    taskDescription: task.description,
                    output: strippedContent, // Return the clean JSON string
                    citations: [],
                }
            }
        } catch (e) {
            // Not a JSON object, proceed as normal text
        }
        
        const { output, citations } = this.extractCitationsFromText(rawContent);

        return {
            taskId: task.id,
            taskDescription: task.description,
            output: output,
            citations: citations,
        };
    }

    private async determineSynthesisStrategy(model: string, goal: string): Promise<SynthesisStrategy> {
        const prompt = `
Based on the user's goal, classify the required final output format. Choose from one of the following strategies:

- 'document_assembly': When the goal is to write a long-form document, article, report, or essay by combining different sections.
- 'code_assembly': When the goal is to create a single, complete code script or file by combining different code blocks.
- 'best_answer_selection': When the goal is to find the single best answer, summary, or choice from multiple possibilities.
- 'list_generation': When the goal is to create a final list, like an outline or a set of bullet points.

Goal: "${goal}"

Respond with only one of the strategy names (e.g., 'document_assembly').
`;
        try {
            const body = JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }]
            });

            const response = await fetch(`${POLLINATIONS_API_BASE}/openai`, {
                method: 'POST',
                headers: this.headers,
                body: body
            });

            if (!response.ok) {
                console.error("Pollinations strategy determination failed, defaulting to document_assembly.");
                return 'document_assembly'; // Fallback
            }

            const data = await response.json();
            const strategy = data.choices[0]?.message?.content.toLowerCase().trim().replace(/['".]/g, '');
            
            const validStrategies: SynthesisStrategy[] = ['document_assembly', 'code_assembly', 'best_answer_selection', 'list_generation'];
            if (validStrategies.includes(strategy as SynthesisStrategy)) {
                return strategy as SynthesisStrategy;
            }
            
            // Default to document_assembly for any other response
            return 'document_assembly';

        } catch (error) {
            console.error("Error determining synthesis strategy:", error);
            return 'document_assembly'; // Fallback
        }
    }

    private assembleDocument(completedTasks: TaskOutput[]): string {
        return completedTasks
            .map(t => `## Task: ${t.taskDescription}\n\n${t.output}`)
            .join('\n\n---\n\n');
    }

    private assembleCode(completedTasks: TaskOutput[]): string {
        const codeBlocks = completedTasks.map(t => {
            const match = t.output.match(/```(?:\w*\n)?([\s\S]+)```/);
            return match ? match[1].trim() : t.output.trim();
        }).join('\n\n');

        const languageMatch = completedTasks.map(t => t.output.match(/```(\w+)/)).find(m => m);
        const language = languageMatch ? languageMatch[1] : '';

        return `\`\`\`${language}\n${codeBlocks}\n\`\`\``;
    }

    private generateList(completedTasks: TaskOutput[]): string {
        const allListItems = completedTasks.flatMap(t => 
            t.output.split('\n').filter(line => /^\s*[-*]\s|\d+\.\s/.test(line.trim()))
        );
        const uniqueItems = [...new Set(allListItems.map(item => item.trim()))];
        return uniqueItems.join('\n');
    }

    private async selectBestOutput(model: string, goal: string, completedTasks: TaskOutput[]): Promise<string> {
        let mutableCompletedTasks = [...completedTasks];

        const promptTemplate = (tasks: TaskOutput[]) => {
            const candidateOutputs = tasks.map((t, index) => 
                `--- CANDIDATE OUTPUT ${index + 1} (from task: "${t.taskDescription}") ---\n${t.output}`
            ).join('\n\n');

            return `
You are an evaluation expert. Your task is to select the single best output from a list of candidates that all aim to fulfill a user's goal.

**Primary Goal:**
${goal}

**Candidate Outputs:**
${candidateOutputs}

**Your Instructions:**
Review all candidate outputs and choose the one that BEST and MOST COMPLETELY fulfills the primary goal.

Respond with ONLY the full and exact text of the best output you have chosen. Do not add any explanation, commentary, or justification.
`;
        };

        let finalPrompt = promptTemplate(mutableCompletedTasks);

        while (finalPrompt.length > POLLINATIONS_SAFE_CHAR_LIMIT && mutableCompletedTasks.length > 1) {
            mutableCompletedTasks.pop();
            finalPrompt = promptTemplate(mutableCompletedTasks);
        }

        if (finalPrompt.length > POLLINATIONS_SAFE_CHAR_LIMIT && mutableCompletedTasks.length === 1) {
             console.warn(`Synthesis context for selection is still too large (${finalPrompt.length}). Using the truncated output of the single remaining task.`);
             return mutableCompletedTasks[0].output;
        }
        
        if (mutableCompletedTasks.length === 1) {
            return mutableCompletedTasks[0].output;
        }

        const body = JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: finalPrompt }]
        });

        const response = await fetch(`${POLLINATIONS_API_BASE}/openai`, {
            method: 'POST',
            headers: this.headers,
            body: body
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Pollinations Selection Error:", errorBody);
            return completedTasks[completedTasks.length - 1].output;
        }
        
        const data = await response.json();
        return data.choices[0]?.message?.content || "The model could not select a final result.";
    }

    async synthesizeFinalResult(
        model: string,
        goal: string,
        completedTasks: TaskOutput[],
        options?: { maxInputChars?: number }
    ): Promise<string> {
        if (completedTasks.length === 0) {
            return "No tasks were completed, so no final result could be synthesized.";
        }
        if (completedTasks.length === 1) {
            return completedTasks[0].output;
        }

        const strategy = await this.determineSynthesisStrategy(model, goal);
        console.log(`Synthesis Strategy Determined: ${strategy}`);

        switch (strategy) {
            case 'document_assembly':
                return this.assembleDocument(completedTasks);
            case 'code_assembly':
                return this.assembleCode(completedTasks);
            case 'list_generation':
                return this.generateList(completedTasks);
            case 'best_answer_selection':
                return await this.selectBestOutput(model, goal, completedTasks);
            default:
                // Fallback to the most general assembly strategy
                return this.assembleDocument(completedTasks);
        }
    }
}