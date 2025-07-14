import { type Question } from "@shared/schema";
import { mathValidator, type MathematicalValidation, type TruncationIssue, type ChoiceValidation } from "./math-validator";

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  score: number; // 0-100
}

export interface ValidationError {
  id: string;
  type: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  field?: string;
  severity: 'critical' | 'major' | 'minor';
  automaticFix: boolean;
  validationMethod: 'ai' | 'sympy' | 'regex' | 'hybrid';
  productionImpact: 'blocks_grading' | 'confuses_students' | 'minor_clarity';
}

export interface ValidationRule {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  severity: 'error' | 'warning' | 'info';
  validate: (question: Question) => Promise<ValidationResult> | ValidationResult;
}

export class ValidationRuleEngine {
  private rules: ValidationRule[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    this.rules = [
      {
        id: 'sympy_arithmetic',
        name: 'Mathematical Accuracy (SymPy)',
        category: 'mathematical_accuracy',
        enabled: true,
        severity: 'error',
        validate: async (question) => this.validateSymPyArithmetic(question)
      },
      {
        id: 'grade_limits',
        name: 'Grade-Level Number Limits',
        category: 'grade_appropriateness',
        enabled: true,
        severity: 'error',
        validate: (question) => this.validateGradeLimits(question)
      },
      {
        id: 'answer_explanation_consistency',
        name: 'Answer-Explanation Consistency',
        category: 'mathematical_accuracy',
        enabled: true,
        severity: 'warning',
        validate: (question) => this.validateAnswerExplanationConsistency(question)
      },
      {
        id: 'truncation_detection',
        name: 'Ellipsis and Truncation Detection',
        category: 'clarity',
        enabled: true,
        severity: 'warning',
        validate: (question) => this.validateTruncation(question)
      },
      {
        id: 'choice_format',
        name: 'Choice Format Validation',
        category: 'accessibility',
        enabled: true,
        severity: 'error',
        validate: (question) => this.validateChoiceFormat(question)
      },
      {
        id: 'duplicate_choices',
        name: 'Duplicate Choice Detection',
        category: 'accessibility',
        enabled: true,
        severity: 'error',
        validate: (question) => this.validateDuplicateChoices(question)
      },
      {
        id: 'correct_answer_present',
        name: 'Correct Answer in Choices',
        category: 'mathematical_accuracy',
        enabled: true,
        severity: 'error',
        validate: (question) => this.validateCorrectAnswerPresent(question)
      },
      {
        id: 'prefix_corruption',
        name: 'Choice Prefix Corruption',
        category: 'accessibility',
        enabled: true,
        severity: 'warning',
        validate: (question) => this.validatePrefixCorruption(question)
      }
    ];
  }

  async validateQuestion(question: Question): Promise<ValidationResult> {
    const results: ValidationResult[] = [];
    let totalScore = 100;

    for (const rule of this.rules.filter(r => r.enabled)) {
      try {
        const result = await rule.validate(question);
        results.push(result);
        
        // Reduce score based on errors and warnings
        const errorPenalty = result.errors.filter(e => e.type === 'error').length * 20;
        const warningPenalty = result.warnings.filter(w => w.type === 'warning').length * 10;
        totalScore -= errorPenalty + warningPenalty;
      } catch (error) {
        console.error(`Rule ${rule.id} failed:`, error);
        const message = error instanceof Error ? error.message : String(error);
        results.push({
          isValid: false,
          errors: [{
            id: `${rule.id}_failure`,
            type: 'error',
            category: rule.category,
            message: `Validation rule failed: ${message}`,
            severity: 'minor',
            automaticFix: false,
            validationMethod: 'regex',
            productionImpact: 'minor_clarity'
          }],
          warnings: [],
          score: 0
        });
        totalScore -= 5; // Small penalty for rule failure
      }
    }

    // Combine all results
    const allErrors = results.flatMap(r => r.errors);
    const allWarnings = results.flatMap(r => r.warnings);
    const isValid = allErrors.filter(e => e.type === 'error').length === 0;

    return {
      isValid,
      errors: allErrors,
      warnings: allWarnings,
      score: Math.max(0, Math.min(100, totalScore))
    };
  }

