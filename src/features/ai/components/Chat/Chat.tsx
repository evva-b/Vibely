"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Clipboard,
  ImagePlus,
  Menu,
  MessageCircle,
  Pencil,
  Send,
  Sparkles,
  Trash2,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeProvider";
import UserAvatarMenu from "@/components/navigation/UserAvatarMenu";
import { api, ApiError } from "@/lib/api";
import type {
  AdaptedContent,
  BoardColumn,
  ChatMessage,
  Post,
  PostChat,
  SocialNetwork,
  Brand,
} from "@/types/api";
import styles from "./Chat.module.css";

type GeneratedContent = {
  title?: string;
  text?: string;
  why_it_works?: string;
};

const quickActions = [
  "Сделай текст короче и динамичнее",
  "Добавь яркий призыв к действию",
  "Предложи более цепляющий заголовок",
  "Сделай тон теплее и дружелюбнее",
];

const stylePresets = [
  "Тёплый и эстетичный",
  "Дружелюбный и простой",
  "Экспертный и деловой",
  "Энергичный и смелый",
  "Ироничный и лёгкий",
  "Минималистичный и спокойный",
];

type PendingAttachment = {
  data: string;
  type: "image/jpeg";
  preview: string;
  name: string;
};

async function compressImage(file: File): Promise<PendingAttachment> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Выберите изображение в формате JPG, PNG или WebP.");
  }
  if (file.size > 15_000_000) {
    throw new Error("Размер исходного изображения не должен превышать 15 МБ.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Не удалось открыть выбранное изображение.");
  }
  try {
    if (bitmap.width * bitmap.height > 40_000_000) {
      throw new Error("Изображение слишком большое для обработки в браузере.");
    }

    let scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Браузер не смог обработать изображение.");

    let blob: Blob | null = null;
    for (let resizeAttempt = 0; resizeAttempt < 4 && !blob; resizeAttempt += 1) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.82, 0.68, 0.54, 0.4]) {
        const candidate = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", quality),
        );
        if (candidate && candidate.size <= 650_000) {
          blob = candidate;
          break;
        }
      }
      if (!blob) scale *= 0.75;
    }
    if (!blob) throw new Error("Не удалось сжать изображение до допустимого размера.");

    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    const data = btoa(binary);
    return {
      data,
      type: "image/jpeg",
      preview: `data:image/jpeg;base64,${data}`,
      name: file.name,
    };
  } finally {
    bitmap.close();
  }
}

