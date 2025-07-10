import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { type Question, type InsertQuestion, type UpdateQuestion } from "@shared/schema";
import { type QuestionFilters } from "@/types/question";
import { useToast } from "@/hooks/use-toast";

export function useQuestions(filters?: QuestionFilters) {
  const queryParams = new URLSearchParams();
  if (filters?.grade) queryParams.append('grade', filters.grade.toString());
  if (filters?.domain) queryParams.append('domain', filters.domain);
  if (filters?.status) queryParams.append('status', filters.status);
  if (filters?.search) queryParams.append('search', filters.search);
  
  const queryString = queryParams.toString();
  const queryKey = ['/api/questions', queryString].filter(Boolean);
  
  return useQuery<Question[]>({
    queryKey,
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/questions?${queryString}`);
      return response.json();
    },
  });
}

export function useQuestion(id: number) {
  return useQuery<Question>({
    queryKey: ['/api/questions', id],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/questions/${id}`);
      return response.json();
    },
    enabled: !!id,
  });
}

export function useCreateQuestion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (question: InsertQuestion) => {
      const response = await apiRequest('POST', '/api/questions', question);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
      toast({
        title: "Success",
        description: "Question created successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create question",
        variant: "destructive",
      });
    },
  });
}

export function useUpdateQuestion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async ({ id, question }: { id: number; question: UpdateQuestion }) => {
      const response = await apiRequest('PUT', `/api/questions/${id}`, question);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
      queryClient.setQueryData(['/api/questions', data.id], data);
      toast({
        title: "Success",
        description: "Question updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update question",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteQuestion() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/questions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
      toast({
        title: "Success",
        description: "Question deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete question",
        variant: "destructive",
      });
    },
  });
}

export function useUploadXml() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/xml/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
      toast({
        title: "Success",
        description: data.message,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to upload XML file",
        variant: "destructive",
      });
    },
  });
}

export function useBatchUpdateQuestions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (updates: { id: number; question: UpdateQuestion }[]) => {
      const response = await apiRequest('PUT', '/api/questions/batch', { updates });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/questions'] });
      toast({
        title: "Success",
        description: `Updated ${data.length} questions successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update questions",
        variant: "destructive",
      });
    },
  });
}
