import { useState, useMemo } from "react";
import { useQuestions } from "@/hooks/use-questions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ChevronLeft, ChevronRight, ArrowRight, CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Question } from "@shared/schema";
import { type QuestionFilters } from "@/types/question";
import { DOMAINS, GRADES, STATUS_OPTIONS } from "@/types/question";

interface QuestionListProps {
  selectedQuestionId?: number;
  onSelectQuestion: (question: Question) => void;
  filters: QuestionFilters;
  onFiltersChange: (filters: QuestionFilters) => void;
}

export default function QuestionList({
  selectedQuestionId,
  onSelectQuestion,
  filters,
  onFiltersChange,
}: QuestionListProps) {
  const [jumpToNumber, setJumpToNumber] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const questionsPerPage = 20;
  
  const { data: questions = [], isLoading, isError } = useQuestions(filters);

  const paginatedQuestions = useMemo(() => {
    const startIndex = (currentPage - 1) * questionsPerPage;
    const endIndex = startIndex + questionsPerPage;
    return questions.slice(startIndex, endIndex);
  }, [questions, currentPage, questionsPerPage]);

  const totalPages = Math.ceil(questions.length / questionsPerPage);

  const handleJumpToQuestion = () => {
    const questionNumber = parseInt(jumpToNumber);
    if (questionNumber > 0 && questionNumber <= questions.length) {
      const targetPage = Math.ceil(questionNumber / questionsPerPage);
      setCurrentPage(targetPage);
      const question = questions[questionNumber - 1];
      if (question) {
        onSelectQuestion(question);
      }
    }
    setJumpToNumber("");
  };

  const getStatusIcon = (question: Question) => {
    if (question.validationStatus === "error") {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    if (question.validationStatus === "warning") {
      return <AlertTriangle className="h-4 w-4 text-warning" />;
    }
    if (question.validationStatus === "valid") {
      return <CheckCircle className="h-4 w-4 text-success" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const getStatusColor = (question: Question) => {
    if (question.validationStatus === "error") {
      return "bg-destructive/10 border-l-destructive";
    }
    if (question.validationStatus === "warning") {
      return "bg-warning/10 border-l-warning";
    }
    return "";
  };

  const getThemeColor = (theme: string) => {
    const colors = {
      'potion-making': 'bg-purple-100 text-purple-700',
      'forest-adventure': 'bg-green-100 text-green-700',
      'space-mission': 'bg-blue-100 text-blue-700',
      'underwater-quest': 'bg-cyan-100 text-cyan-700',
      'medieval-castle': 'bg-amber-100 text-amber-700',
      'pirate-treasure': 'bg-orange-100 text-orange-700',
    };
    return colors[theme as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  if (isError) {
    return (
      <div className="w-96 bg-slate-50 border-r border-slate-300 flex items-center justify-center">
        <div className="text-center p-6">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-slate-600">Failed to load questions</p>
        </div>
      </div>
    );
  }

  return (
    <aside className="w-96 bg-slate-50 border-r border-slate-300 flex flex-col shadow-sm">
      {/* Search and filters */}
      <div className="p-4 border-b border-slate-300 bg-slate-50">
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search questions..."
              value={filters.search || ""}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="pl-10"
            />
          </div>
          
          {/* Filters */}
          <div className="flex space-x-2">
            <Select 
              value={filters.grade?.toString() || "all"} 
              onValueChange={(value) => 
                onFiltersChange({ 
                  ...filters, 
                  grade: value === "all" ? undefined : parseInt(value) 
                })
              }
            >
              <SelectTrigger className="flex-1">
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
            
            <Select 
              value={filters.domain || "all"} 
              onValueChange={(value) => 
                onFiltersChange({ 
                  ...filters, 
                  domain: value === "all" ? undefined : value 
                })
              }
            >
              <SelectTrigger className="flex-1">
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
          
          {/* Quick navigation */}
          <div className="flex items-center space-x-2">
            <Input
              type="number"
              placeholder="Jump to #"
              value={jumpToNumber}
              onChange={(e) => setJumpToNumber(e.target.value)}
              className="w-24"
            />
            <Button
              size="sm"
              onClick={handleJumpToQuestion}
              disabled={!jumpToNumber}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <div className="flex-1 text-right">
              <span className="text-sm text-slate-600">
                {questions.length > 0 ? (
                  <>
                    Question <span className="font-medium">{((currentPage - 1) * questionsPerPage) + 1}</span>-
                    <span className="font-medium">{Math.min(currentPage * questionsPerPage, questions.length)}</span> of{" "}
                    <span className="font-medium">{questions.length}</span>
                  </>
                ) : (
                  "No questions"
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Question list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-slate-200 h-24 rounded-md"></div>
              </div>
            ))}
          </div>
        ) : paginatedQuestions.length === 0 ? (
          <div className="p-4 text-center text-slate-500">
            No questions found
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {paginatedQuestions.map((question) => (
              <div
                key={question.id}
                className={cn(
                  "p-4 hover:bg-white cursor-pointer transition-colors border-l-4 border-l-transparent bg-slate-50",
                  selectedQuestionId === question.id && "bg-blue-50 border-l-primary",
                  getStatusColor(question)
                )}
                onClick={() => onSelectQuestion(question)}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary" className="text-xs">
                        Grade {question.grade}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {question.standard}
                      </Badge>
                      <Badge className={cn("text-xs", getThemeColor(question.theme))}>
                        {question.theme}
                      </Badge>
                    </div>
                    {getStatusIcon(question)}
                  </div>
                  
                  <p className="text-sm font-medium text-slate-800 line-clamp-2">
                    {question.questionText}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Answer: <span className="font-medium">{question.answerKey}</span></span>
                    <span>#{question.id}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="border-t border-slate-300 p-4 bg-slate-50">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}
