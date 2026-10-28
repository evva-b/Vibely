"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff } from "lucide-react";
import { ThemeToggle, useTheme } from "@/components/theme/ThemeProvider";
import { isValidEmail } from "@/features/auth/lib/validation";
import { api, ApiError, saveLoginToken } from "@/lib/api";
import styles from "./RegisterForm.module.css";

type PasswordRule = {
  id: string;
  label: string;
  test: (value: string) => boolean;
};

const passwordRules: PasswordRule[] = [
  {
    id: "length",
    label: "Не менее 8 символов",
    test: (value) => Array.from(value).length >= 8,
  },
  {
    id: "uppercase",
    label: "Содержит 1 заглавную букву",
    test: (value) => /\p{Lu}/u.test(value),
  },
  {
    id: "number-or-symbol",
    label: "Содержит 1 цифру или символ",
    test: (value) => /[\p{N}\p{P}\p{S}]/u.test(value),
  },
];

export default function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const { theme } = useTheme();

  const emailIsValid = isValidEmail(email);
  const passwordIsValid = passwordRules.every((rule) =>
    rule.test(password),
  );
  const showEmailError = (emailTouched || submitted) && !emailIsValid;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    setServerError("");

    if (!name.trim() || !emailIsValid || !passwordIsValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      await api.register({ name: name.trim(), email: email.trim(), password });
      const session = await api.login({ email: email.trim(), password });
      saveLoginToken(session.access_token, true);
      router.replace("/board");
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.status === 409
            ? "Пользователь с таким адресом уже зарегистрирован. Войдите в аккаунт."
            : error.message
          : "Не удалось создать аккаунт. Попробуйте ещё раз.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.screen} data-theme={theme}>
      <ThemeToggle />
      <section aria-labelledby="register-title" className={styles.card}>
        <div aria-hidden="true" className={styles.logo}>
          V
        </div>

        <h1 className={styles.title} id="register-title">
          Создать аккаунт в Vibely
        </h1>
        <p className={styles.loginPrompt}>
          У вас уже есть аккаунт?{" "}
          <Link className={styles.textLink} href="/login">
            Войти
          </Link>
        </p>

        <form className={styles.form} noValidate onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-name">
              Ваше имя
            </label>
            <input
              autoComplete="name"
              className={`${styles.input} ${
                submitted && !name.trim() ? styles.inputError : ""
              }`}
              id="register-name"
              maxLength={100}
              name="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Как к вам обращаться?"
              value={name}
              aria-invalid={submitted && !name.trim()}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-email">
              Электронная почта
            </label>
            <input
              autoComplete="email"
              className={`${styles.input} ${
                showEmailError ? styles.inputError : ""
              }`}
              id="register-email"
              name="email"
              onBlur={() => setEmailTouched(true)}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
              value={email}
              aria-describedby={showEmailError ? "email-error" : undefined}
              aria-invalid={showEmailError}
            />
            {showEmailError && (
              <p className={styles.errorText} id="email-error">
                Введите корректный адрес электронной почты.
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="register-password">
              Создать пароль
            </label>
            <div className={styles.passwordField}>
              <input
                autoComplete="new-password"
                className={styles.input}
                id="register-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Введите пароль"
                type={showPassword ? "text" : "password"}
                value={password}
                aria-describedby="password-requirements"
              />
              <button
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                aria-pressed={showPassword}
                className={styles.visibilityToggle}
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" />
                ) : (
                  <Eye aria-hidden="true" />
                )}
              </button>
            </div>

            <ul
              className={styles.requirements}
              id="password-requirements"
              aria-label="Требования к паролю"
            >
              {passwordRules.map((rule) => {
                const isMet = rule.test(password);

                return (
                  <li
                    className={`${styles.requirement} ${
                      isMet ? styles.requirementMet : ""
                    }`}
                    key={rule.id}
                  >
                    <span aria-hidden="true" className={styles.requirementIcon}>
                      {isMet ? <Check /> : null}
                    </span>
                    <span>{rule.label}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {submitted && (!name.trim() || !emailIsValid || !passwordIsValid) && (
            <p className={styles.errorText} role="alert">
              Заполните имя, проверьте электронную почту и требования к паролю.
            </p>
          )}

          {serverError && <p className={styles.errorText} role="alert">{serverError}</p>}

          <button className={styles.submitButton} disabled={isSubmitting} type="submit">
            {isSubmitting ? "Создаём аккаунт…" : "Зарегистрироваться"}
          </button>

        </form>

        <p className={styles.terms}>
          Регистрируясь, вы соглашаетесь с Условиями использования и Политикой
          конфиденциальности Vibely.
        </p>
      </section>
    </main>
  );
}
