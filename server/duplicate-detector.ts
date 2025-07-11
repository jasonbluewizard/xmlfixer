import { Question } from '../shared/schema';

export interface DuplicateGroup {
  id: string;
  questions: Question[];
  duplicateCount: number;
  similarityScore: number;
  matchType: 'exact' | 'similar' | 'content_match';
}

export interface DuplicateDetectionResult {
  duplicateGroups: DuplicateGroup[];
  totalDuplicates: number;
  uniqueQuestions: number;
  removedQuestions: Question[];
  keptQuestions: Question[];
}

export interface DuplicateDetectionOptions {
  exactMatch: boolean;
  contentSimilarity: boolean;
  ignoreWhitespace: boolean;
  similarityThreshold: number; // 0-1 scale
}

export class DuplicateDetector {
  private defaultOptions: DuplicateDetectionOptions = {
    exactMatch: true,
    contentSimilarity: true,
    ignoreWhitespace: true,
    similarityThreshold: 0.9
  };

  /**
   * Detect duplicate questions in a set of questions
   */
  async detectDuplicates(
    questions: Question[], 
    options: Partial<DuplicateDetectionOptions> = {}
  ): Promise<DuplicateDetectionResult> {
    const opts = { ...this.defaultOptions, ...options };
    const duplicateGroups: DuplicateGroup[] = [];
    const processedQuestions = new Set<number>();

    // Group questions by potential duplicates
    for (let i = 0; i < questions.length; i++) {
      if (processedQuestions.has(questions[i].id)) continue;

      const currentQuestion = questions[i];
      const duplicates: Question[] = [currentQuestion];
      
      // Find all questions that match the current one
      for (let j = i + 1; j < questions.length; j++) {
        if (processedQuestions.has(questions[j].id)) continue;

        const compareQuestion = questions[j];
        const similarity = this.calculateSimilarity(currentQuestion, compareQuestion, opts);

        if (similarity.isDuplicate) {
          duplicates.push(compareQuestion);
          processedQuestions.add(compareQuestion.id);
        }
      }

      // If we found duplicates, create a group
      if (duplicates.length > 1) {
        duplicateGroups.push({
          id: `duplicate_group_${i}`,
          questions: duplicates,
          duplicateCount: duplicates.length - 1,
          similarityScore: 1.0, // Will be calculated more precisely
          matchType: 'exact'
        });
      }

      processedQuestions.add(currentQuestion.id);
    }

    // Calculate statistics
    const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.duplicateCount, 0);
    const uniqueQuestions = questions.length - totalDuplicates;

    // Determine which questions to keep vs remove
    const keptQuestions: Question[] = [];
    const removedQuestions: Question[] = [];

    for (const group of duplicateGroups) {
      // Keep the first question in each group (usually the original)
      keptQuestions.push(group.questions[0]);
      // Mark the rest as removed
      removedQuestions.push(...group.questions.slice(1));
    }

    // Add non-duplicate questions to kept list
    for (const question of questions) {
      if (!removedQuestions.some(q => q.id === question.id) && 
          !keptQuestions.some(q => q.id === question.id)) {
        keptQuestions.push(question);
      }
    }

    return {
      duplicateGroups,
      totalDuplicates,
      uniqueQuestions,
      removedQuestions,
      keptQuestions
    };
  }

  /**
   * Calculate similarity between two questions
   */
  private calculateSimilarity(
    q1: Question, 
    q2: Question, 
    options: DuplicateDetectionOptions
  ): { isDuplicate: boolean; score: number; matchType: 'exact' | 'similar' | 'content_match' } {
    
    // Exact match check
    if (options.exactMatch) {
      if (this.isExactMatch(q1, q2, options.ignoreWhitespace)) {
        return { isDuplicate: true, score: 1.0, matchType: 'exact' };
      }
    }

    // Content similarity check
    if (options.contentSimilarity) {
      const contentScore = this.calculateContentSimilarity(q1, q2);
      if (contentScore >= options.similarityThreshold) {
        return { 
          isDuplicate: true, 
          score: contentScore, 
          matchType: contentScore === 1.0 ? 'exact' : 'similar'
        };
      }
    }

    return { isDuplicate: false, score: 0, matchType: 'exact' };
  }

  /**
   * Check if two questions are exactly the same
   */
  private isExactMatch(q1: Question, q2: Question, ignoreWhitespace: boolean): boolean {
    const normalize = (text: string) => {
      return ignoreWhitespace ? text.replace(/\s+/g, ' ').trim().toLowerCase() : text;
    };

    return (
      normalize(q1.questionText) === normalize(q2.questionText) &&
      normalize(q1.correctAnswer) === normalize(q2.correctAnswer) &&
      normalize(q1.explanation) === normalize(q2.explanation) &&
      JSON.stringify(q1.choices.map(normalize)) === JSON.stringify(q2.choices.map(normalize))
    );
  }

  /**
   * Calculate content similarity using simple text comparison
   */
  private calculateContentSimilarity(q1: Question, q2: Question): number {
    const scores = [
      this.textSimilarity(q1.questionText, q2.questionText),
      this.textSimilarity(q1.correctAnswer, q2.correctAnswer),
      this.textSimilarity(q1.explanation, q2.explanation),
      this.arrayTextSimilarity(q1.choices, q2.choices)
    ];

    // Weighted average - question text and choices are most important
    const weights = [0.4, 0.2, 0.2, 0.2];
    return scores.reduce((sum, score, i) => sum + score * weights[i], 0);
  }

  /**
   * Calculate text similarity using simple string comparison
   */
  private textSimilarity(text1: string, text2: string): number {
    const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
    
    const norm1 = normalize(text1);
    const norm2 = normalize(text2);
    
    if (norm1 === norm2) return 1.0;
    if (norm1.length === 0 || norm2.length === 0) return 0;

    // Simple similarity based on common characters
    const minLength = Math.min(norm1.length, norm2.length);
    const maxLength = Math.max(norm1.length, norm2.length);
    
    let commonChars = 0;
    for (let i = 0; i < minLength; i++) {
      if (norm1[i] === norm2[i]) {
        commonChars++;
      }
    }
    
    return commonChars / maxLength;
  }

  /**
   * Calculate similarity between two arrays of text
   */
  private arrayTextSimilarity(arr1: string[], arr2: string[]): number {
    if (arr1.length !== arr2.length) return 0;
    
    const similarities = arr1.map((text1, i) => 
      this.textSimilarity(text1, arr2[i])
    );
    
    return similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
  }

  /**
   * Remove duplicates from a question array, keeping the first occurrence
   */
  removeDuplicates(questions: Question[], options: Partial<DuplicateDetectionOptions> = {}): Question[] {
    const seen = new Set<string>();
    const unique: Question[] = [];

    for (const question of questions) {
      const key = this.generateQuestionKey(question, options.ignoreWhitespace ?? true);
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(question);
      }
    }

    return unique;
  }

  /**
   * Generate a unique key for a question to identify duplicates
   */
  private generateQuestionKey(question: Question, ignoreWhitespace: boolean): string {
    const normalize = (text: string) => {
      return ignoreWhitespace ? text.replace(/\s+/g, ' ').trim().toLowerCase() : text;
    };

    return [
      normalize(question.questionText),
      normalize(question.correctAnswer),
      normalize(question.explanation),
      question.choices.map(normalize).join('|')
    ].join('::');
  }
}

export const duplicateDetector = new DuplicateDetector();