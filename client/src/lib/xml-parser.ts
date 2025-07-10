import { type InsertQuestion } from "@shared/schema";
import { XMLParser } from "fast-xml-parser";

export function parseXmlQuestions(xmlContent: string): InsertQuestion[] {
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xmlContent) as any;

  const questionNodes = parsed?.questions?.question;
  if (!questionNodes) return [];

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
