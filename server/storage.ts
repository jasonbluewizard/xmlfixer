import { questions, xmlFiles, type Question, type InsertQuestion, type UpdateQuestion, type XmlFile, type InsertXmlFile } from "@shared/schema";

export interface IStorage {
  // Question operations
  getQuestions(filters?: { grade?: number; domain?: string; status?: string; search?: string }): Promise<Question[]>;
  getQuestion(id: number): Promise<Question | undefined>;
  getQuestionByXmlId(xmlId: string): Promise<Question | undefined>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, question: UpdateQuestion): Promise<Question | undefined>;
  deleteQuestion(id: number): Promise<boolean>;
  
  // XML file operations
  getXmlFiles(): Promise<XmlFile[]>;
  getXmlFile(id: number): Promise<XmlFile | undefined>;
  createXmlFile(xmlFile: InsertXmlFile): Promise<XmlFile>;
  deleteXmlFile(id: number): Promise<boolean>;
  
  // Batch operations
  createQuestions(questions: InsertQuestion[]): Promise<Question[]>;
  updateQuestions(updates: { id: number; question: UpdateQuestion }[]): Promise<Question[]>;
}

export class MemStorage implements IStorage {
  private questions: Map<number, Question>;
  private xmlFiles: Map<number, XmlFile>;
  private currentQuestionId: number;
  private currentXmlFileId: number;

  constructor() {
    this.questions = new Map();
    this.xmlFiles = new Map();
    this.currentQuestionId = 1;
    this.currentXmlFileId = 1;
  }

  async getQuestions(filters?: { grade?: number; domain?: string; status?: string; search?: string }): Promise<Question[]> {
    let result = Array.from(this.questions.values());
    
    if (filters?.grade) {
      result = result.filter(q => q.grade === filters.grade);
    }
    
    if (filters?.domain) {
      result = result.filter(q => q.domain === filters.domain);
    }
    
    if (filters?.status) {
      result = result.filter(q => q.status === filters.status);
    }
    
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(q => 
        q.questionText.toLowerCase().includes(searchLower) ||
        q.theme.toLowerCase().includes(searchLower) ||
        q.standard.toLowerCase().includes(searchLower)
      );
    }
    
    return result.sort((a, b) => a.id - b.id);
  }

  async getQuestion(id: number): Promise<Question | undefined> {
    return this.questions.get(id);
  }

  async getQuestionByXmlId(xmlId: string): Promise<Question | undefined> {
    return Array.from(this.questions.values()).find(q => q.xmlId === xmlId);
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const id = this.currentQuestionId++;
    const now = new Date();
    const question: Question = {
      ...insertQuestion,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.questions.set(id, question);
    return question;
  }

  async updateQuestion(id: number, updateQuestion: UpdateQuestion): Promise<Question | undefined> {
    const existing = this.questions.get(id);
    if (!existing) return undefined;
    
    const updated: Question = {
      ...existing,
      ...updateQuestion,
      updatedAt: new Date(),
    };
    this.questions.set(id, updated);
    return updated;
  }

  async deleteQuestion(id: number): Promise<boolean> {
    return this.questions.delete(id);
  }

  async getXmlFiles(): Promise<XmlFile[]> {
    return Array.from(this.xmlFiles.values()).sort((a, b) => b.id - a.id);
  }

  async getXmlFile(id: number): Promise<XmlFile | undefined> {
    return this.xmlFiles.get(id);
  }

  async createXmlFile(insertXmlFile: InsertXmlFile): Promise<XmlFile> {
    const id = this.currentXmlFileId++;
    const xmlFile: XmlFile = {
      ...insertXmlFile,
      id,
      uploadedAt: new Date(),
    };
    this.xmlFiles.set(id, xmlFile);
    return xmlFile;
  }

  async deleteXmlFile(id: number): Promise<boolean> {
    return this.xmlFiles.delete(id);
  }

  async createQuestions(insertQuestions: InsertQuestion[]): Promise<Question[]> {
    const questions: Question[] = [];
    for (const insertQuestion of insertQuestions) {
      const question = await this.createQuestion(insertQuestion);
      questions.push(question);
    }
    return questions;
  }

  async updateQuestions(updates: { id: number; question: UpdateQuestion }[]): Promise<Question[]> {
    const questions: Question[] = [];
    for (const update of updates) {
      const question = await this.updateQuestion(update.id, update.question);
      if (question) {
        questions.push(question);
      }
    }
    return questions;
  }
}

export const storage = new MemStorage();
