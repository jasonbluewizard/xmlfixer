import { useState, useCallback, useRef } from "react";
import { useUploadXml } from "@/hooks/use-questions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileX, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  onUploadComplete?: () => void;
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadXml = useUploadXml();

  console.log('FileUpload render - file:', file?.name, 'size:', file?.size);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const xmlFile = files.find(f => f.name.endsWith('.xml'));
    
    if (xmlFile) {
      console.log('File dropped:', xmlFile.name, 'Size:', xmlFile.size);
      setFile(xmlFile);
    } else {
      console.log('No XML file found in dropped files:', files.map(f => f.name));
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      console.log('File selected:', files[0].name, 'Size:', files[0].size);
      console.log('Setting file state...');
      setFile(files[0]);
      console.log('File state set, current file:', files[0].name);
      
      // Clear the input to allow re-selection of the same file
      e.target.value = '';
    }
  }, []);

  const handleUpload = useCallback(() => {
    if (!file) {
      console.log('No file selected for upload');
      return;
    }
    
    console.log('Starting upload for file:', file.name, 'Size:', file.size, 'Type:', file.type);
    console.log('uploadXml mutation state:', { isPending: uploadXml.isPending, isError: uploadXml.isError });
    
    uploadXml.mutate(file, {
      onSuccess: (data) => {
        console.log('Upload completed successfully, data:', data);
        setFile(null);
        onUploadComplete?.();
      },
      onError: (error) => {
        console.error('Upload failed with error:', error);
      },
    });
  }, [file, uploadXml, onUploadComplete]);

  const handleRemoveFile = useCallback(() => {
    setFile(null);
  }, []);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              Upload XML Question File
            </h3>
            <p className="text-sm text-slate-600">
              Drag and drop your XML file or click to browse
            </p>
            {/* Debug info */}
            <p className="text-xs text-gray-400 mt-1">
              Debug: File state = {file ? `${file.name} (${file.size} bytes)` : 'null'}
            </p>
          </div>

          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
              isDragOver
                ? "border-primary bg-primary/5"
                : "border-slate-300 hover:border-slate-400",
              uploadXml.isPending && "pointer-events-none opacity-50"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              console.log('Upload area clicked');
              fileInputRef.current?.click();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              className="hidden"
              onChange={handleFileSelect}
            />
            
            {!file ? (
              <div className="space-y-3">
                <Upload className="h-12 w-12 text-slate-400 mx-auto" />
                <div>
                  <p className="text-slate-600 font-medium">
                    {isDragOver ? "Drop your XML file here" : "Choose XML file"}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    Maximum file size: 50MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center space-x-2">
                  <CheckCircle className="h-6 w-6 text-success" />
                  <span className="font-medium text-slate-800">{file.name}</span>
                </div>
                <p className="text-sm text-slate-600">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}
          </div>

          {file && (
            <div className="flex items-center justify-between space-x-3">
              <Button
                variant="outline"
                onClick={handleRemoveFile}
                disabled={uploadXml.isPending}
              >
                <FileX className="h-4 w-4 mr-2" />
                Remove
              </Button>
              <Button
                onClick={() => {
                  console.log('Upload button clicked, file:', file?.name);
                  handleUpload();
                }}
                disabled={uploadXml.isPending}
                className="flex-1"
              >
                {uploadXml.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload & Parse
                  </>
                )}
              </Button>
            </div>
          )}

          {uploadXml.isPending && (
            <div className="flex items-center space-x-2 text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
              <span className="text-sm">
                Processing large XML file... This may take a few minutes.
              </span>
            </div>
          )}

          {uploadXml.isError && (
            <div className="flex items-center space-x-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">
                Failed to upload file. {uploadXml.error?.message || "Please check the XML format and try again."}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
