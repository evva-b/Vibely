"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type DragEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, LogOut, MessageCircle, Pencil, Plus, Sparkles, Trash2, UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeProvider";
import IdeaDialog from "@/features/posts/components/Board/IdeaDialog";
import { clearAccessToken } from "@/features/auth/lib/auth-token";
import { api } from "@/lib/api";
import type { BoardColumn, BoardStatus, Brand, Post, PostCreate } from "@/types/api";
import {
  clearIdeaDialogOpenRequest,
  getIdeaDialogOpenRequest,
  getServerIdeaDialogOpenRequest,
  subscribeToIdeaDialogOpenRequest,
} from "@/features/posts/lib/idea-dialog-navigation";
import styles from "./Board.module.css";

const russianPluralRules = new Intl.PluralRules("ru");

function formatPostCount(count: number) {
  const category = russianPluralRules.select(count);
  const noun = category === "one" ? "пост" : category === "few" ? "поста" : "постов";
  return `${count} ${noun}`;
}

export default function Board() {
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogStatusId, setDialogStatusId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);
  const openDialogRequested = useSyncExternalStore(
    subscribeToIdeaDialogOpenRequest,
    getIdeaDialogOpenRequest,
    getServerIdeaDialogOpenRequest,
  );

  const loadBoard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const brands = await api.listBrands();
      const activeBrand = brands[0] ?? null;
      setBrand(activeBrand);
      setColumns(activeBrand ? await api.getBoard(activeBrand.id) : []);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить доску.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadBoard();
    });
    return () => {
      active = false;
    };
  }, [loadBoard]);

  const closeDialog = useCallback(() => {
    setDialogStatusId(null);
    setEditingPost(null);
    clearIdeaDialogOpenRequest();
  }, []);

  async function savePost(payload: PostCreate, postId?: string) {
    if (!brand) return;
    setIsSaving(true);
    try {
      if (postId) await api.updatePost(postId, payload);
      else await api.createPost(brand.id, payload);
      await loadBoard();
      closeDialog();
    } catch (requestError) {
      throw new Error(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось сохранить пост.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function movePost(postId: string, boardStatusId: string) {
    try {
      await api.updatePost(postId, { board_status_id: boardStatusId });
      await loadBoard();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось переместить пост.",
      );
    } finally {
      setDraggedPostId(null);
    }
  }

  async function deletePost(post: Post) {
    if (!window.confirm(`Удалить пост «${post.title}»?`)) return;
    try {
      await api.deletePost(post.id);
      await loadBoard();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось удалить пост.",
      );
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>, status: BoardStatus) {
    event.preventDefault();
    const postId = event.dataTransfer.getData("text/plain") || draggedPostId;
    if (postId) void movePost(postId, status.id);
  }

  function handleSignOut() {
    clearAccessToken();
    router.replace("/login");
  }

  const requestedStatusId = openDialogRequested ? columns[0]?.id : undefined;

  return (
    <main className={styles.app}>
      <header className={styles.topbar}>
        <Link aria-label="Vibely — главная" className={styles.brand} href="/board">
          <span aria-hidden="true" className={styles.brandMark}>V</span>
          <span>Vibely</span>
        </Link>
        <nav aria-label="Основная навигация" className={styles.navigation}>
          <Link aria-current="page" className={styles.navActive} href="/board">Доска идей</Link>
          <Link className={styles.navLink} href="/chats">История AI</Link>
        </nav>
        <div className={styles.topbarActions}>
          <button
            className={styles.primaryButton}
            disabled={!brand || columns.length === 0}
            onClick={() => {
              setEditingPost(null);
              setDialogStatusId(columns[0]?.id ?? null);
            }}
            type="button"
          >
            <Plus aria-hidden="true" /><span>Новая идея</span>
          </button>
          <ThemeToggle inline />
          <details className={styles.accountMenu}>
            <summary aria-label="Меню профиля"><UserRound aria-hidden="true" /></summary>
            <div className={styles.accountDropdown}>
              <Link href="/profile"><UserRound aria-hidden="true" />Профиль компании</Link>
              <button onClick={handleSignOut} type="button"><LogOut aria-hidden="true" />Выйти</button>
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
            <Sparkles aria-hidden="true" /><span>Перетащите карточку, чтобы изменить её статус</span>
          </div>
        </div>

        {error && <p className={styles.storageError} role="alert">{error}</p>}
        {loading ? (
          <p aria-live="polite" className={styles.emptyState}>Загружаем доску…</p>
        ) : !brand ? (
          <div className={styles.emptyState}>
            <h2>Сначала создайте профиль бренда</h2>
            <p>Доска и публикации будут связаны с вашей организацией.</p>
            <Link className={styles.primaryButton} href="/profile">Настроить профиль</Link>
          </div>
        ) : columns.length === 0 ? (
          <p className={styles.storageError} role="alert">Backend не вернул ни одного статуса доски.</p>
        ) : (
          <div aria-label="Колонки доски идей" className={styles.board}>
            {columns.map((column) => (
              <section
                aria-label={`${column.name}: ${column.posts.length}`}
                className={`${styles.column} ${draggedPostId ? styles.columnDropTarget : ""}`}
                key={column.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, column)}
              >
                <header className={styles.columnHeader}>
                  <div className={styles.columnHeading}>
                    <h2>{column.name}</h2>
                    <span aria-label={formatPostCount(column.posts.length)}>{column.posts.length}</span>
                  </div>
                  <div className={styles.columnActions}>
                    <button
                      aria-label={`Добавить пост в колонку «${column.name}»`}
                      className={styles.iconButton}
                      onClick={() => {
                        setEditingPost(null);
                        setDialogStatusId(column.id);
                      }}
                      type="button"
                    ><Plus aria-hidden="true" /></button>
                  </div>
                </header>
                <div className={styles.cardList}>
                  {column.posts.map((post) => (
                    <article
                      className={`${styles.ideaCard} ${draggedPostId === post.id ? styles.dragging : ""}`}
                      draggable
                      key={post.id}
                      onDragEnd={() => setDraggedPostId(null)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", post.id);
                        setDraggedPostId(post.id);
                      }}
                    >
                      <div className={styles.ideaContent}>
                        <div className={styles.ideaCardHeader}>
                          <h3>{post.title}</h3>
                          <div className={styles.ideaActions}>
                            <button
                              aria-label={`Редактировать: ${post.title}`}
                              className={styles.cardAction}
                              onClick={() => {
                                setEditingPost(post);
                                setDialogStatusId(null);
                              }}
                              type="button"
                            ><Pencil aria-hidden="true" /></button>
                            <button
                              aria-label={`Удалить: ${post.title}`}
                              className={styles.cardAction}
                              onClick={() => void deletePost(post)}
                              type="button"
                            ><Trash2 aria-hidden="true" /></button>
                          </div>
                        </div>
                        <p className={styles.ideaDescription}>{post.text}</p>
                        <label className={styles.moveControl}>
                          <span className={styles.visuallyHidden}>Статус поста {post.title}</span>
                          <select
                            aria-label={`Статус поста «${post.title}»`}
                            onChange={(event) => void movePost(post.id, event.target.value)}
                            value={column.id}
                          >
                            {columns.map((status) => (
                              <option key={status.id} value={status.id}>{status.name}</option>
                            ))}
                          </select>
                          <ArrowRight aria-hidden="true" />
                        </label>
                      </div>
                    </article>
                  ))}
                  {column.posts.length === 0 && (
                    <button
                      className={styles.emptyAddButton}
                      onClick={() => {
                        setEditingPost(null);
                        setDialogStatusId(column.id);
                      }}
                      type="button"
                    ><Plus aria-hidden="true" /><span>Новый пост</span></button>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
      <Link aria-label="Перейти к истории генераций" className={styles.chatShortcut} href="/chats">
        <MessageCircle aria-hidden="true" />
      </Link>
      {(dialogStatusId || editingPost || requestedStatusId) && (
        <IdeaDialog
          isSaving={isSaving}
          post={editingPost ?? undefined}
          statuses={columns.map(({ id, name, position }) => ({ id, name, position }))}
          initialStatusId={dialogStatusId ?? editingPost?.board_status_id ?? requestedStatusId ?? ""}
          onClose={closeDialog}
          onSave={savePost}
        />
      )}
    </main>
  );
}
