"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Sparkles, X } from "lucide-react";
import type { BoardStatus, Post, PostCreate } from "@/types/api";
import styles from "./Board.module.css";

export type IdeaDialogProps = {
  post?: Post;
  statuses: BoardStatus[];
  initialStatusId: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (post: PostCreate, id?: string) => Promise<void>;
};

const quickStarts = [
  "Знакомство с брендом",
  "Полезный совет для аудитории",
  "История клиента",
  "Один день за кулисами",
];

export default function IdeaDialog({
  post,
  statuses,
  initialStatusId,
  isSaving,
  onClose,
  onSave,
}: IdeaDialogProps) {
  const [title, setTitle] = useState(post?.title ?? "");
  const [text, setText] = useState(post?.text ?? "");
  const [statusId, setStatusId] = useState(post?.board_status_id ?? initialStatusId);
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    const cleanText = text.trim();
    if (!cleanTitle || !cleanText || !statusId) {
      setError("Укажите название, текст поста и его статус.");
      return;
    }
    setError("");
    try {
      await onSave(
        { title: cleanTitle, text: cleanText, board_status_id: statusId },
        post?.id,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить пост.",
      );
    }
  }

  return (
    <div
      className={styles.dialogBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <section
        aria-labelledby="idea-dialog-title"
        aria-modal="true"
        className={styles.dialog}
        role="dialog"
      >
        <div className={styles.dialogHeader}>
          <div className={styles.dialogHeading}>
            <span className={styles.eyebrow}>ИДЕИ ДЛЯ КОНТЕНТА</span>
            <h2 className={styles.dialogTitle} id="idea-dialog-title">
              {post ? "Редактировать пост" : "Создать пост"}
            </h2>
            <p>Пост сохранится в вашем аккаунте.</p>
          </div>
          <div className={styles.dialogHeaderActions}>
            <label className={styles.dialogSelect}>
              <span className={styles.visuallyHidden}>Статус поста</span>
              <select
                disabled={isSaving}
                onChange={(event) => setStatusId(event.target.value)}
                value={statusId}
              >
                {statuses.map((status) => (
                  <option key={status.id} value={status.id}>{status.name}</option>
                ))}
              </select>
            </label>
            <button
              aria-label="Закрыть окно"
              className={styles.iconButton}
              disabled={isSaving}
              onClick={onClose}
              type="button"
            ><X aria-hidden="true" /></button>
          </div>
        </div>

        <form className={styles.dialogForm} onSubmit={handleSubmit}>
          <div className={styles.ideaPrompt}>
            <label className={styles.visuallyHidden} htmlFor="idea-title">Название поста</label>
            <input
              autoFocus
              disabled={isSaving}
              id="idea-title"
              maxLength={255}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="О чём будет ваша публикация?"
              value={title}
            />
            <button
              className={styles.structureButton}
              disabled={isSaving || !title.trim()}
              onClick={() =>
                setText(`Цель: ${title.trim()}\n\nОсновные тезисы:\n• \n• \n\nПризыв к действию:`)
              }
              type="button"
            ><Sparkles aria-hidden="true" /><span>Подсказать структуру</span></button>
          </div>

          <div className={styles.templateSection}>
            <span className={styles.sectionLabel}>Быстрый старт</span>
            <div className={styles.templateList}>
              {quickStarts.map((item) => (
                <button
                  className={styles.templateChip}
                  key={item}
                  onClick={() => setTitle(item)}
                  type="button"
                >{item}</button>
              ))}
            </div>
          </div>

          <label className={styles.notesField}>
            <span className={styles.sectionLabel}>Текст и заметки</span>
            <textarea
              disabled={isSaving}
              maxLength={10000}
              onChange={(event) => setText(event.target.value)}
              placeholder="Добавьте детали, основные мысли или текст публикации..."
              rows={7}
              value={text}
            />
            <span className={styles.characterCount}>{text.length}/10000</span>
          </label>

          {error && <p className={styles.formError} role="alert">{error}</p>}

          <div className={styles.dialogActions}>
            <button
              className={styles.secondaryButton}
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >Отмена</button>
            <button className={styles.primaryButton} disabled={isSaving} type="submit">
              {isSaving ? "Сохраняем…" : post ? "Сохранить изменения" : "Создать публикацию"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
