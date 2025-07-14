import { type InsertQuestion } from "@shared/schema";
import { XMLParser } from "fast-xml-parser";

// Pre-process XML to handle CDATA properly
function preprocessXML(xmlContent: string): string {
  // Replace CDATA sections with regular text content
  return xmlContent.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
}

export function parseXmlQuestions(xmlContent: string): InsertQuestion[] {
  console.log('Parsing XML content, length:', xmlContent.length);
  
  // Pre-process XML to handle CDATA sections
  const processedXml = preprocessXML(xmlContent);
  
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
  
  const parsed = parser.parse(processedXml) as any;
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
      console.log('Question text raw:', q.questionText);
    }
    
    const choicesData = q.choices?.choice ?? [];
    const choicesArray = Array.isArray(choicesData) ? choicesData : [choicesData];

    // Force string conversion - absolutely no objects allowed
    const forceString = (value: any): string => {
      if (value === null || value === undefined) return "";
      if (typeof value === 'string') return value;
      if (typeof value === 'number') return String(value);
      if (typeof value === 'boolean') return String(value);
      
      // For objects, stringify them completely
      if (typeof value === 'object') {
        // Try to get meaningful text content
        if (value['#text']) return String(value['#text']);
        if (value.cdata) return String(value.cdata);
        if (value.__cdata) return String(value.__cdata);
        
        // If it's a simple object with one text property, extract it
        const keys = Object.keys(value);
        if (keys.length === 1) {
          const singleValue = value[keys[0]];
          if (typeof singleValue === 'string') return singleValue;
        }
        
        // Last resort - stringify the entire object
        try {
          return JSON.stringify(value);
        } catch (e) {
          return String(value);
        }
      }
      
      return String(value);
    };

    // Handle different XML formats - check for both <stem> and <questionText>
    const questionText = q.stem || q.questionText || "";
    const correctAnswer = q.answer || q.correctAnswer || "";
    
    // Extract answer key from answer attributes if available
    let answerKey = q.answerKey || q["@_answerKey"] || "";
    if (q.answer && q.answer["@_key"]) {
      answerKey = q.answer["@_key"];
    }

    const result = {
      xmlId: q["@_id"] || "",
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
      status: forceString(q.status) || "completed",
      validationStatus: "pending",
      validationErrors: [],
    };

    if (index < 3) {
      console.log('Processed question text:', result.questionText);
    }

    return result;
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
