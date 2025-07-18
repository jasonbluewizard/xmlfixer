import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { XmlFile } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { 
  AlertTriangle, 
  CheckCircle, 
  Copy, 
  Download, 
  FileText, 
  Trash2, 
  Users,
  HelpCircle
} from 'lucide-react';

interface DuplicateGroup {
  id: string;
  questions: any[];
  duplicateCount: number;
  similarityScore: number;
  matchType: 'exact' | 'similar' | 'content_match';
}

interface DuplicateDetectionResult {
  duplicateGroups: DuplicateGroup[];
  totalDuplicates: number;
  uniqueQuestions: number;
  removedQuestions: any[];
  keptQuestions: any[];
}

interface DuplicateDetectionOptions {
  exactMatch: boolean;
  contentSimilarity: boolean;
  ignoreWhitespace: boolean;
  similarityThreshold: number;
}

interface DuplicateDetectorProps {
  onComplete?: (result: DuplicateDetectionResult) => void;
}

export default function DuplicateDetector({ onComplete }: DuplicateDetectorProps) {
  const [selectedFile, setSelectedFile] = useState<number | null>(null);
  const [detectionOptions, setDetectionOptions] = useState<DuplicateDetectionOptions>({
    exactMatch: true,
    contentSimilarity: true,
    ignoreWhitespace: true,
    similarityThreshold: 0.8  // Lowered default to account for improved algorithm
  });
  const [detectionResult, setDetectionResult] = useState<DuplicateDetectionResult | null>(null);

  const queryClient = useQueryClient();

  // Fetch XML files
  const { data: xmlFiles = [] } = useQuery({
    queryKey: ['/api/xml/files'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/xml/files');
      return response.json();
    }
  });

  // Detect duplicates mutation
  const detectDuplicatesMutation = useMutation({
    mutationFn: async ({ xmlFileId, options }: { xmlFileId: number; options: DuplicateDetectionOptions }) => {
      const response = await apiRequest('POST', '/api/duplicates/remove', { xmlFileId, options });
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Duplicate detection successful:', data);
      try {
        // The backend returns the result nested in duplicateDetectionResult
        if (data && data.duplicateDetectionResult) {
          console.log('Setting detection result:', data.duplicateDetectionResult);
          setDetectionResult(data.duplicateDetectionResult);
          // Delay query invalidation to prevent state reset
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['/api/xml/files'] });
            queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
          }, 100);
          // Results are now displayed in the UI instead of closing the dialog
          // if (onComplete) {
          //   onComplete(data.duplicateDetectionResult);
          // }
        } else {
          console.error('Invalid response format - missing duplicateDetectionResult:', data);
        }
      } catch (error) {
        console.error('Error processing duplicate detection response:', error);
      }
    },
    onError: (error) => {
      console.error('Error detecting duplicates:', error);
      console.error('Error details:', error.message, error.stack);
    }
  });

  const handleDetectDuplicates = () => {
    if (!selectedFile) return;
    
    detectDuplicatesMutation.mutate({
      xmlFileId: selectedFile,
      options: detectionOptions
    });
  };

  const getSeverityColor = (matchType: string) => {
    switch (matchType) {
      case 'exact':
        return 'bg-red-500';
      case 'similar':
        return 'bg-orange-500';
      case 'content_match':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getMatchTypeLabel = (matchType: string) => {
    switch (matchType) {
      case 'exact':
        return 'Exact Duplicate';
      case 'similar':
        return 'Similar Content';
      case 'content_match':
        return 'Content Match';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      {/* File Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5" />
            Duplicate Detection
          </CardTitle>
          <CardDescription>
            Automatically detect and remove duplicate questions from XML files
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Selection */}
          <div className="space-y-2">
            <Label>Select XML File</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {xmlFiles.map((file: any) => (
                <div
                  key={file.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedFile === file.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedFile(file.id)}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <span className="font-medium truncate">{file.filename}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {new Date(file.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detection Options */}
          <div className="space-y-4">
            <Label>Detection Options</Label>
            
            <TooltipProvider>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="exact-match"
                    checked={detectionOptions.exactMatch}
                    onCheckedChange={(checked) => 
                      setDetectionOptions(prev => ({ ...prev, exactMatch: checked as boolean }))
                    }
                  />
                  <Label htmlFor="exact-match" className="text-sm flex items-center gap-1">
                    Exact Match Detection
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p>Finds questions that are identical in all aspects: question text, answers, choices, and explanations must match exactly.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="content-similarity"
                    checked={detectionOptions.contentSimilarity}
                    onCheckedChange={(checked) => 
                      setDetectionOptions(prev => ({ ...prev, contentSimilarity: checked as boolean }))
                    }
                  />
                  <Label htmlFor="content-similarity" className="text-sm flex items-center gap-1">
                    Content Similarity Detection
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p>Finds questions with similar content even if wording differs slightly. Uses text analysis to detect questions that are essentially the same but may have minor variations.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="ignore-whitespace"
                    checked={detectionOptions.ignoreWhitespace}
                    onCheckedChange={(checked) => 
                      setDetectionOptions(prev => ({ ...prev, ignoreWhitespace: checked as boolean }))
                    }
                  />
                  <Label htmlFor="ignore-whitespace" className="text-sm flex items-center gap-1">
                    Ignore Whitespace Differences
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p>Treats questions as identical even if they have different spacing, line breaks, or tabs. "Hello world" and "Hello    world" would be considered the same.</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm flex items-center gap-1">
                    Similarity Threshold: {Math.round(detectionOptions.similarityThreshold * 100)}%
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3 h-3 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <p>How similar questions must be to be considered duplicates. 80% means questions must be 80% similar to be flagged. The algorithm is designed to avoid false positives with mathematical content like "3+2" vs "5+6".</p>
                      </TooltipContent>
                    </Tooltip>
                  </Label>
                  <Slider
                    value={[detectionOptions.similarityThreshold]}
                    onValueChange={([value]) => 
                      setDetectionOptions(prev => ({ ...prev, similarityThreshold: value }))
                    }
                    max={1}
                    min={0.5}
                    step={0.05}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>50% (More results)</span>
                    <span>100% (Fewer results)</span>
                  </div>
                </div>
              </div>
            </TooltipProvider>
          </div>

          {/* Action Button */}
          <Button 
            onClick={handleDetectDuplicates}
            disabled={!selectedFile || detectDuplicatesMutation.isPending}
            className="w-full"
          >
            {detectDuplicatesMutation.isPending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Detecting Duplicates...
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4 mr-2" />
                Detect & Remove Duplicates
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Detection Results */}
      {detectionResult && (
        <div className="text-xs text-gray-500 mb-2">
          Debug: Results found - {detectionResult.totalDuplicates} duplicates, {detectionResult.uniqueQuestions} unique
        </div>
      )}
      {detectionResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Duplicate Detection Results
                </CardTitle>
                <CardDescription>
                  Processing completed successfully. Here's what was found and removed:
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setDetectionResult(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear Results
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-red-50 rounded-lg border">
                <div className="text-3xl font-bold text-red-600">
                  {detectionResult.totalDuplicates}
                </div>
                <div className="text-sm text-gray-600 font-medium">Duplicates Removed</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg border">
                <div className="text-3xl font-bold text-green-600">
                  {detectionResult.uniqueQuestions}
                </div>
                <div className="text-sm text-gray-600 font-medium">Unique Questions</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg border">
                <div className="text-3xl font-bold text-blue-600">
                  {detectionResult.duplicateGroups.length}
                </div>
                <div className="text-sm text-gray-600 font-medium">Duplicate Groups</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg border">
                <div className="text-3xl font-bold text-orange-600">
                  {Math.round((detectionResult.totalDuplicates / (detectionResult.totalDuplicates + detectionResult.uniqueQuestions)) * 100)}%
                </div>
                <div className="text-sm text-gray-600 font-medium">Duplicate Rate</div>
              </div>
            </div>

            {/* Debug Information */}
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h3 className="font-semibold mb-2 text-yellow-800">Debug Information</h3>
              <div className="text-sm text-yellow-700 space-y-1">
                <div>Total questions processed: {detectionResult.totalDuplicates + detectionResult.uniqueQuestions}</div>
                <div>Sample question data check:</div>
                {detectionResult.duplicateGroups[0]?.questions[0] && (
                  <div className="ml-4 space-y-1">
                    <div>- Question text: "{detectionResult.duplicateGroups[0].questions[0].questionText || 'EMPTY'}"</div>
                    <div>- Explanation: "{detectionResult.duplicateGroups[0].questions[0].explanation?.substring(0, 50) || 'EMPTY'}..."</div>
                    <div>- Choices: {JSON.stringify(detectionResult.duplicateGroups[0].questions[0].choices)}</div>
                    <div>- Grade: {detectionResult.duplicateGroups[0].questions[0].grade}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Download Section */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download Cleaned File
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                A new XML file with duplicates removed has been created and is ready for download.
              </p>
              <Button 
                onClick={() => {
                  const selectedFileData = xmlFiles.find((f: XmlFile) => f.id === selectedFile);
                  if (selectedFileData) {
                    const cleanedFilename = selectedFileData.filename.replace(/\.xml$/, '_no_duplicates.xml');
                    window.open(`/api/xml/download/${cleanedFilename}`, '_blank');
                  }
                }}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Cleaned XML File
              </Button>
            </div>

            {/* Detailed Results */}
            <div className="space-y-4">
              <h3 className="font-semibold">Duplicate Groups Found:</h3>
              <div className="max-h-96 overflow-y-auto space-y-3">
                {detectionResult.duplicateGroups.slice(0, 10).map((group, index) => (
                  <div key={group.id} className="p-3 border rounded-lg bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-medium text-sm">Group {index + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs text-white ${getSeverityColor(group.matchType)}`}>
                          {getMatchTypeLabel(group.matchType)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {Math.round(group.similarityScore * 100)}% similar
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>{group.duplicateCount}</strong> duplicates found
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      <div className="font-medium mb-1">Sample Questions:</div>
                      {group.questions.slice(0, 2).map((q, idx) => (
                        <div key={idx} className="truncate mb-1">
                          {idx + 1}. {q.questionText || q.explanation?.substring(0, 60) || 'Text not available'}
                          {(q.questionText || q.explanation) && '...'}
                        </div>
                      ))}
                      {group.questions.length > 2 && (
                        <div className="text-gray-400">
                          ...and {group.questions.length - 2} more similar questions
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {detectionResult.duplicateGroups.length > 10 && (
                  <div className="text-center py-2 text-sm text-gray-500">
                    ... and {detectionResult.duplicateGroups.length - 10} more groups
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}