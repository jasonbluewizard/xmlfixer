import { type ValidationResult, type ValidationError } from "../types/question";
import { type Question } from "@shared/schema";

export function validateQuestion(question: Question): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Mathematical accuracy check
  if (question.questionText.includes("=")) {
    const mathErrors = checkMathematicalAccuracy(question.questionText);
    errors.push(...mathErrors);
  }

  // Grade-appropriate number range validation
  const numberRangeErrors = validateNumberRange(question);
  errors.push(...numberRangeErrors);

  // Answer-explanation consistency
  const consistencyErrors = validateAnswerExplanationConsistency(question);
  errors.push(...consistencyErrors);

  // Duplicate choice detection
  const duplicateChoices = findDuplicateChoices(question.choices);
  if (duplicateChoices.length > 0) {
    warnings.push({
      type: 'warning',
      message: `Duplicate choices found: ${duplicateChoices.join(', ')}`,
      field: 'choices',
    });
  }

  // Theme consistency check
  const themeErrors = validateThemeConsistency(question);
  warnings.push(...themeErrors);

  // Question length validation
  if (question.questionText.length > 500) {
    warnings.push({
      type: 'warning',
      message: 'Question text exceeds recommended length (500 characters)',
      field: 'questionText',
    });
  }

  // Explanation length validation
  if (question.explanation.length > 1000) {
    warnings.push({
      type: 'warning',
      message: 'Explanation exceeds recommended length (1000 characters)',
      field: 'explanation',
    });
  }

  // Required fields validation
  if (!question.questionText.trim()) {
    errors.push({
      type: 'error',
      message: 'Question text is required',
      field: 'questionText',
    });
  }

  if (!question.correctAnswer.trim()) {
    errors.push({
      type: 'error',
      message: 'Correct answer is required',
      field: 'correctAnswer',
    });
  }

  if (!question.explanation.trim()) {
    errors.push({
      type: 'error',
      message: 'Explanation is required',
      field: 'explanation',
    });
  }

  if (question.choices.length < 2) {
    errors.push({
      type: 'error',
      message: 'At least 2 answer choices are required',
      field: 'choices',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function checkMathematicalAccuracy(text: string): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Simple regex to find basic arithmetic expressions
  const mathExpressions = text.match(/\d+\s*[+\-*\/]\s*\d+\s*=\s*\d+/g);
  
  if (mathExpressions) {
    mathExpressions.forEach(expr => {
      const [left, right] = expr.split('=');
      try {
        const calculated = eval(left.trim());
        const stated = parseInt(right.trim());
        
        if (calculated !== stated) {
          errors.push({
            type: 'error',
            message: `Mathematical error: ${expr} (should be ${calculated})`,
            field: 'questionText',
          });
        }
      } catch (e) {
        // Skip complex expressions
      }
    });
  }
  
  return errors;
}

function validateNumberRange(question: Question): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Extract numbers from question text
  const numbers = question.questionText.match(/\d+/g);
  
  if (numbers) {
    const maxNumber = Math.max(...numbers.map(n => parseInt(n)));
    
    let expectedMax = 100; // Default
    switch (question.grade) {
      case 1:
        expectedMax = 20;
        break;
      case 2:
        expectedMax = 100;
        break;
      case 3:
        expectedMax = 1000;
        break;
      case 4:
        expectedMax = 10000;
        break;
      case 5:
      case 6:
        expectedMax = 100000;
        break;
    }
    
    if (maxNumber > expectedMax) {
      errors.push({
        type: 'error',
        message: `Number ${maxNumber} exceeds grade-appropriate range (max: ${expectedMax})`,
        field: 'questionText',
      });
    }
  }
  
  return errors;
}

function validateAnswerExplanationConsistency(question: Question): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Check if correct answer appears in explanation
  const correctAnswer = question.correctAnswer.toLowerCase();
  const explanation = question.explanation.toLowerCase();
  
  if (!explanation.includes(correctAnswer)) {
    errors.push({
      type: 'error',
      message: 'Correct answer not found in explanation',
      field: 'explanation',
    });
  }
  
  return errors;
}

function findDuplicateChoices(choices: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  
  choices.forEach(choice => {
    const normalized = choice.toLowerCase().trim();
    if (seen.has(normalized)) {
      duplicates.add(choice);
    } else {
      seen.add(normalized);
    }
  });
  
  return Array.from(duplicates);
}

function validateThemeConsistency(question: Question): ValidationError[] {
  const warnings: ValidationError[] = [];
  
  const theme = question.theme.toLowerCase();
  const questionText = question.questionText.toLowerCase();
  
  // Check for generic terms in specific themes
  const genericTerms = ['thing', 'item', 'object', 'stuff'];
  
  if (theme && theme !== 'generic') {
    genericTerms.forEach(term => {
      if (questionText.includes(term)) {
        warnings.push({
          type: 'warning',
          message: `Generic term "${term}" found in ${theme} themed question`,
          field: 'questionText',
        });
      }
    });
  }
  
  return warnings;
}

export function validateBatch(questions: Question[]): {
  totalQuestions: number;
  validQuestions: number;
  questionsWithErrors: number;
  questionsWithWarnings: number;
  errors: ValidationError[];
  warnings: ValidationError[];
} {
  let validQuestions = 0;
  let questionsWithErrors = 0;
  let questionsWithWarnings = 0;
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];
  
  questions.forEach((question, index) => {
    const result = validateQuestion(question);
    
    if (result.isValid) {
      validQuestions++;
    }
    
    if (result.errors.length > 0) {
      questionsWithErrors++;
      result.errors.forEach(error => {
        allErrors.push({
          ...error,
          message: `Question ${index + 1}: ${error.message}`,
        });
      });
    }
    
    if (result.warnings.length > 0) {
      questionsWithWarnings++;
      result.warnings.forEach(warning => {
        allWarnings.push({
          ...warning,
          message: `Question ${index + 1}: ${warning.message}`,
        });
      });
    }
  });
  
  return {
    totalQuestions: questions.length,
    validQuestions,
    questionsWithErrors,
    questionsWithWarnings,
    errors: allErrors,
    warnings: allWarnings,
  };
}
