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
import { FileCode, Download, Upload, Settings, HelpCircle, CheckCircle, AlertTriangle, XCircle, Undo, Redo } from "lucide-react";
import { type Question } from "@shared/schema";
import { type QuestionFilters } from "@/types/question";
import { DOMAINS, GRADES } from "@/types/question";

export default function Dashboard() {
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [filters, setFilters] = useState<QuestionFilters>({});
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportFilters, setExportFilters] = useState<{ grade?: string; domain?: string }>({});
  
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
