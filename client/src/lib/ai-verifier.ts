import { type Question } from "@shared/schema";
import { apiRequest } from "./queryClient";

export interface QuestionIssue {
  id: string;
  type: 'error' | 'warning' | 'improvement';
  category: 'common_core' | 'mathematical_accuracy' | 'grade_appropriateness' | 'clarity' | 'accessibility' | 'pedagogical';
  description: string;
  currentValue: string;
  suggestedFix: string;
  explanation: string;
  confidence: number; // 0-1 scale
  severity: 'critical' | 'major' | 'minor';
  automaticFix: boolean;
  validationMethod: 'ai' | 'sympy' | 'regex' | 'hybrid';
  productionImpact: 'blocks_grading' | 'confuses_students' | 'minor_clarity';
}

export interface MathematicalValidation {
  sympyValidated: boolean;
  computationalErrors: string[];
  arithmeticConsistency: boolean;
  answerExplanationMatch: boolean;
  gradeAppropriate: boolean;
}

export interface VerificationResult {
  questionId: number;
  overallScore: number; // 0-100 scale
  issues: QuestionIssue[];
  commonCoreAlignment: {
    standard: string;
    alignmentScore: number;
    suggestions: string[];
  };
  mathematicalValidation: MathematicalValidation;
  summary: string;
}

export interface BatchVerificationResult {
  questions: VerificationResult[];
  batchSummary: {
    averageScore: number;
    totalIssues: number;
    commonPatterns: string[];
    recommendations: string[];
  };
}

export interface FixApplication {
  questionId: number;
  fixes: {
    issueId: string;
    apply: boolean;
    customValue?: string;
  }[];
}

/**
 * Standalone AI Question Verifier Module (Client-side)
 * 
 * This module communicates with the server-side AI verification service
 * that uses OpenAI's GPT-4o to analyze educational questions against:
 * - Common Core Standards alignment
 * - Mathematical accuracy and rigor
 * - Grade-level appropriateness
 * - Clarity and accessibility
 * - Pedagogical best practices
 * 
 * Features:
 * - Single question analysis
 * - Batch processing (up to 20 questions)
 * - Detailed issue identification and fixes
 * - User confirmation before applying changes
 * - Comprehensive reporting
 */
export class AIQuestionVerifier {
  /**
   * Verify a single question against quality standards
   */
  async verifyQuestion(question: Question): Promise<VerificationResult> {
    try {
      const response = await apiRequest("/api/ai/verify-question", {
        method: "POST",
        body: JSON.stringify({ questionId: question.id }),
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`Verification failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error verifying question:', error);
      throw new Error(`Failed to verify question: ${error.message}`);
    }
  }

  /**
   * Verify a batch of questions (up to 20)
   */
  async verifyBatch(questions: Question[]): Promise<BatchVerificationResult> {
    if (questions.length === 0) {
      throw new Error("No questions provided for batch verification");
    }

    if (questions.length > 20) {
      throw new Error("Batch verification limited to 20 questions maximum");
    }

    try {
      const response = await apiRequest("/api/ai/verify-batch", {
        method: "POST",
        body: JSON.stringify({ questionIds: questions.map(q => q.id) }),
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`Batch verification failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error verifying batch:', error);
      throw new Error(`Failed to verify batch: ${error.message}`);
    }
  }

  /**
   * Apply fixes to a question based on user confirmation
   */
  async applyFixes(question: Question, fixes: FixApplication): Promise<Question> {
    try {
      const response = await apiRequest("/api/ai/apply-fixes", {
        method: "POST",
        body: JSON.stringify({ questionId: question.id, fixes: fixes.fixes }),
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`Failed to apply fixes: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error applying fixes:', error);
      throw new Error(`Failed to apply fixes: ${error.message}`);
    }
  }
}

// Export singleton instance
export const aiVerifier = new AIQuestionVerifier();