#!/usr/bin/env python3
"""
Distractor Improver for XML Question Editor
Generates intelligent distractors based on common mathematical error patterns
"""

import xml.etree.ElementTree as ET
import re
import json
import sys
import random
import math
from collections import defaultdict

class DistractorImprover:
    def __init__(self):
        # Grade-level number constraints
        self.grade_limits = {1: 20, 2: 100, 3: 1000, 4: 10000, 5: 100000, 6: float('inf')}
        
    def extract_numbers(self, text):
        """Extract all numbers from text"""
        return [int(match) for match in re.findall(r'\b\d+\b', text)]

    def detect_operation_and_calculate(self, question_text, numbers):
        """Detect mathematical operation and calculate expected result"""
        text_lower = question_text.lower()
        
        if len(numbers) < 2:
            return None, "insufficient_numbers"
        
        # Addition detection
        if any(word in text_lower for word in ['add', 'adds', 'plus', 'total', 'together', 'sum', 'altogether', 'combined', 'more']):
            return sum(numbers), "addition"
        
        # Subtraction detection
        elif any(word in text_lower for word in ['subtract', 'minus', 'left', 'remaining', 'difference', 'fewer', 'less', 'need', 'needs']):
            if 'how many more' in text_lower or ('how many' in text_lower and 'need' in text_lower):
                return max(numbers) - min(numbers), "subtraction"
            else:
                return numbers[0] - numbers[1], "subtraction"
        
        # Multiplication detection
        elif any(word in text_lower for word in ['multiply', 'times', 'each', 'per', 'groups of', 'needed', 'total']):
            if 'per' in text_lower or 'each' in text_lower:
                return numbers[0] * numbers[1], "multiplication"
            else:
                return numbers[0] * numbers[1], "multiplication"
        
        # Division detection
        elif any(word in text_lower for word in ['divide', 'split', 'equally', 'share', 'groups', 'each group', 'evenly', 'among', 'brew', 'make']):
            if numbers[1] != 0:
                return numbers[0] // numbers[1], "division"
            else:
                return None, "division_by_zero"
        
        return None, "operation_unclear"

    def generate_smart_distractors(self, question_text, correct_answer, grade):
        """Generate intelligent distractors based on common error patterns"""
        try:
            numbers = self.extract_numbers(question_text)
            correct_nums = self.extract_numbers(correct_answer)
            
            if not correct_nums:
                return None
            
            correct = correct_nums[0]
            limit = self.grade_limits.get(grade, float('inf'))
            
            # Detect operation
            expected, operation = self.detect_operation_and_calculate(question_text, numbers)
            
            distractors = set()
            
            if len(numbers) >= 2:
                # Common error patterns based on operation
                if operation == "addition":
                    # Wrong operations
                    distractors.add(abs(numbers[0] - numbers[1]))  # Subtraction instead
                    if numbers[1] != 0:
                        distractors.add(numbers[0] * numbers[1])  # Multiplication
                        if numbers[0] >= numbers[1]:
                            distractors.add(numbers[0] // numbers[1])  # Division
                    # Off-by-one errors
                    distractors.add(correct + 1)
                    distractors.add(correct - 1)
                    # Using only one number
                    distractors.add(numbers[0])
                    distractors.add(numbers[1])
                
                elif operation == "subtraction":
                    # Wrong operations
                    distractors.add(numbers[0] + numbers[1])  # Addition instead
                    if numbers[1] != 0:
                        distractors.add(numbers[0] * numbers[1])  # Multiplication
                        if numbers[0] >= numbers[1]:
                            distractors.add(numbers[0] // numbers[1])  # Division
                    # Common errors
                    distractors.add(numbers[1] - numbers[0])  # Reversed subtraction
                    distractors.add(correct + 1)
                    distractors.add(correct - 1)
                
                elif operation == "multiplication":
                    # Wrong operations
                    distractors.add(numbers[0] + numbers[1])  # Addition instead
                    distractors.add(abs(numbers[0] - numbers[1]))  # Subtraction
                    if numbers[1] != 0:
                        distractors.add(numbers[0] // numbers[1])  # Division
                    # Common errors
                    distractors.add(correct + numbers[0])  # Added instead of multiplied
                    distractors.add(correct - numbers[0])  # Partial error
                    distractors.add(numbers[0])  # Forgot to multiply
                
                elif operation == "division":
                    # Wrong operations
                    distractors.add(numbers[0] + numbers[1])  # Addition instead
                    distractors.add(abs(numbers[0] - numbers[1]))  # Subtraction
                    distractors.add(numbers[0] * numbers[1])  # Multiplication
                    # Common division errors
                    distractors.add(numbers[0])  # Forgot to divide
                    distractors.add(numbers[1])  # Used divisor as answer
                    distractors.add(correct + 1)  # Off by one
                
                # General error patterns
                distractors.add(correct + 2)
                distractors.add(correct - 2)
                distractors.add(correct * 2)
                if correct > 2:
                    distractors.add(correct // 2)
            
            # Remove invalid options
            distractors.discard(correct)
            distractors = {d for d in distractors if d > 0 and d <= limit}
            
            # Ensure we have enough distractors
            while len(distractors) < 3:
                # Add reasonable nearby numbers
                offset = random.choice([-5, -3, -2, 2, 3, 5, 7])
                candidate = correct + offset
                if candidate > 0 and candidate != correct and candidate <= limit:
                    distractors.add(candidate)
            
            # Select best 3 distractors (prefer pedagogically meaningful ones)
            distractor_list = list(distractors)
            
            # Prioritize distractors that are results of wrong operations
            if len(numbers) >= 2:
                priority_distractors = []
                for d in distractor_list:
                    if d in [numbers[0] + numbers[1], abs(numbers[0] - numbers[1]), 
                            numbers[0] * numbers[1] if numbers[1] != 0 else None,
                            numbers[0] // numbers[1] if numbers[1] != 0 and numbers[0] >= numbers[1] else None]:
                        priority_distractors.append(d)
                
                # Use priority distractors first, then fill with others
                final_distractors = priority_distractors[:3]
                remaining_needed = 3 - len(final_distractors)
                if remaining_needed > 0:
                    other_distractors = [d for d in distractor_list if d not in priority_distractors]
                    final_distractors.extend(other_distractors[:remaining_needed])
            else:
                final_distractors = distractor_list[:3]
            
            # Get unit from correct answer if present
            unit = ""
            for word in correct_answer.split():
                if not word.isdigit() and word not in ['crystal', 'vials', 'phoenix', 'healing', 'the', 'a', 'an', 'is', 'are']:
                    if len(word) > 2:  # Avoid short words like 'of', 'in'
                        unit = " " + word.lower()
                        break
            
            # Create choices with units
            choices = []
            for d in final_distractors:
                choices.append(f"{d}{unit}")
            
            return choices
            
        except Exception as e:
            return None

    def improve_question_distractors(self, question_data):
        """Improve distractors for a single question"""
        try:
            question_text = question_data.get('questionText', '')
            correct_answer = question_data.get('correctAnswer', '')
            grade = question_data.get('grade', 1)
            current_choices = question_data.get('choices', [])
            
            # Generate new distractors
            new_distractors = self.generate_smart_distractors(question_text, correct_answer, grade)
            
            if new_distractors:
                # Combine correct answer with new distractors
                all_choices = [correct_answer] + new_distractors
                random.shuffle(all_choices)
                
                # Find which position the correct answer ended up in
                correct_index = all_choices.index(correct_answer)
                answer_key = chr(65 + correct_index)  # A, B, C, D
                
                return {
                    'success': True,
                    'choices': all_choices,
                    'answerKey': answer_key,
                    'message': 'Generated improved distractors based on mathematical error patterns'
                }
            else:
                return {
                    'success': False,
                    'choices': current_choices,
                    'answerKey': question_data.get('answerKey', 'A'),
                    'message': 'Could not generate improved distractors - keeping original choices'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': f'Error improving distractors: {str(e)}'
            }

def main():
    """Main function to process question data from stdin"""
    try:
        # Read input from stdin
        input_data = sys.stdin.read().strip()
        if not input_data:
            raise ValueError("No input data received")
        
        # Debug logging
        import sys
        print(f"Received input: {input_data}", file=sys.stderr)
        
        question_data = json.loads(input_data)
        
        # Create improver and process
        improver = DistractorImprover()
        result = improver.improve_question_distractors(question_data)
        
        # Output result as JSON
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': str(e),
            'message': f'Failed to process question: {str(e)}'
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    main()