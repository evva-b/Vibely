"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { ImagePlus, Sparkles, X } from "lucide-react";
import {
  ideaStatuses,
  statusLabels,
  type Idea,
  type IdeaStatus,
} from "@/features/posts/types";
import styles from "./Board.module.css";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

export type IdeaDialogProps = {
  idea?: Idea;
  initialStatus: IdeaStatus;
  onClose: () => void;
  onSave: (idea: Omit<Idea, "id" | "updatedAt">, id?: string) => void;
};

export default function IdeaDialog({
  idea,
  initialStatus,
  onClose,
  onSave,
}: IdeaDialogProps) {
  const [title, setTitle] = useState(idea?.title ?? "");
  const [description, setDescription] = useState(idea?.description ?? "");
  const [status, setStatus] = useState(idea?.status ?? initialStatus);
  const [topic, setTopic] = useState(idea?.topic ?? "");
  const [image, setImage] = useState(idea?.image ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Выберите файл изображения.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Размер изображения не должен превышать 2 МБ.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImage(reader.result);
        setError("");
      } else {
        setError("Не удалось загрузить изображение.");
      }
    };
    reader.onerror = () => {
      setError("Не удалось загрузить изображение. Попробуйте другой файл.");
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Добавьте название идеи.");
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const savedStatus =
      submitter?.value === "draft"
        ? "draft"
        : !idea && status === "draft"
          ? "todo"
          : status;

    onSave(
      {
        title: cleanTitle,
        description: description.trim(),
        status: savedStatus,
        topic,
        ...(image ? { image } : {}),
      },
      idea?.id,
    );
  }

  function addStructure() {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Сначала укажите тему идеи.");
      return;
    }

    setDescription(
      `Цель: ${cleanTitle}\n\nОсновные тезисы:\n• \n• \n\nПризыв к действию:`,
    );
    setError("");
  }

  const templates = [
    { label: "Знакомство с брендом", title: "Знакомство с брендом" },
    { label: "Полезный совет", title: "Полезный совет для аудитории" },
    { label: "История клиента", title: "История нашего клиента" },
    { label: "Закулисье", title: "Один день за кулисами" },
  ];

  return (
    <div
      className={styles.dialogBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
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
              {idea ? "Редактировать идею" : "Создать идею"}
            </h2>
            <p>Соберите мысли в основу будущей публикации.</p>
          </div>
          <div className={styles.dialogHeaderActions}>
            <label className={styles.dialogSelect}>
              <span className={styles.visuallyHidden}>Статус идеи</span>
              <select
                onChange={(event) => setStatus(event.target.value as IdeaStatus)}
                value={status}
              >
                {ideaStatuses.map((ideaStatus) => (
                  <option key={ideaStatus} value={ideaStatus}>
                    {statusLabels[ideaStatus]}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.dialogSelect}>
              <span className={styles.visuallyHidden}>Тема идеи</span>
              <select onChange={(event) => setTopic(event.target.value)} value={topic}>
                <option value="">Без темы</option>
                <option value="Продукт">Продукт</option>
                <option value="Образование">Образование</option>
                <option value="Личный бренд">Личный бренд</option>
                <option value="Закулисье">Закулисье</option>
              </select>
            </label>
            <button
              aria-label="Закрыть окно"
              className={styles.iconButton}
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </div>

        <form className={styles.dialogForm} onSubmit={handleSubmit}>
          <div className={styles.ideaPrompt}>
            <label className={styles.visuallyHidden} htmlFor="idea-title">
              Краткое название идеи
            </label>
            <input
              autoFocus
              id="idea-title"
              maxLength={90}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="О чём будет ваша идея?"
              value={title}
            />
            <button
              className={styles.structureButton}
              onClick={addStructure}
              type="button"
            >
              <Sparkles aria-hidden="true" />
              <span>Подсказать структуру</span>
            </button>
          </div>

          <div className={styles.templateSection}>
            <span className={styles.sectionLabel}>Быстрый старт</span>
            <div className={styles.templateList}>
              {templates.map((template) => (
                <button
                  className={styles.templateChip}
                  key={template.label}
                  onClick={() => {
                    setTitle(template.title);
                    setError("");
                  }}
                  type="button"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          <label className={styles.notesField}>
            <span className={styles.sectionLabel}>Заметки и тезисы</span>
            <textarea
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Добавьте детали, основные мысли или черновик текста..."
              rows={6}
              value={description}
            />
            <span className={styles.characterCount}>{description.length}/500</span>
          </label>

          <div className={styles.attachmentRow}>
            {image ? (
              <div className={styles.imagePreview}>
                <Image
                  alt="Предпросмотр изображения идеи"
                  height={96}
                  src={image}
                  unoptimized
                  width={128}
                />
                <button
                  aria-label="Удалить изображение"
                  className={styles.removeImageButton}
                  onClick={() => setImage("")}
                  type="button"
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            ) : (
              <label className={styles.uploadButton}>
                <ImagePlus aria-hidden="true" />
                <span>Добавить изображение</span>
                <input
                  accept="image/*"
                  className={styles.visuallyHidden}
                  onChange={handleImageChange}
                  type="file"
                />
              </label>
            )}
            <span className={styles.hint}>PNG, JPG или WEBP · до 2 МБ</span>
          </div>

          {error && (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}

          <div className={styles.dialogActions}>
            <button
              className={styles.secondaryButton}
              name="saveMode"
              type="submit"
              value="draft"
            >
              Сохранить в черновик
            </button>
            <button
              className={styles.primaryButton}
              name="saveMode"
              type="submit"
              value="publish"
            >
              {idea ? "Сохранить изменения" : "Создать публикацию"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
