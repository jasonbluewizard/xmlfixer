import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, CheckCircle, AlertTriangle, Brain, Sparkles, BookOpen } from "lucide-react";
import { type Question } from "@shared/schema";
import { aiVerifier, type VerificationResult, type BatchVerificationResult, type QuestionIssue, type FixApplication } from "@/lib/ai-verifier";
import { cn } from "@/lib/utils";

interface AIVerificationPanelProps {
  questions: Question[];
  selectedQuestion: Question | null;
  onQuestionUpdate: (questionId: number, updatedQuestion: Question) => void;
  onBatchUpdate: (updates: { id: number; question: Partial<Question> }[]) => void;
}

export default function AIVerificationPanel({ 
  questions, 
  selectedQuestion, 
  onQuestionUpdate, 
  onBatchUpdate 
}: AIVerificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchVerificationResult | null>(null);
  const [selectedFixes, setSelectedFixes] = useState<Record<string, boolean>>({});
  const [customFixes, setCustomFixes] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  const handleVerifySingle = async () => {
    if (!selectedQuestion) return;
    
    setIsVerifying(true);
    try {
      const result = await aiVerifier.verifyQuestion(selectedQuestion);
      setVerificationResult(result);
      setSelectedFixes({});
      setCustomFixes({});
      setActiveTab('single');
    } catch (error) {
      console.error('Verification failed:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleVerifyBatch = async () => {
    if (questions.length === 0) return;
    
    setIsVerifying(true);
    try {
      const batch = questions.slice(0, 20); // Limit to 20 questions
      const result = await aiVerifier.verifyBatch(batch);
      setBatchResult(result);
      setSelectedFixes({});
      setCustomFixes({});
      setActiveTab('batch');
    } catch (error) {
      console.error('Batch verification failed:', error);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleApplyFixes = async () => {
    if (!verificationResult || !selectedQuestion) return;

    try {
      const fixesToApply: FixApplication = {
        questionId: selectedQuestion.id,
        fixes: verificationResult.issues.map(issue => ({
          issueId: issue.id,
          apply: selectedFixes[issue.id] || false,
          customValue: customFixes[issue.id]
        }))
      };

      const updatedQuestion = await aiVerifier.applyFixes(selectedQuestion, fixesToApply);
      onQuestionUpdate(selectedQuestion.id, updatedQuestion);
      
      // Reset UI
      setVerificationResult(null);
      setSelectedFixes({});
      setCustomFixes({});
    } catch (error) {
      console.error('Failed to apply fixes:', error);
    }
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'improvement':
        return <Sparkles className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'common_core':
        return 'bg-purple-100 text-purple-800';
      case 'mathematical_accuracy':
        return 'bg-red-100 text-red-800';
      case 'grade_appropriateness':
        return 'bg-green-100 text-green-800';
      case 'clarity':
        return 'bg-blue-100 text-blue-800';
      case 'accessibility':
        return 'bg-orange-100 text-orange-800';
      case 'pedagogical':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const canVerifySingle = selectedQuestion !== null;
  const canVerifyBatch = questions.length > 0;
  const hasFixesToApply = verificationResult && Object.values(selectedFixes).some(Boolean);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="ml-2">
          <Brain className="h-4 w-4 mr-1" />
          AI Verify
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Question Verification
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col h-full">
          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            <Button
              onClick={handleVerifySingle}
              disabled={!canVerifySingle || isVerifying}
              className="flex-1"
            >
              {isVerifying ? 'Verifying...' : 'Verify Current Question'}
            </Button>
            <Button
              onClick={handleVerifyBatch}
              disabled={!canVerifyBatch || isVerifying}
              variant="outline"
              className="flex-1"
            >
              {isVerifying ? 'Verifying...' : `Verify Batch (${Math.min(questions.length, 20)})`}
            </Button>
          </div>

          {/* Loading State */}
          {isVerifying && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
              <p className="text-sm text-gray-600">
                Analyzing questions with AI...
              </p>
            </div>
          )}

          {/* Results */}
          {(verificationResult || batchResult) && !isVerifying && (
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'single' | 'batch')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="single" disabled={!verificationResult}>
                  Single Question
                </TabsTrigger>
                <TabsTrigger value="batch" disabled={!batchResult}>
                  Batch Analysis
                </TabsTrigger>
              </TabsList>

              {/* Single Question Results */}
              <TabsContent value="single" className="mt-4">
                {verificationResult && (
                  <div className="space-y-4">
                    {/* Overall Score */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center justify-between">
                          <span>Overall Quality Score</span>
                          <span className={cn("text-2xl font-bold", getScoreColor(verificationResult.overallScore))}>
                            {verificationResult.overallScore}/100
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Progress value={verificationResult.overallScore} className="mb-2" />
                        <p className="text-sm text-gray-600">{verificationResult.summary}</p>
                      </CardContent>
                    </Card>

                    {/* Mathematical Validation */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle className="h-5 w-5" />
                          Mathematical Validation
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">SymPy Verified:</span>
                            {verificationResult.mathematicalValidation?.sympyValidated ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Grade Appropriate:</span>
                            {verificationResult.mathematicalValidation?.gradeAppropriate ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Arithmetic Consistent:</span>
                            {verificationResult.mathematicalValidation?.arithmeticConsistency ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Answer Match:</span>
                            {verificationResult.mathematicalValidation?.answerExplanationMatch ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                        </div>
                        {verificationResult.mathematicalValidation?.computationalErrors?.length > 0 && (
                          <div className="mt-4">
                            <span className="text-sm font-medium text-red-600">Computational Errors:</span>
                            <ul className="list-disc list-inside text-xs text-red-600 mt-1">
                              {verificationResult.mathematicalValidation.computationalErrors.map((error, index) => (
                                <li key={`math_error_${index}`}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Common Core Alignment */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <BookOpen className="h-5 w-5" />
                          Common Core Alignment
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="font-medium">Standard:</span>
                            <span>{verificationResult.commonCoreAlignment.standard}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Alignment Score:</span>
                            <span className={getScoreColor(verificationResult.commonCoreAlignment.alignmentScore)}>
                              {verificationResult.commonCoreAlignment.alignmentScore}/100
                            </span>
                          </div>
                          {verificationResult.commonCoreAlignment.suggestions.length > 0 && (
                            <div className="mt-3">
                              <span className="font-medium">Suggestions:</span>
                              <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                                {verificationResult.commonCoreAlignment.suggestions.map((suggestion, index) => (
                                  <li key={index}>{suggestion}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Issues and Fixes */}
                    {verificationResult.issues.length > 0 && (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg flex items-center justify-between">
                            <span>Issues Found ({verificationResult.issues.length})</span>
                            {hasFixesToApply && (
                              <Button onClick={handleApplyFixes} size="sm">
                                Apply Selected Fixes
                              </Button>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-60">
                            <div className="space-y-4">
                              {verificationResult.issues.map((issue, index) => (
                                <div key={`${issue.id}_${index}`} className="border rounded-lg p-4 space-y-3">
                                  <div className="flex items-start gap-2">
                                    <Checkbox
                                      id={`${issue.id}_${index}`}
                                      checked={selectedFixes[issue.id] || false}
                                      onCheckedChange={(checked) => 
                                        setSelectedFixes(prev => ({ ...prev, [issue.id]: checked as boolean }))
                                      }
                                    />
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        {getIssueIcon(issue.type)}
                                        <Badge className={getCategoryColor(issue.category)}>
                                          {issue.category.replace('_', ' ')}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs">
                                          {issue.validationMethod || 'ai'}
                                        </Badge>
                                        <span className="text-sm text-gray-500">
                                          {Math.round(issue.confidence * 100)}% confidence
                                        </span>
                                        {issue.severity && (
                                          <Badge 
                                            variant={issue.severity === 'critical' ? 'destructive' : 'secondary'}
                                            className="text-xs"
                                          >
                                            {issue.severity}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="font-medium text-sm">{issue.description}</p>
                                      <div className="mt-2 text-xs text-gray-600">
                                        <p><strong>Current:</strong> {issue.currentValue}</p>
                                        <p><strong>Suggested:</strong> {issue.suggestedFix}</p>
                                        <p><strong>Why:</strong> {issue.explanation}</p>
                                      </div>
                                      {selectedFixes[issue.id] && (
                                        <div className="mt-3">
                                          <Label htmlFor={`custom-${issue.id}_${index}`} className="text-xs">
                                            Custom Fix (optional):
                                          </Label>
                                          <Textarea
                                            id={`custom-${issue.id}_${index}`}
                                            placeholder="Enter custom fix or leave empty to use suggested fix"
                                            value={customFixes[issue.id] || ''}
                                            onChange={(e) => setCustomFixes(prev => ({ ...prev, [issue.id]: e.target.value }))}
                                            className="mt-1 text-xs"
                                            rows={2}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* Batch Results */}
              <TabsContent value="batch" className="mt-4">
                {batchResult && (
                  <div className="space-y-4">
                    {/* Batch Summary */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Batch Analysis Summary</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <span className="text-sm font-medium">Average Score:</span>
                            <span className={cn("ml-2 text-lg font-bold", getScoreColor(batchResult.batchSummary.averageScore))}>
                              {Math.round(batchResult.batchSummary.averageScore)}/100
                            </span>
                          </div>
                          <div>
                            <span className="text-sm font-medium">Total Issues:</span>
                            <span className="ml-2 text-lg font-bold">{batchResult.batchSummary.totalIssues}</span>
                          </div>
                        </div>
                        
                        {batchResult.batchSummary.commonPatterns.length > 0 && (
                          <div className="mb-4">
                            <h4 className="font-medium mb-2">Common Patterns:</h4>
                            <ul className="list-disc list-inside text-sm text-gray-600">
                              {batchResult.batchSummary.commonPatterns.map((pattern, index) => (
                                <li key={index}>{pattern}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {batchResult.batchSummary.recommendations.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Recommendations:</h4>
                            <ul className="list-disc list-inside text-sm text-gray-600">
                              {batchResult.batchSummary.recommendations.map((rec, index) => (
                                <li key={index}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Individual Question Scores */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Individual Question Scores</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-60">
                          <div className="space-y-2">
                            {batchResult.questions.map((result, index) => (
                              <div key={result.questionId} className="flex items-center justify-between p-3 border rounded">
                                <span className="text-sm font-medium">Question {index + 1}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500">
                                    {result.issues.length} issues
                                  </span>
                                  <span className={cn("font-bold", getScoreColor(result.overallScore))}>
                                    {result.overallScore}/100
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}