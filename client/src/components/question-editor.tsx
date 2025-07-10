import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useUpdateQuestion } from "@/hooks/use-questions";
import { useAutoSave } from "@/hooks/use-auto-save";
import { validateQuestion } from "@/lib/validators";
import { ChevronDown, ChevronUp, Save, Play, CheckCircle, AlertTriangle, XCircle, ArrowLeft, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Question } from "@shared/schema";
import { DOMAINS, GRADES, STATUS_OPTIONS, ANSWER_KEYS } from "@/types/question";

const questionSchema = z.object({
  grade: z.number().min(1).max(6),
  domain: z.string().min(1),
  standard: z.string().min(1),
  tier: z.number().min(1).max(3),
  questionText: z.string().min(1),
  correctAnswer: z.string().min(1),
  answerKey: z.enum(ANSWER_KEYS),
  choices: z.array(z.string().min(1)).min(2).max(4),
  explanation: z.string().min(1),
  theme: z.string().min(1),
  status: z.string(),
});

type QuestionFormData = z.infer<typeof questionSchema>;

interface QuestionEditorProps {
  question: Question | null;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export default function QuestionEditor({
  question,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: QuestionEditorProps) {
  const [isMetadataOpen, setIsMetadataOpen] = useState(true);
  const [isValidationOpen, setIsValidationOpen] = useState(true);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const updateQuestion = useUpdateQuestion();
  
  const form = useForm<QuestionFormData>({
    resolver: zodResolver(questionSchema),
    defaultValues: {
      grade: 1,
      domain: "",
      standard: "",
      tier: 1,
      questionText: "",
      correctAnswer: "",
      answerKey: "A",
      choices: ["", "", "", ""],
      explanation: "",
      theme: "",
      status: "pending",
    },
  });

  const formData = form.watch();
  
  // Auto-save functionality
  const { isSaving } = useAutoSave(
    question?.id || null,
    hasUnsavedChanges ? {
      grade: formData.grade,
      domain: formData.domain,
      standard: formData.standard,
      tier: formData.tier,
      questionText: formData.questionText,
      correctAnswer: formData.correctAnswer,
      answerKey: formData.answerKey,
      choices: formData.choices.filter(Boolean),
      explanation: formData.explanation,
      theme: formData.theme,
      status: formData.status,
    } : {},
    2000
  );

  // Update form when question changes
  useEffect(() => {
    if (question) {
      form.reset({
        grade: question.grade,
        domain: question.domain,
        standard: question.standard,
        tier: question.tier,
        questionText: question.questionText,
        correctAnswer: question.correctAnswer,
        answerKey: question.answerKey as any,
        choices: [...question.choices, ...Array(4 - question.choices.length).fill("")],
        explanation: question.explanation,
        theme: question.theme,
        status: question.status || "pending",
      });
      setHasUnsavedChanges(false);
    }
  }, [question, form]);

  // Track changes
  useEffect(() => {
    const subscription = form.watch(() => {
      setHasUnsavedChanges(true);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Run validation when form data changes
  useEffect(() => {
    if (question && hasUnsavedChanges) {
      const questionToValidate = {
        ...question,
        ...formData,
        choices: formData.choices.filter(Boolean),
      };
      const result = validateQuestion(questionToValidate);
      setValidationResult(result);
    }
  }, [question, formData, hasUnsavedChanges]);

  const handleSave = async () => {
    if (!question) return;
    
    const isValid = await form.trigger();
    if (!isValid) return;
    
    updateQuestion.mutate({
      id: question.id,
      question: {
        ...formData,
        choices: formData.choices.filter(Boolean),
      },
    });
    setHasUnsavedChanges(false);
  };

  const handleRunValidation = () => {
    if (!question) return;
    
    const questionToValidate = {
      ...question,
      ...formData,
      choices: formData.choices.filter(Boolean),
    };
    const result = validateQuestion(questionToValidate);
    setValidationResult(result);
  };

  const handleDiscardChanges = () => {
    if (question) {
      form.reset({
        grade: question.grade,
        domain: question.domain,
        standard: question.standard,
        tier: question.tier,
        questionText: question.questionText,
        correctAnswer: question.correctAnswer,
        answerKey: question.answerKey as any,
        choices: [...question.choices, ...Array(4 - question.choices.length).fill("")],
        explanation: question.explanation,
        theme: question.theme,
        status: question.status || "pending",
      });
      setHasUnsavedChanges(false);
    }
  };

  if (!question) {
    return (
      <main className="flex-1 flex flex-col bg-white">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8">
            <div className="text-slate-400 mb-4">
              <CheckCircle className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              No Question Selected
            </h3>
            <p className="text-slate-600">
              Select a question from the list to start editing
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-white">
      {/* Editor header */}
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-slate-800">Question Editor</h2>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-600">Question ID:</span>
              <code className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                {question.xmlId}
              </code>
            </div>
          </div>
          
          {/* Auto-save status */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                  <span className="text-sm text-slate-600">Saving...</span>
                </>
              ) : hasUnsavedChanges ? (
                <>
                  <div className="h-2 w-2 bg-warning rounded-full" />
                  <span className="text-sm text-slate-600">Unsaved changes</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 text-success" />
                  <span className="text-sm text-slate-600">Saved</span>
                </>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunValidation}
            >
              <Play className="h-4 w-4 mr-1" />
              Run Validation
            </Button>
          </div>
        </div>
      </div>
      
      {/* Editor content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          <Form {...form}>
            <form className="space-y-6">
              {/* Metadata section */}
              <Collapsible open={isMetadataOpen} onOpenChange={setIsMetadataOpen}>
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-slate-50">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">Question Metadata</CardTitle>
                        {isMetadataOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="grid grid-cols-3 gap-4 pt-0">
                      <FormField
                        control={form.control}
                        name="grade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Grade</FormLabel>
                            <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {GRADES.map(grade => (
                                  <SelectItem key={grade} value={grade.toString()}>
                                    Grade {grade}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="domain"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Domain</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {DOMAINS.map(domain => (
                                  <SelectItem key={domain.value} value={domain.value}>
                                    {domain.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="standard"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Standard</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="tier"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tier</FormLabel>
                            <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value.toString()}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="1">Tier 1</SelectItem>
                                <SelectItem value="2">Tier 2</SelectItem>
                                <SelectItem value="3">Tier 3</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="theme"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Theme</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {STATUS_OPTIONS.map(status => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
              
              {/* Question text */}
              <FormField
                control={form.control}
                name="questionText"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">Question Text</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={4}
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Answer choices */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Answer Choices</Label>
                  {validationResult?.warnings?.some((w: any) => w.field === 'choices') && (
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-warning" />
                      <span className="text-xs text-warning">
                        {validationResult.warnings.find((w: any) => w.field === 'choices')?.message}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  <FormField
                    control={form.control}
                    name="answerKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="space-y-3"
                          >
                            {ANSWER_KEYS.map((key, index) => (
                              <div
                                key={key}
                                className={cn(
                                  "flex items-center space-x-3 p-3 border rounded-md",
                                  formData.choices[index] === formData.choices.find((c, i) => i !== index && c === formData.choices[index])
                                    ? "border-warning bg-warning/10"
                                    : "border-slate-300"
                                )}
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value={key} id={key} />
                                  <Label htmlFor={key} className="font-medium">
                                    {key}
                                  </Label>
                                </div>
                                <FormField
                                  control={form.control}
                                  name={`choices.${index}`}
                                  render={({ field: choiceField }) => (
                                    <FormItem className="flex-1">
                                      <FormControl>
                                        <Input
                                          {...choiceField}
                                          placeholder={`Choice ${key}`}
                                        />
                                      </FormControl>
                                    </FormItem>
                                  )}
                                />
                              </div>
                            ))}
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              {/* Correct answer */}
              <FormField
                control={form.control}
                name="correctAnswer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">Correct Answer</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={2}
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Explanation */}
              <FormField
                control={form.control}
                name="explanation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-semibold">Explanation</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={4}
                        className="resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
          
          {/* Validation results */}
          {validationResult && (
            <Collapsible open={isValidationOpen} onOpenChange={setIsValidationOpen}>
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-slate-50">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">Validation Results</CardTitle>
                      <div className="flex items-center space-x-2">
                        <Badge variant={validationResult.isValid ? "default" : "destructive"}>
                          {validationResult.isValid ? "Valid" : "Issues Found"}
                        </Badge>
                        {isValidationOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    {validationResult.errors.map((error: any, index: number) => (
                      <div key={index} className="flex items-center space-x-2">
                        <XCircle className="h-4 w-4 text-destructive" />
                        <span className="text-sm text-destructive">{error.message}</span>
                      </div>
                    ))}
                    
                    {validationResult.warnings.map((warning: any, index: number) => (
                      <div key={index} className="flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <span className="text-sm text-warning">{warning.message}</span>
                      </div>
                    ))}
                    
                    {validationResult.isValid && (
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-success" />
                        <span className="text-sm text-success">All validation checks passed</span>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          )}
        </div>
      </div>
      
      {/* Editor actions */}
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevious}
              disabled={!hasPrevious}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNext}
              disabled={!hasNext}
            >
              Next
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              onClick={handleDiscardChanges}
              disabled={!hasUnsavedChanges}
            >
              <X className="h-4 w-4 mr-1" />
              Discard Changes
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasUnsavedChanges || updateQuestion.isPending}
            >
              <Save className="h-4 w-4 mr-1" />
              Save Question
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
