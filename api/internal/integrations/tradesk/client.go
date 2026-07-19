// Package tradesk — адаптер доставки заказов/заявок в учётную систему tradesk.ru
// (Yii2, самопись). Реализует orders.OrderDelivery. Заменяет мок после разведки
// механизма приёма форм.
//
// Разведка (read-only) показала:
//   - Вход: GET /site/login → CSRF-токен из <meta name="csrf-token"> и куки _csrf →
//     POST /site/login с полями _csrf-frontend + LoginForm[username]/[password].
//   - Сессия: куки _identity (30д), PHPSESSID, _csrf. Держим в cookiejar.
//   - Кодировка: сервер отдаёт UTF-8 (иногда рендерит как CP1251 в чужих клиентах) —
//     шлём и парсим UTF-8, Content-Type формы application/x-www-form-urlencoded.
//   - Контроллеры контура: order, backcall, request (заявка), storage.
//
// ВНИМАНИЕ: точные имена полей приёмника («создать обратный звонок» и «создать заказ»)
// в админке отсутствуют (backcall/create → 404). Их контракт берётся из формы старого
// сайта tirestock.ru и подставляется в backcall.go / order.go (см. TODO там).
package tradesk

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Config — параметры подключения к tradesk (из env, задаются в main).
type Config struct {
	BaseURL  string // напр. https://tradesk.ru
	Username string
	Password string
	Timeout  time.Duration // на один HTTP-запрос; 0 → 15s
}

// Client — HTTP-клиент к tradesk с ленивой авторизацией и переиспользованием сессии.
// Потокобезопасен: воркер доставки может дёргать Deliver из нескольких горутин.
type Client struct {
	cfg  Config
	http *http.Client

	mu       sync.Mutex // защищает loggedIn и повторный вход
	loggedIn bool
}

// meta name="csrf-token" content="...": Yii2 кладёт токен в meta, откуда его берёт yii.js.
var csrfMetaRe = regexp.MustCompile(`<meta\s+name="csrf-token"\s+content="([^"]+)"`)

// NewClient собирает клиент с cookiejar (держит _identity/PHPSESSID/_csrf между запросами).
func NewClient(cfg Config) (*Client, error) {
	if strings.TrimSpace(cfg.BaseURL) == "" {
		return nil, fmt.Errorf("tradesk: BaseURL обязателен")
	}
	if cfg.Username == "" || cfg.Password == "" {
		return nil, fmt.Errorf("tradesk: нужны Username и Password")
	}
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	if cfg.Timeout == 0 {
		cfg.Timeout = 15 * time.Second
	}
	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, fmt.Errorf("tradesk: cookiejar: %w", err)
	}
	return &Client{
		cfg:  cfg,
		http: &http.Client{Jar: jar, Timeout: cfg.Timeout},
	}, nil
}

// ensureLogin гарантирует активную сессию: если ещё не входили — выполняет вход.
// Переавторизация по протухшей сессии обрабатывается в postForm (retry once).
func (c *Client) ensureLogin(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.loggedIn {
		return nil
	}
	return c.loginLocked(ctx)
}

// loginLocked выполняет двухшаговый вход Yii2. Вызывается под c.mu.
func (c *Client) loginLocked(ctx context.Context) error {
	// Шаг 1: GET страницы логина — получить CSRF-токен и стартовые куки.
	token, err := c.fetchCSRF(ctx, "/site/login")
	if err != nil {
		return fmt.Errorf("tradesk login: получить csrf: %w", err)
	}

	// Шаг 2: POST логина. Имена полей — стандартные для Yii2 LoginForm.
	form := url.Values{
		"_csrf-frontend":        {token},
		"LoginForm[username]":   {c.cfg.Username},
		"LoginForm[password]":   {c.cfg.Password},
		"LoginForm[rememberMe]": {"1"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.BaseURL+"/site/login", strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("X-CSRF-Token", token)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("tradesk login: POST: %w", err)
	}
	defer drain(resp)

	// Успех Yii2 — редирект на защищённую страницу; повторно показанная /site/login
	// с формой означает неверные креды.
	body := readSnippet(resp)
	if resp.StatusCode >= 400 || strings.Contains(body, `name="LoginForm[password]"`) {
		return fmt.Errorf("tradesk login: отказ (status %d) — проверьте логин/пароль", resp.StatusCode)
	}
	c.loggedIn = true
	return nil
}

// fetchCSRF делает GET страницы и вынимает CSRF-токен из <meta name="csrf-token">.
func (c *Client) fetchCSRF(ctx context.Context, path string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.cfg.BaseURL+path, nil)
	if err != nil {
		return "", err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer drain(resp)
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}
	m := csrfMetaRe.FindSubmatch(body)
	if m == nil {
		return "", fmt.Errorf("csrf-token не найден на %s", path)
	}
	return string(m[1]), nil
}

// postForm отправляет form-urlencoded POST на path контура. Перед отправкой берёт
// свежий CSRF-токен со страницы формы (Yii2 валидирует _csrf по кукам+полю).
// При признаке протухшей сессии (редирект на /site/login) — один повторный вход.
func (c *Client) postForm(ctx context.Context, formPath, actionPath string, fields url.Values) error {
	if err := c.ensureLogin(ctx); err != nil {
		return err
	}

	do := func() (*http.Response, string, error) {
		token, err := c.fetchCSRF(ctx, formPath)
		if err != nil {
			return nil, "", err
		}
		fields.Set("_csrf-frontend", token)
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.BaseURL+actionPath, strings.NewReader(fields.Encode()))
		if err != nil {
			return nil, "", err
		}
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("X-CSRF-Token", token)
		req.Header.Set("X-Requested-With", "XMLHttpRequest")
		resp, err := c.http.Do(req)
		if err != nil {
			return nil, "", err
		}
		return resp, readSnippet(resp), nil
	}

	resp, body, err := do()
	if err != nil {
		return err
	}
	// Протухшая сессия → Yii2 редиректит на логин; клиент по jar проходит редирект и
	// в теле оказывается форма логина. Тогда сбрасываем сессию и пробуем ещё раз.
	if sessionExpired(body) {
		drain(resp)
		c.mu.Lock()
		c.loggedIn = false
		reErr := c.loginLocked(ctx)
		c.mu.Unlock()
		if reErr != nil {
			return reErr
		}
		resp, body, err = do()
		if err != nil {
			return err
		}
	}
	defer drain(resp)

	if resp.StatusCode >= 400 {
		return fmt.Errorf("tradesk POST %s: status %d", actionPath, resp.StatusCode)
	}
	return nil
}

func sessionExpired(body string) bool {
	return strings.Contains(body, `name="LoginForm[password]"`)
}

// readSnippet читает начало тела (для диагностики), не вычитывая гигабайты.
func readSnippet(resp *http.Response) string {
	b, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	return string(b)
}

// drain дочитывает и закрывает тело, чтобы переиспользовать TCP-соединение.
func drain(resp *http.Response) {
	if resp == nil {
		return
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	_ = resp.Body.Close()
}
