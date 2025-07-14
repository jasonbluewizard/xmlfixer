import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertQuestionSchema, updateQuestionSchema, insertXmlFileSchema, type Question } from "@shared/schema";
import multer from "multer";
import { z } from "zod";
import { XMLParser } from "fast-xml-parser";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import path from "path";
import { tmpdir } from "os";
import { execFileSync } from "child_process";
import { aiVerifier } from "./ai-verifier";
import { mathValidator } from "./math-validator";
import { validationEngine } from "./validation-rules";
import { duplicateDetector } from "./duplicate-detector";

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

  // Delete all questions (for clearing corrupted data)
  app.delete("/api/questions/bulk", async (req, res) => {
    try {
      // Clear all questions from storage
      const questions = await storage.getQuestions();
      for (const question of questions) {
        await storage.deleteQuestion(question.id);
      }
      
      res.json({ message: `Deleted ${questions.length} questions`, count: questions.length });
    } catch (error) {
      console.error("Error bulk deleting questions:", error);
      res.status(500).json({ message: "Failed to delete questions" });
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
        originalContent: xmlContent, // Store complete XML content for duplicate detection
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

  // Enhanced SymPy validation endpoint
  app.post("/api/ai/validate-sympy", async (req, res) => {
    try {
      const validationRequest = req.body;
      
      if (!validationRequest.questionText || !validationRequest.correctAnswer) {
        return res.status(400).json({ message: "Question text and correct answer are required" });
      }

      // Create a temporary question object for validation
      const tempQuestion: Question = {
        id: 0,
        xmlId: '',
        grade: validationRequest.grade || 1,
        domain: validationRequest.domain || 'Number and Operations',
        standard: '',
        tier: 1,
        questionText: validationRequest.questionText,
        correctAnswer: validationRequest.correctAnswer,
        answerKey: 'A',
        choices: validationRequest.choices || [],
        explanation: validationRequest.explanation || '',
        theme: '',
        tokensUsed: 0,
        status: 'pending',
        validationStatus: 'pending',
        validationErrors: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mathValidation = await mathValidator.validateMathematically(tempQuestion);
      const ruleValidation = await validationEngine.validateQuestion(tempQuestion);

      const response = {
        isValid: mathValidation.sympyValidated && ruleValidation.isValid,
        errors: [
          ...mathValidation.computationalErrors,
          ...ruleValidation.errors.map(e => e.message)
        ],
        mathematicalAccuracy: mathValidation.sympyValidated,
        gradeAppropriate: mathValidation.gradeAppropriate,
        arithmeticConsistency: mathValidation.arithmeticConsistency,
        confidenceScore: mathValidation.sympyValidated ? 0.95 : 0.3
      };
      
      res.json(response);
    } catch (error) {
      console.error("Error in SymPy validation:", error);
      res.status(500).json({ message: "SymPy validation failed" });
    }
  });

  // Duplicate detection API
  app.post("/api/duplicates/detect", async (req, res) => {
    try {
      const { questionIds, options } = req.body;
      
      if (!questionIds || !Array.isArray(questionIds)) {
        return res.status(400).json({ message: "Question IDs array is required" });
      }

      // Fetch questions
      const questions = [];
      for (const id of questionIds) {
        const question = await storage.getQuestion(id);
        if (question) {
          questions.push(question);
        }
      }

      if (questions.length === 0) {
        return res.status(404).json({ message: "No questions found" });
      }

      // Detect duplicates
      const result = await duplicateDetector.detectDuplicates(questions, options);
      
      res.json(result);
    } catch (error) {
      console.error("Error detecting duplicates:", error);
      res.status(500).json({ message: "Failed to detect duplicates" });
    }
  });

  // Remove duplicates from XML file
  app.post("/api/duplicates/remove", async (req, res) => {
    try {
      const { xmlFileId, options } = req.body;
      
      if (!xmlFileId) {
        return res.status(400).json({ message: "XML file ID is required" });
      }

      console.log(`Processing duplicate removal for XML file ID: ${xmlFileId}`);

      // Get XML file
      const xmlFile = await storage.getXmlFile(xmlFileId);
      if (!xmlFile) {
        return res.status(404).json({ message: "XML file not found" });
      }

      console.log(`Found XML file: ${xmlFile.filename}, processing ${xmlFile.originalContent.length} characters for duplicates...`);

      // For large files, set a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Processing timeout after 120 seconds')), 120000);
      });

      // Parse XML and extract questions
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        textNodeName: "#text",
        parseTagValue: true,
        parseAttributeValue: true,
        trimValues: true,
        alwaysCreateTextNode: true,
        processEntities: true,
        htmlEntities: true,
        ignoreDeclaration: true,
        ignorePiTags: true,
        stopNodes: ["*.CDATA", "*.cdata"],
        cdataPropName: "cdata"
      });

      const xmlContent = xmlFile.originalContent;
      
      // Validate XML content is complete
      if (!xmlContent.trim().endsWith('</questions>')) {
        return res.status(400).json({ 
          message: "Incomplete XML content - file appears to be truncated. Please re-upload the XML file." 
        });
      }
      
      // Process with timeout protection
      const processPromise = (async () => {
        const parsedXml = parser.parse(xmlContent);
        
        if (!parsedXml.questions || !parsedXml.questions.question) {
          throw new Error("Invalid XML format");
        }

        const questionNodes = Array.isArray(parsedXml.questions.question) 
          ? parsedXml.questions.question 
          : [parsedXml.questions.question];

        // Helper function to safely extract text from parsed XML nodes
        const safeText = (value: any): string => {
          if (typeof value === 'string') return value;
          if (typeof value === 'number') return String(value);
          if (value?.["#text"]) return String(value["#text"]);
          if (value?.cdata) return String(value.cdata);
          if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value);
          }
          return String(value || "");
        };

        // Convert to Question objects for duplicate detection
        const questions = questionNodes.map((node: any, index: number) => ({
          id: index + 1,
          xmlId: safeText(node["@_id"]) || `question_${index}`,
          questionText: safeText(node.questionText),
          correctAnswer: safeText(node.correctAnswer),
          explanation: safeText(node.explanation),
          choices: Array.isArray(node.choices?.choice) 
            ? node.choices.choice.map((c: any) => safeText(c))
            : node.choices?.choice ? [safeText(node.choices.choice)] : [],
          grade: parseInt(safeText(node.grade)) || 1,
          domain: safeText(node.domain),
          standard: safeText(node.standard),
          tier: parseInt(safeText(node.tier)) || 1,
          answerKey: safeText(node.answerKey),
          theme: safeText(node.theme),
          tokensUsed: 0,
          status: "completed",
          validationStatus: "pending",
          validationErrors: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));

        console.log(`Processing ${questions.length} questions for duplicate detection...`);
        
        // Detect duplicates
        const duplicateResult = await duplicateDetector.detectDuplicates(questions, options);
        
        console.log(`Found ${duplicateResult.totalDuplicates} duplicates in ${duplicateResult.duplicateGroups.length} groups`);
        
        return duplicateResult;
      })();
      
      // Wait for processing with timeout
      const duplicateResult = await Promise.race([processPromise, timeoutPromise]) as any;
      
      // Generate new XML with duplicates removed
      const uniqueQuestions = duplicateResult.keptQuestions;
      const newXmlContent = generateXmlFromQuestions(uniqueQuestions.map((q: any) => ({
        xmlId: q.xmlId,
        grade: q.grade,
        domain: q.domain,
        standard: q.standard,
        tier: q.tier,
        questionText: q.questionText,
        correctAnswer: q.correctAnswer,
        answerKey: q.answerKey,
        choices: q.choices,
        explanation: q.explanation,
        theme: q.theme,
        tokensUsed: q.tokensUsed || 0,
        status: q.status || "completed"
      })));

      // Create new XML file
      const newFilename = xmlFile.filename.replace(/\.xml$/, '_no_duplicates.xml');
      const newXmlFile = await storage.createXmlFile({
        filename: newFilename,
        originalContent: newXmlContent,
        questionCount: uniqueQuestions.length
      });

      res.json({
        originalFile: xmlFile,
        newFile: newXmlFile,
        duplicateDetectionResult: duplicateResult,
        removedCount: duplicateResult.totalDuplicates,
        keptCount: uniqueQuestions.length
      });
    } catch (error) {
      console.error("Error removing duplicates:", error);
      res.status(500).json({ message: "Failed to remove duplicates" });
    }
  });

  // Distractor improvement endpoint
  app.post("/api/ai/improve-distractors", async (req, res) => {
    try {
      const { questionId } = req.body;
      
      if (!questionId) {
        return res.status(400).json({ message: "Question ID is required" });
      }

      const question = await storage.getQuestion(questionId);
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Prepare question data for Python script
      const questionData = {
        questionText: question.questionText,
        correctAnswer: question.correctAnswer,
        grade: question.grade,
        choices: question.choices,
        answerKey: question.answerKey
      };

      // Run Python distractor improver
      const { execFile } = await import("child_process");
      const { promisify } = await import("util");
      const execFileAsync = promisify(execFile);

      try {
        const result = await execFileAsync('python3', ['server/distractor-improver.py'], {
          input: JSON.stringify(questionData),
          timeout: 30000, // 30 second timeout
          encoding: 'utf8'
        });

        const improvement = JSON.parse(result.stdout);
        
        if (improvement.success) {
          // Update the question with improved choices
          const updatedQuestion = await storage.updateQuestion(questionId, {
            choices: improvement.choices,
            answerKey: improvement.answerKey
          });
          
          res.json({
            success: true,
            question: updatedQuestion,
            message: improvement.message,
            originalChoices: question.choices,
            improvedChoices: improvement.choices
          });
        } else {
          res.status(400).json({
            success: false,
            message: improvement.message || "Failed to improve distractors"
          });
        }
      } catch (error) {
        console.error("Python script error:", error);
        res.status(500).json({ 
          message: "Failed to run distractor improvement", 
          error: error.message 
        });
      }
    } catch (error) {
      console.error("Error improving distractors:", error);
      res.status(500).json({ message: "Failed to improve distractors" });
    }
  });

  // AI text shortening endpoint
  app.post("/api/ai/shorten-text", async (req, res) => {
    try {
      const { text, targetWords = 30, preserveMath = true } = req.body;
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ message: "Text is required" });
      }

      // Import OpenAI at runtime to avoid circular dependencies
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const systemPrompt = `You are an expert educational content editor. Your task is to shorten question text while preserving:
1. The core mathematical concept and problem
2. All numerical values and mathematical operations  
3. The educational context and grade-appropriate language
4. Character names and fantasy/adventure theme elements (like "Blade the Fearless", "Underworld Dungeon", etc.)
5. The specific question being asked

Guidelines:
- Target ${targetWords} words or fewer, but only reduce as much as needed
- Keep character names and adventure theme intact when possible
- Remove only truly redundant phrases and excessive descriptive details
- Maintain the engaging narrative style that makes math fun
- Preserve essential story context that helps students understand the problem
- Keep mathematical accuracy as top priority

Example: 
- Instead of removing "Blade the Fearless" entirely, keep it but remove redundant phrases like "prepare to enter" or "they decide to"
- Keep adventure locations like "Underworld Dungeon" but trim wordy setup

Respond with only the shortened text, no additional explanation.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Shorten this question text to ${targetWords} words or fewer:\n\n${text}` }
        ],
        max_tokens: 200,
        temperature: 0.3
      });

      const shortenedText = response.choices[0]?.message?.content?.trim();
      
      if (!shortenedText) {
        throw new Error("Failed to generate shortened text");
      }

      res.json({ 
        originalText: text,
        shortenedText,
        originalWordCount: text.trim().split(/\s+/).length,
        newWordCount: shortenedText.trim().split(/\s+/).length
      });
    } catch (error) {
      console.error("Error shortening text:", error);
      res.status(500).json({ 
        message: "Failed to shorten text", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // AI batch text shortening endpoint
  app.post("/api/ai/shorten-batch", async (req, res) => {
    try {
      const { questions, targetWords = 30, preserveMath = true } = req.body;
      
      if (!questions || !Array.isArray(questions)) {
        return res.status(400).json({ message: "Questions array is required" });
      }

      if (questions.length === 0) {
        return res.json({ results: [] });
      }

      // Import OpenAI at runtime to avoid circular dependencies
      const OpenAI = (await import("openai")).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const systemPrompt = `You are an expert educational content editor. Your task is to shorten multiple question texts while preserving:
1. The core mathematical concept and problem for each question
2. All numerical values and mathematical operations
3. The educational context and grade-appropriate language
4. Character names and fantasy/adventure theme elements (like "Blade the Fearless", "Underworld Dungeon", etc.)
5. The specific question being asked

Guidelines:
- Target ${targetWords} words or fewer for each question, but only reduce as much as needed
- Keep character names and adventure theme intact when possible
- Remove only truly redundant phrases and excessive descriptive details
- Maintain the engaging narrative style that makes math fun
- Preserve essential story context that helps students understand the problem
- Keep mathematical accuracy as top priority

Process each question separately and respond with a JSON array where each object has:
- "id": the question ID
- "originalText": the original question text
- "shortenedText": the shortened version
- "originalWordCount": word count of original
- "newWordCount": word count of shortened version

Example format:
[
  {
    "id": 1,
    "originalText": "...",
    "shortenedText": "...",
    "originalWordCount": 45,
    "newWordCount": 28
  }
]`;

      // Process questions individually for more reliable results
      const results = [];
      
      console.log(`Processing ${questions.length} questions for shortening to ${targetWords} words...`);
      
      for (const question of questions) {
        try {
          const wordCount = question.text.trim().split(/\s+/).filter(word => word.length > 0).length;
          console.log(`Question ${question.id}: "${question.text.substring(0, 100)}..." has ${wordCount} words`);
          
          // Skip if already under target words
          if (wordCount <= targetWords) {
            console.log(`Question ${question.id} already under ${targetWords} words (${wordCount} words), skipping`);
            continue;
          }
          
          console.log(`Processing question ${question.id} (${wordCount} words)...`);

          const individualPrompt = `You are an expert educational content editor. Your task is to shorten question text while preserving:
1. The core mathematical concept and problem
2. All numerical values and mathematical operations  
3. The educational context and grade-appropriate language
4. Character names and fantasy/adventure theme elements (like "Master Thaddeus", "Sorceress Lyralei", "mystical alchemical laboratory", etc.)
5. The specific question being asked

Guidelines:
- Target ${targetWords} words or fewer, but only reduce as much as needed
- Keep character names and adventure theme intact when possible
- Remove only truly redundant phrases and excessive descriptive details
- Maintain the engaging narrative style that makes math fun
- Preserve essential story context that helps students understand the problem
- Keep mathematical accuracy as top priority

Respond with only the shortened text, no additional explanation.`;

          const individualResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              { role: "system", content: individualPrompt },
              { role: "user", content: `Shorten this question text to ${targetWords} words or fewer:\n\n${question.text}` }
            ],
            max_tokens: 200,
            temperature: 0.3
          });

          const shortenedText = individualResponse.choices[0]?.message?.content?.trim();
          if (shortenedText) {
            const newWordCount = shortenedText.trim().split(/\s+/).length;
            console.log(`Question ${question.id}: ${wordCount} → ${newWordCount} words`);
            
            results.push({
              id: question.id,
              originalText: question.text,
              shortenedText,
              originalWordCount: wordCount,
              newWordCount
            });
          } else {
            console.error(`No shortened text returned for question ${question.id}`);
          }
        } catch (error) {
          console.error(`Failed to process question ${question.id}:`, error);
        }
      }

      res.json({ 
        results,
        totalProcessed: results.length,
        totalRequested: questions.length
      });
    } catch (error) {
      console.error("Error in batch shortening:", error);
      res.status(500).json({ 
        message: "Failed to shorten questions", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
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
    parseTagValue: false,
    textNodeName: "#text",
    processEntities: true,
    htmlEntities: true,
    ignoreDeclaration: true,
    ignorePiTags: true,
    alwaysCreateTextNode: false
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

    // Handle different XML formats - check for both <stem> and <questionText>
    const questionText = q.stem || q.questionText || "";
    const correctAnswer = q.answer || q.correctAnswer || "";
    
    // Extract answer key from answer attributes if available  
    let answerKey = q.answerKey || q["@_answerKey"] || "";
    if (q.answer && q.answer["@_key"]) {
      answerKey = q.answer["@_key"];
    }

    // Force string conversion for all values
    const forceString = (value: any): string => {
      if (value === null || value === undefined) return "";
      if (typeof value === 'string') return value;
      if (typeof value === 'number') return String(value);
      if (typeof value === 'boolean') return String(value);
      
      // For objects, try to extract text content
      if (typeof value === 'object') {
        if (value['#text']) return String(value['#text']);
        if (value.cdata) return String(value.cdata);
        if (value.__cdata) return String(value.__cdata);
        
        // If it's a simple object with one text property, extract it
        const keys = Object.keys(value);
        if (keys.length === 1) {
          const singleValue = value[keys[0]];
          if (typeof singleValue === 'string') return singleValue;
        }
        
        return String(value);
      }
      
      return String(value);
    };

    return {
      xmlId: q["@_id"] ?? "",
      grade: parseInt(forceString(q["@_grade"] || q.grade)) || 1,
      domain: forceString(q["@_domain"] || q.domain),
      standard: forceString(q["@_standard"] || q.standard),
      tier: parseInt(forceString(q["@_tier"] || q.tier)) || 1,
      questionText: forceString(questionText),
      correctAnswer: forceString(correctAnswer),
      answerKey: forceString(answerKey) || "A",
      choices: choicesArray.map((c: any) => forceString(c)),
      explanation: forceString(q.explanation),
      theme: forceString(q.theme),
      tokensUsed: parseInt(forceString(q.tokensUsed)) || 0,
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
    // Use system zip command to create archive without using a shell
    const fileNames = filePaths.map(p => path.basename(p));
    execFileSync("zip", ["-j", zipPath, ...fileNames], { cwd: tempDir });
    
    const zipBuffer = readFileSync(zipPath);
    
    // Clean up temporary files
    filePaths.forEach(p => {
      try {
        unlinkSync(p);
      } catch {}
    });
    try {
      unlinkSync(zipPath);
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
          unlinkSync(p);
        } catch {}
      });
      
      return firstFile;
    }
    
    return Buffer.from('');
  }
}

function generateXmlFromQuestions(questions: any[]): string {
  const questionsXml = questions.map(q => `  <question id="${q.xmlId}" grade="${q.grade}" domain="${q.domain}" standard="${q.standard}" tier="${q.tier}">
    <stem>
      ${q.questionText}
    </stem>
    <choices>
      ${Array.isArray(q.choices) ? q.choices.map((choice: string, index: number) => {
        const id = String.fromCharCode(65 + index); // A, B, C, D
        return `      <choice id="${id}">
        ${choice}
      </choice>`;
      }).join('\n') : `      <choice id="A">
        ${q.choices}
      </choice>`}
    </choices>
    <explanation>
      ${q.explanation}
    </explanation>
    <metadata>
      <created>
        ${new Date().toString()}
      </created>
      <tokens_used>
        ${q.tokensUsed}
      </tokens_used>
    </metadata>
    <answer key="${q.answerKey}">
      ${q.correctAnswer}
    </answer>
  </question>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<questions>
${questionsXml}
</questions>`;
}
