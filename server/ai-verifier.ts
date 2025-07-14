import OpenAI from "openai";
import { type Question } from "@shared/schema";
import { mathValidator, type MathematicalValidation } from "./math-validator";
import { validationEngine, type ValidationError } from "./validation-rules";
import { aiValidationBreaker, sympyValidationBreaker } from "./validation-circuit-breaker";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
 * Standalone AI Question Verifier Module (Server-side)
 * 
 * This module uses OpenAI's GPT-4o to analyze educational questions against:
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
  private model = "gpt-4o";
  
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is required for AI verification");
    }
  }

  /**
   * Verify a single question against quality standards
   * Enhanced with production-grade validation systems
   */
  async verifyQuestion(question: Question): Promise<VerificationResult> {
    try {
      // Use circuit breaker pattern for resilience
      return await aiValidationBreaker.callWithFallback(
        () => this.performFullValidation(question),
        () => this.performFallbackValidation(question)
      );
    } catch (error) {
      console.error('Error verifying question:', error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to verify question: ${message}`);
    }
  }

  /**
   * Comprehensive validation combining AI and deterministic methods
   */
  private async performFullValidation(question: Question): Promise<VerificationResult> {
    // 1. Run mathematical validation (SymPy-based)
    const mathValidation = await sympyValidationBreaker.callWithFallback(
      () => mathValidator.validateMathematically(question),
      () => Promise.resolve(this.createFallbackMathValidation())
    );

    // 2. Run validation rules engine
    const ruleValidation = await validationEngine.validateQuestion(question);

    // 3. Run AI analysis for pedagogical insights
    const aiResult = await this.performAIAnalysis(question);

    // 4. Combine all results
    return this.combineValidationResults(question.id, aiResult, mathValidation, ruleValidation);
  }

  /**
   * Fallback validation using only rule-based systems
   */
  private async performFallbackValidation(question: Question): Promise<VerificationResult> {
    console.warn('Using fallback validation - AI service unavailable');
    
    const mathValidation = await mathValidator.validateMathematically(question);
    const ruleValidation = await validationEngine.validateQuestion(question);

    return {
      questionId: question.id,
      overallScore: ruleValidation.score,
      issues: this.convertValidationErrorsToIssues(ruleValidation.errors.concat(ruleValidation.warnings)),
      commonCoreAlignment: {
        standard: question.standard || 'Unknown',
        alignmentScore: 50, // Default when AI unavailable
        suggestions: ['AI analysis unavailable - manual review recommended']
      },
      mathematicalValidation: mathValidation,
      summary: 'Validation completed using rule-based systems only (AI unavailable)'
    };
  }

  /**
   * Perform AI analysis for pedagogical insights
   */
  private async performAIAnalysis(question: Question): Promise<any> {
    const prompt = this.buildSingleQuestionPrompt(question);
    
    const response = await openai.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: "system",
          content: this.getSystemPrompt()
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 2000
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }

  /**
   * Verify a batch of questions (up to 20)
   * Uses the same three-tier validation pipeline as individual verification for consistency
   */
  async verifyBatch(questions: Question[]): Promise<BatchVerificationResult> {
    if (questions.length === 0) {
      throw new Error("No questions provided for batch verification");
    }

    if (questions.length > 20) {
      throw new Error("Batch verification limited to 20 questions maximum");
    }

    try {
      console.log(`Starting batch verification for ${questions.length} questions using three-tier validation`);
      
      // Run full individual verification for each question to ensure consistency
      const individualResults = await Promise.all(
        questions.map(async (question, index) => {
          try {
            console.log(`Verifying question ${index + 1}/${questions.length}: ${question.id}`);
            return await this.verifyQuestion(question);
          } catch (error) {
            console.error(`Failed to verify question ${question.id}:`, error);
            return this.createFallbackResult(question);
          }
        })
      );

      // Calculate batch summary
      const batchSummary = {
        averageScore: individualResults.reduce((sum, r) => sum + r.overallScore, 0) / individualResults.length,
        totalIssues: individualResults.reduce((sum, r) => sum + r.issues.length, 0),
        commonPatterns: this.identifyCommonPatterns(individualResults),
        recommendations: this.generateBatchRecommendations(individualResults)
      };

      console.log(`Batch verification completed: ${batchSummary.averageScore.toFixed(1)} avg score, ${batchSummary.totalIssues} total issues`);

      return {
        questions: individualResults,
        batchSummary
      };
    } catch (error) {
      console.error('Error verifying batch:', error);
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to verify batch: ${message}`);
    }
  }

  /**
   * Apply fixes to a question based on user confirmation
   */
  async applyFixes(question: Question, fixes: FixApplication): Promise<Question> {
    const updatedQuestion = { ...question };
    
    for (const fix of fixes.fixes) {
      if (!fix.apply) continue;
      
      // Apply the fix based on the issue type
      const issue = await this.getIssueById(question, fix.issueId);
      if (!issue) continue;

      const valueToUse = fix.customValue || issue.suggestedFix;
      
      switch (issue.category) {
        case 'common_core':
          if (issue.description.includes('standard')) {
            updatedQuestion.standard = valueToUse;
          }
          break;
        case 'mathematical_accuracy':
          if (issue.description.includes('question text')) {
            updatedQuestion.questionText = valueToUse;
          } else if (issue.description.includes('correct answer')) {
            updatedQuestion.correctAnswer = valueToUse;
          }
          break;
        case 'grade_appropriateness':
          if (issue.description.includes('grade')) {
            updatedQuestion.grade = parseInt(valueToUse);
          }
          break;
        case 'clarity':
          if (issue.description.includes('question')) {
            updatedQuestion.questionText = valueToUse;
          } else if (issue.description.includes('explanation')) {
            updatedQuestion.explanation = valueToUse;
          }
          break;
        case 'accessibility':
          if (issue.description.includes('choices')) {
            updatedQuestion.choices = valueToUse.split('|');
          }
          break;
      }
    }

    return updatedQuestion;
  }

  private async getIssueById(question: Question, issueId: string): Promise<QuestionIssue | null> {
    try {
      const verification = await this.verifyQuestion(question);
      return verification.issues.find(issue => issue.id === issueId) || null;
    } catch (error) {
      console.error('Error getting issue:', error);
      return null;
    }
  }

  private getSystemPrompt(): string {
    return `You are an expert educational content reviewer specializing in Common Core Standards and mathematics education. Your task is to analyze educational questions for quality, accuracy, and alignment with standards.

Analyze questions for:
1. Common Core Standards alignment and accuracy
2. Mathematical accuracy and rigor
3. Grade-level appropriateness
4. Clarity and accessibility
5. Pedagogical effectiveness

For each issue found, provide:
- Specific description of the problem
- Current problematic content
- Suggested fix
- Clear explanation of why the fix improves the question
- Confidence level (0-1)

Always respond in JSON format with the structure:
{
  "overallScore": number (0-100),
  "issues": [
    {
      "id": "unique_id",
      "type": "error|warning|improvement",
      "category": "common_core|mathematical_accuracy|grade_appropriateness|clarity|accessibility|pedagogical",
      "description": "specific issue description",
      "currentValue": "current problematic content",
      "suggestedFix": "improved content",
      "explanation": "why this fix improves the question",
      "confidence": number (0-1)
    }
  ],
  "commonCoreAlignment": {
    "standard": "detected/suggested standard",
    "alignmentScore": number (0-100),
    "suggestions": ["alignment improvements"]
  },
  "summary": "overall assessment"
}`;
  }

  private getBatchSystemPrompt(): string {
    return `You are an expert educational content reviewer analyzing a batch of educational questions. Focus on identifying patterns across questions and providing comprehensive feedback.

Analyze each question individually, then provide batch-level insights about:
- Common issues across questions
- Consistency problems
- Overall quality patterns
- Recommendations for improvement

Respond in JSON format with:
{
  "questions": [
    {
      "overallScore": number (0-100),
      "issues": [...],
      "commonCoreAlignment": {...},
      "summary": "question assessment"
    }
  ],
  "batchSummary": {
    "averageScore": number,
    "totalIssues": number,
    "commonPatterns": ["pattern descriptions"],
    "recommendations": ["improvement recommendations"]
  }
}`;
  }

  private buildSingleQuestionPrompt(question: Question): string {
    return `Please analyze this educational question for quality and Common Core alignment:

**Question Details:**
- Grade: ${question.grade}
- Domain: ${question.domain}
- Standard: ${question.standard}
- Question: ${question.questionText}
- Choices: ${question.choices.join(', ')}
- Correct Answer: ${question.correctAnswer}
- Answer Key: ${question.answerKey}
- Explanation: ${question.explanation}
- Theme: ${question.theme}

**Analysis Focus:**
1. Verify Common Core standard alignment for Grade ${question.grade}
2. Check mathematical accuracy and rigor
3. Assess grade-level appropriateness
4. Evaluate clarity and accessibility
5. Review pedagogical effectiveness

Provide specific, actionable feedback with concrete fixes.`;
  }

  private buildBatchPrompt(questions: Question[]): string {
    const questionsList = questions.map((q, index) => 
      `Question ${index + 1}:
- Grade: ${q.grade}, Domain: ${q.domain}
- Text: ${q.questionText}
- Choices: ${q.choices.join(', ')}
- Correct: ${q.correctAnswer}
- Standard: ${q.standard}`
    ).join('\n\n');

    return `Please analyze this batch of ${questions.length} educational questions:

${questionsList}

Provide individual analysis for each question plus batch-level insights about common patterns and recommendations.`;
  }

  /**
   * Combine results from AI, SymPy, and rule-based validation
   */
  private combineValidationResults(
    questionId: number, 
    aiResult: any, 
    mathValidation: MathematicalValidation,
    ruleValidation: any
  ): VerificationResult {
    // Convert rule validation errors to enhanced issues
    const ruleIssues = this.convertValidationErrorsToIssues(
      ruleValidation.errors.concat(ruleValidation.warnings)
    );

    // Convert AI issues to enhanced format
    const aiIssues = (aiResult.issues || []).map((issue: any, index: number) => ({
      id: issue.id || `ai_issue_${index}`,
      type: issue.type || 'warning',
      category: issue.category || 'clarity',
      description: issue.description || '',
      currentValue: issue.currentValue || '',
      suggestedFix: issue.suggestedFix || '',
      explanation: issue.explanation || '',
      confidence: Math.max(0, Math.min(1, issue.confidence || 0.5)),
      severity: issue.severity || 'minor',
      automaticFix: false,
      validationMethod: 'ai' as const,
      productionImpact: issue.productionImpact || 'minor_clarity'
    }));

    // Add mathematical validation issues
    const mathIssues: QuestionIssue[] = [];
    if (!mathValidation.sympyValidated) {
      mathValidation.computationalErrors.forEach((error, index) => {
        mathIssues.push({
          id: `sympy_error_${index}`,
          type: 'error',
          category: 'mathematical_accuracy',
          description: error,
          currentValue: 'Mathematical expression',
          suggestedFix: 'Correct the mathematical calculation',
          explanation: 'SymPy detected computational error',
          confidence: 0.95,
          severity: 'critical',
          automaticFix: false,
          validationMethod: 'sympy',
          productionImpact: 'blocks_grading'
        });
      });
    }

    // Calculate combined score
    const baseScore = Math.max(0, Math.min(100, aiResult.overallScore || 70));
    const mathPenalty = mathValidation.sympyValidated ? 0 : 30;
    const rulePenalty = Math.max(0, 100 - ruleValidation.score);
    const combinedScore = Math.max(0, baseScore - mathPenalty - (rulePenalty * 0.3));

    return {
      questionId,
      overallScore: Math.round(combinedScore),
      issues: [...ruleIssues, ...aiIssues, ...mathIssues],
      commonCoreAlignment: {
        standard: aiResult.commonCoreAlignment?.standard || '',
        alignmentScore: Math.max(0, Math.min(100, aiResult.commonCoreAlignment?.alignmentScore || 0)),
        suggestions: aiResult.commonCoreAlignment?.suggestions || []
      },
      mathematicalValidation: mathValidation,
      summary: this.generateCombinedSummary(aiResult, mathValidation, ruleValidation)
    };
  }

  /**
   * Convert validation errors to enhanced question issues
   */
  private convertValidationErrorsToIssues(errors: ValidationError[]): QuestionIssue[] {
    return errors.map(error => ({
      id: error.id,
      type: error.type as 'error' | 'warning' | 'improvement',
      category: error.category as any,
      description: error.message,
      currentValue: error.field || 'Unknown field',
      suggestedFix: 'Manual correction required',
      explanation: `Rule-based validation: ${error.message}`,
      confidence: 0.9,
      severity: error.severity,
      automaticFix: error.automaticFix,
      validationMethod: error.validationMethod,
      productionImpact: error.productionImpact
    }));
  }

  /**
   * Generate comprehensive summary
   */
  private generateCombinedSummary(aiResult: any, mathValidation: MathematicalValidation, ruleValidation: any): string {
    const parts = [];
    
    if (mathValidation.sympyValidated) {
      parts.push('Mathematical accuracy verified');
    } else {
      parts.push('Mathematical errors detected');
    }

    if (mathValidation.gradeAppropriate) {
      parts.push('grade-appropriate content');
    } else {
      parts.push('grade-level issues found');
    }

    if (ruleValidation.isValid) {
      parts.push('passes all validation rules');
    } else {
      parts.push(`${ruleValidation.errors.length} rule violations found`);
    }

    const aiSummary = aiResult.summary || 'AI analysis completed';
    
    return `${parts.join(', ')}. ${aiSummary}`;
  }

  /**
   * Create fallback mathematical validation when SymPy fails
   */
  private createFallbackMathValidation(): MathematicalValidation {
    return {
      sympyValidated: false,
      computationalErrors: ['SymPy validation unavailable'],
      arithmeticConsistency: false,
      answerExplanationMatch: false,
      gradeAppropriate: false
    };
  }

  /**
   * Create fallback result when verification fails
   */
  private createFallbackResult(question: Question): VerificationResult {
    return {
      questionId: question.id,
      overallScore: 0,
      issues: [{
        id: 'fallback_error',
        type: 'error',
        category: 'clarity',
        description: 'Verification failed - manual review required',
        currentValue: 'Unknown',
        suggestedFix: 'Manual review required',
        explanation: 'Automated verification failed',
        confidence: 0,
        severity: 'major',
        automaticFix: false,
        validationMethod: 'hybrid',
        productionImpact: 'minor_clarity'
      }],
      commonCoreAlignment: {
        standard: question.standard || 'Unknown',
        alignmentScore: 0,
        suggestions: ['Verification failed - manual review required']
      },
      mathematicalValidation: this.createFallbackMathValidation(),
      summary: 'Verification failed - manual review recommended'
    };
  }

  /**
   * Identify common patterns across verification results
   */
  private identifyCommonPatterns(results: VerificationResult[]): string[] {
    const patterns: string[] = [];
    
    const mathErrors = results.filter(r => r.issues.some(i => i.category === 'mathematical_accuracy')).length;
    const gradeIssues = results.filter(r => r.issues.some(i => i.category === 'grade_appropriateness')).length;
    const clarityIssues = results.filter(r => r.issues.some(i => i.category === 'clarity')).length;
    
    if (mathErrors > 0) patterns.push(`${mathErrors} questions with mathematical errors`);
    if (gradeIssues > 0) patterns.push(`${gradeIssues} questions with grade-level issues`);
    if (clarityIssues > 0) patterns.push(`${clarityIssues} questions with clarity issues`);
    
    return patterns;
  }

  /**
   * Generate batch recommendations based on results
   */
  private generateBatchRecommendations(results: VerificationResult[]): string[] {
    const recommendations: string[] = [];
    
    const avgScore = results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;
    const criticalIssues = results.reduce((sum, r) => sum + r.issues.filter(i => i.severity === 'critical').length, 0);
    
    if (avgScore < 50) {
      recommendations.push("Consider comprehensive review - average quality below acceptable threshold");
    }
    
    if (criticalIssues > 0) {
      recommendations.push(`Address ${criticalIssues} critical issues that may block student grading`);
    }
    
    if (avgScore >= 80) {
      recommendations.push("Quality meets standards - consider for production use");
    }
    
    return recommendations;
  }
}

// Export singleton instance
export const aiVerifier = new AIQuestionVerifier();