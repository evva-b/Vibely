"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { ImagePlus, Plus, Trash2, UserRound, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeProvider";
import UserAvatarMenu, { notifyAvatarChanged } from "@/components/navigation/UserAvatarMenu";
import { api, ApiError } from "@/lib/api";
import { quickStarts } from "@/features/posts/data/quick-starts";
import type { Brand, Topic, ToneOfVoice, UserRead } from "@/types/api";
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
  const avatarInput = useRef<HTMLInputElement>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [user, setUser] = useState<UserRead | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [tone, setTone] = useState<ToneOfVoice | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [draft, setDraft] = useState<ProfileDraft>(emptyDraft);
  const [originalTopics, setOriginalTopics] = useState<Topic[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      const [brands, currentUser] = await Promise.all([
        api.listBrands(),
        api.currentUser(),
      ]);
      const activeBrand = brands[0] ?? null;
      setUser(currentUser);
      try {
        setAvatar(window.localStorage.getItem(`vibely:user-avatar:${currentUser.id}`));
      } catch {
        setError("Браузер запретил доступ к локальному хранилищу аватара.");
      }
      let activeTone: ToneOfVoice | null = null;
      let brandTopics: Topic[] = [];
      if (activeBrand) {
        const [topicResult, toneResult] = await Promise.all([
          api.listTopics(activeBrand.id),
          api.getTone(activeBrand.id).catch((requestError: unknown) => {
            if (requestError instanceof ApiError && requestError.status === 404) {
              return null;
            }
            throw requestError;
          }),
        ]);
        brandTopics = topicResult;
        activeTone = toneResult;
      }
      setBrand(activeBrand);
      setTone(activeTone);
      setTopics(brandTopics);
      setOriginalTopics(brandTopics);
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
    addTopicName(newTopic);
    setNewTopic("");
  }

  function addTopicName(value: string) {
    const name = value.trim();
    if (!name) return;
    if (topics.some((topic) => topic.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setError("Такая тема уже добавлена.");
      return;
    }
    setTopics((current) => [...current, { id: `new-${crypto.randomUUID()}`, brand_id: brand?.id ?? "", name }]);
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
    setDraft(toDraft(brand, tone));
    setNewTopic("");
    setError("");
    setNotice("");
  }

  function handleAvatarSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !user) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Выберите изображение в формате JPG, PNG или WebP.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Размер аватара не должен превышать 2 МБ.");
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setError("Не удалось прочитать выбранное изображение.");
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Не удалось обработать выбранное изображение.");
        return;
      }
      try {
        window.localStorage.setItem(`vibely:user-avatar:${user.id}`, reader.result);
        setAvatar(reader.result);
        notifyAvatarChanged();
        setError("");
        setNotice("Аватар сохранён в этом браузере.");
      } catch {
        setError("Недостаточно места в локальном хранилище браузера для аватара.");
      }
    };
    reader.readAsDataURL(file);
  }

  function removeAvatar() {
    if (!user) return;
    try {
      window.localStorage.removeItem(`vibely:user-avatar:${user.id}`);
      setAvatar(null);
      notifyAvatarChanged();
      setError("");
      setNotice("Аватар удалён.");
    } catch {
      setError("Не удалось удалить аватар из локального хранилища браузера.");
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

  return (
    <main className={styles.app}>
      <header className={styles.topbar}>
        <Link aria-label="Vibely — главная" className={styles.brand} href="/board">
          <span aria-hidden="true" className={styles.brandMark}>V</span><span>Vibely</span>
        </Link>
        <nav aria-label="Основная навигация" className={styles.navigation}>
          <Link className={styles.navLink} href="/board">Доска идей</Link>
          <Link className={styles.navLink} href="/chats">Чаты</Link>
        </nav>
        <div className={styles.topbarActions}>
          <ThemeToggle inline />
          <UserAvatarMenu />
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
              <div className={styles.avatarSection}>
                <div className={styles.avatarFrame}>
                  {avatar
                    ? <Image alt={`Аватар пользователя ${user?.name ?? ""}`} height={92} src={avatar} unoptimized width={92} />
                    : <UserRound aria-hidden="true" />}
                </div>
                <div className={styles.avatarDetails}>
                  <strong>Аватар пользователя</strong>
                  <span>{avatar ? "Изображение сохранено в этом браузере." : "Добавьте изображение профиля. Оно хранится только в этом браузере."}</span>
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    aria-label="Выбрать изображение аватара"
                    className={styles.visuallyHidden}
                    onChange={handleAvatarSelection}
                    ref={avatarInput}
                    type="file"
                  />
                  <button
                    className={styles.avatarButton}
                    disabled={!user}
                    onClick={() => avatarInput.current?.click()}
                    type="button"
                  ><ImagePlus aria-hidden="true" />{avatar ? "Заменить изображение" : "Выбрать изображение"}</button>
                  {avatar && (
                    <button className={styles.removeAvatarButton} onClick={removeAvatar} type="button">
                      <Trash2 aria-hidden="true" />Удалить
                    </button>
                  )}
                  {!brand && <span>Создайте профиль бренда ниже, чтобы начать работу.</span>}
                </div>
              </div>
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
                <div className={styles.quickTopics}>
                  <span className={styles.quickTopicsLabel}>Быстрые темы</span>
                  <div className={styles.topicList}>
                    {quickStarts.map((suggestion) => {
                      const alreadyAdded = topics.some(
                        (topic) => topic.name.toLocaleLowerCase() === suggestion.toLocaleLowerCase(),
                      );
                      return (
                        <button
                          className={`${styles.quickTopicButton} ${alreadyAdded ? styles.quickTopicAdded : ""}`}
                          disabled={saving || alreadyAdded}
                          key={suggestion}
                          onClick={() => addTopicName(suggestion)}
                          type="button"
                        >{suggestion}{alreadyAdded ? " · Добавлена" : <Plus aria-hidden="true" />}</button>
                      );
                    })}
                  </div>
                </div>
              </div>
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
