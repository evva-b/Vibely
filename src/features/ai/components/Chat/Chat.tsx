"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Clipboard,
  LogOut,
  Menu,
  MessageSquarePlus,
  Plus,
  Search,
  Send,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeProvider";
import { clearAccessToken } from "@/features/auth/lib/auth-token";
import { api, ApiError } from "@/lib/api";
import type {
  AIRequest,
  AdaptedContent,
  Brand,
  Post,
  SocialNetwork,
  Template,
} from "@/types/api";
import styles from "./Chat.module.css";

type GeneratedContent = {
  title?: string;
  text?: string;
};

function parseResponse(response: string | null): GeneratedContent | null {
  if (!response) return null;
  try {
    const parsed: unknown = JSON.parse(response);
    if (typeof parsed !== "object" || parsed === null) return null;
    const value = parsed as Record<string, unknown>;
    return {
      title: typeof value.title === "string" ? value.title : undefined,
      text: typeof value.text === "string" ? value.text : undefined,
    };
  } catch {
    return { text: response };
  }
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

export default function Chat() {
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [history, setHistory] = useState<AIRequest[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [networks, setNetworks] = useState<SocialNetwork[]>([]);
  const [adaptations, setAdaptations] = useState<AdaptedContent[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [selectedPostId, setSelectedPostId] = useState("");
  const [networkId, setNetworkId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAdapting, setIsAdapting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);

  const selectedRequest = history.find((item) => item.id === selectedRequestId) ?? null;
  const selectedContent = parseResponse(selectedRequest?.response ?? null);
  const filteredHistory = useMemo(
    () =>
      history.filter((item) =>
        `${item.prompt} ${item.request_type} ${item.model}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
      ),
    [history, query],
  );
  const selectedPost = posts.find((post) => post.id === selectedPostId) ?? null;
  const selectedAdaptations = adaptations.filter(
    (adaptation) => adaptation.post_id === selectedPostId,
  );

  const loadData = useCallback(async () => {
    try {
      const brands = await api.listBrands();
      const activeBrand = brands[0] ?? null;
      setBrand(activeBrand);
      if (!activeBrand) {
        setHistory([]);
        setPosts([]);
        setTemplates([]);
        setNetworks([]);
        return;
      }
      const [requests, board, templateList, socialNetworks] = await Promise.all([
        api.listAIRequests(activeBrand.id),
        api.getBoard(activeBrand.id),
        api.listTemplates(activeBrand.id),
        api.listSocialNetworks(),
      ]);
      const allPosts = board.flatMap((column) => column.posts);
      setHistory(requests);
      setPosts(allPosts);
      setTemplates(templateList);
      setNetworks(socialNetworks);
      setNetworkId((current) => current || socialNetworks[0]?.id || "");
      setSelectedPostId((current) =>
        allPosts.some((post) => post.id === current) ? current : allPosts[0]?.id ?? "",
      );
      setSelectedRequestId((current) =>
        requests.some((request) => request.id === current)
          ? current
          : requests[0]?.id ?? "",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить историю генераций.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadData();
    });
    return () => {
      active = false;
    };
  }, [loadData]);

  useEffect(() => {
    let active = true;
    if (!selectedPostId) return;
    api.listAdaptations(selectedPostId)
      .then((items) => {
        if (active) setAdaptations(items);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Не удалось загрузить адаптации.",
          );
        }
      })
      .finally(() => {
        active = false;
      });
    return () => {
      active = false;
    };
  }, [selectedPostId]);

  async function generatePost(prompt = draft) {
    const cleanPrompt = prompt.trim();
    if (!brand || !cleanPrompt || isGenerating) return;
    setIsGenerating(true);
    setError("");
    setNotice("");
    try {
      const generated = await api.generatePost(brand.id, {
        prompt: cleanPrompt,
        ...(templateId ? { template_id: templateId } : {}),
      });
      setDraft("");
      await loadData();
      setSelectedPostId(generated.post.id);
      setSelectedRequestId(generated.ai_request_id);
      setNotice("Пост сгенерирован и сохранён на доске.");
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status >= 500
          ? "Не удалось выполнить генерацию. Проверьте, что локальная языковая модель запущена."
          : requestError instanceof Error
            ? requestError.message
            : "Не удалось выполнить генерацию.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function generateAdaptation() {
    if (!selectedPost || !networkId || isAdapting) return;
    setIsAdapting(true);
    setError("");
    setNotice("");
    try {
      const result = await api.generateAdaptation(selectedPost.id, networkId);
      setAdaptations((current) => [result.adaptation, ...current]);
      setNotice("Адаптация создана и сохранена.");
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status >= 500
          ? "Не удалось создать адаптацию. Проверьте доступность локальной языковой модели."
          : requestError instanceof Error
            ? requestError.message
            : "Не удалось создать адаптацию.",
      );
    } finally {
      setIsAdapting(false);
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Не удалось скопировать текст. Проверьте разрешение браузера.");
    }
  }

  function signOut() {
    clearAccessToken();
    router.replace("/login");
  }

  return (
    <main className={styles.app}>
      {isSidebarOpen && (
        <button
          aria-label="Закрыть историю генераций"
          className={styles.drawerBackdrop}
          onClick={() => setIsSidebarOpen(false)}
          type="button"
        />
      )}
      <aside
        aria-label="История AI-запросов"
        className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ""}`}
      >
        <div className={styles.sidebarHeading}>
          <Link aria-label="Vibely — главная" className={styles.brand} href="/board">
            <span aria-hidden="true" className={styles.brandMark}>V</span><span>Vibely</span>
          </Link>
          <button
            aria-label="Закрыть историю"
            className={styles.drawerClose}
            onClick={() => setIsSidebarOpen(false)}
            type="button"
          ><X aria-hidden="true" /></button>
        </div>
        <button
          className={styles.newChatButton}
          disabled={!brand}
          onClick={() => {
            setSelectedRequestId("");
            setDraft("");
            setNotice("");
            setIsSidebarOpen(false);
          }}
          type="button"
        ><Plus aria-hidden="true" />Новая генерация</button>
        <label className={styles.searchField}>
          <Search aria-hidden="true" />
          <span className={styles.visuallyHidden}>Поиск по истории AI</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по истории..."
            value={query}
          />
          {query && (
            <button aria-label="Очистить поиск" onClick={() => setQuery("")} type="button">
              <X aria-hidden="true" />
            </button>
          )}
        </label>
        <div className={styles.ideaList}>
          <section className={styles.ideaGroup}>
            <h2 className={styles.groupHeading}>ПОСЛЕДНИЕ ЗАПРОСЫ</h2>
            {filteredHistory.map((item) => {
              const content = parseResponse(item.response);
              return (
                <button
                  aria-pressed={selectedRequestId === item.id}
                  className={`${styles.ideaPreview} ${selectedRequestId === item.id ? styles.ideaPreviewActive : ""}`}
                  key={item.id}
                  onClick={() => {
                    setSelectedRequestId(item.id);
                    setIsSidebarOpen(false);
                  }}
                  type="button"
                >
                  <strong>{content?.title || item.prompt}</strong>
                  <span>{item.request_type === "adaptation" ? "Адаптация" : "Генерация поста"} · {formatTime(item.created_at)}</span>
                </button>
              );
            })}
            {!isLoading && filteredHistory.length === 0 && (
              <p className={styles.noResults}>
                {query ? "Ничего не найдено" : "История пока пуста"}
              </p>
            )}
          </section>
        </div>
      </aside>

      <section aria-label="Генерация контента Vibely AI" className={styles.chatPanel}>
        <header className={styles.topbar}>
          <nav aria-label="Основная навигация" className={styles.navigation}>
            <button
              aria-label="Открыть историю генераций"
              aria-expanded={isSidebarOpen}
              className={styles.mobileMenuButton}
              onClick={() => setIsSidebarOpen(true)}
              type="button"
            ><Menu aria-hidden="true" /></button>
            <Link className={styles.navLink} href="/board">Доска идей</Link>
            <Link aria-current="page" className={styles.navActive} href="/chats">История AI</Link>
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
            <details className={styles.accountMenu}>
              <summary aria-label="Дополнительные действия профиля"><UserRound aria-hidden="true" /></summary>
              <div className={styles.accountDropdown}>
                <button onClick={signOut} type="button"><LogOut aria-hidden="true" />Выйти</button>
              </div>
            </details>
          </div>
        </header>

        <div aria-live="polite" className={styles.conversation}>
          {isLoading ? (
            <div className={styles.emptyConversation}><p>Загружаем данные из backend…</p></div>
          ) : !brand ? (
            <div className={styles.emptyConversation}>
              <span className={styles.emptyIcon}><Sparkles aria-hidden="true" /></span>
              <h1>Сначала настройте бренд</h1>
              <p>Профиль бренда нужен для генерации публикаций.</p>
              <Link className={styles.primaryButton} href="/profile">Настроить профиль</Link>
            </div>
          ) : !selectedRequestId && !draft ? (
            <div className={styles.emptyConversation}>
              <span className={styles.emptyIcon}><Sparkles aria-hidden="true" /></span>
              <h1>Создайте публикацию с AI</h1>
              <p>Опишите задачу. Генерация учитывает бренд, его аудиторию, tone of voice и выбранный шаблон.</p>
              <div className={styles.suggestionList}>
                {[
                  "Напиши пост-знакомство с брендом",
                  "Предложи идеи для сторис на неделю",
                  "Создай вовлекающий пост с вопросом аудитории",
                ].map((suggestion) => (
                  <button key={suggestion} onClick={() => setDraft(suggestion)} type="button">
                    <Sparkles aria-hidden="true" />{suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.messageList}>
              {selectedRequest && (
                <article className={styles.userMessage}>
                  <span className={styles.messageTime}>Задание · {formatTime(selectedRequest.created_at)}</span>
                  <p>{selectedRequest.prompt}</p>
                </article>
              )}
              {selectedRequest && selectedContent && (
                <article className={styles.assistantMessage}>
                  <div className={styles.assistantAvatar} aria-hidden="true">V</div>
                  <div className={styles.assistantContent}>
                    <header className={styles.assistantHeader}>
                      <span>Vibely AI <span className={styles.demoBadge}>{selectedRequest.model}</span></span>
                      <div className={styles.messageActions}>
                        <button
                          aria-label={copied ? "Текст скопирован" : "Скопировать текст"}
                          onClick={() => void copyText([selectedContent.title, selectedContent.text].filter(Boolean).join("\n\n"))}
                          type="button"
                        >{copied ? <Check aria-hidden="true" /> : <Clipboard aria-hidden="true" />}</button>
                      </div>
                    </header>
                    <div className={styles.generatedPost}>
                      <h2>{selectedContent.title ?? "РЕЗУЛЬТАТ ЗАПРОСА"}</h2>
                      {selectedContent.text?.split("\n").map((paragraph, index) =>
                        paragraph ? <p key={`${selectedRequest.id}-${index}`}>{paragraph}</p> : <br key={`${selectedRequest.id}-${index}`} />,
                      )}
                    </div>
                    <div className={styles.assistantFooter}>
                      <span>{selectedRequest.request_type === "adaptation" ? "Адаптация" : "Пост сохранён на доске"}</span>
                      <span>{formatTime(selectedRequest.created_at)}</span>
                    </div>
                  </div>
                </article>
              )}
              {!selectedRequest && (
                <div className={styles.emptyConversation}>
                  <span className={styles.emptyIcon}><MessageSquarePlus aria-hidden="true" /></span>
                  <h1>Опишите публикацию</h1>
                  <p>Текст будет сгенерирован и сохранён в PostgreSQL.</p>
                </div>
              )}
              {posts.length > 0 && (
                <section className={styles.explanation}>
                  <h3>Адаптировать публикацию</h3>
                  <label>
                    <span className={styles.visuallyHidden}>Выберите исходный пост</span>
                    <select onChange={(event) => setSelectedPostId(event.target.value)} value={selectedPostId}>
                      {posts.map((post) => <option key={post.id} value={post.id}>{post.title}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className={styles.visuallyHidden}>Социальная сеть</span>
                    <select onChange={(event) => setNetworkId(event.target.value)} value={networkId}>
                      {networks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}
                    </select>
                  </label>
                  <button disabled={!selectedPost || !networkId || isAdapting} onClick={() => void generateAdaptation()} type="button">
                    {isAdapting ? "Адаптируем…" : "Создать адаптацию"}
                  </button>
                  {selectedAdaptations.map((adaptation) => (
                    <div className={styles.generatedPost} key={adaptation.id}>
                      <h2>СОХРАНЁННАЯ АДАПТАЦИЯ</h2>
                      <p>{adaptation.text}</p>
                    </div>
                  ))}
                </section>
              )}
              <div />
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

        <div className={styles.quickPrompts}>
          {templates.length > 0 && (
            <label>
              <span className={styles.visuallyHidden}>Шаблон генерации</span>
              <select onChange={(event) => setTemplateId(event.target.value)} value={templateId}>
                <option value="">Без шаблона</option>
                {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
            </label>
          )}
        </div>

        <form
          className={styles.composer}
          onSubmit={(event) => {
            event.preventDefault();
            void generatePost();
          }}
        >
          <button
            aria-label="Новая генерация"
            className={styles.composerNewChat}
            onClick={() => {
              setSelectedRequestId("");
              setDraft("");
            }}
            type="button"
          ><MessageSquarePlus aria-hidden="true" /></button>
          <div className={styles.composerContents}>
            <label className={styles.visuallyHidden} htmlFor="chat-prompt">Задание для Vibely AI</label>
            <textarea
              disabled={isGenerating || !brand}
              id="chat-prompt"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void generatePost();
                }
              }}
              placeholder="Опишите идею публикации для Vibely AI..."
              rows={1}
              value={draft}
            />
          </div>
          <button
            aria-label={isGenerating ? "Выполняется генерация" : "Сгенерировать пост"}
            className={styles.sendButton}
            disabled={isGenerating || !brand || !draft.trim()}
            type="submit"
          >{isGenerating ? <span className={styles.loadingSpinner} aria-hidden="true" /> : <Send aria-hidden="true" />}</button>
        </form>
      </section>
    </main>
  );
}
