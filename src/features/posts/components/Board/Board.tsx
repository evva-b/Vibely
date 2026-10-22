"use client";

import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowRight,
  ImagePlus,
  LogOut,
  MessageCircle,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { clearMockUser } from "@/features/auth/lib/local-auth";
import {
  ideaStatuses,
  statusLabels,
  type Idea,
  type IdeaStatus,
} from "@/features/posts/types";
import {
  getIdeasSnapshot,
  getServerIdeasSnapshot,
  getStorageErrorSnapshot,
  subscribeToIdeas,
  updateIdeas,
} from "@/features/posts/lib/idea-store";
import styles from "./Board.module.css";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const russianPluralRules = new Intl.PluralRules("ru");

function formatIdeaCount(count: number) {
  const category = russianPluralRules.select(count);
  const noun =
    category === "one" ? "идея" : category === "few" ? "идеи" : "идей";

  return `${count} ${noun}`;
}

type IdeaDialogProps = {
  idea?: Idea;
  initialStatus: IdeaStatus;
  onClose: () => void;
  onSave: (idea: Omit<Idea, "id" | "updatedAt">, id?: string) => void;
};

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function IdeaDialog({
  idea,
  initialStatus,
  onClose,
  onSave,
}: IdeaDialogProps) {
  const [title, setTitle] = useState(idea?.title ?? "");
  const [description, setDescription] = useState(idea?.description ?? "");
  const [status, setStatus] = useState(idea?.status ?? initialStatus);
  const [image, setImage] = useState(idea?.image ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

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

    onSave(
      {
        title: cleanTitle,
        description: description.trim(),
        status,
        ...(image ? { image } : {}),
      },
      idea?.id,
    );
  }

  return (
    <div
      className={styles.dialogBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="idea-dialog-title"
        aria-modal="true"
        className={styles.dialog}
        role="dialog"
      >
        <div className={styles.dialogHeader}>
          <div>
            <span className={styles.eyebrow}>ИДЕИ ДЛЯ КОНТЕНТА</span>
            <h2 className={styles.dialogTitle} id="idea-dialog-title">
              {idea ? "Редактировать идею" : "Новая идея"}
            </h2>
          </div>
          <button
            aria-label="Закрыть окно"
            className={styles.iconButton}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <form className={styles.dialogForm} onSubmit={handleSubmit}>
          <label className={styles.formField}>
            <span>Название</span>
            <input
              autoFocus
              maxLength={90}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например, идея для нового поста"
              value={title}
            />
          </label>

          <label className={styles.formField}>
            <span>Описание</span>
            <textarea
              maxLength={500}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Добавьте детали, формат или заметки"
              rows={4}
              value={description}
            />
          </label>

          <label className={styles.formField}>
            <span>Колонка</span>
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

          <div className={styles.formField}>
            <span>Изображение</span>
            {image ? (
              <div className={styles.imagePreview}>
                <Image
                  alt="Предпросмотр изображения идеи"
                  height={360}
                  src={image}
                  unoptimized
                  width={640}
                />
                <button
                  className={styles.removeImageButton}
                  onClick={() => setImage("")}
                  type="button"
                >
                  <X aria-hidden="true" />
                  Удалить изображение
                </button>
              </div>
            ) : (
              <label className={styles.uploadButton}>
                <ImagePlus aria-hidden="true" />
                <span>Прикрепить изображение</span>
                <input
                  accept="image/*"
                  className={styles.visuallyHidden}
                  onChange={handleImageChange}
                  type="file"
                />
              </label>
            )}
            <span className={styles.hint}>Изображение до 2 МБ</span>
          </div>

          {error && (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}

          <div className={styles.dialogActions}>
            <button
              className={styles.secondaryButton}
              onClick={onClose}
              type="button"
            >
              Отмена
            </button>
            <button className={styles.primaryButton} type="submit">
              {idea ? "Сохранить" : "Добавить идею"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function Board() {
  const router = useRouter();
  const ideas = useSyncExternalStore(
    subscribeToIdeas,
    getIdeasSnapshot,
    getServerIdeasSnapshot,
  );
  const storageError = useSyncExternalStore(
    subscribeToIdeas,
    getStorageErrorSnapshot,
    () => "",
  );
  const [dialogStatus, setDialogStatus] = useState<IdeaStatus | null>(null);
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [draggedIdeaId, setDraggedIdeaId] = useState<string | null>(null);

  function saveIdea(
    updatedIdea: Omit<Idea, "id" | "updatedAt">,
    id?: string,
  ) {
    updateIdeas((currentIdeas) => {
      if (id) {
        return currentIdeas.map((idea) =>
          idea.id === id
            ? { ...idea, ...updatedIdea, updatedAt: Date.now() }
            : idea,
        );
      }

      return [
        {
          ...updatedIdea,
          id: createId(),
          updatedAt: Date.now(),
        },
        ...currentIdeas,
      ];
    });
    setDialogStatus(null);
    setEditingIdea(null);
  }

  function moveIdea(id: string, status: IdeaStatus) {
    updateIdeas((currentIdeas) =>
      currentIdeas.map((idea) =>
        idea.id === id ? { ...idea, status, updatedAt: Date.now() } : idea,
      ),
    );
    setDraggedIdeaId(null);
  }

  function handleDrop(event: DragEvent<HTMLElement>, status: IdeaStatus) {
    event.preventDefault();
    const ideaId = event.dataTransfer.getData("text/plain") || draggedIdeaId;

    if (ideaId) {
      moveIdea(ideaId, status);
    }
  }

  function handleSignOut() {
    clearMockUser();
    router.push("/login");
  }

  return (
    <main className={styles.app}>
      <header className={styles.topbar}>
        <Link aria-label="Vibely — главная" className={styles.brand} href="/board">
          <span aria-hidden="true" className={styles.brandMark}>
            V
          </span>
          <span>Vibely</span>
        </Link>

        <nav aria-label="Основная навигация" className={styles.navigation}>
          <Link aria-current="page" className={styles.navActive} href="/board">
            Доска идей
          </Link>
          <Link className={styles.navLink} href="/chats">
            Чаты
          </Link>
        </nav>

        <div className={styles.topbarActions}>
          <button
            className={styles.primaryButton}
            onClick={() => {
              setEditingIdea(null);
              setDialogStatus("draft");
            }}
            type="button"
          >
            <Plus aria-hidden="true" />
            <span>Новая идея</span>
          </button>
          <details className={styles.accountMenu}>
            <summary aria-label="Меню профиля">
              <UserRound aria-hidden="true" />
            </summary>
            <div className={styles.accountDropdown}>
              <Link href="/profile">
                <UserRound aria-hidden="true" />
                Профиль организации
              </Link>
              <button onClick={handleSignOut} type="button">
                <LogOut aria-hidden="true" />
                Выйти
              </button>
            </div>
          </details>
        </div>
      </header>

      <section aria-labelledby="board-title" className={styles.boardSection}>
        <div className={styles.boardHeading}>
          <div>
            <span className={styles.eyebrow}>ВАША РАБОЧАЯ ОБЛАСТЬ</span>
            <h1 id="board-title">Доска идей</h1>
            <p>Собирайте идеи и превращайте их в готовый контент.</p>
          </div>
          <div className={styles.boardTip}>
            <Sparkles aria-hidden="true" />
            <span>Перетащите карточку, чтобы изменить её статус</span>
          </div>
        </div>

        {storageError && (
          <p className={styles.storageError} role="alert">
            {storageError}
          </p>
        )}

        <div aria-label="Колонки доски идей" className={styles.board}>
          {ideaStatuses.map((status) => {
            const columnIdeas = ideas.filter((idea) => idea.status === status);

            return (
              <section
                aria-label={`${statusLabels[status]}: ${columnIdeas.length}`}
                className={`${styles.column} ${
                  draggedIdeaId ? styles.columnDropTarget : ""
                }`}
                key={status}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, status)}
              >
                <header className={styles.columnHeader}>
                  <div className={styles.columnHeading}>
                    <h2>{statusLabels[status]}</h2>
                    <span aria-label={formatIdeaCount(columnIdeas.length)}>
                      {columnIdeas.length}
                    </span>
                  </div>
                  <div className={styles.columnActions}>
                    <button
                      aria-label={`Добавить идею в колонку «${statusLabels[status]}»`}
                      className={styles.iconButton}
                      onClick={() => {
                        setEditingIdea(null);
                        setDialogStatus(status);
                      }}
                      type="button"
                    >
                      <Plus aria-hidden="true" />
                    </button>
                  </div>
                </header>

                <div className={styles.cardList}>
                  {columnIdeas.map((idea) => (
                    <article
                      className={`${styles.ideaCard} ${
                        draggedIdeaId === idea.id ? styles.dragging : ""
                      }`}
                      draggable
                      key={idea.id}
                      onDragEnd={() => setDraggedIdeaId(null)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", idea.id);
                        setDraggedIdeaId(idea.id);
                      }}
                    >
                      {idea.image && (
                        <Image
                          alt=""
                          className={styles.ideaImage}
                          height={360}
                          src={idea.image}
                          unoptimized
                          width={576}
                        />
                      )}
                      <div className={styles.ideaContent}>
                        <div className={styles.ideaCardHeader}>
                          <h3>{idea.title}</h3>
                          <div className={styles.ideaActions}>
                            <button
                              aria-label={`Редактировать: ${idea.title}`}
                              className={styles.cardAction}
                              onClick={() => {
                                setDialogStatus(null);
                                setEditingIdea(idea);
                              }}
                              type="button"
                            >
                              <Pencil aria-hidden="true" />
                            </button>
                            <button
                              aria-label={`Удалить: ${idea.title}`}
                              className={styles.cardAction}
                              onClick={() =>
                                updateIdeas((currentIdeas) =>
                                  currentIdeas.filter(
                                    (currentIdea) => currentIdea.id !== idea.id,
                                  ),
                                )
                              }
                              type="button"
                            >
                              <Trash2 aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                        {idea.description && (
                          <p className={styles.ideaDescription}>
                            {idea.description}
                          </p>
                        )}
                        <label className={styles.moveControl}>
                          <span className={styles.visuallyHidden}>
                            Переместить карточку {idea.title}
                          </span>
                          <select
                            aria-label={`Статус карточки «${idea.title}»`}
                            onChange={(event) =>
                              moveIdea(idea.id, event.target.value as IdeaStatus)
                            }
                            value={idea.status}
                          >
                            {ideaStatuses.map((ideaStatus) => (
                              <option key={ideaStatus} value={ideaStatus}>
                                {statusLabels[ideaStatus]}
                              </option>
                            ))}
                          </select>
                          <ArrowRight aria-hidden="true" />
                        </label>
                      </div>
                    </article>
                  ))}

                  {columnIdeas.length === 0 && (
                    <button
                      className={styles.emptyAddButton}
                      onClick={() => {
                        setEditingIdea(null);
                        setDialogStatus(status);
                      }}
                      type="button"
                    >
                      <Plus aria-hidden="true" />
                      <span>Новая идея</span>
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <Link aria-label="Перейти к чатам с идеями" className={styles.chatShortcut} href="/chats">
        <MessageCircle aria-hidden="true" />
      </Link>

      {(dialogStatus || editingIdea) && (
        <IdeaDialog
          idea={editingIdea ?? undefined}
          initialStatus={dialogStatus ?? editingIdea?.status ?? "draft"}
          onClose={() => {
            setDialogStatus(null);
            setEditingIdea(null);
          }}
          onSave={saveIdea}
        />
      )}
    </main>
  );
}
