import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertQuestionSchema, updateQuestionSchema, insertXmlFileSchema } from "@shared/schema";
import multer from "multer";
import { z } from "zod";

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all questions with optional filters
  app.get("/api/questions", async (req, res) => {
    try {
      const { grade, domain, status, search } = req.query;
      const filters = {
        grade: grade ? parseInt(grade as string) : undefined,
        domain: domain as string,
        status: status as string,
        search: search as string,
      };
      
      const questions = await storage.getQuestions(filters);
      res.json(questions);
    } catch (error) {
      console.error("Error fetching questions:", error);
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  // Get a single question
  app.get("/api/questions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const question = await storage.getQuestion(id);
      
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }
      
      res.json(question);
    } catch (error) {
      console.error("Error fetching question:", error);
      res.status(500).json({ message: "Failed to fetch question" });
    }
  });

  // Create a new question
  app.post("/api/questions", async (req, res) => {
    try {
      const questionData = insertQuestionSchema.parse(req.body);
      const question = await storage.createQuestion(questionData);
      res.status(201).json(question);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid question data", errors: error.errors });
      }
      console.error("Error creating question:", error);
      res.status(500).json({ message: "Failed to create question" });
    }
  });

  // Update a question
  app.put("/api/questions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const questionData = updateQuestionSchema.parse(req.body);
      const question = await storage.updateQuestion(id, questionData);
      
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }
      
      res.json(question);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid question data", errors: error.errors });
      }
      console.error("Error updating question:", error);
      res.status(500).json({ message: "Failed to update question" });
    }
  });

  // Delete a question
  app.delete("/api/questions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteQuestion(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Question not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting question:", error);
      res.status(500).json({ message: "Failed to delete question" });
    }
  });

  // Upload XML file
  app.post("/api/xml/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const xmlContent = req.file.buffer.toString("utf-8");
      const filename = req.file.originalname;

      console.log(`Processing XML file: ${filename} (${Math.round(xmlContent.length / 1024)}KB)`);

      // Parse XML and extract questions
      const { parseXmlQuestions } = await import("../client/src/lib/xml-parser");
      const parsedQuestions = parseXmlQuestions(xmlContent);

      console.log(`Parsed ${parsedQuestions.length} questions from XML`);

      // Create XML file record
      const xmlFile = await storage.createXmlFile({
        filename,
        originalContent: xmlContent.substring(0, 10000), // Store only first 10KB for large files
        questionCount: parsedQuestions.length,
      });

      // Create questions in storage in batches to avoid memory issues
      const batchSize = 100;
      const questions: any[] = [];
      
      for (let i = 0; i < parsedQuestions.length; i += batchSize) {
        const batch = parsedQuestions.slice(i, i + batchSize);
        const batchQuestions = await storage.createQuestions(batch);
        questions.push(...batchQuestions);
        console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(parsedQuestions.length / batchSize)}`);
      }

      res.json({
        xmlFile,
        questions: questions.slice(0, 10), // Return only first 10 for performance
        totalQuestions: questions.length,
        message: `Successfully imported ${questions.length} questions from ${filename}`,
      });
    } catch (error) {
      console.error("Error uploading XML file:", error);
      res.status(500).json({ 
        message: "Failed to process XML file", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get XML files
  app.get("/api/xml/files", async (req, res) => {
    try {
      const xmlFiles = await storage.getXmlFiles();
      res.json(xmlFiles);
    } catch (error) {
      console.error("Error fetching XML files:", error);
      res.status(500).json({ message: "Failed to fetch XML files" });
    }
  });

  // Export questions as XML
  app.get("/api/xml/export", async (req, res) => {
    try {
      const { grade, domain } = req.query;
      const filters = {
        grade: grade ? parseInt(grade as string) : undefined,
        domain: domain as string,
      };
      
      const questions = await storage.getQuestions(filters);
      
      // Generate XML content
      const xmlContent = generateXmlFromQuestions(questions);
      
      res.setHeader("Content-Type", "application/xml");
      res.setHeader("Content-Disposition", `attachment; filename="questions_export.xml"`);
      res.send(xmlContent);
    } catch (error) {
      console.error("Error exporting XML:", error);
      res.status(500).json({ message: "Failed to export XML" });
    }
  });

  // Batch update questions
  app.put("/api/questions/batch", async (req, res) => {
    try {
      const updates = req.body.updates;
      if (!Array.isArray(updates)) {
        return res.status(400).json({ message: "Invalid updates format" });
      }

      const questions = await storage.updateQuestions(updates);
      res.json(questions);
    } catch (error) {
      console.error("Error batch updating questions:", error);
      res.status(500).json({ message: "Failed to update questions" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function generateXmlFromQuestions(questions: any[]): string {
  const questionsXml = questions.map(q => `
  <question id="${q.xmlId}">
    <grade>${q.grade}</grade>
    <domain>${q.domain}</domain>
    <standard>${q.standard}</standard>
    <tier>${q.tier}</tier>
    <questionText><![CDATA[${q.questionText}]]></questionText>
    <correctAnswer><![CDATA[${q.correctAnswer}]]></correctAnswer>
    <answerKey>${q.answerKey}</answerKey>
    <choices>
      ${q.choices.map((choice: string) => `<choice>${choice}</choice>`).join('\n      ')}
    </choices>
    <explanation><![CDATA[${q.explanation}]]></explanation>
    <theme>${q.theme}</theme>
    <tokensUsed>${q.tokensUsed}</tokensUsed>
    <status>${q.status}</status>
  </question>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<questions>
${questionsXml}
</questions>`;
}
