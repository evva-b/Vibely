import {
  initialIdeas,
  type Idea,
} from "@/features/posts/types";

const STORAGE_KEY = "vibely-ideas";
const subscribers = new Set<() => void>();

let currentIdeas = initialIdeas;
let lastReadValue: string | null | undefined;
let storageError = "";

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber());
}

function parseIdeas(serialized: string | null): Idea[] {
  if (!serialized) {
    return initialIdeas;
  }

  try {
    const parsed: unknown = JSON.parse(serialized);

    if (
      Array.isArray(parsed) &&
      parsed.every(
        (idea): idea is Idea =>
          typeof idea === "object" &&
          idea !== null &&
          "id" in idea &&
          typeof idea.id === "string" &&
          "title" in idea &&
          typeof idea.title === "string" &&
          "description" in idea &&
          typeof idea.description === "string" &&
          "status" in idea &&
          (idea.status === "draft" ||
            idea.status === "todo" ||
            idea.status === "inProgress" ||
            idea.status === "done") &&
          "updatedAt" in idea &&
          typeof idea.updatedAt === "number" &&
          (!("image" in idea) || typeof idea.image === "string") &&
          (!("topic" in idea) || typeof idea.topic === "string"),
      )
    ) {
      return parsed;
    }

    throw new Error("Сохранённые идеи имеют неверный формат.");
  } catch (error) {
    console.error("Не удалось прочитать идеи из локального хранилища.", error);
    storageError = "Не удалось прочитать сохранённые идеи.";
    return initialIdeas;
  }
}

function readStoredValue() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error("Не удалось обратиться к локальному хранилищу.", error);
    storageError = "Браузер не разрешил доступ к локальному хранилищу.";
    return null;
  }
}

export function getIdeasSnapshot(): Idea[] {
  const storedValue = readStoredValue();

  if (storedValue !== lastReadValue) {
    currentIdeas = parseIdeas(storedValue);
    lastReadValue = storedValue;
  }

  return currentIdeas;
}

export function getServerIdeasSnapshot() {
  return initialIdeas;
}

export function getStorageErrorSnapshot() {
  return storageError;
}

export function subscribeToIdeas(subscriber: () => void) {
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

export function updateIdeas(
  updater: (ideas: Idea[]) => Idea[],
) {
  const nextIdeas = updater(currentIdeas);
  currentIdeas = nextIdeas;

  try {
    const serialized = JSON.stringify(nextIdeas);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    lastReadValue = serialized;
    storageError = "";
  } catch (error) {
    console.error("Не удалось сохранить идеи в браузере.", error);
    storageError =
      "Не удалось сохранить изменения. Возможно, в хранилище браузера закончилось место.";
  }

  notifySubscribers();
}
