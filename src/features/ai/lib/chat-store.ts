export type ChatAttachment = {
  id: string;
  name: string;
  type: string;
  dataUrl: string;
  size: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  attachments?: ChatAttachment[];
  reaction?: "up" | "down";
  saved?: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
  ideaId?: string;
};

export type ChatState = {
  conversations: Conversation[];
  activeConversationId: string;
};

const STORAGE_KEY = "vibely-chat-conversations";
const subscribers = new Set<() => void>();

const starterMessages: ChatMessage[] = [
  {
    id: "starter-user",
    role: "user",
    content:
      "Напиши вовлекающий пост-анонс о запуске новой весенней капсулы для локального бренда одежды. Тон — тёплый, эстетичный, без клише. Сделай акцент на натуральных тканях: лён, органический хлопок и первом тепле.",
    createdAt: "14:28",
  },
  {
    id: "starter-assistant",
    role: "assistant",
    content:
      "Воздух пахнет переменами, а мы согреваемся первыми лучами солнца! ☀️\n\nМы отобрали плотный органический хлопок, дышащий вискозный лён и палитру, подсмотренную у просыпающейся природы: тёплый песочный, терракотовый, сливочный и цвет свежего утреннего неба.\n\nКапсула уже доступна на сайте и в шоуруме на Покровке. Первые заказы бережно упаковываем в хлопковые мешочки ручной работы. ✨\n\nПереходите по ссылке в описание профиля, чтобы первыми выбрать свой размер!\n\n#весенняякапсула  #натуральныеткани",
    createdAt: "14:28",
  },
];

export function createPlaceholderMessages(): ChatMessage[] {
  return starterMessages.map((message) => ({ ...message }));
}

const initialState: ChatState = {
  conversations: [
    {
      id: "starter-conversation",
      title: "Весенняя капсула",
      messages: starterMessages,
      updatedAt: 1,
    },
  ],
  activeConversationId: "starter-conversation",
};

let currentState = initialState;
let lastReadValue: string | null | undefined;
let storageError = "";

function isAttachment(value: unknown): value is ChatAttachment {
  if (typeof value !== "object" || value === null) return false;
  const attachment = value as Record<string, unknown>;
  return (
    typeof attachment.id === "string" &&
    typeof attachment.name === "string" &&
    typeof attachment.type === "string" &&
    typeof attachment.dataUrl === "string" &&
    typeof attachment.size === "number"
  );
}

function isMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Record<string, unknown>;
  return (
    typeof message.id === "string" &&
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    typeof message.createdAt === "string" &&
    (message.attachments === undefined ||
      (Array.isArray(message.attachments) &&
        message.attachments.every(isAttachment))) &&
    (message.reaction === undefined ||
      message.reaction === "up" ||
      message.reaction === "down") &&
    (message.saved === undefined || typeof message.saved === "boolean")
  );
}

function isChatState(value: unknown): value is ChatState {
  if (typeof value !== "object" || value === null) return false;
  const state = value as Record<string, unknown>;
  return (
    typeof state.activeConversationId === "string" &&
    Array.isArray(state.conversations) &&
    state.conversations.every((conversation) => {
      if (typeof conversation !== "object" || conversation === null) return false;
      const item = conversation as Record<string, unknown>;
      return (
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.updatedAt === "number" &&
        (item.ideaId === undefined || typeof item.ideaId === "string") &&
        Array.isArray(item.messages) &&
        item.messages.every(isMessage)
      );
    }) &&
    (state.conversations.length === 0 ||
      state.conversations.some(
        (conversation) =>
          (conversation as Record<string, unknown>).id ===
          state.activeConversationId,
      ))
  );
}

function notifySubscribers() {
  subscribers.forEach((subscriber) => subscriber());
}

function readStoredState() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    if (!storageError) {
      console.error("Не удалось прочитать историю чатов.", error);
    }
    storageError = "Браузер не разрешил доступ к истории чатов.";
    return undefined;
  }
}

export function getChatStateSnapshot() {
  const storedValue = readStoredState();
  if (storedValue === undefined) return currentState;

  if (storedValue !== lastReadValue) {
    if (!storedValue) {
      currentState = initialState;
      storageError = "";
    } else {
      try {
        const parsed: unknown = JSON.parse(storedValue);
        if (!isChatState(parsed)) {
          throw new Error("История чатов имеет неверный формат.");
        }
        currentState = parsed;
        storageError = "";
      } catch (error) {
        console.error("Не удалось загрузить историю чатов.", error);
        currentState = initialState;
        storageError = "Не удалось прочитать историю чатов из браузера.";
      }
    }
    lastReadValue = storedValue;
  }

  return currentState;
}

export function getServerChatStateSnapshot() {
  return initialState;
}

export function getChatStorageError() {
  return storageError;
}

export function subscribeToChatState(subscriber: () => void) {
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

export function updateChatState(
  updater: (state: ChatState) => ChatState,
) {
  const nextState = updater(currentState);
  currentState = nextState;

  try {
    const serialized = JSON.stringify(nextState);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    lastReadValue = serialized;
    storageError = "";
  } catch (error) {
    console.error("Не удалось сохранить историю чатов.", error);
    storageError =
      "Не удалось сохранить историю. Возможно, в хранилище браузера закончилось место.";
  }

  notifySubscribers();
}
