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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  AlertTriangle, 
  CheckCircle, 
  Copy, 
  Download, 
  FileText, 
  Trash2, 
  Users 
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
    similarityThreshold: 0.9
  });
  const [detectionResult, setDetectionResult] = useState<DuplicateDetectionResult | null>(null);

  const queryClient = useQueryClient();

  // Fetch XML files
  const { data: xmlFiles = [] } = useQuery({
    queryKey: ['/api/xml/files'],
    queryFn: () => apiRequest('/api/xml/files')
  });

  // Detect duplicates mutation
  const detectDuplicatesMutation = useMutation({
    mutationFn: async ({ xmlFileId, options }: { xmlFileId: number; options: DuplicateDetectionOptions }) => {
      return apiRequest(`/api/duplicates/remove`, {
        method: 'POST',
        body: { xmlFileId, options }
      });
    },
    onSuccess: (data) => {
      console.log('Duplicate detection successful:', data);
      try {
        if (data && data.duplicateDetectionResult) {
          setDetectionResult(data.duplicateDetectionResult);
          queryClient.invalidateQueries({ queryKey: ['/api/xml/files'] });
          queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
          if (onComplete) {
            onComplete(data.duplicateDetectionResult);
          }
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
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="exact-match"
                  checked={detectionOptions.exactMatch}
                  onCheckedChange={(checked) => 
                    setDetectionOptions(prev => ({ ...prev, exactMatch: checked as boolean }))
                  }
                />
                <Label htmlFor="exact-match" className="text-sm">
                  Exact Match Detection
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
                <Label htmlFor="content-similarity" className="text-sm">
                  Content Similarity Detection
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
                <Label htmlFor="ignore-whitespace" className="text-sm">
                  Ignore Whitespace Differences
                </Label>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">
                  Similarity Threshold: {Math.round(detectionOptions.similarityThreshold * 100)}%
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
              </div>
            </div>
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
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Detection Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {detectionResult.totalDuplicates}
                </div>
                <div className="text-sm text-gray-600">Duplicates Removed</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {detectionResult.uniqueQuestions}
                </div>
                <div className="text-sm text-gray-600">Unique Questions</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {detectionResult.duplicateGroups.length}
                </div>
                <div className="text-sm text-gray-600">Duplicate Groups</div>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Duplicate Removal Progress</span>
                <span>
                  {detectionResult.uniqueQuestions} / {detectionResult.uniqueQuestions + detectionResult.totalDuplicates} questions kept
                </span>
              </div>
              <Progress 
                value={(detectionResult.uniqueQuestions / (detectionResult.uniqueQuestions + detectionResult.totalDuplicates)) * 100} 
                className="h-2"
              />
            </div>

            {/* Duplicate Groups */}
            {detectionResult.duplicateGroups.length > 0 && (
              <div className="space-y-3">
                <Label>Duplicate Groups Found</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {detectionResult.duplicateGroups.map((group, index) => (
                    <div key={group.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-500" />
                          <span className="font-medium">Group {index + 1}</span>
                          <Badge variant="outline" className={getSeverityColor(group.matchType)}>
                            {getMatchTypeLabel(group.matchType)}
                          </Badge>
                        </div>
                        <span className="text-sm text-gray-500">
                          {group.duplicateCount} duplicate(s)
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 truncate">
                        {group.questions[0]?.questionText || 'No question text'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Success Message */}
            {detectionResult.totalDuplicates > 0 ? (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Successfully removed {detectionResult.totalDuplicates} duplicate questions. 
                  A new XML file has been created with {detectionResult.uniqueQuestions} unique questions.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  No duplicates found! Your XML file already contains only unique questions.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}