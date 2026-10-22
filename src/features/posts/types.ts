export const ideaStatuses = ["draft", "todo", "inProgress", "done"] as const;

export type IdeaStatus = (typeof ideaStatuses)[number];

export type Idea = {
  id: string;
  title: string;
  description: string;
  status: IdeaStatus;
  image?: string;
  updatedAt: number;
};

export const statusLabels: Record<IdeaStatus, string> = {
  draft: "Черновик",
  todo: "Сделать",
  inProgress: "В работе",
  done: "Готово",
};

export const initialIdeas: Idea[] = [
  {
    id: "idea-content-plan",
    title: "Место для планирования контента",
    description:
      "Сохраняйте идеи до публикации, продумывайте форматы и распределяйте публикации по соцсетям.",
    status: "draft",
    updatedAt: 3,
  },
  {
    id: "idea-behind-scenes",
    title: "Идеи из бэкстейджа",
    description:
      "Покажите процесс создания продукта: короткое видео, детали и один интересный факт о команде.",
    status: "draft",
    updatedAt: 2,
  },
];
