import { useEffect, useRef, useCallback } from "react";
import { useUpdateQuestion } from "./use-questions";
import { type UpdateQuestion } from "@shared/schema";

export function useAutoSave(
  questionId: number | null,
  data: UpdateQuestion,
  delay: number = 2000
) {
  const updateQuestion = useUpdateQuestion();
  const timeoutRef = useRef<NodeJS.Timeout>();
  const lastSavedRef = useRef<string>("");
  
  const saveData = useCallback(() => {
    if (!questionId || !data) return;
    
    const currentData = JSON.stringify(data);
    if (currentData === lastSavedRef.current) return;
    
    updateQuestion.mutate({ id: questionId, question: data });
    lastSavedRef.current = currentData;
  }, [questionId, data, updateQuestion]);
  
  const debouncedSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(saveData, delay);
  }, [saveData, delay]);
  
  useEffect(() => {
    debouncedSave();
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [debouncedSave]);
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return {
    isSaving: updateQuestion.isPending,
    isError: updateQuestion.isError,
    error: updateQuestion.error,
  };
}
