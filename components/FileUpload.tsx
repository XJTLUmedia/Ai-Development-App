
import React, { useCallback, useState, useRef } from 'react';

interface FileUploadProps {
  onFileUploaded: (files: FileList) => void;
  disabled: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUploaded, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);


  const handleFileChange = (files: FileList | null) => {
    if (files && files.length > 0) {
      onFileUploaded(files);
      setUploadStatus('success');
      // Reset input to allow uploading the same file again
      if(fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setTimeout(() => setUploadStatus('idle'), 2000); // Reset visual state after 2s
    }
  };

  const onDragEnter = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);
  
  const onDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!disabled) {
      handleFileChange(e.dataTransfer.files);
    }
  }, [disabled]);

  const dragDropClasses = isDragging ? 'border-blue-500 bg-blue-900/30' : 'border-gray-600 hover:border-blue-500';
  const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer';

  return (
    <div>
      <label
        htmlFor="file-upload"
        className={`flex flex-col items-center justify-center w-full h-32 px-4 transition duration-300 border-2 border-dashed rounded-lg ${dragDropClasses} ${disabledClasses}`}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
            {uploadStatus === 'success' ? (
                <>
                    <svg className="w-8 h-8 mb-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <p className="font-semibold text-gray-200">Upload Successful!</p>
                    <p className="text-xs text-gray-400">You can add more files.</p>
                </>
            ) : (
                <>
                    <svg className="w-10 h-10 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h2l2-2h4l2 2h2a4 4 0 014 4v5a4 4 0 01-4 4H7z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    <p className="mb-2 text-sm text-gray-400"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    <p className="text-xs text-gray-500">TXT, PDF, DOCX, XLSX</p>
                </>
            )}
        </div>
        <input 
            id="file-upload" 
            type="file" 
            className="hidden" 
            accept=".txt,.pdf,.docx,.xlsx" 
            onChange={(e) => handleFileChange(e.target.files)} 
            disabled={disabled}
            multiple
            ref={fileInputRef}
        />
      </label>
    </div>
  );
};