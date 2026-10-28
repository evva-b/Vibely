import type {
  AIRequest,
  AdaptedContent,
  AdaptationGenerateResponse,
  AuthToken,
  BoardColumn,
  Brand,
  BrandCreate,
  BrandUpdate,
  GeneratedPostResponse,
  Post,
  PostCreate,
  PostUpdate,
  SocialNetwork,
  Template,
  TemplateCreate,
  TemplateUpdate,
  ToneOfVoice,
  ToneOfVoiceCreate,
  Topic,
  TopicCreate,
  TopicUpdate,
  UserCreate,
  UserRead,
} from "@/types/api";
import {
  clearAccessToken,
  getAccessToken,
  saveAccessToken,
} from "@/features/auth/lib/auth-token";

const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getErrorMessage(payload: unknown, status: number): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "detail" in payload
  ) {
    const detail = payload.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const firstError = detail.find(
        (item): item is { msg: string } =>
          typeof item === "object" &&
          item !== null &&
          "msg" in item &&
          typeof item.msg === "string",
      );
      if (firstError) return firstError.msg;
    }
  }

  if (status === 401) return "Сессия истекла. Войдите в аккаунт снова.";
  if (status === 403) return "У вас нет доступа к этому действию.";
  if (status === 404) return "Запрошенные данные не найдены.";
  if (status === 409) return "Пользователь с таким адресом уже существует.";
  if (status === 422) return "Проверьте введённые данные.";
  if (status >= 500) return "Сервис временно недоступен. Попробуйте позже.";
  return "Не удалось выполнить запрос.";
}

async function request<T>(
  path: string,
  options: RequestInit & { authenticated?: boolean } = {},
): Promise<T> {
  const { authenticated = false, headers: requestHeaders, ...init } = options;
  const headers = new Headers(requestHeaders);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (authenticated) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Не удалось подключиться к backend. Проверьте, что FastAPI запущен.",
      0,
    );
  }

  if (response.status === 401) {
    clearAccessToken();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("vibely:unauthorized"));
    }
  }

  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new ApiError(getErrorMessage(payload, response.status), response.status);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const json = (value: unknown) => JSON.stringify(value);

export const api = {
  register: (body: UserCreate) =>
    request<UserRead>("/api/auth/register", {
      method: "POST",
      body: json(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<AuthToken>("/api/auth/login", {
      method: "POST",
      body: json(body),
    }),
  currentUser: () => request<UserRead>("/api/auth/me", { authenticated: true }),
  listBrands: () => request<Brand[]>("/api/brands", { authenticated: true }),
  createBrand: (body: BrandCreate) =>
    request<Brand>("/api/brands", {
      method: "POST",
      body: json(body),
      authenticated: true,
    }),
  updateBrand: (id: string, body: BrandUpdate) =>
    request<Brand>(`/api/brands/${id}`, {
      method: "PATCH",
      body: json(body),
      authenticated: true,
    }),
  getTone: (brandId: string) =>
    request<ToneOfVoice>(`/api/brands/${brandId}/tone-of-voice`, {
      authenticated: true,
    }),
  saveTone: (brandId: string, body: ToneOfVoiceCreate) =>
    request<ToneOfVoice>(`/api/brands/${brandId}/tone-of-voice`, {
      method: "PUT",
      body: json(body),
      authenticated: true,
    }),
  listTopics: (brandId: string) =>
    request<Topic[]>(`/api/brands/${brandId}/topics`, { authenticated: true }),
  createTopic: (brandId: string, body: TopicCreate) =>
    request<Topic>(`/api/brands/${brandId}/topics`, {
      method: "POST",
      body: json(body),
      authenticated: true,
    }),
  updateTopic: (id: string, body: TopicUpdate) =>
    request<Topic>(`/api/topics/${id}`, {
      method: "PATCH",
      body: json(body),
      authenticated: true,
    }),
  deleteTopic: (id: string) =>
    request<void>(`/api/topics/${id}`, {
      method: "DELETE",
      authenticated: true,
    }),
  listTemplates: (brandId: string) =>
    request<Template[]>(`/api/brands/${brandId}/templates`, {
      authenticated: true,
    }),
  createTemplate: (brandId: string, body: TemplateCreate) =>
    request<Template>(`/api/brands/${brandId}/templates`, {
      method: "POST",
      body: json(body),
      authenticated: true,
    }),
  updateTemplate: (id: string, body: TemplateUpdate) =>
    request<Template>(`/api/templates/${id}`, {
      method: "PATCH",
      body: json(body),
      authenticated: true,
    }),
  deleteTemplate: (id: string) =>
    request<void>(`/api/templates/${id}`, {
      method: "DELETE",
      authenticated: true,
    }),
  getBoard: (brandId: string) =>
    request<BoardColumn[]>(`/api/brands/${brandId}/board`, {
      authenticated: true,
    }),
  listPosts: (brandId: string) =>
    request<Post[]>(`/api/brands/${brandId}/posts`, { authenticated: true }),
  createPost: (brandId: string, body: PostCreate) =>
    request<Post>(`/api/brands/${brandId}/posts`, {
      method: "POST",
      body: json(body),
      authenticated: true,
    }),
  updatePost: (id: string, body: PostUpdate) =>
    request<Post>(`/api/posts/${id}`, {
      method: "PATCH",
      body: json(body),
      authenticated: true,
    }),
  deletePost: (id: string) =>
    request<void>(`/api/posts/${id}`, {
      method: "DELETE",
      authenticated: true,
    }),
  generatePost: (brandId: string, body: {
    prompt: string;
    template_id?: string;
    board_status_id?: string;
  }) =>
    request<GeneratedPostResponse>(`/api/brands/${brandId}/generate-post`, {
      method: "POST",
      body: json(body),
      authenticated: true,
    }),
  listAIRequests: (brandId: string) =>
    request<AIRequest[]>(`/api/brands/${brandId}/ai-requests`, {
      authenticated: true,
    }),
  listSocialNetworks: () =>
    request<SocialNetwork[]>("/api/social-networks", { authenticated: true }),
  generateAdaptation: (postId: string, socialNetworkId: string) =>
    request<AdaptationGenerateResponse>(
      `/api/posts/${postId}/generate-adaptation`,
      {
        method: "POST",
        body: json({ social_network_id: socialNetworkId }),
        authenticated: true,
      },
    ),
  listAdaptations: (postId: string) =>
    request<AdaptedContent[]>(`/api/posts/${postId}/adaptations`, {
      authenticated: true,
    }),
};

export function saveLoginToken(token: string, rememberMe: boolean) {
  saveAccessToken(token, rememberMe);
}
