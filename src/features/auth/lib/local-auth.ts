export type MockUser = {
  email: string;
};

const USER_STORAGE_KEY = "vibely-user";

export function saveMockUser(email: string) {
  window.localStorage.setItem(
    USER_STORAGE_KEY,
    JSON.stringify({ email } satisfies MockUser),
  );
}

export function getMockUser(): MockUser | null {
  const storedUser = window.localStorage.getItem(USER_STORAGE_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    const parsedUser: unknown = JSON.parse(storedUser);

    if (
      typeof parsedUser === "object" &&
      parsedUser !== null &&
      "email" in parsedUser &&
      typeof parsedUser.email === "string"
    ) {
      return { email: parsedUser.email };
    }
  } catch (error) {
    console.error("Не удалось прочитать пользователя из локального хранилища.", error);
    window.localStorage.removeItem(USER_STORAGE_KEY);
  }

  return null;
}

export function clearMockUser() {
  window.localStorage.removeItem(USER_STORAGE_KEY);
}
