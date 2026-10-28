"use client";

import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, LogOut, Plus, UserRound, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeProvider";
import { clearAccessToken } from "@/features/auth/lib/auth-token";
import { api, ApiError } from "@/lib/api";
import type { Brand, Template, Topic, ToneOfVoice } from "@/types/api";
import styles from "./CompanyProfile.module.css";

type ProfileDraft = {
  name: string;
  description: string;
  targetAudience: string;
  tone: string;
  vocabulary: string;
  communicationRules: string;
  forbiddenWords: string;
};

const emptyDraft: ProfileDraft = {
  name: "",
  description: "",
  targetAudience: "",
  tone: "",
  vocabulary: "",
  communicationRules: "",
  forbiddenWords: "",
};

const toneOptions = [
  "Тёплый и эстетичный",
  "Дружелюбный и простой",
  "Экспертный и деловой",
  "Энергичный и смелый",
  "Ироничный и лёгкий",
  "Минималистичный и спокойный",
];

function toDraft(brand: Brand | null, tone: ToneOfVoice | null): ProfileDraft {
  return {
    name: brand?.name ?? "",
    description: brand?.description ?? "",
    targetAudience: brand?.target_audience ?? "",
    tone: tone?.style ?? "",
    vocabulary: tone?.vocabulary ?? "",
    communicationRules: tone?.communication_rules ?? "",
    forbiddenWords: tone?.forbidden_words ?? "",
  };
}

