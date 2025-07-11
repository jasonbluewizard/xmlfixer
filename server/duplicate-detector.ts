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
    const normalize = (text: any) => {
      try {
        if (text === null || text === undefined) return "";
        if (typeof text === 'string') {
          return ignoreWhitespace ? text.replace(/\s+/g, ' ').trim().toLowerCase() : text;
        }
        if (typeof text === 'number' || typeof text === 'boolean') {
          const str = String(text);
          return ignoreWhitespace ? str.replace(/\s+/g, ' ').trim().toLowerCase() : str;
        }
        if (typeof text === 'object') {
          const str = JSON.stringify(text);
          return ignoreWhitespace ? str.replace(/\s+/g, ' ').trim().toLowerCase() : str;
        }
        const str = String(text);
        return ignoreWhitespace ? str.replace(/\s+/g, ' ').trim().toLowerCase() : str;
      } catch (error) {
        console.error('Error normalizing text:', text, 'type:', typeof text, 'error:', error);
        return "";
      }
    };

    const safeChoicesCompare = (choices1: any[], choices2: any[]) => {
      const norm1 = choices1.map(c => normalize(c));
      const norm2 = choices2.map(c => normalize(c));
      return JSON.stringify(norm1) === JSON.stringify(norm2);
    };

    return (
      normalize(q1.questionText) === normalize(q2.questionText) &&
      normalize(q1.correctAnswer) === normalize(q2.correctAnswer) &&
      normalize(q1.explanation) === normalize(q2.explanation) &&
      safeChoicesCompare(q1.choices || [], q2.choices || [])
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
   * Calculate text similarity using improved algorithm that reduces false positives
   */
  private textSimilarity(text1: any, text2: any): number {
    const normalize = (text: any) => String(text || "").toLowerCase().replace(/\s+/g, ' ').trim();
    
    const norm1 = normalize(text1);
    const norm2 = normalize(text2);
    
    if (norm1 === norm2) return 1.0;
    if (norm1.length === 0 || norm2.length === 0) return 0;

    // Check for mathematical content patterns that should be treated as distinct
    const mathPatterns = [
      /\d+[\+\-\*\/]\d+/g,        // Simple arithmetic like 3+2, 5-4, etc.
      /\d+\.\d+/g,                // Decimal numbers
      /\d+\/\d+/g,                // Fractions
      /\$\d+/g,                   // Currency
      /\d+\s*(cups?|liters?|meters?|feet|inches?|pounds?|ounces?|gallons?|milliliters?)/gi // Units
    ];

    // Extract mathematical expressions from both texts
    const extractMathContent = (text: string) => {
      const matches = [];
      for (const pattern of mathPatterns) {
        const found = text.match(pattern);
        if (found) matches.push(...found);
      }
      return matches;
    };

    const math1 = extractMathContent(norm1);
    const math2 = extractMathContent(norm2);

    // If both contain mathematical expressions, compare them specifically
    if (math1.length > 0 && math2.length > 0) {
      const mathSimilarity = this.calculateMathSimilarity(math1, math2);
      if (mathSimilarity < 0.8) {
        // If mathematical content is significantly different, reduce overall similarity
        return mathSimilarity * 0.7;
      }
    }

    // Use Jaccard similarity for better text comparison
    const words1 = norm1.split(/\s+/);
    const words2 = norm2.split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    const jaccardSimilarity = intersection.size / union.size;
    
    // Combine with length-based similarity for better accuracy
    const lengthSimilarity = Math.min(norm1.length, norm2.length) / Math.max(norm1.length, norm2.length);
    
    return (jaccardSimilarity * 0.7) + (lengthSimilarity * 0.3);
  }

  /**
   * Calculate similarity between mathematical expressions
   */
  private calculateMathSimilarity(math1: string[], math2: string[]): number {
    if (math1.length !== math2.length) return 0;
    
    let exactMatches = 0;
    for (let i = 0; i < math1.length; i++) {
      if (math1[i] === math2[i]) {
        exactMatches++;
      }
    }
    
    return exactMatches / math1.length;
  }

  /**
   * Calculate similarity between two arrays of text
   */
  private arrayTextSimilarity(arr1: any[], arr2: any[]): number {
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