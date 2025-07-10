export interface ValidationError {
  type: 'error' | 'warning';
  message: string;
  field?: string;
}

export interface QuestionFilters {
  grade?: number;
  domain?: string;
  status?: string;
  search?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export const DOMAINS = [
  { value: 'OA', label: 'Operations & Algebraic Thinking' },
  { value: 'NBT', label: 'Number & Operations in Base Ten' },
  { value: 'NF', label: 'Number & Operations - Fractions' },
  { value: 'MD', label: 'Measurement & Data' },
  { value: 'G', label: 'Geometry' },
  { value: 'SP', label: 'Statistics & Probability' },
] as const;

export const GRADES = [1, 2, 3, 4, 5, 6] as const;

export const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'completed', label: 'Completed' },
  { value: 'review', label: 'Needs Review' },
  { value: 'draft', label: 'Draft' },
] as const;

export const ANSWER_KEYS = ['A', 'B', 'C', 'D'] as const;
