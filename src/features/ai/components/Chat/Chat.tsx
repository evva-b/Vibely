"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  Check,
  Clipboard,
  FileText,
  Lightbulb,
  LogOut,
  Menu,
  MoreHorizontal,
  MessageSquarePlus,
  Paperclip,
  Plus,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { ThemeToggle } from "@/components/theme/ThemeProvider";
import { clearMockUser } from "@/features/auth/lib/local-auth";
import {
  getChatStateSnapshot,
  getChatStorageError,
  getServerChatStateSnapshot,
  subscribeToChatState,
  updateChatState,
  createPlaceholderMessages,
  type ChatAttachment,
  type ChatMessage,
  type Conversation,
} from "@/features/ai/lib/chat-store";
import IdeaDialog from "@/features/posts/components/Board/IdeaDialog";
import {
  getIdeasSnapshot,
  getServerIdeasSnapshot,
  subscribeToIdeas,
  updateIdeas,
} from "@/features/posts/lib/idea-store";
import {
  getCompanyProfileSnapshot,
  getServerCompanyProfileSnapshot,
  subscribeToCompanyProfile,
} from "@/features/brands/lib/company-profile-store";
import {
  statusLabels,
  type Idea,
} from "@/features/posts/types";
import styles from "./Chat.module.css";

const ideaStatusOrder = ["inProgress", "todo", "draft", "done"] as const;
const emptyMessages: ChatMessage[] = [];
const MAX_ATTACHMENT_SIZE = 2 * 1024 * 1024;
const MAX_ATTACHMENTS = 3;
const MAX_TOTAL_ATTACHMENT_SIZE = 5 * 1024 * 1024;

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function getTimestamp() {
  return Date.now();
}

function formatTime() {
  return new Intl.DateTimeFormat("ru", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function createDemoAnswer(prompt: string) {
  const subject = prompt.replace(/\s+/g, " ").trim().replace(/[.!?]+$/, "");
  return `Иногда самые хорошие идеи начинаются с простого «а что, если…» ✨\n\n${subject.charAt(0).toLocaleUpperCase()}${subject.slice(1)} — повод рассказать о том, что для нас действительно важно. Мы собрали детали, продумали каждую мелочь и готовы поделиться результатом с вами.\n\nЗагляните к нам, чтобы узнать больше. Будем рады вашему мнению — расскажите в комментариях, что думаете! 💬\n\n#идеядляконтента #историябренда #вдохновение`;
}

function getPostTitle(content: string) {
  const firstLine = content.split("\n").find((line) => line.trim())?.trim() ?? "";
  return firstLine.length > 64 ? `${firstLine.slice(0, 61)}...` : firstLine;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Файл не удалось прочитать."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Файл не удалось прочитать."));
    reader.readAsDataURL(file);
  });
}

function isSupportedAttachment(file: File) {
  const extension = file.name.split(".").pop()?.toLocaleLowerCase();
  return (
    ["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"].includes(file.type) ||
    extension === "pdf" ||
    extension === "txt"
  );
}

