import React from 'react';
import { ChunkPriority } from '../types';

// A function signature for the API call to avoid circular dependencies
type ApiCallFunction = (model: string, messages: { role: string; content: string }[], options: { [key: string]: any }) => Promise<string>;

/**
 * Executes an array of promise-generating functions with a limited concurrency.
 * @param promiseFactories An array of functions that each return a Promise.
 * @param batchSize The number of promises to run in parallel in each batch.
 * @param onProgress A callback function that reports the number of completed promises.
 * @param isCancelledRef A React ref object to check if the process has been cancelled.
 * @returns A promise that resolves to an array of all results.
 */
async function runPromisesInBatches<T>(
    promiseFactories: (() => Promise<T>)[],
    batchSize: number,
    onProgress: (completed: number) => void,
    isCancelledRef?: React.RefObject<boolean>
): Promise<T[]> {
    const results: T[] = [];
    let completedCount = 0;
    for (let i = 0; i < promiseFactories.length; i += batchSize) {
        if (isCancelledRef?.current) {
            throw new Error('Process stopped by user.');
        }
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
 * Makes a single API call to get priority scores for a list of text chunks.
 * @returns A promise that resolves to an array of chunk priorities.
 */
async function _getChunkPriorities(
    apiCallFn: ApiCallFunction,
    model: string,
    options: { [key: string]: any },
    relevanceTopic: string,
    chunks: string[]
): Promise<ChunkPriority[]> {
    console.log(`Getting priorities for ${chunks.length} chunks...`);
    const concatenatedChunks = chunks.map((chunk, index) => `---CHUNK ${index}---\n${chunk.substring(0, 500)}...`).join('\n');
    
    const prompt = `You are a text analysis expert. Your task is to rate the relevance of each numbered text chunk below to the given Topic. Return a JSON array where each object contains the 'chunk_index' and a 'score' from 1 (least relevant) to 10 (most relevant). Respond ONLY with the JSON array.
Topic: ${relevanceTopic}

Chunks:
${concatenatedChunks}
`;

    try {
        const priorityModel = "google/gemma-2-9b-it"; // Use a fast model for this
        const result = await apiCallFn(priorityModel, [{ role: 'user', content: prompt }], { ...options, reasoning_effort: 'minimal' });
        const jsonResult = JSON.parse(result.replace(/```json\n?([\s\S]*?)\n?```/, '$1').trim());
        // Basic validation
        if (Array.isArray(jsonResult) && jsonResult.every(item => 'chunk_index' in item && 'score' in item)) {
             return jsonResult;
        }
        throw new Error("Invalid format for chunk priorities.");
    } catch (error) {
        console.error("Failed to get chunk priorities, proceeding without them.", error);
        // Fallback: return an array with original order and default score
        return chunks.map((_, index) => ({ chunk_index: index, score: 5 }));
    }
}


/**
 * Breaks down both main and auxiliary content into chunks, prioritizes them if limits are set,
 * and then runs an API call for each combination of the selected chunks.
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
    onProgress: (progress: { completed: number, total: number }) => void,
    limits: { doc: number, aux: number } = { doc: 0, aux: 0 },
    isCancelledRef?: React.RefObject<boolean>
): Promise<string[]> {
    const maxInputChars = options.maxInputChars || 5000;
    const templateLength = promptTemplate('', '').length + systemPrompt.length;
    const availableChars = maxInputChars - templateLength - 200; // 200 buffer
    
    const mainChunkSize = Math.max(1, Math.floor(availableChars / 2));
    const auxChunkSize = Math.max(1, Math.floor(availableChars / 2));

    const chunkContent = (content: string, chunkSize: number) => {
        if (!content) return [''];
        const chunks: string[] = [];
        for (let i = 0; i < content.length; i += chunkSize) {
            chunks.push(content.substring(i, i + chunkSize));
        }
        return chunks;
    };

    const mainContentChunks = chunkContent(mainContent, mainChunkSize);
    const auxContentChunks = chunkContent(auxiliaryContext, auxChunkSize);

    let selectedMainChunks = mainContentChunks;
    let selectedAuxChunks = auxContentChunks;
    
    // Prioritize and slice main document chunks if a limit is set
    if (limits.doc > 0 && limits.doc < selectedMainChunks.length) {
        console.log(`Limiting document chunks from ${selectedMainChunks.length} to ${limits.doc}. Prioritizing...`);
        const priorities = await _getChunkPriorities(apiCallFn, model, options, auxiliaryContext, selectedMainChunks);
        selectedMainChunks = priorities
            .sort((a, b) => b.score - a.score)
            .slice(0, limits.doc)
            .map(p => mainContentChunks[p.chunk_index]);
    }

    // Prioritize and slice auxiliary context chunks if a limit is set
    if (limits.aux > 0 && limits.aux < selectedAuxChunks.length) {
        console.log(`Limiting context chunks from ${selectedAuxChunks.length} to ${limits.aux}. Prioritizing...`);
        // When prioritizing context, the "goal" is the main content itself (or a summary)
        const mainContentSummary = mainContent.substring(0, 500);
        const priorities = await _getChunkPriorities(apiCallFn, model, options, mainContentSummary, selectedAuxChunks);
        selectedAuxChunks = priorities
            .sort((a, b) => b.score - a.score)
            .slice(0, limits.aux)
            .map(p => auxContentChunks[p.chunk_index]);
    }
    
    const finalTotalCalls = selectedMainChunks.length * selectedAuxChunks.length;
    onProgress({ completed: 0, total: finalTotalCalls });
    
    const promiseFactories: (() => Promise<string>)[] = [];
    
    // Create the N*M cross-product of API calls
    for (const mainChunk of selectedMainChunks) {
        for (const auxChunk of selectedAuxChunks) {
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
        1, // Batch size of 1 to be gentle on the free API
        (completed) => onProgress({ completed, total: finalTotalCalls }),
        isCancelledRef
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
    limits: { doc: number, aux: number } = { doc: 0, aux: 0 },
    isCancelledRef?: React.RefObject<boolean>,
    finalJoinStrategy: 'string-concat' | 'json-array' = 'string-concat'
): Promise<string> {
    
    // Step 1: Process content in chunks
    const partialResults = await processInChunks(
        apiCallFn,
        model,
        options,
        processingSystemPrompt,
        processingPromptTemplate,
        mainContent,
        auxiliaryContext,
        (progress) => onProgress({ ...progress, stage: 'processing' }),
        limits,
        isCancelledRef
    );

    if (isCancelledRef?.current) throw new Error('Process stopped by user.');

    const combinedPartialResults = partialResults.filter(r => r && r.trim()).join('\n\n---\n\n');

    if (!combinedPartialResults) {
        return ""; // Return empty if all chunks resulted in empty strings
    }
    
    // Step 2: Synthesize the results (with its own internal chunking if necessary)
    const maxInputChars = options.maxInputChars || 5000;
    const synthTemplateLength = synthesisPromptTemplate('').length + synthesisSystemPrompt.length;
    const availableCharsForSynth = maxInputChars - synthTemplateLength - 500;

    if (combinedPartialResults.length <= availableCharsForSynth) {
        // Synthesis fits in a single call
        const synthesisMessages = [
            { role: 'system', content: synthesisSystemPrompt },
            { role: 'user', content: synthesisPromptTemplate(combinedPartialResults) }
        ];
        onProgress({ completed: 0, total: 1, stage: 'synthesis' });
        const result = await apiCallFn(model, synthesisMessages, options);
        onProgress({ completed: 1, total: 1, stage: 'synthesis' });
        return result;
    }
    
    // Synthesis input is too large and must also be chunked
    console.log(`Synthesis input is too large (${combinedPartialResults.length} chars). Chunking synthesis.`);
    const synthesisChunks: string[] = [];
    for (let i = 0; i < combinedPartialResults.length; i += availableCharsForSynth) {
        synthesisChunks.push(combinedPartialResults.substring(i, i + availableCharsForSynth));
    }
    
    const synthesisPromiseFactories = synthesisChunks.map(chunk => {
        return () => {
            if (isCancelledRef?.current) throw new Error('Process stopped by user.');
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
        1, // Batch size of 1
        (completed) => onProgress({ completed, total: totalSynthCalls, stage: 'synthesis' }),
        isCancelledRef
    );

    // If we have multiple parts and expect a JSON array, merge them intelligently
    if (finalSynthesizedParts.length > 1 && finalJoinStrategy === 'json-array') {
        try {
            const combinedArray: any[] = [];
            finalSynthesizedParts.forEach(part => {
                const cleanPart = part.replace(/```json\n?([\s\S]*?)\n?```/, '$1').trim();
                if (cleanPart) {
                    const parsedPart = JSON.parse(cleanPart);
                    if (Array.isArray(parsedPart)) {
                        combinedArray.push(...parsedPart);
                    }
                }
            });
            return JSON.stringify(combinedArray, null, 2);
        } catch (error) {
            console.error("Error merging JSON arrays from chunked synthesis, falling back to simple join:", error);
            // Fallback to avoid crashing, though the result will likely be invalid JSON
            return finalSynthesizedParts.join('\n\n');
        }
    }
    
    // Default behavior for single part or text concat
    return finalSynthesizedParts.join('\n\n');
}

/**
 * A simplified version of the processing pipeline that processes content in chunks and
 * then concatenates the results without a final synthesis API call.
 * @returns A promise that resolves to the final, concatenated string.
 */
export async function processAndConcatenate(
    apiCallFn: ApiCallFunction,
    model: string,
    options: { [key: string]: any },
    processingSystemPrompt: string,
    processingPromptTemplate: (mainChunk: string, auxChunk: string) => string,
    mainContent: string,
    auxiliaryContext: string,
    onProgress: (progress: { completed: number; total: number; }) => void,
    limits: { doc: number, aux: number } = { doc: 0, aux: 0 },
    isCancelledRef?: React.RefObject<boolean>
): Promise<string> {
    
    const partialResults = await processInChunks(
        apiCallFn,
        model,
        options,
        processingSystemPrompt,
        processingPromptTemplate,
        mainContent,
        auxiliaryContext,
        onProgress, // Pass the simplified progress handler directly
        limits,
        isCancelledRef
    );

    if (isCancelledRef?.current) throw new Error('Process stopped by user.');

    // Simple concatenation of results, as requested for final output.
    const combinedResults = partialResults.filter(r => r && r.trim()).join('\n\n---\n\n');

    return combinedResults;
}