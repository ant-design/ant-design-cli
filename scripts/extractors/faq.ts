import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export interface FaqItem {
  question: string;
  answer: string;
}

/** Extract FAQ section from component markdown */
function parseFaq(content: string): FaqItem[] {
  const faqs: FaqItem[] = [];

  // Find ## FAQ section
  const faqMatch = content.match(/^## FAQ/m);
  if (!faqMatch || faqMatch.index === undefined) return faqs;

  const afterFaq = content.slice(faqMatch.index + faqMatch[0].length);

  // Stop at the next ## heading
  const nextSection = afterFaq.match(/\n## /m);
  const faqContent = nextSection?.index !== undefined ? afterFaq.slice(0, nextSection.index) : afterFaq;

  // Split by ### headings to get individual FAQ items
  const items = faqContent.split(/^### /m).filter((s) => s.trim());

  for (const item of items) {
    const lines = item.split('\n');
    // First line is the question (may have {#anchor} suffix)
    const question = lines[0].replace(/\s*\{#[^}]+\}\s*$/, '').trim();
    if (!question) continue;

    // Rest is the answer (skip empty lines at start)
    const answerLines = lines.slice(1);
    const answer = answerLines.join('\n').trim();

    // Remove <style> blocks from the answer
    const cleanAnswer = answer.replace(/<style>[\s\S]*?<\/style>/g, '').trim();

    if (question && cleanAnswer) {
      faqs.push({ question, answer: cleanAnswer });
    }
  }

  return faqs;
}

/** Extract FAQ items for a component (English only for now) */
export function extractFaq(antdDir: string, dirName: string): FaqItem[] {
  const enPath = path.join(antdDir, 'components', dirName, 'index.en-US.md');
  if (!fs.existsSync(enPath)) return [];

  const enContent = matter(fs.readFileSync(enPath, 'utf-8')).content;
  return parseFaq(enContent);
}