export default function Chat() {
  const router = useRouter();
  const chatState = useSyncExternalStore(
    subscribeToChatState,
    getChatStateSnapshot,
    getServerChatStateSnapshot,
  );
  const ideas = useSyncExternalStore(
    subscribeToIdeas,
    getIdeasSnapshot,
    getServerIdeasSnapshot,
  );
  const companyProfile = useSyncExternalStore(
    subscribeToCompanyProfile,
    getCompanyProfileSnapshot,
    getServerCompanyProfileSnapshot,
  );
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isReadingAttachments, setIsReadingAttachments] = useState(false);
  const [isIdeaDialogOpen, setIsIdeaDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasMountedMessages = useRef(false);
  const activeConversation = chatState.conversations.find(
    (conversation) => conversation.id === chatState.activeConversationId,
  );
  const messages = activeConversation?.messages ?? emptyMessages;
  const storageError = getChatStorageError();

  useEffect(() => {
    if (!hasMountedMessages.current) {
      hasMountedMessages.current = true;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!isSidebarOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsSidebarOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isSidebarOpen]);

  const updateActiveConversation = useCallback(
    (updateMessages: (current: ChatMessage[]) => ChatMessage[]) => {
      updateChatState((state) => ({
        ...state,
        conversations: state.conversations.map((conversation) =>
          conversation.id === state.activeConversationId
            ? {
                ...conversation,
                messages: updateMessages(conversation.messages),
                updatedAt: getTimestamp(),
              }
            : conversation,
        ),
      }));
    },
    [],
  );

  const filteredIdeas = ideas.filter((idea) =>
    `${idea.title} ${idea.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const groupedIdeas = ideaStatusOrder.map((status) => ({
    status,
    ideas: filteredIdeas.filter((idea) => idea.status === status),
  }));
  function sendPrompt(prompt: string, attachments = pendingAttachments) {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt && attachments.length === 0) return;

    const now = formatTime();
    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: cleanPrompt || "Посмотри, пожалуйста, прикреплённые файлы.",
      createdAt: now,
      attachments,
    };
    const assistantMessage: ChatMessage = {
      id: createId(),
      role: "assistant",
      content: attachments.length > 0 && !cleanPrompt
        ? "Файлы прикреплены к сообщению. В демо-режиме я не анализирую вложения — подключение AI появится позже."
        : createDemoAnswer(cleanPrompt),
      createdAt: now,
    };
    const state = getChatStateSnapshot();
    updateChatState((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === state.activeConversationId
          ? {
              ...conversation,
              title:
                conversation.title === "Новая беседа"
                  ? getPostTitle(cleanPrompt || attachments[0].name) || "Новая беседа"
                  : conversation.title,
              messages: [...conversation.messages, userMessage, assistantMessage],
              updatedAt: getTimestamp(),
            }
          : conversation,
      ),
    }));
    setDraft("");
    setPendingAttachments([]);
    setNotice(
      attachments.length > 0
        ? "Вложения добавлены к сообщению. Демо-ответ создан без анализа файлов и без подключения к AI."
        : "Демо-режим: ответ сформирован локально, без подключения к AI.",
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendPrompt(draft);
  }

  function startNewChat() {
    const conversation: Conversation = {
      id: createId(),
      title: "Новая беседа",
      messages: createPlaceholderMessages(),
      updatedAt: getTimestamp(),
    };
    updateChatState((state) => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: conversation.id,
    }));
    setDraft("");
    setPendingAttachments([]);
    setNotice("");
    setIsSidebarOpen(false);
  }

  function selectIdea(idea: Idea) {
    const existing = chatState.conversations.find(
      (conversation) => conversation.ideaId === idea.id,
    );
    if (existing) {
      updateChatState((state) => ({
        ...state,
        activeConversationId: existing.id,
        conversations: state.conversations.map((conversation) =>
          conversation.id === existing.id && conversation.messages.length === 0
            ? { ...conversation, messages: createPlaceholderMessages() }
            : conversation,
        ),
      }));
      setPendingAttachments([]);
      setNotice("");
      setIsSidebarOpen(false);
    } else {
      const conversation: Conversation = {
        id: createId(),
        title: idea.title,
        messages: createPlaceholderMessages(),
        updatedAt: getTimestamp(),
        ideaId: idea.id,
      };
      updateChatState((state) => ({
        conversations: [conversation, ...state.conversations],
        activeConversationId: conversation.id,
      }));
      setPendingAttachments([]);
      setNotice("");
      setIsSidebarOpen(false);
    }
    setDraft("");
  }

  function saveIdeaFromChat(
    idea: Omit<Idea, "id" | "updatedAt">,
  ) {
    const savedIdea: Idea = {
      ...idea,
      id: createId(),
      updatedAt: getTimestamp(),
    };
    const conversation: Conversation = {
      id: createId(),
      title: savedIdea.title,
      messages: createPlaceholderMessages(),
      updatedAt: getTimestamp(),
      ideaId: savedIdea.id,
    };

    updateIdeas((current) => [savedIdea, ...current]);
    updateChatState((state) => ({
      conversations: [conversation, ...state.conversations],
      activeConversationId: conversation.id,
    }));
    setDraft("");
    setPendingAttachments([]);
    setNotice("Идея создана. Открыт диалог для работы с ней.");
    setIsIdeaDialogOpen(false);
    setIsSidebarOpen(false);
  }

  async function copyPost(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch (error) {
      console.error("Не удалось скопировать текст публикации.", error);
      setNotice("Не удалось скопировать текст. Проверьте разрешение браузера.");
    }
  }

  function toggleReaction(id: string, reaction: "up" | "down") {
    updateActiveConversation((current) =>
      current.map((message) =>
        message.id === id
          ? { ...message, reaction: message.reaction === reaction ? undefined : reaction }
          : message,
      ),
    );
  }

  function saveAsIdea(message: ChatMessage) {
    const title = getPostTitle(message.content);
    updateIdeas((current) => [
      {
        id: createId(),
        title: title || "Новая идея из чата",
        description: message.content,
        status: "draft",
        updatedAt: getTimestamp(),
      },
      ...current,
    ]);
    updateActiveConversation((current) =>
      current.map((item) =>
        item.id === message.id ? { ...item, saved: true } : item,
      ),
    );
    setNotice("Текст добавлен на доску в колонку «Черновик».");
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    const currentSize = pendingAttachments.reduce((total, item) => total + item.size, 0);
    const acceptedFiles: File[] = [];
    const validationMessages: string[] = [];

    for (const file of selectedFiles) {
      if (!isSupportedAttachment(file)) {
        validationMessages.push(`Формат файла «${file.name}» не поддерживается. Добавьте фото, PDF или TXT.`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_SIZE) {
        validationMessages.push(`Файл «${file.name}» больше 2 МБ и не может быть прикреплён.`);
        continue;
      }
      if (pendingAttachments.length + acceptedFiles.length >= MAX_ATTACHMENTS) {
        validationMessages.push("К одному сообщению можно прикрепить не более 3 файлов.");
        break;
      }
      const acceptedSize = acceptedFiles.reduce((total, item) => total + item.size, 0);
      if (currentSize + acceptedSize + file.size > MAX_TOTAL_ATTACHMENT_SIZE) {
        validationMessages.push("Общий размер вложений не должен превышать 5 МБ.");
        break;
      }
      acceptedFiles.push(file);
    }

    if (acceptedFiles.length === 0) {
      setNotice(validationMessages.join(" "));
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsReadingAttachments(true);
    try {
      const attachments = await Promise.all(
        acceptedFiles.map(async (file) => ({
          id: createId(),
          name: file.name,
          type: file.type || "application/octet-stream",
          dataUrl: await readFileAsDataUrl(file),
          size: file.size,
        })),
      );
      setPendingAttachments((current) => [...current, ...attachments]);
      setNotice(validationMessages.join(" "));
    } catch (error) {
      console.error("Не удалось прочитать прикреплённый файл.", error);
      setNotice("Не удалось прочитать один из файлов. Попробуйте выбрать его ещё раз.");
    } finally {
      setIsReadingAttachments(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleSignOut() {
    clearMockUser();
    router.push("/login");
  }

  return (
    <main className={styles.app}>
      {isSidebarOpen && (
        <button
          aria-label="Закрыть меню чатов"
          className={styles.drawerBackdrop}
          onClick={() => setIsSidebarOpen(false)}
          type="button"
        />
      )}
      <aside
        aria-label="Идеи по статусам"
        className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ""}`}
      >
        <div className={styles.sidebarHeading}>
          <Link aria-label="Vibely — главная" className={styles.brand} href="/board">
            <span aria-hidden="true" className={styles.brandMark}>V</span>
            <span>Vibely</span>
          </Link>
          <button
            aria-label="Закрыть меню чатов"
            className={styles.drawerClose}
            onClick={() => setIsSidebarOpen(false)}
            type="button"
          ><X aria-hidden="true" /></button>
        </div>
        <button
          className={styles.newChatButton}
          onClick={() => setIsIdeaDialogOpen(true)}
          type="button"
        >
          <Plus aria-hidden="true" />
          Новая идея
        </button>
        <label className={styles.searchField}>
          <Search aria-hidden="true" />
          <span className={styles.visuallyHidden}>Поиск по публикациям</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по публикациям..."
            value={query}
          />
          {query && (
            <button aria-label="Очистить поиск" onClick={() => setQuery("")} type="button">
              <X aria-hidden="true" />
            </button>
          )}
        </label>

        <div className={styles.ideaList}>
          {groupedIdeas.map(({ status, ideas: statusIdeas }) => (
            <section className={styles.ideaGroup} key={status}>
              <h2 className={styles.groupHeading}>
                <span className={`${styles.statusDot} ${styles[`status-${status}`]}`} />
                {statusLabels[status].toLocaleUpperCase()}
              </h2>
              {statusIdeas.map((idea) => (
                <button
                  aria-pressed={activeConversation?.ideaId === idea.id}
                  className={`${styles.ideaPreview} ${activeConversation?.ideaId === idea.id ? styles.ideaPreviewActive : ""}`}
                  key={idea.id}
                  onClick={() => selectIdea(idea)}
                  type="button"
                >
                  <strong>{idea.title}</strong>
                  <span>{idea.description || "Без описания"}</span>
                </button>
              ))}
              {statusIdeas.length === 0 && query && (
                <p className={styles.noResults}>Ничего не найдено</p>
              )}
            </section>
          ))}
        </div>
      </aside>

      <section aria-label="Чат с Vibely AI" className={styles.chatPanel}>
        <header className={styles.topbar}>
          <nav aria-label="Основная навигация" className={styles.navigation}>
            <button
              aria-label="Открыть список чатов"
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
            <Link aria-label={`Профиль компании: ${companyProfile.brandName || "Профиль компании"}`} className={styles.organizationBadge} href="/profile">
              <span className={styles.organizationIcon}><UserRound aria-hidden="true" /></span>
              <span>{companyProfile.brandName || "Профиль компании"}</span>
            </Link>
            <details className={styles.accountMenu}>
              <summary aria-label="Дополнительные действия профиля"><MoreHorizontal aria-hidden="true" /></summary>
              <div className={styles.accountDropdown}>
                <button onClick={handleSignOut} type="button"><LogOut aria-hidden="true" />Выйти</button>
              </div>
            </details>
          </div>
        </header>

        <div aria-live="polite" className={styles.conversation}>
          {messages.length === 0 ? (
            <div className={styles.emptyConversation}>
              <span className={styles.emptyIcon}><Sparkles aria-hidden="true" /></span>
              <h1>О чём поговорим?</h1>
              <p>Опишите задачу или выберите идею слева — подготовим основу публикации.</p>
              <div className={styles.suggestionList}>
                {[
                  "Придумай пост-знакомство с брендом",
                  "Напиши вовлекающий пост с вопросом",
                  "Предложи идеи для сторис на неделю",
                ].map((suggestion) => (
                  <button key={suggestion} onClick={() => setDraft(suggestion)} type="button">
                    <Sparkles aria-hidden="true" />{suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.messageList}>
              {messages.map((message) =>
                message.role === "user" ? (
                  <article className={styles.userMessage} key={message.id}>
                    <span className={styles.messageTime}>Вы, {message.createdAt}</span>
                    {message.content && <p>{message.content}</p>}
                    {!!message.attachments?.length && (
                      <div className={styles.messageAttachments}>
                        {message.attachments.map((attachment) => (
                          <a
                            className={styles.messageAttachment}
                            download={attachment.name}
                            href={attachment.dataUrl}
                            key={attachment.id}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {attachment.type.startsWith("image/") ? (
                              <Image
                                alt={attachment.name}
                                height={130}
                                src={attachment.dataUrl}
                                unoptimized
                                width={170}
                              />
                            ) : (
                              <span className={styles.fileAttachment}>
                                <FileText aria-hidden="true" />
                                <span>{attachment.name}</span>
                                <Download aria-hidden="true" />
                              </span>
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                  </article>
                ) : (
                  <article className={styles.assistantMessage} key={message.id}>
                    <div className={styles.assistantAvatar} aria-hidden="true">V</div>
                    <div className={styles.assistantContent}>
                      <header className={styles.assistantHeader}>
                        <span>Vibely AI <span className={styles.demoBadge}>ДЕМО</span></span>
                        <div className={styles.messageActions}>
                          <button
                            aria-label="Полезный ответ"
                            aria-pressed={message.reaction === "up"}
                            className={message.reaction === "up" ? styles.actionActive : ""}
                            onClick={() => toggleReaction(message.id, "up")}
                            type="button"
                          ><ThumbsUp aria-hidden="true" /></button>
                          <button
                            aria-label="Ответ не помог"
                            aria-pressed={message.reaction === "down"}
                            className={message.reaction === "down" ? styles.actionActive : ""}
                            onClick={() => toggleReaction(message.id, "down")}
                            type="button"
                          ><ThumbsDown aria-hidden="true" /></button>
                          <button
                            aria-label={copiedId === message.id ? "Текст скопирован" : "Скопировать текст"}
                            onClick={() => void copyPost(message)}
                            type="button"
                          >{copiedId === message.id ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}</button>
                        </div>
                      </header>
                      <div className={styles.generatedPost}>
                        <h2>ГОТОВЫЙ ЧЕРНОВИК ПОСТА</h2>
                        {message.content.split("\n").map((paragraph, index) =>
                          paragraph.startsWith("#") ? (
                            <p className={styles.hashtags} key={`${message.id}-${index}`}>{paragraph}</p>
                          ) : paragraph ? (
                            <p key={`${message.id}-${index}`}>{paragraph}</p>
                          ) : (
                            <div aria-hidden="true" className={styles.paragraphSpace} key={`${message.id}-${index}`} />
                          ),
                        )}
                      </div>
                      <section className={styles.explanation}>
                        <h3>Почему этот вариант сработает</h3>
                        <ul>
                          <li><Check aria-hidden="true" />Эмоциональный заход: текст начинается с образа и создаёт настроение.</li>
                          <li><Check aria-hidden="true" />Чёткая ценность: читателю понятно, о чём публикация и зачем читать дальше.</li>
                          <li><Check aria-hidden="true" />Естественный призыв к действию помогает начать разговор с аудиторией.</li>
                          <li><Check aria-hidden="true" />Формат легко адаптировать для поста, сторис или короткого видео.</li>
                        </ul>
                      </section>
                      <div className={styles.assistantFooter}>
                        <button
                          className={styles.saveIdeaButton}
                          disabled={message.saved}
                          onClick={() => saveAsIdea(message)}
                          type="button"
                        >
                          {message.saved ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
                          {message.saved ? "Добавлено на доску" : "Сохранить как идею"}
                        </button>
                        <span>{message.createdAt}</span>
                      </div>
                    </div>
                  </article>
                ),
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {notice && (
          <p className={styles.notice} role="status">
            {notice}
            <button aria-label="Закрыть уведомление" onClick={() => setNotice("")} type="button">
              <X aria-hidden="true" />
            </button>
          </p>
        )}
        {storageError && (
          <p className={styles.storageError} role="alert">{storageError}</p>
        )}

        {messages.length > 0 && (
          <div className={styles.quickPrompts}>
            {["Сделай текст короче", "Добавь больше эмоций", "Предложи заголовки"].map((suggestion) => (
              <button key={suggestion} onClick={() => setDraft(suggestion)} type="button">
                <Lightbulb aria-hidden="true" />{suggestion}
              </button>
            ))}
          </div>
        )}

        <form className={styles.composer} onSubmit={handleSubmit}>
          <button
            aria-label="Новая беседа"
            className={styles.composerNewChat}
            onClick={startNewChat}
            type="button"
          >
            <MessageSquarePlus aria-hidden="true" />
          </button>
          <label className={styles.visuallyHidden} htmlFor="chat-prompt">Сообщение для Vibely AI</label>
          <input
            accept="image/*,.pdf,.txt"
            className={styles.visuallyHidden}
            multiple
            onChange={(event) => void handleFilesSelected(event.target.files)}
            ref={fileInputRef}
            type="file"
          />
          <div className={styles.composerContents}>
            {!!pendingAttachments.length && (
              <div className={styles.pendingAttachments}>
                {pendingAttachments.map((attachment) => (
                  <div className={styles.pendingAttachment} key={attachment.id}>
                    {attachment.type.startsWith("image/") ? (
                      <Image
                        alt={attachment.name}
                        height={44}
                        src={attachment.dataUrl}
                        unoptimized
                        width={44}
                      />
                    ) : (
                      <FileText aria-hidden="true" />
                    )}
                    <span>{attachment.name}</span>
                    <button
                      aria-label={`Удалить файл ${attachment.name}`}
                      onClick={() => setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                      type="button"
                    ><X aria-hidden="true" /></button>
                  </div>
                ))}
              </div>
            )}
          <textarea
            id="chat-prompt"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendPrompt(draft);
              }
            }}
            placeholder="Спросите Vibely AI, уточните задачу или предложите правки к посту..."
            rows={1}
            value={draft}
          />
          </div>
          <button
            aria-label="Прикрепить изображения, PDF или TXT"
            className={styles.attachButton}
            disabled={isReadingAttachments || pendingAttachments.length >= MAX_ATTACHMENTS}
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Paperclip aria-hidden="true" />
          </button>
          <button
            aria-label="Отправить сообщение"
            className={styles.sendButton}
            disabled={!draft.trim() && pendingAttachments.length === 0}
            type="submit"
          >
            <Send aria-hidden="true" />
          </button>
          <span className={styles.composerHint}>Enter — отправить · Shift + Enter — новая строка · до 3 файлов по 2 МБ</span>
        </form>
      </section>
      {isIdeaDialogOpen && (
        <IdeaDialog
          initialStatus="inProgress"
          onClose={() => setIsIdeaDialogOpen(false)}
          onSave={(idea) => saveIdeaFromChat(idea)}
        />
      )}
    </main>
  );
}
