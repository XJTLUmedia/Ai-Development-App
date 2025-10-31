
import { StoredFile, DataTableData } from '../types';
import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import * as XLSX from 'xlsx';

// Configure PDF.js worker from a CDN. This is required for the library to work.
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@^4.4.178/build/pdf.worker.mjs`;

const STORAGE_KEY = 'rag_assistant_files';

class StorageService {
  private async readFileContent(file: File): Promise<string> {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();

    try {
      switch (extension) {
        case 'txt':
          return new TextDecoder().decode(arrayBuffer);
        case 'docx':
          const docxResult = await mammoth.extractRawText({ arrayBuffer });
          return docxResult.value;
        case 'pdf':
          const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
          let pdfText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              // @ts-ignore
              pdfText += textContent.items.map(item => item.str).join(' ') + '\n';
          }
          return pdfText;
        case 'xlsx':
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          let excelContent = '';
          workbook.SheetNames.forEach(sheetName => {
              const worksheet = workbook.Sheets[sheetName];
              excelContent += `Sheet: ${sheetName}\n\n`;
              excelContent += XLSX.utils.sheet_to_csv(worksheet);
              excelContent += '\n\n';
          });
          return excelContent;
        default:
          throw new Error(`Unsupported file type: .${extension}. Please upload a .txt, .pdf, .docx, or .xlsx file.`);
      }
    } catch (error) {
        console.error(`Error processing .${extension} file:`, error);
        throw new Error(`Failed to read content from ${file.name}. The file might be corrupted or in an unsupported format.`);
    }
  }

  public async parseXlsxToJson(file: File): Promise<DataTableData> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
            return { headers: [], rows: [] };
        }

        const headers = jsonData[0].map(header => String(header));
        const rows = jsonData.slice(1);
        
        return { headers, rows };
    } catch (error) {
        console.error(`Error parsing .xlsx file to JSON:`, error);
        throw new Error(`Failed to parse ${file.name}. The file might be corrupted.`);
    }
  }

  getFiles(): StoredFile[] {
    try {
      const storedFiles = sessionStorage.getItem(STORAGE_KEY);
      return storedFiles ? JSON.parse(storedFiles) : [];
    } catch (error) {
      console.error('Failed to parse files from sessionStorage:', error);
      return [];
    }
  }

  async addFile(file: File): Promise<void> {
    try {
      const content = await this.readFileContent(file);
      const storedFile: StoredFile = { name: file.name, content };
      
      const currentFiles = this.getFiles();
      const existingIndex = currentFiles.findIndex(f => f.name === file.name);
      if (existingIndex > -1) {
        currentFiles[existingIndex] = storedFile;
      } else {
        currentFiles.push(storedFile);
      }
      
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(currentFiles));
    } catch (error) {
      console.error('Failed to add file to storage:', error);
      if (error instanceof Error) throw error;
      throw new Error('Could not read or save file.');
    }
  }

  removeFile(filename: string): void {
    const currentFiles = this.getFiles();
    const updatedFiles = currentFiles.filter(f => f.name !== filename);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updatedFiles));
  }

  clearFiles(): void {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

export const storageService = new StorageService();