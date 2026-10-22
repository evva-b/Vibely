"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";
import { saveMockUser } from "@/features/auth/lib/local-auth";
import { isValidEmail } from "@/features/auth/lib/validation";
import styles from "../RegisterForm/RegisterForm.module.css";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { theme } = useTheme();

  const emailIsValid = isValidEmail(email);
  const showEmailError = (emailTouched || submitted) && !emailIsValid;
  const showPasswordError = submitted && password.length === 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!emailIsValid || password.length === 0) {
      return;
    }

    saveMockUser(email);
    router.push("/board");
  }

  return (
    <main className={styles.screen} data-theme={theme}>
      <section
        aria-labelledby="login-title"
        className={`${styles.card} ${styles.loginCard}`}
      >
        <div aria-hidden="true" className={styles.logo}>
          V
        </div>

        <h1 className={styles.title} id="login-title">
          Войти в Vibely
        </h1>
        <p className={styles.loginPrompt}>
          Ещё нет аккаунта?{" "}
          <Link className={styles.textLink} href="/register">
            Вместо этого зарегистрируйтесь
          </Link>
        </p>

        <form
          className={`${styles.form} ${styles.loginForm}`}
          noValidate
          onSubmit={handleSubmit}
        >
          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-email">
              Электронная почта
            </label>
            <input
              autoComplete="email"
              className={`${styles.input} ${
                showEmailError ? styles.inputError : ""
              }`}
              id="login-email"
              name="email"
              onBlur={() => setEmailTouched(true)}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
              value={email}
              aria-describedby={showEmailError ? "login-email-error" : undefined}
              aria-invalid={showEmailError}
            />
            {showEmailError && (
              <p className={styles.errorText} id="login-email-error">
                Введите корректный адрес электронной почты.
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-password">
              Пароль
            </label>
            <div className={styles.passwordField}>
              <input
                autoComplete="current-password"
                className={`${styles.input} ${
                  showPasswordError ? styles.inputError : ""
                }`}
                id="login-password"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Введите пароль"
                type={showPassword ? "text" : "password"}
                value={password}
                aria-invalid={showPasswordError}
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
            {showPasswordError && (
              <p className={styles.errorText} role="alert">
                Введите пароль.
              </p>
            )}
          </div>

          <label className={styles.rememberRow} htmlFor="remember-me">
            <input
              checked={rememberMe}
              className={styles.checkbox}
              id="remember-me"
              name="rememberMe"
              onChange={(event) => setRememberMe(event.target.checked)}
              type="checkbox"
            />
            <span>Запомнить меня</span>
          </label>

          {submitted && (!emailIsValid || password.length === 0) && (
            <p className={styles.errorText} role="alert">
              Проверьте электронную почту и пароль.
            </p>
          )}

          <button className={styles.submitButton} type="submit">
            Войти
          </button>

        </form>
      </section>
    </main>
  );
}
