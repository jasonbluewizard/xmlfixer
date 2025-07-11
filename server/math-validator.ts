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
    const pythonScript = `
import sympy as sp
import re
import json
import sys

def extract_numbers(text):
    """Extract all numbers from text"""
    return [float(match) for match in re.findall(r'\\d+(?:\\.\\d+)?', text)]

def extract_expressions(text):
    """Extract arithmetic expressions from text"""
    patterns = [
        r'(\\d+)\\s*\\+\\s*(\\d+)\\s*=\\s*(\\d+)',  # Addition
        r'(\\d+)\\s*-\\s*(\\d+)\\s*=\\s*(\\d+)',   # Subtraction
        r'(\\d+)\\s*\\*\\s*(\\d+)\\s*=\\s*(\\d+)',  # Multiplication
        r'(\\d+)\\s*/\\s*(\\d+)\\s*=\\s*(\\d+)',   # Division
        r'(\\d+)\\s*×\\s*(\\d+)\\s*=\\s*(\\d+)',   # Multiplication (×)
        r'(\\d+)\\s*÷\\s*(\\d+)\\s*=\\s*(\\d+)',   # Division (÷)
    ]
    
    expressions = []
    for pattern in patterns:
        matches = re.findall(pattern, text)
        for match in matches:
            expressions.append({
                'operand1': float(match[0]),
                'operand2': float(match[1]),
                'result': float(match[2]),
                'operation': pattern
            })
    
    return expressions

def validate_arithmetic_expressions(text):
    """Validate arithmetic expressions using SymPy"""
    errors = []
    expressions = extract_expressions(text)
    
    for expr in expressions:
        op1, op2, result = expr['operand1'], expr['operand2'], expr['result']
        operation = expr['operation']
        
        try:
            if '+' in operation:
                expected = op1 + op2
            elif '-' in operation:
                expected = op1 - op2
            elif '*' in operation or '×' in operation:
                expected = op1 * op2
            elif '/' in operation or '÷' in operation:
                if op2 != 0:
                    expected = op1 / op2
                else:
                    errors.append(f"Division by zero: {op1} ÷ {op2}")
                    continue
            else:
                continue
            
            if abs(expected - result) > 0.001:  # Allow for small floating point errors
                errors.append(f"Arithmetic error: {op1} {operation.split()[1] if len(operation.split()) > 1 else '+'} {op2} = {result}, but should be {expected}")
        
        except Exception as e:
            errors.append(f"Evaluation error: {str(e)}")
    
    return errors

def main():
    question_data = json.loads(sys.argv[1])
    
    all_text = f"{question_data['questionText']} {question_data['explanation']} {' '.join(question_data['choices'])}"
    
    errors = validate_arithmetic_expressions(all_text)
    
    result = {
        'isValid': len(errors) == 0,
        'errors': errors
    }
    
    print(json.dumps(result))

if __name__ == "__main__":
    main()
`;

    const tempFile = path.join(tmpdir(), `sympy_validation_${Date.now()}.py`);
    
    try {
      writeFileSync(tempFile, pythonScript);
      
      const questionData = JSON.stringify({
        questionText: question.questionText,
        explanation: question.explanation,
        choices: question.choices
      });

      const output = execSync(`${this.pythonPath} "${tempFile}" '${questionData}'`, { 
        encoding: 'utf8',
        timeout: 10000 
      });

      return JSON.parse(output.trim());
    } catch (error) {
      console.error('SymPy validation error:', error);
      return { isValid: false, errors: [`SymPy execution failed: ${error.message}`] };
    } finally {
      try {
        unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
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