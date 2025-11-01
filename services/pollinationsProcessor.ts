// A function signature for the API call to avoid circular dependencies
type ApiCallFunction = (model: string, messages: { role: string; content: string }[], options: { [key: string]: any }) => Promise<string>;

/**
 * Executes an array of promise-generating functions with a limited concurrency.
 * @param promiseFactories An array of functions that each return a Promise.
 * @param batchSize The number of promises to run in parallel in each batch.
 * @param onProgress A callback function that reports the number of completed promises.
 * @returns A promise that resolves to an array of all results.
 */
async function runPromisesInBatches<T>(
    promiseFactories: (() => Promise<T>)[],
    batchSize: number,
    onProgress: (completed: number) => void
): Promise<T[]> {
    const results: T[] = [];
    let completedCount = 0;
    for (let i = 0; i < promiseFactories.length; i += batchSize) {
        const batch = promiseFactories.slice(i, i + batchSize);
        // Execute batch and wait for all promises in it to resolve
        const batchResults = await Promise.all(batch.map(p => p()));
        results.push(...batchResults);
        completedCount += batch.length;
        onProgress(completedCount); // Report progress after each batch
    }
    return results;
}

/**
 * Breaks down main content and auxiliary context into chunks and runs an API call for each combination.
 * @returns A promise that resolves to an array of all partial results from the API calls.
 */
async function processInChunks(
    apiCallFn: ApiCallFunction,
    model: string,
    options: { [key: string]: any },
    systemPrompt: string,
    promptTemplate: (mainChunk: string, auxChunk: string) => string,
    mainContent: string,
    auxiliaryContext: string,
    onProgress: (progress: { completed: number, total: number }) => void
): Promise<string[]> {
    const maxInputChars = options.maxInputChars || 5000; // A safe default if not provided
    const templateLength = promptTemplate('', '').length + systemPrompt.length;
    const availableChars = maxInputChars - templateLength - 500; // 500 char buffer for safety

    let mainContentChunks: string[];
    let auxContextChunks: string[];

    const totalLength = (mainContent?.length || 0) + (auxiliaryContext?.length || 0);

    if (totalLength <= availableChars) {
        // No chunking needed
        mainContentChunks = [mainContent || ''];
        auxContextChunks = [auxiliaryContext || ''];
    } else {
        // Calculate chunk sizes based on the relative size of each content type
        const mainRatio = mainContent.length > 0 ? mainContent.length / totalLength : 0;
        const mainChunkSize = Math.floor(availableChars * mainRatio) || 1; // Ensure chunk size is at least 1
        const auxChunkSize = Math.floor(availableChars * (1 - mainRatio)) || 1;

        mainContentChunks = [];
        if (mainContent && mainContent.length > 0) {
            for (let i = 0; i < mainContent.length; i += mainChunkSize) {
                mainContentChunks.push(mainContent.substring(i, i + mainChunkSize));
            }
        } else {
            mainContentChunks.push('');
        }

        auxContextChunks = [];
        if (auxiliaryContext && auxiliaryContext.length > 0) {
            for (let i = 0; i < auxiliaryContext.length; i += auxChunkSize) {
                auxContextChunks.push(auxiliaryContext.substring(i, i + auxChunkSize));
            }
        } else {
            auxContextChunks.push('');
        }
    }
    
    const totalCalls = mainContentChunks.length * auxContextChunks.length;
    onProgress({ completed: 0, total: totalCalls }); // Initial progress report
    
    console.log(`Processing with ${mainContentChunks.length} main chunks and ${auxContextChunks.length} auxiliary chunks. Total API calls: ${totalCalls}`);

    const promiseFactories: (() => Promise<string>)[] = [];
    for (const mainChunk of mainContentChunks) {
        for (const auxChunk of auxContextChunks) {
            promiseFactories.push(() => {
                const messages = [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: promptTemplate(mainChunk, auxChunk) }
                ];
                return apiCallFn(model, messages, options);
            });
        }
    }

    const results = await runPromisesInBatches(
        promiseFactories,
        2, // Concurrency of 2
        (completed) => onProgress({ completed, total: totalCalls })
    );

    return results;
}


/**
 * The main processing function. It orchestrates the chunked processing of content and the subsequent
 * chunked synthesis of the results.
 * @returns A promise that resolves to the final, synthesized string.
 */
export async function processAndSynthesize(
    apiCallFn: ApiCallFunction,
    model: string,
    options: { [key: string]: any },
    processingSystemPrompt: string,
    processingPromptTemplate: (mainChunk: string, auxChunk: string) => string,
    synthesisSystemPrompt: string,
    synthesisPromptTemplate: (partialResults: string) => string,
    mainContent: string,
    auxiliaryContext: string,
    onProgress: (progress: { completed: number; total: number; stage: 'processing' | 'synthesis' }) => void,
): Promise<string> {
    
    // Step 1: Process content in x*y chunks
    const partialResults = await processInChunks(
        apiCallFn,
        model,
        options,
        processingSystemPrompt,
        processingPromptTemplate,
        mainContent,
        auxiliaryContext,
        (progress) => onProgress({ ...progress, stage: 'processing' })
    );

    const combinedPartialResults = partialResults.filter(r => r && r.trim()).join('\n\n---\n\n');

    if (!combinedPartialResults) {
        return ""; // Return empty if all chunks resulted in empty strings
    }
    
    // Step 2: Synthesize the results (with its own internal chunking)
    const maxInputChars = options.maxInputChars || 5000;
    const synthTemplateLength = synthesisPromptTemplate('').length + synthesisSystemPrompt.length;
    const availableCharsForSynth = maxInputChars - synthTemplateLength - 500;

    if (combinedPartialResults.length <= availableCharsForSynth) {
        const synthesisMessages = [
            { role: 'system', content: synthesisSystemPrompt },
            { role: 'user', content: synthesisPromptTemplate(combinedPartialResults) }
        ];
        onProgress({ completed: 0, total: 1, stage: 'synthesis' });
        const result = await apiCallFn(model, synthesisMessages, options);
        onProgress({ completed: 1, total: 1, stage: 'synthesis' });
        return result;
    }
    
    console.log(`Synthesis input is too large (${combinedPartialResults.length} chars). Chunking synthesis.`);
    const synthesisChunks: string[] = [];
    for (let i = 0; i < combinedPartialResults.length; i += availableCharsForSynth) {
        synthesisChunks.push(combinedPartialResults.substring(i, i + availableCharsForSynth));
    }
    
    const synthesisPromiseFactories = synthesisChunks.map(chunk => {
        return () => {
            const synthesisMessages = [
                { role: 'system', content: synthesisSystemPrompt },
                { role: 'user', content: synthesisPromptTemplate(chunk) }
            ];
            return apiCallFn(model, synthesisMessages, options);
        };
    });

    const totalSynthCalls = synthesisPromiseFactories.length;
    onProgress({ completed: 0, total: totalSynthCalls, stage: 'synthesis' });

    const finalSynthesizedParts = await runPromisesInBatches(
        synthesisPromiseFactories,
        4,
        (completed) => onProgress({ completed, total: totalSynthCalls, stage: 'synthesis' })
    );

    // Join the synthesized parts. In many cases, this might just be a simple join.
    // For JSON, a more complex merge might be needed, but for now, a newline join is a reasonable default.
    return finalSynthesizedParts.join('\n\n');
}