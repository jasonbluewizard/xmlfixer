import { type InsertQuestion } from "@shared/schema";

export function parseXmlQuestions(xmlContent: string): InsertQuestion[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, "application/xml");
  
  // Check for parsing errors
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error("Invalid XML format");
  }
  
  const questionElements = doc.querySelectorAll("question");
  const questions: InsertQuestion[] = [];
  
  questionElements.forEach((questionEl) => {
    try {
      const xmlId = questionEl.getAttribute("id") || "";
      const grade = parseInt(questionEl.querySelector("grade")?.textContent || "1");
      const domain = questionEl.querySelector("domain")?.textContent || "";
      const standard = questionEl.querySelector("standard")?.textContent || "";
      const tier = parseInt(questionEl.querySelector("tier")?.textContent || "1");
      const questionText = extractCDATA(questionEl.querySelector("questionText"));
      const correctAnswer = extractCDATA(questionEl.querySelector("correctAnswer"));
      const answerKey = questionEl.querySelector("answerKey")?.textContent || "A";
      const explanation = extractCDATA(questionEl.querySelector("explanation"));
      const theme = questionEl.querySelector("theme")?.textContent || "";
      const tokensUsed = parseInt(questionEl.querySelector("tokensUsed")?.textContent || "0");
      const status = questionEl.querySelector("status")?.textContent || "pending";
      
      const choiceElements = questionEl.querySelectorAll("choices choice");
      const choices: string[] = [];
      choiceElements.forEach((choiceEl) => {
        choices.push(choiceEl.textContent || "");
      });
      
      questions.push({
        xmlId,
        grade,
        domain,
        standard,
        tier,
        questionText,
        correctAnswer,
        answerKey,
        choices,
        explanation,
        theme,
        tokensUsed,
        status,
        validationStatus: "pending",
        validationErrors: [],
      });
    } catch (error) {
      console.error("Error parsing question:", error);
      // Skip invalid questions
    }
  });
  
  return questions;
}

function extractCDATA(element: Element | null): string {
  if (!element) return "";
  
  // Check for CDATA sections
  const cdata = element.querySelector("![CDATA[");
  if (cdata) {
    return cdata.textContent || "";
  }
  
  // Fallback to regular text content
  return element.textContent || "";
}

export function generateXmlFromQuestions(questions: any[]): string {
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
