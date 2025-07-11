import { type InsertQuestion } from "@shared/schema";
import { XMLParser } from "fast-xml-parser";

export function parseXmlQuestions(xmlContent: string): InsertQuestion[] {
  console.log('Parsing XML content, length:', xmlContent.length);
  
  const parser = new XMLParser({ 
    ignoreAttributes: false,
    parseAttributeValue: true,
    trimValues: true,
    parseTrueNumberOnly: false,
    parseNodeValue: true,
    cdataPropName: "__cdata", // Handle CDATA sections properly
    parseCDATA: true,
    alwaysCreateTextNode: true
  });
  
  const parsed = parser.parse(xmlContent) as any;
  console.log('Parsed XML root keys:', Object.keys(parsed));

  const questionNodes = parsed?.questions?.question;
  if (!questionNodes) {
    console.log('No question nodes found in XML');
    return [];
  }

  const nodesArray = Array.isArray(questionNodes) ? questionNodes : [questionNodes];
  console.log('Found', nodesArray.length, 'questions in XML');

  return nodesArray.map((q: any, index: number) => {
    if (index < 3) {
      console.log('Processing question', index, 'with id:', q["@_id"]);
    }
    
    const choicesData = q.choices?.choice ?? [];
    const choicesArray = Array.isArray(choicesData) ? choicesData : [choicesData];

    // Helper function to extract text content from CDATA or text nodes
    const extractText = (node: any): string => {
      if (typeof node === 'string') return node;
      if (node?.__cdata) return node.__cdata;
      if (node?.['#text']) return node['#text'];
      if (typeof node === 'object' && node !== null) {
        return String(node);
      }
      return String(node ?? "");
    };

    return {
      xmlId: q["@_id"] ?? "",
      grade: parseInt(String(q.grade ?? "1")),
      domain: extractText(q.domain),
      standard: extractText(q.standard),
      tier: parseInt(String(q.tier ?? "1")),
      questionText: extractText(q.questionText),
      correctAnswer: extractText(q.correctAnswer),
      answerKey: extractText(q.answerKey) || "A",
      choices: choicesArray.map((c: any) => extractText(c)),
      explanation: extractText(q.explanation),
      theme: extractText(q.theme),
      tokensUsed: parseInt(String(q.tokensUsed ?? "0")),
      status: extractText(q.status) || "pending",
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
