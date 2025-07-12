import { useState, useEffect } from "react";
import { useQuestions } from "@/hooks/use-questions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FileUpload from "@/components/file-upload";
import QuestionList from "@/components/question-list";
import QuestionEditor from "@/components/question-editor";
import ValidationPanel from "@/components/validation-panel";
import AIVerificationPanel from "@/components/ai-verification-panel";
import DuplicateDetector from "@/components/duplicate-detector";
import { FileCode, Download, Upload, Settings, HelpCircle, CheckCircle, AlertTriangle, XCircle, Undo, Redo, Merge, Split, Copy, Zap } from "lucide-react";
import { type Question } from "@shared/schema";
import { type QuestionFilters } from "@/types/question";
import { DOMAINS, GRADES } from "@/types/question";

export default function Dashboard() {
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [filters, setFilters] = useState<QuestionFilters>({});
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [isSplitOpen, setIsSplitOpen] = useState(false);
  const [isDuplicateDetectorOpen, setIsDuplicateDetectorOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState<{ grade?: string; domain?: string }>({});
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [splitOptions, setSplitOptions] = useState<{ type: 'grade' | 'theme'; filename: string }>({ type: 'grade', filename: 'questions' });
  const [isShorteningAll, setIsShorteningAll] = useState(false);
  
  const { data: questions = [], isLoading } = useQuestions(filters);
  
  const selectedIndex = selectedQuestion ? questions.findIndex(q => q.id === selectedQuestion.id) : -1;
  const hasNext = selectedIndex >= 0 && selectedIndex < questions.length - 1;
  const hasPrevious = selectedIndex > 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (selectedIndex > 0) {
            setSelectedQuestion(questions[selectedIndex - 1]);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (selectedIndex < questions.length - 1) {
            setSelectedQuestion(questions[selectedIndex + 1]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedQuestion(null);
          break;
        case 'Enter':
          e.preventDefault();
          if (!selectedQuestion && questions.length > 0) {
            setSelectedQuestion(questions[0]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedQuestion, selectedIndex, questions]);

  const handleSelectQuestion = (question: Question) => {
    setSelectedQuestion(question);
  };

  const handleNext = () => {
    if (hasNext) {
      setSelectedQuestion(questions[selectedIndex + 1]);
    }
  };

  const handlePrevious = () => {
    if (hasPrevious) {
      setSelectedQuestion(questions[selectedIndex - 1]);
    }
  };

  // Helper function to count words
  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  // Get questions that are over 30 words
  const questionsOverLimit = questions.filter(q => countWords(q.questionText) > 30);

  // Batch shorten all questions over 30 words
  const handleShortenAll = async () => {
    if (questionsOverLimit.length === 0) return;
    
    setIsShorteningAll(true);
    
    try {
      const questionsToShorten = questionsOverLimit.map(q => ({
        id: q.id,
        text: q.questionText
      }));

      const response = await fetch('/api/ai/shorten-batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          questions: questionsToShorten,
          targetWords: 30,
          preserveMath: true 
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to shorten questions');
      }
      
      const data = await response.json();
      
      // Apply the shortened texts by updating each question
      for (const result of data.results) {
        try {
          await fetch(`/api/questions/${result.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              questionText: result.shortenedText
            }),
          });
        } catch (error) {
          console.error(`Failed to update question ${result.id}:`, error);
        }
      }
      
      // Refresh the questions list
      window.location.reload();
      
    } catch (error) {
      console.error('Error shortening questions:', error);
    } finally {
      setIsShorteningAll(false);
    }
  };

  const handleExport = async () => {
    const queryParams = new URLSearchParams();
    if (exportFilters.grade) queryParams.append('grade', exportFilters.grade);
    if (exportFilters.domain) queryParams.append('domain', exportFilters.domain);
    
    const url = `/api/xml/export?${queryParams.toString()}`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `questions_export_${Date.now()}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportOpen(false);
  };

  const handleMergeFiles = async () => {
    if (mergeFiles.length === 0) return;
    
    try {
      const formData = new FormData();
      mergeFiles.forEach((file, index) => {
        formData.append(`file${index}`, file);
      });
      
      const response = await fetch('/api/xml/merge', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to merge files');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'merged_questions.xml';
      a.click();
      window.URL.revokeObjectURL(url);
      
      setMergeFiles([]);
      setIsMergeOpen(false);
    } catch (error) {
      console.error('Error merging files:', error);
    }
  };

  const handleSplitFile = async () => {
    if (questions.length === 0) return;
    
    try {
      const params = new URLSearchParams();
      params.append('type', splitOptions.type);
      params.append('filename', splitOptions.filename);
      
      const response = await fetch(`/api/xml/split?${params.toString()}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to split file');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${splitOptions.filename}_split.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      setIsSplitOpen(false);
    } catch (error) {
      console.error('Error splitting file:', error);
    }
  };

  const validationStats = {
    total: questions.length,
    valid: questions.filter(q => q.validationStatus === 'valid').length,
    warnings: questions.filter(q => q.validationStatus === 'warning').length,
    errors: questions.filter(q => q.validationStatus === 'error').length,
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-300 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <FileCode className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold text-slate-800">XML Question Editor</h1>
            </div>
            {questions.length > 0 && (
              <div className="hidden md:flex items-center space-x-2 bg-slate-100 px-3 py-1 rounded-full">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-sm font-medium text-slate-700">
                  {questions.length} questions loaded
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Auto-save indicator */}
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              <CheckCircle className="h-4 w-4 text-success" />
              <span>Auto-saved</span>
            </div>
            
            {/* Actions */}
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" disabled>
                <Undo className="h-4 w-4 mr-1" />
                Undo
              </Button>
              <Button variant="outline" size="sm" disabled>
                <Redo className="h-4 w-4 mr-1" />
                Redo
              </Button>
              
              <AIVerificationPanel
                questions={questions}
                selectedQuestion={selectedQuestion}
                onQuestionUpdate={(id, updated) => {
                  // Update the question in the list
                  setSelectedQuestion(updated);
                }}
                onBatchUpdate={(updates) => {
                  // Handle batch updates
                  console.log('Batch updates:', updates);
                }}
              />
              
              <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-1" />
                    Upload
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Upload XML File</DialogTitle>
                  </DialogHeader>
                  <FileUpload onUploadComplete={() => setIsUploadOpen(false)} />
                </DialogContent>
              </Dialog>
              
              <Dialog open={isExportOpen} onOpenChange={setIsExportOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Export Questions</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Filter by Grade</label>
                      <Select value={exportFilters.grade || "all"} onValueChange={(value) => 
                        setExportFilters(prev => ({ ...prev, grade: value === "all" ? undefined : value }))
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="All Grades" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Grades</SelectItem>
                          {GRADES.map(grade => (
                            <SelectItem key={grade} value={grade.toString()}>
                              Grade {grade}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Filter by Domain</label>
                      <Select value={exportFilters.domain || "all"} onValueChange={(value) => 
                        setExportFilters(prev => ({ ...prev, domain: value === "all" ? undefined : value }))
                      }>
                        <SelectTrigger>
                          <SelectValue placeholder="All Domains" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Domains</SelectItem>
                          {DOMAINS.map(domain => (
                            <SelectItem key={domain.value} value={domain.value}>
                              {domain.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsExportOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleExport}>
                        Export XML
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isDuplicateDetectorOpen} onOpenChange={setIsDuplicateDetectorOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Copy className="h-4 w-4 mr-1" />
                    Remove Duplicates
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Duplicate Detection & Removal</DialogTitle>
                  </DialogHeader>
                  <DuplicateDetector />
                </DialogContent>
              </Dialog>

              <Button 
                size="sm" 
                variant="outline"
                onClick={handleShortenAll}
                disabled={isShorteningAll || questionsOverLimit.length === 0}
                className="relative"
              >
                {isShorteningAll ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-2" />
                    Shortening...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-1" />
                    Shorten All
                    {questionsOverLimit.length > 0 && (
                      <Badge variant="secondary" className="ml-2 h-5 text-xs">
                        {questionsOverLimit.length}
                      </Badge>
                    )}
                  </>
                )}
              </Button>

              <Dialog open={isMergeOpen} onOpenChange={setIsMergeOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Merge className="h-4 w-4 mr-1" />
                    Merge
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Merge XML Files</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Select XML Files to Merge</label>
                      <input
                        type="file"
                        multiple
                        accept=".xml"
                        onChange={(e) => setMergeFiles(Array.from(e.target.files || []))}
                        className="w-full"
                      />
                    </div>
                    
                    {mergeFiles.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Selected Files:</label>
                        <div className="space-y-1">
                          {mergeFiles.map((file, index) => (
                            <div key={index} className="text-sm bg-slate-100 p-2 rounded">
                              {file.name} ({Math.round(file.size / 1024)} KB)
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsMergeOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleMergeFiles} disabled={mergeFiles.length === 0}>
                        Merge Files
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isSplitOpen} onOpenChange={setIsSplitOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Split className="h-4 w-4 mr-1" />
                    Split
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Split Current Questions</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Split By</label>
                      <Select value={splitOptions.type} onValueChange={(value) => 
                        setSplitOptions(prev => ({ ...prev, type: value as 'grade' | 'theme' }))
                      }>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grade">Grade Level</SelectItem>
                          <SelectItem value="theme">Theme</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Output Filename Prefix</label>
                      <input
                        type="text"
                        value={splitOptions.filename}
                        onChange={(e) => setSplitOptions(prev => ({ ...prev, filename: e.target.value }))}
                        className="w-full p-2 border rounded"
                        placeholder="questions"
                      />
                    </div>
                    
                    <div className="text-sm text-slate-600">
                      This will create separate XML files for each {splitOptions.type} and download them as a ZIP file.
                    </div>
                    
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setIsSplitOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSplitFile} disabled={questions.length === 0}>
                        Split File
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {questions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <FileCode className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-800 mb-2">
              No Questions Loaded
            </h2>
            <p className="text-slate-600 mb-6">
              Upload an XML file to start editing questions
            </p>
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload XML File
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Upload XML File</DialogTitle>
                </DialogHeader>
                <FileUpload onUploadComplete={() => setIsUploadOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      ) : (
        <div className="flex h-[calc(100vh-80px)]">
          <QuestionList
            selectedQuestionId={selectedQuestion?.id}
            onSelectQuestion={handleSelectQuestion}
            filters={filters}
            onFiltersChange={setFilters}
          />
          
          <div className="flex-1 flex flex-col">
            <QuestionEditor
              question={selectedQuestion}
              onNext={handleNext}
              onPrevious={handlePrevious}
              hasNext={hasNext}
              hasPrevious={hasPrevious}
            />
          </div>
        </div>
      )}
    </div>
  );
}
