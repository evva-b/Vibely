export type CompanyProfileData = {
  brandName: string;
  description: string;
  tone: string;
  audience: string;
  topics: string[];
  avatar: string;
};

export const defaultProfile: CompanyProfileData = {
  brandName: "SOJOURN Creative Agency",
  description:
    "Креативное агентство и мастерская визуальных решений из Санкт-Петербурга. Создаём айдентику, дизайн-системы и контент-стратегии для локальных независимых марок, премиального кофе и архитектурных бюро.",
  tone: "Тёплый и эстетичный",
  audience:
    "Основатели креативных бизнесов, арт-директора, маркетологи бутиковых брендов (26–45 лет). Ценят эстетику, авторскую подачу и лаконичность.",
  topics: [
    "🌿 Новинки и концепт кейсы",
    "🎩 За кулисами",
    "💡 Заметки об эстетике и шрифтах",
    "💡 Лайфстайл и вдохновение",
  ],
  avatar: "",
};

const STORAGE_KEY = "vibely-company-profile";
const subscribers = new Set<() => void>();
let currentProfile = defaultProfile;
let lastReadValue: string | null | undefined;
let storageError = "";

function isCompanyProfile(value: unknown): value is CompanyProfileData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const profile = value as Record<string, unknown>;
  return (
    typeof profile.brandName === "string" &&
    typeof profile.description === "string" &&
    typeof profile.tone === "string" &&
    typeof profile.audience === "string" &&
    Array.isArray(profile.topics) &&
    profile.topics.every((topic) => typeof topic === "string") &&
    typeof profile.avatar === "string"
  );
}

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber());
}

function readStoredProfile() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    if (!storageError) {
      console.error("Не удалось обратиться к локальному хранилищу профиля.", error);
    }
    storageError = "Браузер не разрешил доступ к сохранённому профилю.";
    return undefined;
  }
}

export function getCompanyProfileSnapshot() {
  const storedValue = readStoredProfile();
  if (storedValue === undefined) {
    return currentProfile;
  }

  if (storedValue !== lastReadValue) {
    if (!storedValue) {
      currentProfile = defaultProfile;
      storageError = "";
    } else {
      try {
        const parsed: unknown = JSON.parse(storedValue);
        if (!isCompanyProfile(parsed)) {
          throw new Error("Сохранённый профиль компании имеет неверный формат.");
        }
        currentProfile = parsed;
        storageError = "";
      } catch (error) {
        console.error("Не удалось загрузить профиль компании.", error);
        currentProfile = defaultProfile;
        storageError = "Не удалось прочитать сохранённый профиль компании.";
      }
    }
    lastReadValue = storedValue;
  }

  return currentProfile;
}

export function getServerCompanyProfileSnapshot() {
  return defaultProfile;
}

export function getCompanyProfileStorageError() {
  return storageError;
}

export function subscribeToCompanyProfile(subscriber: () => void) {
  subscribers.add(subscriber);

  function handleStorageChange(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      lastReadValue = undefined;
      subscriber();
    }
  }

  window.addEventListener("storage", handleStorageChange);
  return () => {
    subscribers.delete(subscriber);
    window.removeEventListener("storage", handleStorageChange);
  };
}

export function saveCompanyProfile(profile: CompanyProfileData) {
  try {
    const serialized = JSON.stringify(profile);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    currentProfile = profile;
    lastReadValue = serialized;
    storageError = "";
    notifySubscribers();
  } catch (error) {
    console.error("Не удалось сохранить профиль компании.", error);
    storageError =
      "Не удалось сохранить профиль. Возможно, в хранилище браузера закончилось место.";
    notifySubscribers();
    throw error;
  }
}
