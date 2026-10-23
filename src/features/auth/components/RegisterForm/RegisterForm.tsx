"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff } from "lucide-react";
import { ThemeToggle, useTheme } from "@/components/theme/ThemeProvider";
import { saveMockUser } from "@/features/auth/lib/local-auth";
import { isValidEmail } from "@/features/auth/lib/validation";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { theme } = useTheme();

  const emailIsValid = isValidEmail(email);
  const passwordIsValid = passwordRules.every((rule) =>
    rule.test(password),
  );
  const showEmailError = (emailTouched || submitted) && !emailIsValid;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);

    if (!emailIsValid || !passwordIsValid) {
      return;
    }

    saveMockUser(email);
    router.push("/board");
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

          {submitted && (!emailIsValid || !passwordIsValid) && (
            <p className={styles.errorText} role="alert">
              Проверьте электронную почту и требования к паролю.
            </p>
          )}

          <button className={styles.submitButton} type="submit">
            Зарегистрироваться
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