function parseAssistantContent(value: string): GeneratedContent {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed === "object" && parsed !== null) {
      const content = parsed as Record<string, unknown>;
      return {
        title: typeof content.title === "string" ? content.title : undefined,
        text: typeof content.text === "string" ? content.text : undefined,
        why_it_works:
          typeof content.why_it_works === "string"
            ? content.why_it_works
            : undefined,
      };
    }
  } catch {
    return { text: value };
  }
  return { text: value };
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("ru", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function rationalePoints(value: string) {
  const points = value
    .split(/\r?\n|(?<=[.!?])\s+/)
    .map((point) => point.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
  return points.length > 1 ? points : [value.trim()];
}

function replacePost(columns: BoardColumn[], updatedPost: Post) {
  return columns.map((column) => ({
    ...column,
    posts: column.posts
      .filter((post) => post.id !== updatedPost.id)
      .concat(
        column.id === updatedPost.board_status_id ? [updatedPost] : [],
      ),
  }));
}

export default function Chat({ postId }: { postId?: string }) {
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [networks, setNetworks] = useState<SocialNetwork[]>([]);
  const [adaptations, setAdaptations] = useState<AdaptedContent[]>([]);
  const [chat, setChat] = useState<PostChat | null>(null);
  const selectedPostId = postId ?? "";
  const [networkId, setNetworkId] = useState("");
  const [adaptationStyle, setAdaptationStyle] = useState("Дружелюбный и простой");
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [setupPrompt, setSetupPrompt] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editText, setEditText] = useState("");
  const [editStatusId, setEditStatusId] = useState("");
  const [isSavingPost, setIsSavingPost] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingChatFor, setLoadingChatFor] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isAdapting, setIsAdapting] = useState(false);
  const [isAdaptationDialogOpen, setIsAdaptationDialogOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState("");
  const [isCopying, setIsCopying] = useState(false);

  const posts = useMemo(() => columns.flatMap((column) => column.posts), [columns]);
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;
  const hasSelectedPost = selectedPost !== null;
  const selectedChat = chat?.post.id === selectedPostId ? chat : null;
  const isChatLoading = loadingChatFor === selectedPostId;
  const hasAssistantResponse = Boolean(
    selectedChat?.messages.some((message) => message.role === "assistant"),
  );
  const selectedNetwork = networks.find((network) => network.id === networkId);
  const contextualQuickActions = selectedNetwork?.name.toLocaleLowerCase().includes("instagram")
    || selectedNetwork?.name.toLocaleLowerCase().includes("инстаграм")
    ? [
        "Добавь 3–5 подходящих хэштегов",
        "Усиль первую строку и вовлечение",
        "Добавь короткий призыв сохранить пост",
      ]
    : selectedNetwork?.name.toLocaleLowerCase().includes("telegram")
      || selectedNetwork?.name.toLocaleLowerCase().includes("телеграм")
      ? [
          "Сделай текст компактнее для Telegram",
          "Добавь ясный призыв к обсуждению",
          "Разбей текст на удобные абзацы",
        ]
      : quickActions;
  const previousAdaptations = adaptations.filter((adaptation) => {
    if (adaptation.post_id !== selectedPostId) return false;
    const networkName = networks.find(
      (network) => network.id === adaptation.social_network_id,
    )?.name;
    return !selectedChat?.messages.some((message) => {
      if (message.role !== "assistant" || message.kind !== "adaptation") return false;
      const messageContent = parseAssistantContent(message.content);
      return (
        message.platform === networkName &&
        messageContent.text === adaptation.text
      );
    });
  });
  const visibleColumns = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return columns.map((column) => ({
      ...column,
      posts: column.posts.filter((post) =>
        `${post.title} ${post.text}`.toLocaleLowerCase().includes(normalizedQuery),
      ),
    }));
  }, [columns, query]);

  const loadWorkspace = useCallback(async () => {
    setError("");
    try {
      const brands = await api.listBrands();
      const activeBrand = brands[0] ?? null;
      setBrand(activeBrand);
      if (!activeBrand) {
        setColumns([]);
        setNetworks([]);
        return;
      }
      const [board, socialNetworks] = await Promise.all([
        api.getBoard(activeBrand.id),
        api.listSocialNetworks(),
      ]);
      setColumns(board);
      setNetworks(socialNetworks);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить доску и социальные сети.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadWorkspace();
    });
    return () => {
      active = false;
    };
  }, [loadWorkspace]);

  useEffect(() => {
    let active = true;
    if (!selectedPostId || !hasSelectedPost) return;
    queueMicrotask(() => {
      if (!active) return;
      setLoadingChatFor(selectedPostId);
      setError("");
      void api.openPostChat(selectedPostId)
        .then((result) => {
          if (active) {
            setChat(result);
            setNetworkId(result.context.social_network_id ?? "");
            setAdaptationStyle(result.context.style ?? "Дружелюбный и простой");
          }
        })
        .catch((requestError: unknown) => {
          if (active) {
            setError(
              requestError instanceof Error
                ? requestError.message
                : "Не удалось открыть чат публикации.",
            );
          }
        })
        .finally(() => {
          if (active) setLoadingChatFor("");
        });
    });
    return () => {
      active = false;
    };
  }, [selectedPostId, hasSelectedPost]);

  useEffect(() => {
    let active = true;
    if (!selectedPostId || !hasSelectedPost) return;
    api.listAdaptations(selectedPostId)
      .then((items) => {
        if (active) setAdaptations(items);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Не удалось загрузить сохранённые адаптации.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [selectedPostId, hasSelectedPost]);

  function openPost(post: Post) {
    setError("");
    setNotice("");
    setDraft("");
    setPendingAttachment(null);
    setSetupPrompt(null);
    setIsSetupOpen(false);
    setIsSidebarOpen(false);
    router.push(`/chats/${post.id}`);
  }

  function syncUpdatedPost(updatedPost: Post) {
    setColumns((current) => replacePost(current, updatedPost));
  }

  async function sendMessage(
    prompt = draft,
    context?: { social_network_id: string; style: string },
  ): Promise<boolean> {
    const cleanPrompt = prompt.trim() || (
      pendingAttachment ? "Опиши прикреплённое изображение и предложи идею публикации." : ""
    );
    if (!selectedPost || !cleanPrompt || isSending) return false;
    if (
      selectedChat?.messages.length === 0 &&
      !context &&
      (!selectedChat.context.social_network_id || !selectedChat.context.style)
    ) {
      setSetupPrompt(cleanPrompt);
      setIsSetupOpen(true);
      return false;
    }
    setIsSending(true);
    setError("");
    setNotice("");
    try {
      const activeContext = context ?? (
        networkId && adaptationStyle.trim()
          ? { social_network_id: networkId, style: adaptationStyle.trim() }
          : {}
      );
      const result = await api.sendPostChatMessage(selectedPost.id, {
        prompt: cleanPrompt,
        ...activeContext,
        ...(pendingAttachment
          ? {
              image_data: pendingAttachment.data,
              image_type: pendingAttachment.type,
            }
          : {}),
      });
      setChat(result);
      syncUpdatedPost(result.post);
      setDraft("");
      setPendingAttachment(null);
      setSetupPrompt(null);
      setNotice("Публикация обновлена и сохранена на доске.");
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status >= 500
          ? "Не удалось получить ответ от AI. Проверьте доступность языковой модели."
          : requestError instanceof Error
            ? requestError.message
            : "Не удалось отправить сообщение.",
      );
      return false;
    } finally {
      setIsSending(false);
    }
  }

  async function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsCompressingImage(true);
    setError("");
    try {
      setPendingAttachment(await compressImage(file));
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "Не удалось обработать изображение.");
    } finally {
      setIsCompressingImage(false);
    }
  }

  async function saveChatSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const style = adaptationStyle.trim();
    if (!selectedPost || !networkId || !style) {
      setError("Выберите социальную сеть и укажите стиль публикации.");
      return;
    }
    const context = { social_network_id: networkId, style };
    if (setupPrompt !== null) {
      setIsSetupOpen(false);
      const sent = await sendMessage(setupPrompt, context);
      if (!sent) setIsSetupOpen(true);
      return;
    }
    setIsSending(true);
    setError("");
    setNotice("");
    try {
      const updatedChat = await api.updatePostChatContext(selectedPost.id, context);
      setChat(updatedChat);
      setNotice("Параметры публикации сохранены.");
      setIsSetupOpen(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить параметры.");
    } finally {
      setIsSending(false);
    }
  }

  function startEditingPost(post: Post) {
    setEditingPost(post);
    setEditTitle(post.title);
    setEditText(post.text);
    setEditStatusId(post.board_status_id);
  }

  async function savePostEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPost || !editTitle.trim() || !editText.trim() || isSavingPost) return;
    setIsSavingPost(true);
    setError("");
    try {
      const updatedPost = await api.updatePost(editingPost.id, {
        title: editTitle.trim(),
        text: editText.trim(),
        board_status_id: editStatusId,
      });
      syncUpdatedPost(updatedPost);
      if (selectedPostId === updatedPost.id && chat) {
        setChat({ ...chat, post: updatedPost });
      }
      setEditingPost(null);
      setNotice("Публикация обновлена.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось обновить публикацию.");
    } finally {
      setIsSavingPost(false);
    }
  }

  async function deletePost(post: Post) {
    if (!window.confirm(`Удалить публикацию «${post.title}»? Это действие нельзя отменить.`)) return;
    setError("");
    try {
      await api.deletePost(post.id);
      setColumns((current) => current.map((column) => ({
        ...column,
        posts: column.posts.filter((item) => item.id !== post.id),
      })));
      if (selectedPostId === post.id) {
        setChat(null);
        router.push("/chats");
      }
      setNotice("Публикация удалена.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось удалить публикацию.");
    }
  }

  async function generateAdaptation() {
    if (!selectedPost || !networkId || !adaptationStyle.trim() || isAdapting) return;
    setIsAdapting(true);
    setError("");
    setNotice("");
    try {
      const result = await api.generateAdaptation(
        selectedPost.id,
        networkId,
        adaptationStyle.trim(),
      );
      setAdaptations((current) => [
        result.adaptation,
        ...current.filter((item) => item.id !== result.adaptation.id),
      ]);
      const updatedChat = await api.openPostChat(selectedPost.id);
      setChat(updatedChat);
      setNotice(`Адаптация для ${networks.find((item) => item.id === networkId)?.name ?? "соцсети"} добавлена в этот чат.`);
      setIsAdaptationDialogOpen(false);
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status >= 500
          ? "Не удалось создать адаптацию. Проверьте доступность языковой модели."
          : requestError instanceof Error
            ? requestError.message
            : "Не удалось создать адаптацию.",
      );
    } finally {
      setIsAdapting(false);
    }
  }

  function openAdaptationDialog() {
    setNetworkId((current) => current || networks[0]?.id || "");
    setAdaptationStyle((current) => current || "Дружелюбный и простой");
    setError("");
    setIsAdaptationDialogOpen(true);
  }

  async function updateFeedback(message: ChatMessage, rating: "up" | "down" | null) {
    if (!chat) return;
    try {
      await api.setChatFeedback(chat.request.id, message.id, rating);
      setChat((current) => current
        ? {
            ...current,
            messages: current.messages.map((item) =>
              item.id === message.id ? { ...item, feedback: rating } : item,
            ),
          }
        : current);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось сохранить оценку ответа.",
      );
    }
  }

  async function copyMessage(message: ChatMessage) {
    const content = parseAssistantContent(message.content);
    const value = [content.title, content.text].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(value || message.content);
      setCopiedMessageId(message.id);
      setIsCopying(true);
      window.setTimeout(() => {
        setCopiedMessageId("");
        setIsCopying(false);
      }, 1600);
    } catch {
      setError("Не удалось скопировать текст. Проверьте разрешение браузера.");
    }
  }

  return (
    <main className={styles.app}>
      {isSidebarOpen && (
        <button
          aria-label="Закрыть список публикаций"
          className={styles.drawerBackdrop}
          onClick={() => setIsSidebarOpen(false)}
          type="button"
        />
      )}
      <aside
        aria-label="Публикации по статусам"
        className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ""}`}
      >
        <div className={styles.sidebarHeading}>
          <Link aria-label="Vibely — главная" className={styles.brand} href="/board">
            <span aria-hidden="true" className={styles.brandMark}>V</span><span>Vibely</span>
          </Link>
          <button
            aria-label="Закрыть список публикаций"
            className={styles.drawerClose}
            onClick={() => setIsSidebarOpen(false)}
            type="button"
          ><X aria-hidden="true" /></button>
        </div>
        <Link className={styles.newChatButton} href="/board">
          <Sparkles aria-hidden="true" />Открыть доску идей
        </Link>
        <label className={styles.searchField}>
          <MessageCircle aria-hidden="true" />
          <span className={styles.visuallyHidden}>Поиск публикаций</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти публикацию..."
            value={query}
          />
          {query && (
            <button aria-label="Очистить поиск" onClick={() => setQuery("")} type="button">
              <X aria-hidden="true" />
            </button>
          )}
        </label>
        <div className={styles.ideaList}>
          {visibleColumns.map((column) => (
            <section className={styles.ideaGroup} key={column.id}>
              <h2 className={styles.groupHeading}>
                <span aria-hidden="true" className={styles.statusDot} data-position={column.position} />
                {column.name}
                <span className={styles.groupCount}>{column.posts.length}</span>
              </h2>
              {column.posts.map((post) => (
                <div className={styles.ideaPreviewRow} key={post.id}>
                  <button
                    aria-current={selectedPostId === post.id ? "page" : undefined}
                    className={`${styles.ideaPreview} ${selectedPostId === post.id ? styles.ideaPreviewActive : ""}`}
                    onClick={() => openPost(post)}
                    type="button"
                  >
                    <strong>{post.title}</strong>
                    <span>{post.text}</span>
                  </button>
                  <div className={styles.ideaActions}>
                    <button aria-label={`Редактировать: ${post.title}`} onClick={() => startEditingPost(post)} type="button">
                      <Pencil aria-hidden="true" />
                    </button>
                    <button aria-label={`Удалить: ${post.title}`} onClick={() => void deletePost(post)} type="button">
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
              {query && column.posts.length === 0 && (
                <p className={styles.noResults}>Нет совпадений</p>
              )}
            </section>
          ))}
          {!isLoading && posts.length === 0 && (
            <p className={styles.noResults}>Создайте публикацию на доске, чтобы начать отдельный чат с AI.</p>
          )}
        </div>
      </aside>

      <section aria-label="Чат с AI по публикации" className={styles.chatPanel}>
        <header className={styles.topbar}>
          <nav aria-label="Основная навигация" className={styles.navigation}>
            <button
              aria-label="Открыть список публикаций"
              aria-expanded={isSidebarOpen}
              className={styles.mobileMenuButton}
              onClick={() => setIsSidebarOpen(true)}
              type="button"
            ><Menu aria-hidden="true" /></button>
            <Link className={styles.navLink} href="/board">Доска идей</Link>
            <Link aria-current="page" className={styles.navActive} href="/chats">Чаты</Link>
          </nav>
          <div className={styles.topbarActions}>
            <ThemeToggle inline />
            <Link
              aria-label={`Профиль компании: ${brand?.name ?? "Профиль компании"}`}
              className={styles.organizationBadge}
              href="/profile"
            >
              <span className={styles.organizationIcon}><UserRound aria-hidden="true" /></span>
              <span>{brand?.name ?? "Профиль компании"}</span>
            </Link>
            <UserAvatarMenu />
          </div>
        </header>

        <div aria-live="polite" className={styles.conversation}>
          {isLoading ? (
            <div className={styles.emptyConversation}><p>Загружаем публикации…</p></div>
          ) : !brand ? (
            <div className={styles.emptyConversation}>
              <span className={styles.emptyIcon}><Sparkles aria-hidden="true" /></span>
              <h1>Сначала настройте бренд</h1>
              <p>Профиль бренда нужен, чтобы AI учитывал аудиторию и стиль ваших публикаций.</p>
              <Link className={styles.primaryButton} href="/profile">Настроить профиль</Link>
            </div>
          ) : !selectedPostId ? (
            <div className={styles.emptyConversation}>
              <span className={styles.emptyIcon}><MessageCircle aria-hidden="true" /></span>
              <h1>Выберите публикацию</h1>
              <p>У каждой идеи на доске свой отдельный чат. Выберите публикацию в списке или создайте её.</p>
              <Link className={styles.primaryButton} href="/board">Перейти на доску</Link>
            </div>
          ) : isChatLoading ? (
            <div className={styles.emptyConversation}><p>Открываем чат публикации…</p></div>
          ) : !selectedPost ? (
            <div className={styles.emptyConversation}>
              <span className={styles.emptyIcon}><MessageCircle aria-hidden="true" /></span>
              <h1>Публикация не найдена</h1>
              <p>Возможно, её удалили или она больше недоступна.</p>
              <Link className={styles.primaryButton} href="/chats">К списку чатов</Link>
            </div>
          ) : (
            <div className={styles.messageList}>
              <header className={styles.conversationHeading}>
                <span className={styles.eyebrow}>ЧАТ ПО ПУБЛИКАЦИИ</span>
                <div className={styles.conversationTitle}>
                  <h1>{chat?.post.title ?? selectedPost.title}</h1>
                  {hasAssistantResponse && (
                    <button
                      className={styles.settingsButton}
                      onClick={() => {
                        setSetupPrompt(null);
                        setIsSetupOpen(true);
                      }}
                      type="button"
                    >Изменить параметры</button>
                  )}
                </div>
                <p>Ответы AI и адаптации сохраняются в контексте этой публикации.</p>
              </header>
              {selectedChat?.messages.map((message) => {
                if (message.role === "user") {
                  return (
                    <article className={styles.userMessage} key={message.id}>
                      <span className={styles.messageTime}>
                        {message.kind === "adaptation" ? `Адаптация · ${message.platform ?? ""}` : "Вы"} · {formatTime(message.created_at)}
                      </span>
                      <p>{message.content}</p>
                      {message.image_data && message.image_type && (
                        <div className={styles.messageAttachments}>
                          <a
                            aria-label="Открыть прикреплённое изображение"
                            className={styles.messageAttachment}
                            href={`data:${message.image_type};base64,${message.image_data}`}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <Image
                              alt="Изображение, прикреплённое к сообщению"
                              height={240}
                              src={`data:${message.image_type};base64,${message.image_data}`}
                              unoptimized
                              width={340}
                            />
                          </a>
                        </div>
                      )}
                    </article>
                  );
                }
                const content = parseAssistantContent(message.content);
                return (
                  <article className={styles.assistantMessage} key={message.id}>
                    <div className={styles.assistantAvatar} aria-hidden="true">V</div>
                    <div className={styles.assistantContent}>
                      <header className={styles.assistantHeader}>
                        <span>Vibely AI{message.platform ? ` · ${message.platform}` : ""}</span>
                        <div className={styles.messageActions}>
                          <button
                            aria-label={copiedMessageId === message.id ? "Текст скопирован" : "Скопировать ответ"}
                            onClick={() => void copyMessage(message)}
                            type="button"
                          >{isCopying && copiedMessageId === message.id ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}</button>
                          {message.kind === "post" && (
                            <button
                              aria-label="Адаптировать публикацию для соцсети"
                              onClick={openAdaptationDialog}
                              type="button"
                            ><Sparkles aria-hidden="true" /></button>
                          )}
                          <button
                            aria-label="Ответ полезен"
                            aria-pressed={message.feedback === "up"}
                            className={message.feedback === "up" ? styles.actionActive : ""}
                            onClick={() => void updateFeedback(message, message.feedback === "up" ? null : "up")}
                            type="button"
                          ><ThumbsUp aria-hidden="true" /></button>
                          <button
                            aria-label="Ответ не полезен"
                            aria-pressed={message.feedback === "down"}
                            className={message.feedback === "down" ? styles.actionActive : ""}
                            onClick={() => void updateFeedback(message, message.feedback === "down" ? null : "down")}
                            type="button"
                          ><ThumbsDown aria-hidden="true" /></button>
                        </div>
                      </header>
                      <div className={styles.generatedPost}>
                        {content.title && <h2>{content.title}</h2>}
                        {content.text?.split("\n").map((paragraph, index) =>
                          paragraph
                            ? <p key={`${message.id}-${index}`}>{paragraph}</p>
                            : <br key={`${message.id}-${index}`} />,
                        )}
                        {content.why_it_works && (
                          <div className={styles.whyItWorks}>
                            <strong>Почему это сработает</strong>
                            <ul>
                              {rationalePoints(content.why_it_works).map((point, index) => <li key={`${message.id}-reason-${index}`}>{point}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                      <footer className={styles.assistantFooter}>
                        <span>{message.kind === "adaptation" ? `Адаптация для ${message.platform ?? "соцсети"}` : "Текст публикации"}</span>
                        <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
                      </footer>
                    </div>
                  </article>
                );
              })}
              {(!selectedChat || selectedChat.messages.length === 0) && (
                <div className={styles.emptyConversation}>
                  <span className={styles.emptyIcon}><Sparkles aria-hidden="true" /></span>
                  <h2>Давайте доработаем эту идею</h2>
                  <p>Задайте вопрос или попросите AI изменить заголовок, тон или текст публикации.</p>
                </div>
              )}
              {previousAdaptations.length > 0 && (
                <section aria-label="Ранее сохранённые адаптации" className={styles.previousAdaptations}>
                  <h2>Сохранённые адаптации</h2>
                  {previousAdaptations.map((adaptation) => (
                    <article className={styles.generatedPost} key={adaptation.id}>
                      <h3>{networks.find((network) => network.id === adaptation.social_network_id)?.name ?? "Адаптация"}</h3>
                      {adaptation.text.split("\n").map((paragraph, index) =>
                        paragraph
                          ? <p key={`${adaptation.id}-${index}`}>{paragraph}</p>
                          : <br key={`${adaptation.id}-${index}`} />,
                      )}
                    </article>
                  ))}
                </section>
              )}
              {hasAssistantResponse && contextualQuickActions.length > 0 && (
                <div aria-label="Быстрые действия" className={styles.quickPrompts}>
                  {contextualQuickActions.map((action) => (
                    <button disabled={isSending} key={action} onClick={() => void sendMessage(action)} type="button">
                      <Sparkles aria-hidden="true" />{action}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {error && <p className={styles.storageError} role="alert">{error}</p>}
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
            <button aria-label="Закрыть уведомление" onClick={() => setNotice("")} type="button"><X aria-hidden="true" /></button>
          </p>
        )}

        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage();
          }}
        >
          <input
            accept="image/jpeg,image/png,image/webp"
            className={styles.visuallyHidden}
            onChange={(event) => void handleImageSelection(event)}
            ref={imageInput}
            type="file"
          />
          <button
            aria-label={isCompressingImage ? "Обрабатываем изображение" : "Прикрепить изображение"}
            className={styles.attachButton}
            disabled={!selectedPost || isSending || isChatLoading || isCompressingImage}
            onClick={() => imageInput.current?.click()}
            type="button"
          ><ImagePlus aria-hidden="true" /></button>
          <div className={styles.composerContents}>
            <label className={styles.visuallyHidden} htmlFor="chat-prompt">Сообщение для Vibely AI</label>
            {pendingAttachment && (
              <div className={styles.pendingAttachments}>
                <div className={styles.pendingAttachment}>
                  <Image alt="" height={40} src={pendingAttachment.preview} unoptimized width={40} />
                  <span>{pendingAttachment.name}</span>
                  <button
                    aria-label="Убрать прикреплённое изображение"
                    onClick={() => setPendingAttachment(null)}
                    type="button"
                  ><X aria-hidden="true" /></button>
                </div>
              </div>
            )}
            <textarea
              disabled={!selectedPost || isSending || isChatLoading || isCompressingImage}
              id="chat-prompt"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              placeholder={selectedPost ? "Напишите, что изменить в публикации…" : "Сначала выберите публикацию"}
              rows={1}
              value={draft}
            />
          </div>
          <button
            aria-label={isSending ? "AI формирует ответ" : "Отправить сообщение"}
            className={styles.sendButton}
            disabled={!selectedPost || (!draft.trim() && !pendingAttachment) || isSending || isChatLoading || isCompressingImage}
            type="submit"
          >{isSending ? <span className={styles.loadingSpinner} aria-hidden="true" /> : <Send aria-hidden="true" />}</button>
        </form>
      </section>

      {isSetupOpen && (
        <div className={styles.modalBackdrop}>
          <section aria-labelledby="chat-settings-title" aria-modal="true" className={styles.dialog} role="dialog">
            <header className={styles.dialogHeader}>
              <div>
                <span className={styles.eyebrow}>НАСТРОЙКИ ПУБЛИКАЦИИ</span>
                <h2 id="chat-settings-title">{setupPrompt !== null ? "Перед началом выберите параметры" : "Изменить параметры"}</h2>
              </div>
              <button aria-label="Закрыть настройки" className={styles.dialogClose} onClick={() => setIsSetupOpen(false)} type="button">
                <X aria-hidden="true" />
              </button>
            </header>
            <p className={styles.dialogDescription}>AI адаптирует содержание и тон под выбранную площадку и аудиторию.</p>
            {error && <p className={styles.dialogError} role="alert">{error}</p>}
            <form className={styles.dialogForm} onSubmit={(event) => void saveChatSettings(event)}>
              <label>
                <span>Социальная сеть</span>
                <select onChange={(event) => setNetworkId(event.target.value)} required value={networkId}>
                  <option value="" disabled>Выберите соцсеть</option>
                  {networks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}
                </select>
              </label>
              <label>
                <span>Стиль текста</span>
                <select
                  onChange={(event) => setAdaptationStyle(event.target.value === "__custom" ? "" : event.target.value)}
                  value={stylePresets.includes(adaptationStyle) ? adaptationStyle : "__custom"}
                >
                  {stylePresets.map((preset) => <option key={preset} value={preset}>{preset}</option>)}
                  <option value="__custom">Свой стиль</option>
                </select>
              </label>
              {!stylePresets.includes(adaptationStyle) && (
                <label>
                  <span>Опишите желаемый стиль</span>
                  <input
                    autoComplete="off"
                    maxLength={100}
                    onChange={(event) => setAdaptationStyle(event.target.value)}
                    placeholder="Например, экспертный и лаконичный"
                    required
                    value={adaptationStyle}
                  />
                </label>
              )}
              <div className={styles.dialogActions}>
                <button className={styles.secondaryButton} onClick={() => setIsSetupOpen(false)} type="button">Отмена</button>
                <button
                  className={styles.adaptationButton}
                  disabled={!networkId || !adaptationStyle.trim() || isSending}
                  type="submit"
                >{isSending ? "Сохраняем…" : setupPrompt !== null ? "Начать чат" : "Сохранить параметры"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isAdaptationDialogOpen && (
        <div className={styles.modalBackdrop}>
          <section aria-labelledby="adaptation-dialog-title" aria-modal="true" className={styles.dialog} role="dialog">
            <header className={styles.dialogHeader}>
              <div>
                <span className={styles.eyebrow}>АДАПТАЦИЯ ПУБЛИКАЦИИ</span>
                <h2 id="adaptation-dialog-title">Выберите соцсеть</h2>
              </div>
              <button
                aria-label="Закрыть окно адаптации"
                className={styles.dialogClose}
                onClick={() => setIsAdaptationDialogOpen(false)}
                type="button"
              ><X aria-hidden="true" /></button>
            </header>
            <p className={styles.dialogDescription}>
              Создадим отдельную версию текущей публикации. Исходный пост останется без изменений.
            </p>
            {error && <p className={styles.dialogError} role="alert">{error}</p>}
            <form
              className={styles.dialogForm}
              onSubmit={(event) => {
                event.preventDefault();
                void generateAdaptation();
              }}
            >
              <label>
                <span>Социальная сеть</span>
                <select onChange={(event) => setNetworkId(event.target.value)} required value={networkId}>
                  <option value="" disabled>Выберите соцсеть</option>
                  {networks.map((network) => (
                    <option key={network.id} value={network.id}>{network.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Желаемый стиль</span>
                <input
                  autoComplete="off"
                  maxLength={100}
                  onChange={(event) => setAdaptationStyle(event.target.value)}
                  placeholder="Например, экспертный и лаконичный"
                  required
                  value={adaptationStyle}
                />
              </label>
              <div className={styles.dialogActions}>
                <button className={styles.secondaryButton} onClick={() => setIsAdaptationDialogOpen(false)} type="button">
                  Отмена
                </button>
                <button
                  className={styles.adaptationButton}
                  disabled={!networkId || !adaptationStyle.trim() || isAdapting}
                  type="submit"
                >{isAdapting ? "Адаптируем…" : "Создать адаптацию"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {editingPost && (
        <div className={styles.modalBackdrop}>
          <section aria-labelledby="edit-post-title" aria-modal="true" className={styles.dialog} role="dialog">
            <header className={styles.dialogHeader}>
              <h2 id="edit-post-title">Редактировать публикацию</h2>
              <button aria-label="Закрыть редактирование" className={styles.dialogClose} onClick={() => setEditingPost(null)} type="button">
                <X aria-hidden="true" />
              </button>
            </header>
            <form className={styles.dialogForm} onSubmit={(event) => void savePostEdit(event)}>
              <label>
                <span>Заголовок</span>
                <input maxLength={255} onChange={(event) => setEditTitle(event.target.value)} required value={editTitle} />
              </label>
              <label>
                <span>Текст</span>
                <textarea onChange={(event) => setEditText(event.target.value)} required rows={6} value={editText} />
              </label>
              <label>
                <span>Статус</span>
                <select onChange={(event) => setEditStatusId(event.target.value)} required value={editStatusId}>
                  {columns.map((column) => <option key={column.id} value={column.id}>{column.name}</option>)}
                </select>
              </label>
              <div className={styles.dialogActions}>
                <button className={styles.secondaryButton} onClick={() => setEditingPost(null)} type="button">Отмена</button>
                <button className={styles.adaptationButton} disabled={!editTitle.trim() || !editText.trim() || isSavingPost} type="submit">
                  {isSavingPost ? "Сохраняем…" : "Сохранить"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
