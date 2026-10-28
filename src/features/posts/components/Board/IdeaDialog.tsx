"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { quickStarts } from "@/features/posts/data/quick-starts";
import type { BoardStatus, Post, PostCreate } from "@/types/api";
import styles from "./Board.module.css";

export type IdeaDialogProps = {
  brandId: string;
  initialTitle?: string;
  initialText?: string;
  post?: Post;
  statuses: BoardStatus[];
  initialStatusId: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (post: PostCreate, id?: string) => Promise<void>;
};

export default function IdeaDialog({
  brandId,
  initialTitle,
  initialText,
  post,
  statuses,
  initialStatusId,
  isSaving,
  onClose,
  onSave,
}: IdeaDialogProps) {
  const [title, setTitle] = useState(post?.title ?? initialTitle ?? "");
  const [text, setText] = useState(post?.text ?? initialText ?? "");
  const [statusId, setStatusId] = useState(post?.board_status_id ?? initialStatusId);
  const [error, setError] = useState("");
  const [suggestionNotice, setSuggestionNotice] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving && !isSuggesting) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, isSuggesting, onClose]);

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

  async function suggestStructure() {
    const cleanTitle = title.trim();
    if (!cleanTitle || isSuggesting) return;
    setIsSuggesting(true);
    setError("");
    setSuggestionNotice("");
    try {
      const result = await api.suggestStructure(brandId, cleanTitle);
      const generatedDescription = [
        text.trim(),
        result.structure.trim(),
      ].filter(Boolean).join("\n\n");
      if (generatedDescription.length > 10000) {
        setError("Описание не поместится в поле. Сократите заметки и попробуйте ещё раз.");
        return;
      }
      setText(generatedDescription);
      setSuggestionNotice("Описание идеи сгенерировано и добавлено в поле «Текст и заметки».");
      if (result.missing_profile_fields.length > 0) {
        setSuggestionNotice(
          `Описание добавлено в заметки. Для большей точности заполните профиль: ${result.missing_profile_fields.join(", ")}.`,
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось предложить структуру.",
      );
    } finally {
      setIsSuggesting(false);
    }
  }

  return (
    <div
      className={styles.dialogBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving && !isSuggesting) onClose();
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
                disabled={isSaving || isSuggesting}
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
              disabled={isSaving || isSuggesting}
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
              disabled={isSaving || isSuggesting}
              id="idea-title"
              maxLength={255}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="О чём будет ваша публикация?"
              value={title}
            />
            <button
              className={styles.structureButton}
              disabled={isSaving || isSuggesting || !title.trim()}
              onClick={() => void suggestStructure()}
              type="button"
            ><Sparkles aria-hidden="true" /><span>{isSuggesting ? "Пишем описание…" : "Сгенерировать описание"}</span></button>
          </div>

          <div className={styles.quickStartSection}>
            <span className={styles.sectionLabel}>Быстрый старт</span>
            <div className={styles.quickStartList}>
              {quickStarts.map((item) => (
                <button
                  className={styles.quickStartChip}
                  disabled={isSaving || isSuggesting}
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
              disabled={isSaving || isSuggesting}
              maxLength={10000}
              onChange={(event) => setText(event.target.value)}
              placeholder="Добавьте детали, основные мысли или текст публикации..."
              rows={7}
              value={text}
            />
            <span className={styles.characterCount}>{text.length}/10000</span>
          </label>

          {suggestionNotice && <p className={styles.structureNotice} role="status">{suggestionNotice}</p>}
          {error && <p className={styles.formError} role="alert">{error}</p>}

          <div className={styles.dialogActions}>
            <button
              className={styles.secondaryButton}
              disabled={isSaving || isSuggesting}
              onClick={onClose}
              type="button"
            >Отмена</button>
            <button className={styles.primaryButton} disabled={isSaving || isSuggesting} type="submit">
              {isSaving ? "Сохраняем…" : post ? "Сохранить изменения" : "Создать публикацию"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