  private async validateSymPyArithmetic(question: Question): Promise<ValidationResult> {
    try {
      const mathValidation = await mathValidator.validateMathematically(question);
      const errors: ValidationError[] = [];

      if (!mathValidation.sympyValidated) {
        mathValidation.computationalErrors.forEach((error, index) => {
          errors.push({
            id: `sympy_error_${index}`,
            type: 'error',
            category: 'mathematical_accuracy',
            message: error,
            severity: 'critical',
            automaticFix: false,
            validationMethod: 'sympy',
            productionImpact: 'blocks_grading'
          });
        });
      }

      if (!mathValidation.arithmeticConsistency) {
        errors.push({
          id: 'arithmetic_inconsistency',
          type: 'error',
          category: 'mathematical_accuracy',
          message: 'Arithmetic expressions contain computational errors',
          severity: 'critical',
          automaticFix: false,
          validationMethod: 'sympy',
          productionImpact: 'blocks_grading'
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings: [],
        score: errors.length === 0 ? 100 : 50
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        isValid: false,
        errors: [{
          id: 'sympy_validation_failed',
          type: 'error',
          category: 'mathematical_accuracy',
          message: `SymPy validation failed: ${message}`,
          severity: 'major',
          automaticFix: false,
          validationMethod: 'sympy',
          productionImpact: 'minor_clarity'
        }],
        warnings: [],
        score: 70
      };
    }
  }

  private validateGradeLimits(question: Question): ValidationResult {
    const gradeLimits = { 1: 20, 2: 100, 3: 1000, 4: 10000, 5: 100000, 6: Infinity };
    const limit = gradeLimits[question.grade as keyof typeof gradeLimits] || Infinity;
    
    const allText = `${question.questionText} ${question.explanation} ${question.choices.join(' ')}`;
    const numbers = allText.match(/\d+/g)?.map(Number) || [];
    
    const violations = numbers.filter(num => num > limit);
    const errors: ValidationError[] = violations.map((num, index) => ({
      id: `grade_limit_violation_${index}`,
      type: 'error',
      category: 'grade_appropriateness',
      message: `Number ${num} exceeds grade ${question.grade} limit of ${limit}`,
      severity: 'major',
      automaticFix: false,
      validationMethod: 'regex',
      productionImpact: 'confuses_students'
    }));

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      score: errors.length === 0 ? 100 : Math.max(50, 100 - violations.length * 25)
    };
  }

  private validateAnswerExplanationConsistency(question: Question): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Check if correct answer appears in explanation
    if (!question.explanation.toLowerCase().includes(question.correctAnswer.toLowerCase())) {
      warnings.push({
        id: 'answer_not_in_explanation',
        type: 'warning',
        category: 'mathematical_accuracy',
        message: 'Correct answer not clearly referenced in explanation',
        severity: 'minor',
        automaticFix: false,
        validationMethod: 'regex',
        productionImpact: 'confuses_students'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: warnings.length === 0 ? 100 : 85
    };
  }

  private validateTruncation(question: Question): ValidationResult {
    const truncationIssues = mathValidator.detectTruncationIssues(question);
    const warnings: ValidationError[] = truncationIssues.map((issue, index) => ({
      id: `truncation_${index}`,
      type: 'warning',
      category: 'clarity',
      message: `${issue.type} detected in ${issue.location}: ${issue.suggestedFix}`,
      field: issue.location,
      severity: 'minor',
      automaticFix: false,
      validationMethod: 'regex',
      productionImpact: 'confuses_students'
    }));

    return {
      isValid: true,
      errors: [],
      warnings,
      score: warnings.length === 0 ? 100 : Math.max(80, 100 - warnings.length * 10)
    };
  }

  private validateChoiceFormat(question: Question): ValidationResult {
    const choiceValidation = mathValidator.validateChoices(question);
    const errors: ValidationError[] = [];

    if (!choiceValidation.formatConsistency) {
      errors.push({
        id: 'choice_format_inconsistent',
        type: 'error',
        category: 'accessibility',
        message: 'Answer choices have inconsistent formatting',
        field: 'choices',
        severity: 'major',
        automaticFix: false,
        validationMethod: 'regex',
        productionImpact: 'confuses_students'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      score: errors.length === 0 ? 100 : 70
    };
  }

  private validateDuplicateChoices(question: Question): ValidationResult {
    const choiceValidation = mathValidator.validateChoices(question);
    const errors: ValidationError[] = [];

    if (choiceValidation.hasDuplicates) {
      errors.push({
        id: 'duplicate_choices',
        type: 'error',
        category: 'accessibility',
        message: 'Answer choices contain duplicates',
        field: 'choices',
        severity: 'critical',
        automaticFix: false,
        validationMethod: 'regex',
        productionImpact: 'blocks_grading'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      score: errors.length === 0 ? 100 : 30
    };
  }

  private validateCorrectAnswerPresent(question: Question): ValidationResult {
    const choiceValidation = mathValidator.validateChoices(question);
    const errors: ValidationError[] = [];

    if (!choiceValidation.correctAnswerPresent) {
      errors.push({
        id: 'correct_answer_missing',
        type: 'error',
        category: 'mathematical_accuracy',
        message: 'Correct answer not found in answer choices',
        field: 'correctAnswer',
        severity: 'critical',
        automaticFix: false,
        validationMethod: 'regex',
        productionImpact: 'blocks_grading'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: [],
      score: errors.length === 0 ? 100 : 0
    };
  }

  private validatePrefixCorruption(question: Question): ValidationResult {
    const choiceValidation = mathValidator.validateChoices(question);
    const warnings: ValidationError[] = choiceValidation.prefixCorruption.map((choice, index) => ({
      id: `prefix_corruption_${index}`,
      type: 'warning',
      category: 'accessibility',
      message: `Choice has corrupted prefix: ${choice}`,
      field: 'choices',
      severity: 'minor',
      automaticFix: true,
      validationMethod: 'regex',
      productionImpact: 'minor_clarity'
    }));

    return {
      isValid: true,
      errors: [],
      warnings,
      score: warnings.length === 0 ? 100 : 90
    };
  }

  enableRule(ruleId: string): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = true;
    }
  }

  disableRule(ruleId: string): void {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = false;
    }
  }

  getRules(): ValidationRule[] {
    return [...this.rules];
  }
}

export const validationEngine = new ValidationRuleEngine();