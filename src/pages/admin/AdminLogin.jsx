import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CircleAlert, Eye, EyeOff, Info } from "lucide-react";
import Logo from "../../components/Logo";
import { LanguageMenu, ThemeToggle } from "../../components/Preferences";
import { useI18n } from "../../i18n/i18n-context";
import { apiRequest } from "../../lib/api";
import { isAbortError, readToken, storeToken } from "./useAdminSession";
import "../../components/layout.css";
import "./admin.css";

function loginErrorMessage(error) {
  if (error.status === 401) {
    return { key: "admin.login.errors.wrong" };
  }

  return { text: error.message };
}

export default function AdminLogin() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [hasToken] = useState(() => Boolean(readToken()));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const controllerRef = useRef(null);
  const inputRef = useRef(null);
  const expired = Boolean(location.state?.expired);

  useEffect(() => {
    document.title = t("admin.pageTitle.login");
  }, [t]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  if (hasToken) {
    return <Navigate to="/admin" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!email.trim()) {
      setError({ key: "admin.login.errors.emailRequired" });
      document.getElementById("admin-email")?.focus();
      return;
    }

    if (!password) {
      setError({ key: "admin.login.errors.required" });
      inputRef.current?.focus();
      return;
    }

    const controller = new AbortController();
    controllerRef.current = controller;
    setSubmitting(true);
    setError(null);

    try {
      const data = await apiRequest("/api/admin/login", {
        method: "POST",
        body: { email: email.trim(), password },
        signal: controller.signal,
      });

      storeToken(data.token);
      navigate(data.admin?.mustChangePassword ? "/admin/account" : "/admin", { replace: true });
    } catch (loginError) {
      if (isAbortError(loginError)) {
        return;
      }

      setError(loginErrorMessage(loginError));
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }

  return (
    <main className="admin-login">
      <div className="admin-login__panel panel">
        <div className="admin-login__top">
          <Logo
            to="/"
            brand="AutoZone"
            tone="dark"
            suffix={t("admin.brandSuffix")}
            label={t("nav.home", { brand: "AutoZone" })}
          />
          <div className="admin-prefs" role="group" aria-label={t("admin.login.preferences")}>
            <LanguageMenu />
            <ThemeToggle />
          </div>
        </div>
        <h1 className="admin-login__title display">{t("admin.login.title")}</h1>

        {expired && !error && (
          <p className="notice" role="status">
            <Info size={18} aria-hidden="true" />
            <span>{t("admin.login.expired")}</span>
          </p>
        )}

        <form className="admin-login__form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label className="field__label" htmlFor="admin-email">
              {t("admin.login.email")}
            </label>
            <input
              id="admin-email"
              className="input"
              type="email"
              name="email"
              dir="ltr"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="admin-password">
              {t("admin.login.password")}
            </label>
            <div className="admin-password">
              <input
                ref={inputRef}
                id="admin-password"
                className="input admin-password__input"
                type={visible ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={error ? "true" : undefined}
                aria-describedby={error ? "admin-login-error" : undefined}
              />
              <button
                type="button"
                className="admin-password__toggle"
                aria-label={t("admin.login.showPassword")}
                aria-pressed={visible}
                onClick={() => setVisible((value) => !value)}
              >
                {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {error && (
            <p id="admin-login-error" className="notice notice--stop" role="alert">
              <CircleAlert size={18} aria-hidden="true" />
              <span>{error.key ? t(error.key) : error.text}</span>
            </p>
          )}

          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting && <span className="spinner" aria-hidden="true" />}
            {t(submitting ? "admin.login.submitting" : "admin.login.submit")}
          </button>
        </form>

        <Link className="admin-login__back" to="/">
          <ArrowLeft size={18} aria-hidden="true" className="flip-rtl" />
          {t("admin.login.back")}
        </Link>
      </div>
    </main>
  );
}
