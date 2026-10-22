# Vibely

Frontend-каркас приложения для генерации и редактирования контента социальных
сетей. Сейчас проект содержит только структуру и стартовые страницы; интеграция
с backend и API нейросети пока не добавлена.

## Структура frontend

```text
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── board/page.tsx
│   │   ├── chats/page.tsx
│   │   ├── profile/page.tsx
│   │   └── layout.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── layout/
│   │   └── Header/
│   └── ui/
│       ├── Button/
│       ├── Input/
│       ├── Logo/
│       ├── Modal/
│       └── Textarea/
├── data/
│   └── mock/
├── features/
│   ├── ai/components/Chat/
│   ├── auth/components/AuthCard/
│   ├── brands/components/
│   └── posts/components/
│       ├── Board/
│       ├── BoardColumn/
│       ├── CreateIdeaModal/
│       └── IdeaCard/
├── lib/
└── types/
```

## Правила размещения кода

- `app/` — маршруты, layouts и глобальные стили Next.js. Группы `(auth)` и
  `(dashboard)` организуют маршруты, не добавляя сегменты в URL.
- `features/` — компоненты и логика отдельных предметных областей: авторизации,
  публикаций, организаций и AI-чата. Специфичные для функции типы и API-код
  следует хранить рядом с соответствующей функцией.
- `components/ui/` — переиспользуемые базовые элементы интерфейса;
  `components/layout/` — общие элементы оболочки приложения.
- `data/mock/` — временные данные для разработки интерфейса до подключения API.
- `lib/` — общие утилиты frontend; `types/` — типы, которые действительно
  используются несколькими функциями.

Маршруты доступны по адресам `/login`, `/register`, `/board`, `/chats` и
`/profile`. Корневой маршрут для нового посетителя перенаправляет на
`/register`.
