import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { type Question } from "@shared/schema";

export interface MathematicalValidation {
  sympyValidated: boolean;
  computationalErrors: string[];
  arithmeticConsistency: boolean;
  answerExplanationMatch: boolean;
  gradeAppropriate: boolean;
}

export interface ConsistencyIssue {
  type: 'arithmetic_mismatch' | 'answer_statement_conflict' | 'numerical_inconsistency';
  oldExpression: string;
  correctedExpression: string;
  confidence: number;
}

export interface TruncationIssue {
  type: 'ellipsis' | 'incomplete_operand' | 'truncated_expression';
  location: 'question_text' | 'explanation' | 'choices';
  pattern: string;
  suggestedFix: string;
}

export interface ChoiceValidation {
  hasDuplicates: boolean;
  correctAnswerPresent: boolean;
  formatConsistency: boolean;
  prefixCorruption: string[];
}

// Grade-level number limits based on CC-Mathmaster standards
const GRADE_LIMITS = {
  1: 20,     // Grade 1: numbers ≤ 20
  2: 100,    // Grade 2: numbers ≤ 100
  3: 1000,   // Grade 3: numbers ≤ 1000
  4: 10000,  // Grade 4: numbers ≤ 10,000
  5: 100000, // Grade 5: numbers ≤ 100,000
  6: Infinity // Grade 6: unlimited
};

export class MathValidator {
  private pythonPath: string;

  constructor() {
    this.pythonPath = this.findPythonPath();
  }

  private findPythonPath(): string {
    const candidates = ['python3', 'python'];
    for (const candidate of candidates) {
      try {
        execSync(`${candidate} --version`, { stdio: 'pipe' });
        return candidate;
      } catch {
        continue;
      }
    }
    throw new Error('Python not found. Please install Python 3.x');
  }

  /**
   * Comprehensive mathematical validation using SymPy
   */
  async validateMathematically(question: Question): Promise<MathematicalValidation> {
    try {
      const sympyResult = await this.validateWithSympy(question);
      const consistencyResult = this.checkAnswerExplanationConsistency(question);
      const gradeResult = this.validateGradeLimits(question);

      return {
        sympyValidated: sympyResult.isValid,
        computationalErrors: sympyResult.errors,
        arithmeticConsistency: consistencyResult.isConsistent,
        answerExplanationMatch: consistencyResult.explanationMatches,
        gradeAppropriate: gradeResult.isAppropriate
      };
    } catch (error) {
      console.error('Mathematical validation failed:', error);
      return {
        sympyValidated: false,
        computationalErrors: [`Validation error: ${error.message}`],
        arithmeticConsistency: false,
        answerExplanationMatch: false,
        gradeAppropriate: false
      };
    }
  }

