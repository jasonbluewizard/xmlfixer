# AI Question Verification Module

## Overview

This standalone module provides AI-powered verification and improvement of educational questions using OpenAI's GPT-4o model. It analyzes questions against Common Core Standards and educational best practices, identifies issues, and suggests specific fixes.

## Architecture

The module consists of three main components:

### 1. Server-Side AI Verifier (`server/ai-verifier.ts`)
- **Purpose**: Core AI analysis engine using OpenAI API
- **Key Features**:
  - Single question analysis
  - Batch processing (up to 20 questions)
  - Common Core Standards alignment verification
  - Mathematical accuracy checking
  - Grade-level appropriateness assessment
  - Clarity and accessibility evaluation
  - Pedagogical effectiveness review

### 2. Client-Side API Interface (`client/src/lib/ai-verifier.ts`)
- **Purpose**: Frontend interface to communicate with server-side AI service
- **Key Features**:
  - Simplified API calls to backend
  - Type-safe interfaces
  - Error handling and validation
  - Question update management

### 3. UI Component (`client/src/components/ai-verification-panel.tsx`)
- **Purpose**: User interface for AI verification features
- **Key Features**:
  - Single question verification
  - Batch verification of up to 20 questions
  - Interactive issue review and fix application
  - Common Core alignment display
  - Comprehensive reporting

## Core Functionality

### Question Analysis Categories

1. **Common Core Standards**
   - Verifies alignment with appropriate grade-level standards
   - Suggests correct standard references
   - Evaluates pedagogical alignment

2. **Mathematical Accuracy**
   - Checks mathematical correctness
   - Verifies calculation accuracy
   - Validates formula and equation usage

3. **Grade Appropriateness**
   - Assesses vocabulary level
   - Evaluates concept complexity
   - Checks number ranges and difficulty

4. **Clarity and Accessibility**
   - Reviews question clarity
   - Identifies ambiguous language
   - Suggests clearer wording

5. **Pedagogical Effectiveness**
   - Evaluates educational value
   - Checks answer choice quality
   - Reviews explanation effectiveness

### Issue Types

- **Error**: Critical issues requiring immediate attention
- **Warning**: Important issues that should be addressed
- **Improvement**: Suggestions for enhancement

## Data Structures

### QuestionIssue
```typescript
interface QuestionIssue {
  id: string;
  type: 'error' | 'warning' | 'improvement';
  category: 'common_core' | 'mathematical_accuracy' | 'grade_appropriateness' | 'clarity' | 'accessibility' | 'pedagogical';
  description: string;
  currentValue: string;
  suggestedFix: string;
  explanation: string;
  confidence: number; // 0-1 scale
}
```

### VerificationResult
```typescript
interface VerificationResult {
  questionId: number;
  overallScore: number; // 0-100 scale
  issues: QuestionIssue[];
  commonCoreAlignment: {
    standard: string;
    alignmentScore: number;
    suggestions: string[];
  };
  summary: string;
}
```

### BatchVerificationResult
```typescript
interface BatchVerificationResult {
  questions: VerificationResult[];
  batchSummary: {
    averageScore: number;
    totalIssues: number;
    commonPatterns: string[];
    recommendations: string[];
  };
}
```

## API Endpoints

### POST /api/ai/verify-question
Verifies a single question against quality standards.

**Request Body:**
```json
{
  "questionId": number
}
```

**Response:** `VerificationResult`

### POST /api/ai/verify-batch
Verifies a batch of questions (up to 20).

**Request Body:**
```json
{
  "questionIds": number[]
}
```

**Response:** `BatchVerificationResult`

### POST /api/ai/apply-fixes
Applies selected fixes to a question.

**Request Body:**
```json
{
  "questionId": number,
  "fixes": [
    {
      "issueId": string,
      "apply": boolean,
      "customValue"?: string
    }
  ]
}
```

**Response:** Updated `Question` object

## Usage Examples

### Single Question Verification
```typescript
import { aiVerifier } from '@/lib/ai-verifier';

const result = await aiVerifier.verifyQuestion(question);
console.log(`Overall score: ${result.overallScore}/100`);
console.log(`Issues found: ${result.issues.length}`);
```

### Batch Verification
```typescript
const results = await aiVerifier.verifyBatch(questions);
console.log(`Average score: ${results.batchSummary.averageScore}`);
console.log(`Total issues: ${results.batchSummary.totalIssues}`);
```

### Applying Fixes
```typescript
const fixApplication = {
  questionId: question.id,
  fixes: [
    {
      issueId: 'issue_1',
      apply: true,
      customValue: 'User-provided custom fix'
    }
  ]
};

const updatedQuestion = await aiVerifier.applyFixes(question, fixApplication);
```

## UI Features

### Verification Panel
- **Location**: Header toolbar, "AI Verify" button
- **Features**:
  - Single question verification
  - Batch verification (up to 20 questions)
  - Issue review and selection
  - Custom fix input
  - Apply selected fixes
  - Comprehensive reporting

### Scoring System
- **Overall Score**: 0-100 scale based on all analysis factors
- **Color Coding**:
  - Green (80-100): Excellent quality
  - Yellow (60-79): Good quality with minor issues
  - Red (0-59): Needs improvement

### Issue Display
- **Visual Indicators**: Icons for error, warning, and improvement
- **Category Badges**: Color-coded category labels
- **Confidence Levels**: Percentage confidence for each issue
- **Fix Preview**: Shows current vs. suggested content

## Configuration

### Environment Variables
- `OPENAI_API_KEY`: Required for AI analysis (server-side only)

### Limits
- Maximum 20 questions per batch verification
- 2000 tokens for single question analysis
- 4000 tokens for batch analysis

## Error Handling

The module includes comprehensive error handling:
- API connectivity issues
- Invalid question data
- OpenAI API errors
- Timeout handling
- User-friendly error messages

## Security Considerations

- OpenAI API key stored securely on server-side only
- All AI analysis performed server-side
- Input validation and sanitization
- Rate limiting considerations

## Performance Optimizations

- Batch processing for efficiency
- Caching of verification results
- Lazy loading of UI components
- Debounced user interactions

## Future Enhancements

Potential areas for expansion:
1. **Additional AI Models**: Support for other AI providers
2. **Custom Rubrics**: User-defined evaluation criteria
3. **Learning Analytics**: Track improvement patterns
4. **Collaborative Review**: Multi-user verification workflows
5. **Export Capabilities**: Generate verification reports
6. **Integration**: Connect with learning management systems

## Testing

The module should be tested with:
- Various question types and formats
- Different grade levels (1-6)
- Edge cases and error conditions
- Performance under load
- User interaction workflows

## Maintenance

Regular maintenance tasks:
- Monitor OpenAI API usage and costs
- Update Common Core Standards references
- Refine AI prompts based on feedback
- Performance optimization
- Security updates

## Support

For issues or enhancements:
1. Check error logs in browser console
2. Verify OpenAI API key configuration
3. Test with simplified question examples
4. Review network connectivity
5. Consult OpenAI API documentation

This module provides a comprehensive AI-powered solution for educational question quality assurance, combining advanced AI analysis with user-friendly interfaces and robust error handling.