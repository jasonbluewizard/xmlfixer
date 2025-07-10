import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, AlertTriangle, XCircle, Play, FileText } from "lucide-react";
import { validateBatch } from "@/lib/validators";
import { type Question } from "@shared/schema";

interface ValidationPanelProps {
  questions: Question[];
  onValidate: () => void;
  isValidating?: boolean;
}

export default function ValidationPanel({ questions, onValidate, isValidating }: ValidationPanelProps) {
  const validationResults = validateBatch(questions);
  const validationProgress = Math.round((validationResults.validQuestions / validationResults.totalQuestions) * 100);

  if (questions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <FileText className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600">No questions to validate</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Validation Summary</CardTitle>
          <Button
            onClick={onValidate}
            disabled={isValidating}
            size="sm"
          >
            {isValidating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Validating...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Validation
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-slate-800">
              {validationResults.totalQuestions}
            </div>
            <div className="text-sm text-slate-600">Total Questions</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-success">
              {validationResults.validQuestions}
            </div>
            <div className="text-sm text-slate-600">Valid Questions</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Validation Progress</span>
            <span className="text-sm text-slate-600">{validationProgress}%</span>
          </div>
          <Progress value={validationProgress} className="h-2" />
        </div>

        <div className="space-y-3">
          {validationResults.validQuestions > 0 && (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <span className="font-medium text-green-800">
                  {validationResults.validQuestions} questions passed
                </span>
              </div>
              <Badge variant="outline" className="text-green-700 border-green-300">
                Valid
              </Badge>
            </div>
          )}

          {validationResults.questionsWithWarnings > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-md cursor-pointer hover:bg-yellow-100">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    <span className="font-medium text-yellow-800">
                      {validationResults.questionsWithWarnings} questions have warnings
                    </span>
                  </div>
                  <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                    View Details
                  </Badge>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Validation Warnings</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {validationResults.warnings.map((warning, index) => (
                      <div key={index} className="flex items-start space-x-2 p-2 bg-yellow-50 rounded">
                        <AlertTriangle className="h-4 w-4 text-warning mt-0.5" />
                        <span className="text-sm text-yellow-800">{warning.message}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          )}

          {validationResults.questionsWithErrors > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-md cursor-pointer hover:bg-red-100">
                  <div className="flex items-center space-x-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="font-medium text-red-800">
                      {validationResults.questionsWithErrors} questions have errors
                    </span>
                  </div>
                  <Badge variant="outline" className="text-red-700 border-red-300">
                    View Details
                  </Badge>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Validation Errors</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-96">
                  <div className="space-y-2">
                    {validationResults.errors.map((error, index) => (
                      <div key={index} className="flex items-start space-x-2 p-2 bg-red-50 rounded">
                        <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                        <span className="text-sm text-red-800">{error.message}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