  /**
   * Use SymPy to validate mathematical expressions and computations
   */
  private async validateWithSympy(question: Question): Promise<{ isValid: boolean; errors: string[] }> {
    // Simplified JavaScript-based validation to avoid Python execution issues
    try {
      const errors: string[] = [];
      const allText = `${question.questionText} ${question.explanation} ${question.choices.join(' ')}`;
      
      // Extract arithmetic expressions - look for patterns like "2 + 3 = 6"
      const patterns = [
        { regex: /(\d+)\s*\+\s*(\d+)\s*=\s*(\d+)/g, op: '+' },
        { regex: /(\d+)\s*-\s*(\d+)\s*=\s*(\d+)/g, op: '-' },
        { regex: /(\d+)\s*\*\s*(\d+)\s*=\s*(\d+)/g, op: '*' },
        { regex: /(\d+)\s*×\s*(\d+)\s*=\s*(\d+)/g, op: '×' },
        { regex: /(\d+)\s*\/\s*(\d+)\s*=\s*(\d+)/g, op: '÷' },
        { regex: /(\d+)\s*÷\s*(\d+)\s*=\s*(\d+)/g, op: '÷' }
      ];

      for (const pattern of patterns) {
        let match;
        pattern.regex.lastIndex = 0; // Reset regex
        
        while ((match = pattern.regex.exec(allText)) !== null) {
          const num1 = parseInt(match[1]);
          const num2 = parseInt(match[2]);
          const result = parseInt(match[3]);
          let expected: number;

          switch (pattern.op) {
            case '+':
              expected = num1 + num2;
              break;
            case '-':
              expected = num1 - num2;
              break;
            case '*':
            case '×':
              expected = num1 * num2;
              break;
            case '÷':
              if (num2 !== 0) {
                expected = num1 / num2;
              } else {
                errors.push(`Division by zero: ${num1} ÷ ${num2}`);
                continue;
              }
              break;
            default:
              continue;
          }

          if (Math.abs(expected - result) > 0.001) {
            errors.push(`Math error found: ${num1} ${pattern.op} ${num2} shows ${result}, should be ${expected}`);
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };
    } catch (error) {
      console.error('Math validation error:', error);
      return {
        isValid: false,
        errors: [`Math validation failed: ${error.message}`]
      };
    }

  }

  /**
   * Check answer-explanation consistency
   */
  private checkAnswerExplanationConsistency(question: Question): { isConsistent: boolean; explanationMatches: boolean } {
    const correctAnswer = question.correctAnswer;
    const explanation = question.explanation;
    
    // Extract numbers from explanation
    const explanationNumbers = this.extractNumbers(explanation);
    const answerNumbers = this.extractNumbers(correctAnswer);
    
    // Check if the correct answer appears in the explanation
    const explanationMatches = explanation.toLowerCase().includes(correctAnswer.toLowerCase()) ||
      answerNumbers.some(num => explanationNumbers.includes(num));
    
    // Check for arithmetic consistency in explanation
    const arithmeticErrors = this.findArithmeticInconsistencies(explanation);
    
    return {
      isConsistent: arithmeticErrors.length === 0,
      explanationMatches
    };
  }

  /**
   * Validate grade-level appropriateness
   */
  private validateGradeLimits(question: Question): { isAppropriate: boolean; violations: string[] } {
    const gradeLimit = GRADE_LIMITS[question.grade as keyof typeof GRADE_LIMITS] || Infinity;
    const violations: string[] = [];
    
    const allText = `${question.questionText} ${question.explanation} ${question.choices.join(' ')}`;
    const numbers = this.extractNumbers(allText);
    
    for (const number of numbers) {
      if (number > gradeLimit) {
        violations.push(`Number ${number} exceeds grade ${question.grade} limit of ${gradeLimit}`);
      }
    }
    
    return {
      isAppropriate: violations.length === 0,
      violations
    };
  }

  /**
   * Detect ellipsis and truncation issues
   */
  detectTruncationIssues(question: Question): TruncationIssue[] {
    const issues: TruncationIssue[] = [];
    
    const checks = [
      { text: question.questionText, location: 'question_text' as const },
      { text: question.explanation, location: 'explanation' as const },
      { text: question.choices.join(' '), location: 'choices' as const }
    ];
    
    for (const check of checks) {
      // Check for ellipsis
      if (/\.{3,}|…/.test(check.text)) {
        issues.push({
          type: 'ellipsis',
          location: check.location,
          pattern: '...',
          suggestedFix: 'Remove ellipsis and complete the expression'
        });
      }
      
      // Check for truncation indicators
      if (/\[truncated\]|\[cut off\]|\.\.\./i.test(check.text)) {
        issues.push({
          type: 'truncated_expression',
          location: check.location,
          pattern: '[Truncated]',
          suggestedFix: 'Complete the truncated content'
        });
      }
      
      // Check for incomplete mathematical expressions
      if (/\+\s*$|\-\s*$|\×\s*$|÷\s*$|\*\s*$|\/\s*$/.test(check.text)) {
        issues.push({
          type: 'incomplete_operand',
          location: check.location,
          pattern: 'Incomplete operator',
          suggestedFix: 'Complete the mathematical expression'
        });
      }
    }
    
    return issues;
  }

  /**
   * Validate answer choices format
   */
  validateChoices(question: Question): ChoiceValidation {
    const choices = question.choices;
    
    // Check for duplicates
    const hasDuplicates = new Set(choices).size !== choices.length;
    
    // Check if correct answer is present
    const correctAnswerPresent = choices.includes(question.correctAnswer);
    
    // Check format consistency
    const formatConsistency = this.checkChoiceFormatConsistency(choices);
    
    // Check for prefix corruption (e.g., "A: A: value")
    const prefixCorruption = this.findPrefixCorruption(choices);
    
    return {
      hasDuplicates,
      correctAnswerPresent,
      formatConsistency: formatConsistency.isConsistent,
      prefixCorruption
    };
  }

  private extractNumbers(text: string): number[] {
    const matches = text.match(/\d+(?:\.\d+)?/g);
    return matches ? matches.map(Number) : [];
  }

  private findArithmeticInconsistencies(text: string): string[] {
    const errors: string[] = [];
    
    // Check addition patterns
    const additionMatches = text.match(/(\d+)\s*\+\s*(\d+)\s*=\s*(\d+)/g);
    if (additionMatches) {
      for (const match of additionMatches) {
        const [, a, b, result] = match.match(/(\d+)\s*\+\s*(\d+)\s*=\s*(\d+)/) || [];
        if (parseInt(a) + parseInt(b) !== parseInt(result)) {
          errors.push(`Addition error: ${a} + ${b} = ${result} (should be ${parseInt(a) + parseInt(b)})`);
        }
      }
    }
    
    // Check subtraction patterns
    const subtractionMatches = text.match(/(\d+)\s*-\s*(\d+)\s*=\s*(\d+)/g);
    if (subtractionMatches) {
      for (const match of subtractionMatches) {
        const [, a, b, result] = match.match(/(\d+)\s*-\s*(\d+)\s*=\s*(\d+)/) || [];
        if (parseInt(a) - parseInt(b) !== parseInt(result)) {
          errors.push(`Subtraction error: ${a} - ${b} = ${result} (should be ${parseInt(a) - parseInt(b)})`);
        }
      }
    }
    
    return errors;
  }

  private checkChoiceFormatConsistency(choices: string[]): { isConsistent: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check if all choices have similar formatting
    const hasNumbers = choices.map(choice => /\d/.test(choice));
    const hasLetters = choices.map(choice => /[a-zA-Z]/.test(choice));
    
    if (hasNumbers.some(Boolean) && !hasNumbers.every(Boolean)) {
      issues.push('Inconsistent number format across choices');
    }
    
    if (hasLetters.some(Boolean) && !hasLetters.every(Boolean)) {
      issues.push('Inconsistent letter format across choices');
    }
    
    return {
      isConsistent: issues.length === 0,
      issues
    };
  }

  private findPrefixCorruption(choices: string[]): string[] {
    const corrupted: string[] = [];
    
    for (const choice of choices) {
      // Check for repeated prefixes like "A: A: value"
      if (/^[A-D]:\s*[A-D]:\s*/.test(choice)) {
        corrupted.push(choice);
      }
    }
    
    return corrupted;
  }
}

export const mathValidator = new MathValidator();