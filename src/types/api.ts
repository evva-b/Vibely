export type AuthToken = {
  access_token: string;
  token_type: "bearer";
};

export type UserCreate = {
  name: string;
  email: string;
  password: string;
};

export type UserRead = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

export type Brand = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  target_audience: string | null;
  created_at: string;
};

export type BrandCreate = {
  name: string;
  description: string | null;
  target_audience: string | null;
};

export type BrandUpdate = Partial<BrandCreate>;

export type ToneOfVoice = {
  id: string;
  brand_id: string;
  style: string;
  vocabulary: string | null;
  communication_rules: string | null;
  forbidden_words: string | null;
};

export type ToneOfVoiceCreate = {
  style: string;
  vocabulary: string | null;
  communication_rules: string | null;
  forbidden_words: string | null;
};

export type Topic = {
  id: string;
  brand_id: string;
  name: string;
};

export type TopicCreate = { name: string };
export type TopicUpdate = Partial<TopicCreate>;

export type BoardStatus = {
  id: string;
  name: string;
  position: number;
};

export type Post = {
  id: string;
  brand_id: string;
  ai_request_id: string | null;
  board_status_id: string;
  title: string;
  text: string;
  created_at: string;
  updated_at: string;
};

export type PostCreate = {
  title: string;
  text: string;
  board_status_id: string;
};

export type PostUpdate = Partial<PostCreate>;

export type BoardColumn = BoardStatus & {
  posts: Post[];
};

export type AIRequest = {
  id: string;
  template_id: string | null;
  brand_id: string;
  request_type: string;
  prompt: string;
  response: string | null;
  model: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  kind: "post" | "adaptation";
  platform: string | null;
  feedback: "up" | "down" | null;
  image_data?: string | null;
  image_type?: "image/jpeg" | "image/png" | "image/webp" | null;
};

export type PostChat = {
  post: Post;
  request: AIRequest;
  messages: ChatMessage[];
  context: {
    social_network_id: string | null;
    social_network: string | null;
    style: string | null;
  };
};

export type ChatFeedbackRead = {
  message_id: string;
  rating: "up" | "down" | null;
};

export type StructureSuggestion = {
  structure: string;
  missing_profile_fields: string[];
};

export type SocialNetwork = {
  id: string;
  name: string;
  description: string | null;
};

export type AdaptedContent = {
  id: string;
  post_id: string;
  social_network_id: string;
  text: string;
  created_at: string;
  updated_at: string;
};

export type AdaptationGenerateResponse = {
  adaptation: AdaptedContent;
  ai_request_id: string;
};
