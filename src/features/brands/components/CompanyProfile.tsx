"use client";

import {
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ImagePlus, LogOut, Plus, UserRound, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeProvider";
import { clearMockUser } from "@/features/auth/lib/local-auth";
import {
  getCompanyProfileSnapshot,
  getCompanyProfileStorageError,
  getServerCompanyProfileSnapshot,
  saveCompanyProfile,
  subscribeToCompanyProfile,
  type CompanyProfileData,
} from "@/features/brands/lib/company-profile-store";
import { requestIdeaDialogOpen } from "@/features/posts/lib/idea-dialog-navigation";
import styles from "./CompanyProfile.module.css";

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

export default function CompanyProfile() {
  const router = useRouter();
  const savedProfile = useSyncExternalStore(
    subscribeToCompanyProfile,
    getCompanyProfileSnapshot,
    getServerCompanyProfileSnapshot,
  );
  const storageError = useSyncExternalStore(
    subscribeToCompanyProfile,
    getCompanyProfileStorageError,
    () => "",
  );
  const [draft, setDraft] = useState<CompanyProfileData | null>(null);
  const [newTopic, setNewTopic] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profile = draft ?? savedProfile;

  function updateField<K extends keyof CompanyProfileData>(
    field: K,
    value: CompanyProfileData[K],
  ) {
    setDraft((current) => ({ ...(current ?? profile), [field]: value }));
    setError("");
    setNotice("");
  }

  function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Поддерживаются только изображения PNG, JPG и WEBP.");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setError("Размер фотографии не должен превышать 2 МБ.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Не удалось обработать фотографию. Попробуйте другой файл.");
        return;
      }
      updateField("avatar", reader.result);
      setError("");
    };
    reader.onerror = () => {
      setError("Не удалось загрузить фотографию. Попробуйте другой файл.");
    };
    reader.readAsDataURL(file);
  }

  function addTopic() {
    const topic = newTopic.trim();
    if (!topic) return;

    if (profile.topics.some((existing) => existing.toLocaleLowerCase() === topic.toLocaleLowerCase())) {
      setError("Такая тема уже добавлена.");
      return;
    }

    updateField("topics", [...profile.topics, topic]);
    setNewTopic("");
    setError("");
  }

  function handleTopicKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTopic();
    }
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = profile.brandName.trim();
    if (!cleanName) {
      setError("Укажите название бренда.");
      return;
    }

    const updatedProfile = { ...profile, brandName: cleanName };
    try {
      saveCompanyProfile(updatedProfile);
      setDraft(null);
      setError("");
      setNotice("Изменения профиля сохранены.");
    } catch {
      setError("Не удалось сохранить профиль. Возможно, в хранилище браузера закончилось место.");
      setNotice("");
    }
  }

  function handleCancel() {
    setDraft(null);
    setNewTopic("");
    setError("");
    setNotice("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSignOut() {
    clearMockUser();
    router.push("/login");
  }

  return (
    <main className={styles.app}>
      <header className={styles.topbar}>
        <Link aria-label="Vibely — главная" className={styles.brand} href="/board">
          <span aria-hidden="true" className={styles.brandMark}>V</span>
          <span>Vibely</span>
        </Link>

        <nav aria-label="Основная навигация" className={styles.navigation}>
          <Link className={styles.navLink} href="/board">Доска идей</Link>
          <Link className={styles.navLink} href="/chats">Чаты</Link>
        </nav>

        <div className={styles.topbarActions}>
          <button
            className={styles.primaryButton}
            onClick={() => {
              requestIdeaDialogOpen();
              router.push("/board");
            }}
            type="button"
          >
            <Plus aria-hidden="true" />
            <span>Новая идея</span>
          </button>
          <ThemeToggle inline />
          <details className={styles.accountMenu}>
            <summary aria-label="Меню профиля">
              <UserRound aria-hidden="true" />
            </summary>
            <div className={styles.accountDropdown}>
              <Link href="/profile"><UserRound aria-hidden="true" />Профиль компании</Link>
              <button onClick={handleSignOut} type="button">
                <LogOut aria-hidden="true" />Выйти
              </button>
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
              <button className={styles.secondaryButton} onClick={handleCancel} type="button">
                Отмена
              </button>
              <button className={styles.primaryButton} type="submit">
                Сохранить изменения
              </button>
            </div>
          </div>

          {(error || storageError) && (
            <p className={styles.formError} role="alert">
              {error || storageError}
            </p>
          )}
          {notice && <p className={styles.formNotice} role="status">{notice}</p>}

          <div className={styles.profileGrid}>
            <div className={styles.avatarSection}>
              <div className={styles.avatarFrame}>
                {profile.avatar ? (
                  <Image
                    alt="Фотография профиля компании"
                    className={styles.avatarImage}
                    height={128}
                    src={profile.avatar}
                    unoptimized
                    width={128}
                  />
                ) : (
                  <Building2 aria-hidden="true" />
                )}
              </div>
              <div className={styles.avatarDetails}>
                <strong>Фотография профиля</strong>
                <span>PNG, JPG или WEBP · до 2 МБ</span>
                <label className={styles.avatarButton}>
                  <ImagePlus aria-hidden="true" />
                  Изменить фото
                  <input
                    accept="image/png,image/jpeg,image/webp"
                    className={styles.visuallyHidden}
                    onChange={handleAvatarChange}
                    ref={fileInputRef}
                    type="file"
                  />
                </label>
                {profile.avatar && (
                  <button
                    className={styles.removeAvatarButton}
                    onClick={() => updateField("avatar", "")}
                    type="button"
                  >
                    <X aria-hidden="true" /> Удалить фото
                  </button>
                )}
              </div>
            </div>

            <label className={styles.field}>
              <span>Название бренда</span>
              <input
                autoComplete="organization"
                maxLength={100}
                onChange={(event) => updateField("brandName", event.target.value)}
                placeholder="Название компании или бренда"
                value={profile.brandName}
              />
            </label>

            <label className={styles.field}>
              <span>Тип общения</span>
              <select
                onChange={(event) => updateField("tone", event.target.value)}
                value={profile.tone}
              >
                <option>Тёплый и эстетичный</option>
                <option>Дружелюбный и простой</option>
                <option>Экспертный и деловой</option>
                <option>Энергичный и смелый</option>
                <option>Ироничный и лёгкий</option>
                <option>Минималистичный и спокойный</option>
              </select>
            </label>

            <label className={`${styles.field} ${styles.fullWidth}`}>
              <span>Описание бренда</span>
              <textarea
                maxLength={1200}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="Расскажите о компании, продукте и ценностях бренда"
                rows={4}
                value={profile.description}
              />
              <small>{profile.description.length}/1200</small>
            </label>

            <label className={`${styles.field} ${styles.fullWidth}`}>
              <span>Целевая аудитория</span>
              <textarea
                maxLength={800}
                onChange={(event) => updateField("audience", event.target.value)}
                placeholder="Кому адресован ваш контент? Опишите интересы и потребности аудитории"
                rows={3}
                value={profile.audience}
              />
              <small>{profile.audience.length}/800</small>
            </label>

            <div className={`${styles.field} ${styles.fullWidth}`}>
              <span>Темы контента</span>
              <div className={styles.topicList}>
                {profile.topics.map((topic) => (
                  <span className={styles.topicTag} key={topic}>
                    {topic}
                    <button
                      aria-label={`Удалить тему «${topic}»`}
                      onClick={() => updateField("topics", profile.topics.filter((item) => item !== topic))}
                      type="button"
                    >
                      <X aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
              <div className={styles.addTopicRow}>
                <input
                  aria-label="Новая тема контента"
                  maxLength={50}
                  onChange={(event) => setNewTopic(event.target.value)}
                  onKeyDown={handleTopicKeyDown}
                  placeholder="Например, советы по уходу"
                  value={newTopic}
                />
                <button className={styles.addTopicButton} onClick={addTopic} type="button">
                  <Plus aria-hidden="true" />
                  Добавить тему
                </button>
              </div>
              <small>Нажмите Enter, чтобы добавить тему. Удалить тег можно кнопкой ×.</small>
            </div>
          </div>

          <div className={styles.mobileActions}>
            <button className={styles.secondaryButton} onClick={handleCancel} type="button">
              Отмена
            </button>
            <button className={styles.primaryButton} type="submit">
              Сохранить изменения
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