export default function CompanyProfile() {
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [tone, setTone] = useState<ToneOfVoice | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [originalTemplates, setOriginalTemplates] = useState<Template[]>([]);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    prompt: "",
  });
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [originalTopics, setOriginalTopics] = useState<Topic[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      const brands = await api.listBrands();
      const activeBrand = brands[0] ?? null;
      let activeTone: ToneOfVoice | null = null;
      let brandTopics: Topic[] = [];
      let brandTemplates: Template[] = [];
      if (activeBrand) {
        const [topicResult, toneResult, templateResult] = await Promise.all([
          api.listTopics(activeBrand.id),
          api.getTone(activeBrand.id).catch((requestError: unknown) => {
            if (requestError instanceof ApiError && requestError.status === 404) {
              return null;
            }
            throw requestError;
          }),
          api.listTemplates(activeBrand.id),
        ]);
        brandTopics = topicResult;
        activeTone = toneResult;
        brandTemplates = templateResult;
      }
      setBrand(activeBrand);
      setTone(activeTone);
      setTopics(brandTopics);
      setOriginalTopics(brandTopics);
      setTemplates(brandTemplates);
      setOriginalTemplates(brandTemplates);
      setDraft(toDraft(activeBrand, activeTone));
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Не удалось загрузить профиль компании.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadProfile();
    });
    return () => {
      active = false;
    };
  }, [loadProfile]);

  function updateField<K extends keyof ProfileDraft>(field: K, value: ProfileDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError("");
    setNotice("");
  }

  function addTopic() {
    const name = newTopic.trim();
    if (!name) return;
    if (topics.some((topic) => topic.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError("Такая тема уже добавлена.");
      return;
    }
    setTopics((current) => [...current, { id: `new-${crypto.randomUUID()}`, brand_id: brand?.id ?? "", name }]);
    setNewTopic("");
    setError("");
  }

  function handleTopicKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTopic();
    }
  }

  function handleCancel() {
    setTopics(originalTopics);
    setTemplates(originalTemplates);
    setDraft(toDraft(brand, tone));
    setNewTemplate({ name: "", description: "", prompt: "" });
    setNewTopic("");
    setError("");
    setNotice("");
  }

  async function createTemplate() {
    if (!brand || !newTemplate.name.trim() || !newTemplate.prompt.trim()) return;
    setSaving(true);
    setError("");
    try {
      const created = await api.createTemplate(brand.id, {
        name: newTemplate.name.trim(),
        description: newTemplate.description.trim() || null,
        prompt: newTemplate.prompt.trim(),
      });
      setTemplates((current) => [...current, created]);
      setOriginalTemplates((current) => [...current, created]);
      setNewTemplate({ name: "", description: "", prompt: "" });
      setNotice("Шаблон добавлен.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось создать шаблон.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTemplate(template: Template) {
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateTemplate(template.id, {
        name: template.name.trim(),
        description: template.description?.trim() || null,
        prompt: template.prompt.trim(),
      });
      setTemplates((current) => current.map((item) => item.id === updated.id ? updated : item));
      setOriginalTemplates((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice("Шаблон сохранён.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось сохранить шаблон.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate(template: Template) {
    if (!window.confirm(`Удалить шаблон «${template.name}»?`)) return;
    setSaving(true);
    setError("");
    try {
      await api.deleteTemplate(template.id);
      setTemplates((current) => current.filter((item) => item.id !== template.id));
      setOriginalTemplates((current) => current.filter((item) => item.id !== template.id));
      setNotice("Шаблон удалён.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Не удалось удалить шаблон.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) {
      setError("Укажите название бренда.");
      return;
    }
    if (!draft.tone.trim()) {
      setError("Укажите тон общения бренда.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const savedBrand = brand
        ? await api.updateBrand(brand.id, {
            name: draft.name.trim(),
            description: draft.description.trim() || null,
            target_audience: draft.targetAudience.trim() || null,
          })
        : await api.createBrand({
            name: draft.name.trim(),
            description: draft.description.trim() || null,
            target_audience: draft.targetAudience.trim() || null,
          });
      await api.saveTone(savedBrand.id, {
        style: draft.tone.trim(),
        vocabulary: draft.vocabulary.trim() || null,
        communication_rules: draft.communicationRules.trim() || null,
        forbidden_words: draft.forbiddenWords.trim() || null,
      });

      const originalIds = new Set(originalTopics.map((topic) => topic.id));
      const retainedIds = new Set(topics.map((topic) => topic.id));
      const topicOperations = [
        ...topics
          .filter((topic) => !originalIds.has(topic.id))
          .map((topic) => api.createTopic(savedBrand.id, { name: topic.name })),
        ...originalTopics
          .filter((topic) => !retainedIds.has(topic.id))
          .map((topic) => api.deleteTopic(topic.id)),
      ];
      await Promise.all(topicOperations);
      await loadProfile();
      setNotice("Изменения профиля сохранены.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить профиль.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleSignOut() {
    clearAccessToken();
    router.replace("/login");
  }

  return (
    <main className={styles.app}>
      <header className={styles.topbar}>
        <Link aria-label="Vibely — главная" className={styles.brand} href="/board">
          <span aria-hidden="true" className={styles.brandMark}>V</span><span>Vibely</span>
        </Link>
        <nav aria-label="Основная навигация" className={styles.navigation}>
          <Link className={styles.navLink} href="/board">Доска идей</Link>
          <Link className={styles.navLink} href="/chats">История AI</Link>
        </nav>
        <div className={styles.topbarActions}>
          <ThemeToggle inline />
          <details className={styles.accountMenu}>
            <summary aria-label="Меню профиля"><UserRound aria-hidden="true" /></summary>
            <div className={styles.accountDropdown}>
              <button onClick={handleSignOut} type="button"><LogOut aria-hidden="true" />Выйти</button>
            </div>
          </details>
        </div>
      </header>

      <section aria-labelledby="profile-title" className={styles.profileSection}>
        <form className={styles.profileForm} onSubmit={handleSave}>
          <div className={styles.pageHeader}>
            <div className={styles.pageTitleGroup}>
              <span className={styles.eyebrow}>НАСТРОЙКИ БРЕНДА</span>
              <h1 id="profile-title">Профиль компании</h1>
              <p>Расскажите о бренде, чтобы идеи точнее отражали ваш стиль.</p>
            </div>
            <div className={styles.pageActions}>
              <button className={styles.secondaryButton} disabled={loading || saving} onClick={handleCancel} type="button">Отмена</button>
              <button className={styles.primaryButton} disabled={loading || saving} type="submit">
                {saving ? "Сохраняем…" : "Сохранить изменения"}
              </button>
            </div>
          </div>
          {loading && <p aria-live="polite">Загружаем профиль…</p>}
          {error && <p className={styles.formError} role="alert">{error}</p>}
          {notice && <p className={styles.formNotice} role="status">{notice}</p>}

          {!loading && (
            <div className={styles.profileGrid}>
              {!brand && (
                <div className={styles.avatarSection}>
                  <div className={styles.avatarFrame}><Building2 aria-hidden="true" /></div>
                  <div className={styles.avatarDetails}>
                    <strong>Настройка организации</strong>
                    <span>Создайте первый профиль бренда, чтобы начать работу.</span>
                  </div>
                </div>
              )}
              <label className={styles.field}>
                <span>Название бренда</span>
                <input
                  autoComplete="organization"
                  disabled={saving}
                  maxLength={150}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Название компании или бренда"
                  value={draft.name}
                />
              </label>
              <label className={styles.field}>
                <span>Тип общения</span>
                <select
                  disabled={saving}
                  onChange={(event) => {
                    if (event.target.value === "__custom") {
                      updateField("tone", draft.tone || "Свободный стиль");
                    } else {
                      updateField("tone", event.target.value);
                    }
                  }}
                  value={toneOptions.includes(draft.tone) || !draft.tone ? draft.tone : "__custom"}
                >
                  <option disabled value="">Выберите тон общения</option>
                  {!toneOptions.includes(draft.tone) && draft.tone && (
                    <option value="__custom">{draft.tone}</option>
                  )}
                  {!draft.tone && <option value="__custom">Свой стиль…</option>}
                  {toneOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              {draft.tone && !toneOptions.includes(draft.tone) && (
                <label className={`${styles.field} ${styles.fullWidth}`}>
                  <span>Свой тон общения</span>
                  <input
                    disabled={saving}
                    onChange={(event) => updateField("tone", event.target.value)}
                    value={draft.tone}
                  />
                </label>
              )}
              <label className={`${styles.field} ${styles.fullWidth}`}>
                <span>Описание бренда</span>
                <textarea
                  disabled={saving}
                  maxLength={1200}
                  onChange={(event) => updateField("description", event.target.value)}
                  placeholder="Расскажите о компании, продукте и ценностях бренда"
                  rows={4}
                  value={draft.description}
                />
                <small>{draft.description.length}/1200</small>
              </label>
              <label className={`${styles.field} ${styles.fullWidth}`}>
                <span>Целевая аудитория</span>
                <textarea
                  disabled={saving}
                  maxLength={800}
                  onChange={(event) => updateField("targetAudience", event.target.value)}
                  placeholder="Кому адресован ваш контент? Опишите интересы и потребности аудитории"
                  rows={3}
                  value={draft.targetAudience}
                />
                <small>{draft.targetAudience.length}/800</small>
              </label>
              <label className={`${styles.field} ${styles.fullWidth}`}>
                <span>Словарь бренда</span>
                <textarea
                  disabled={saving}
                  onChange={(event) => updateField("vocabulary", event.target.value)}
                  placeholder="Предпочтительные слова и выражения"
                  rows={2}
                  value={draft.vocabulary}
                />
              </label>
              <label className={`${styles.field} ${styles.fullWidth}`}>
                <span>Правила коммуникации</span>
                <textarea
                  disabled={saving}
                  onChange={(event) => updateField("communicationRules", event.target.value)}
                  placeholder="Как бренд общается с аудиторией"
                  rows={2}
                  value={draft.communicationRules}
                />
              </label>
              <label className={`${styles.field} ${styles.fullWidth}`}>
                <span>Запрещённые слова</span>
                <input
                  disabled={saving}
                  onChange={(event) => updateField("forbiddenWords", event.target.value)}
                  placeholder="Слова и фразы, которых следует избегать"
                  value={draft.forbiddenWords}
                />
              </label>
              <div className={`${styles.field} ${styles.fullWidth}`}>
                <span>Темы контента</span>
                <div className={styles.topicList}>
                  {topics.map((topic) => (
                    <span className={styles.topicTag} key={topic.id}>
                      {topic.name}
                      <button
                        aria-label={`Удалить тему «${topic.name}»`}
                        disabled={saving}
                        onClick={() => setTopics((current) => current.filter((item) => item.id !== topic.id))}
                        type="button"
                      ><X aria-hidden="true" /></button>
                    </span>
                  ))}
                  {topics.length === 0 && <span>Темы пока не добавлены.</span>}
                </div>
                <div className={styles.addTopicRow}>
                  <input
                    aria-label="Новая тема контента"
                    disabled={saving}
                    maxLength={150}
                    onChange={(event) => setNewTopic(event.target.value)}
                    onKeyDown={handleTopicKeyDown}
                    placeholder="Например, советы по уходу"
                    value={newTopic}
                  />
                  <button className={styles.addTopicButton} disabled={saving || !newTopic.trim()} onClick={addTopic} type="button">
                    <Plus aria-hidden="true" />Добавить тему
                  </button>
                </div>
                <small>Нажмите Enter, чтобы добавить тему. Удалить тег можно кнопкой ×.</small>
              </div>
              <section className={`${styles.field} ${styles.fullWidth}`} aria-labelledby="template-heading">
                <span id="template-heading">Шаблоны генерации</span>
                {!brand && <small>Сначала сохраните профиль бренда.</small>}
                {templates.map((template) => (
                  <article className={styles.templateCard} key={template.id}>
                    <label>
                      <span>Название шаблона</span>
                      <input
                        disabled={saving}
                        maxLength={150}
                        onChange={(event) => setTemplates((current) => current.map((item) =>
                          item.id === template.id ? { ...item, name: event.target.value } : item,
                        ))}
                        value={template.name}
                      />
                    </label>
                    <label>
                      <span>Описание</span>
                      <input
                        disabled={saving}
                        onChange={(event) => setTemplates((current) => current.map((item) =>
                          item.id === template.id ? { ...item, description: event.target.value } : item,
                        ))}
                        value={template.description ?? ""}
                      />
                    </label>
                    <label className={styles.templatePrompt}>
                      <span>Инструкция для AI</span>
                      <textarea
                        disabled={saving}
                        onChange={(event) => setTemplates((current) => current.map((item) =>
                          item.id === template.id ? { ...item, prompt: event.target.value } : item,
                        ))}
                        rows={3}
                        value={template.prompt}
                      />
                    </label>
                    <div className={styles.templateActions}>
                      <button
                        className={styles.secondaryButton}
                        disabled={saving || !template.name.trim() || !template.prompt.trim()}
                        onClick={() => void saveTemplate(template)}
                        type="button"
                      >Сохранить шаблон</button>
                      <button
                        className={styles.removeTemplateButton}
                        disabled={saving}
                        onClick={() => void deleteTemplate(template)}
                        type="button"
                      >Удалить</button>
                    </div>
                  </article>
                ))}
                <div className={styles.templateCard}>
                  <label>
                    <span>Название шаблона</span>
                    <input
                      disabled={saving || !brand}
                      maxLength={150}
                      onChange={(event) => setNewTemplate((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Например, экспертный совет"
                      value={newTemplate.name}
                    />
                  </label>
                  <label>
                    <span>Описание</span>
                    <input
                      disabled={saving || !brand}
                      onChange={(event) => setNewTemplate((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Короткое пояснение"
                      value={newTemplate.description}
                    />
                  </label>
                  <label className={styles.templatePrompt}>
                    <span>Инструкция для AI</span>
                    <textarea
                      disabled={saving || !brand}
                      onChange={(event) => setNewTemplate((current) => ({ ...current, prompt: event.target.value }))}
                      placeholder="Опишите структуру и пожелания к публикации"
                      rows={3}
                      value={newTemplate.prompt}
                    />
                  </label>
                  <div className={styles.templateActions}>
                    <button
                      className={styles.addTopicButton}
                      disabled={saving || !brand || !newTemplate.name.trim() || !newTemplate.prompt.trim()}
                      onClick={() => void createTemplate()}
                      type="button"
                    ><Plus aria-hidden="true" />Добавить шаблон</button>
                  </div>
                </div>
              </section>
            </div>
          )}
          <div className={styles.mobileActions}>
            <button className={styles.secondaryButton} disabled={loading || saving} onClick={handleCancel} type="button">Отмена</button>
            <button className={styles.primaryButton} disabled={loading || saving} type="submit">
              {saving ? "Сохраняем…" : "Сохранить изменения"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
