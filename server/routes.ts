import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertQuestionSchema, updateQuestionSchema, insertXmlFileSchema } from "@shared/schema";
import multer from "multer";
import { z } from "zod";
import { XMLParser } from "fast-xml-parser";
import { writeFileSync, readFileSync } from "fs";
import path from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";
import { aiVerifier } from "./ai-verifier";

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

  // Merge multiple XML files
  app.post("/api/xml/merge", upload.array('file'), async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files provided" });
      }

      let allQuestions: any[] = [];
      
      for (const file of files) {
        const xmlContent = file.buffer.toString('utf-8');
        try {
          const questions = parseXmlQuestions(xmlContent);
          allQuestions.push(...questions);
        } catch (error) {
          console.error(`Error parsing file ${file.originalname}:`, error);
          continue;
        }
      }

      if (allQuestions.length === 0) {
        return res.status(400).json({ message: "No valid questions found in any file" });
      }

      // Generate merged XML
      const mergedXml = generateXmlFromQuestions(allQuestions);
      
      res.setHeader("Content-Type", "application/xml");
      res.setHeader("Content-Disposition", `attachment; filename="merged_questions.xml"`);
      res.send(mergedXml);
    } catch (error) {
      console.error("Error merging XML files:", error);
      res.status(500).json({ message: "Failed to merge XML files" });
    }
  });

  // Split XML file by grade or theme
  app.post("/api/xml/split", async (req, res) => {
    try {
      const { type, filename } = req.query;
      const questions = await storage.getQuestions();
      
      if (questions.length === 0) {
        return res.status(400).json({ message: "No questions to split" });
      }

      const splitGroups: Record<string, any[]> = {};
      
      // Group questions by the specified type
      questions.forEach(question => {
        const key = type === 'grade' ? `grade_${question.grade}` : question.theme;
        if (!splitGroups[key]) {
          splitGroups[key] = [];
        }
        splitGroups[key].push(question);
      });

      // Generate XML files for each group
      const zipContent = await generateZipFromGroups(splitGroups, filename as string || 'questions');
      
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename || 'questions'}_split.zip"`);
      res.send(zipContent);
    } catch (error) {
      console.error("Error splitting XML file:", error);
      res.status(500).json({ message: "Failed to split XML file" });
    }
  });

  // AI Verification endpoints
  app.post("/api/ai/verify-question", async (req, res) => {
    try {
      const { questionId } = req.body;
      
      if (!questionId) {
        return res.status(400).json({ message: "Question ID is required" });
      }

      const question = await storage.getQuestion(questionId);
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }

      const result = await aiVerifier.verifyQuestion(question);
      res.json(result);
    } catch (error) {
      console.error("Error verifying question:", error);
      res.status(500).json({ message: "Failed to verify question" });
    }
  });

  app.post("/api/ai/verify-batch", async (req, res) => {
    try {
      const { questionIds } = req.body;
      
      if (!Array.isArray(questionIds) || questionIds.length === 0) {
        return res.status(400).json({ message: "Question IDs array is required" });
      }

      if (questionIds.length > 20) {
        return res.status(400).json({ message: "Batch verification limited to 20 questions" });
      }

      const questions = await Promise.all(
        questionIds.map(id => storage.getQuestion(id))
      );

      const validQuestions = questions.filter(q => q !== undefined);
      if (validQuestions.length === 0) {
        return res.status(404).json({ message: "No valid questions found" });
      }

      const result = await aiVerifier.verifyBatch(validQuestions);
      res.json(result);
    } catch (error) {
      console.error("Error verifying batch:", error);
      res.status(500).json({ message: "Failed to verify batch" });
    }
  });

  app.post("/api/ai/apply-fixes", async (req, res) => {
    try {
      const { questionId, fixes } = req.body;
      
      if (!questionId || !fixes) {
        return res.status(400).json({ message: "Question ID and fixes are required" });
      }

      const question = await storage.getQuestion(questionId);
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }

      const updatedQuestion = await aiVerifier.applyFixes(question, { questionId, fixes });
      const result = await storage.updateQuestion(questionId, updatedQuestion);
      
      res.json(result);
    } catch (error) {
      console.error("Error applying fixes:", error);
      res.status(500).json({ message: "Failed to apply fixes" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function parseXmlQuestions(xmlContent: string): any[] {
  const parser = new XMLParser({ 
    ignoreAttributes: false,
    parseAttributeValue: true,
    trimValues: true,
    parseTrueNumberOnly: false,
    parseNodeValue: true
  });
  
  const parsed = parser.parse(xmlContent) as any;
  const questionNodes = parsed?.questions?.question;
  if (!questionNodes) {
    return [];
  }

  const nodesArray = Array.isArray(questionNodes) ? questionNodes : [questionNodes];
  
  return nodesArray.map((q: any) => {
    const choicesData = q.choices?.choice ?? [];
    const choicesArray = Array.isArray(choicesData) ? choicesData : [choicesData];

    return {
      xmlId: q["@_id"] ?? "",
      grade: parseInt(String(q.grade ?? "1")),
      domain: q.domain ?? "",
      standard: q.standard ?? "",
      tier: parseInt(String(q.tier ?? "1")),
      questionText: String(q.questionText ?? ""),
      correctAnswer: String(q.correctAnswer ?? ""),
      answerKey: String(q.answerKey ?? "A"),
      choices: choicesArray.map((c: any) => String(c ?? "")),
      explanation: String(q.explanation ?? ""),
      theme: q.theme ?? "",
      tokensUsed: parseInt(String(q.tokensUsed ?? "0")),
      status: q.status ?? "pending",
      validationStatus: "pending",
      validationErrors: [],
    };
  });
}

async function generateZipFromGroups(groups: Record<string, any[]>, baseFilename: string): Promise<Buffer> {
  const tempDir = tmpdir();
  const zipPath = path.join(tempDir, `${baseFilename}_split.zip`);
  
  // Create individual XML files for each group
  const filePaths: string[] = [];
  
  for (const [groupName, questions] of Object.entries(groups)) {
    const xml = generateXmlFromQuestions(questions);
    const filePath = path.join(tempDir, `${baseFilename}_${groupName}.xml`);
    writeFileSync(filePath, xml);
    filePaths.push(filePath);
  }
  
  try {
    // Use system zip command to create archive
    const fileNames = filePaths.map(p => path.basename(p));
    const zipCommand = `cd "${tempDir}" && zip "${zipPath}" ${fileNames.join(' ')}`;
    execSync(zipCommand);
    
    const zipBuffer = readFileSync(zipPath);
    
    // Clean up temporary files
    filePaths.forEach(p => {
      try { 
        execSync(`rm "${p}"`); 
      } catch {}
    });
    try { 
      execSync(`rm "${zipPath}"`); 
    } catch {}
    
    return zipBuffer;
  } catch (error) {
    console.error('Error creating ZIP archive:', error);
    
    // Fallback: return the first XML file if ZIP creation fails
    if (filePaths.length > 0) {
      const firstFile = readFileSync(filePaths[0]);
      
      // Clean up temporary files
      filePaths.forEach(p => {
        try { 
          execSync(`rm "${p}"`); 
        } catch {}
      });
      
      return firstFile;
    }
    
    return Buffer.from('');
  }
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
