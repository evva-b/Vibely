import type { ReactNode } from "react";
import styles from "./Board.module.css";

const knownStageNames: Record<string, string> = {
  visual: "Визуал",
  "image/video": "Визуал",
  image: "Визуал",
  text: "Текст",
  detail: "Деталь",
  details: "Детали",
  cta: "Призыв к действию",
  "call to action": "Призыв к действию",
  hook: "Зацепка",
  headline: "Заголовок",
  "key points": "Основные тезисы",
  hashtags: "Хэштеги",
};

function prepareStructure(value: string) {
  return value
    .replace(
      /\[Stage\s+(\d+)\s*:\s*([^\]]+)\]/gi,
      (_match, number: string, label: string) => {
        const [rawName] = label.split(/\s+-\s+/);
        const stageName =
          knownStageNames[rawName.trim().toLocaleLowerCase()] ??
          rawName.trim().replace(/\s+/g, " ");
        return `\n## ${number}. ${stageName}\n`;
      },
    )
    .replace(
      /(^|\s)Stage\s+(\d+)\s*:\s*([A-Za-z][A-Za-z /-]{1,30})\s*[-–—]\s*/gi,
      (_match, prefix: string, number: string, rawName: string) => {
        const stageName =
          knownStageNames[rawName.trim().toLocaleLowerCase()] ??
          rawName.trim();
        return `${prefix}\n## ${number}. ${stageName}\n`;
      },
    )
    .replace(/<\/?(?:brand_context|tone_of_voice|template_context|user_task|output_requirements)[^>]*>/gi, "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function renderInline(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

export default function StructureContent({ value }: { value: string }) {
  const lines = prepareStructure(value).split("\n");
  const blocks: ReactNode[] = [];
  let listItems: { text: string; ordered: boolean }[] = [];

  function flushList() {
    if (listItems.length === 0) return;
    const ordered = listItems[0].ordered;
    const items = listItems;
    const List = ordered ? "ol" : "ul";
    blocks.push(
      <List className={styles.structureList} key={`list-${blocks.length}`}>
        {items.map((item, index) => (
          <li key={index}>{renderInline(item.text)}</li>
        ))}
      </List>,
    );
    listItems = [];
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      flushList();
      blocks.push(
        <h3 className={styles.structureHeading} key={`heading-${index}`}>
          {renderInline(heading[1])}
        </h3>,
      );
      return;
    }
    const listItem = trimmed.match(/^(?:[-*•]\s+|(\d+)[.)]\s+)(.+)$/);
    if (listItem) {
      const ordered = Boolean(listItem[1]);
      if (listItems.length && listItems[0].ordered !== ordered) flushList();
      listItems.push({ text: listItem[2], ordered });
      return;
    }
    flushList();
    blocks.push(
      <p className={styles.structureParagraph} key={`paragraph-${index}`}>
        {renderInline(trimmed)}
      </p>,
    );
  });
  flushList();

  return <div className={styles.structureContent}>{blocks}</div>;
}
