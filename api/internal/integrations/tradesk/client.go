// Package tradesk — адаптер доставки заказов/заявок в учётную систему tradesk.ru
// (Yii2, самопись). Реализует orders.OrderDelivery. Заменяет мост oldsite, когда
// выключается Битрикс.
//
// Приём заявок (вскрыто из /ajax/call.php старого сайта, 11.08.2026): публичное
// пространство `/data/<сущность>` — простой GET с query-параметрами, БЕЗ входа,
// сессии и CSRF. Именно так заявки со старого сайта попадают в учётку. См. delivery.go.
//
// Админ-контур (вход по логину/паролю) остаётся здесь на будущее — он нужен для
// чтения/служебных действий, но НЕ для доставки заявок. Поэтому Username/Password
// необязательны: клиент без кредов умеет доставлять обратные звонки.
//   - Вход: GET /site/login → CSRF-токен из <meta name="csrf-token"> и куки _csrf →
//     POST /site/login с полями _csrf-frontend + LoginForm[username]/[password].
//   - Сессия: куки _identity (30д), PHPSESSID, _csrf. Держим в cookiejar.
//   - Кодировка: UTF-8 в обе стороны.
package tradesk

import (
	"context"
	"fmt"
	"io"
	"log/slog"
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
	Log      *slog.Logger  // 0 → slog.Default(); пишем номера принятых заказов
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
	// Креды не обязательны: доставка заявок идёт в публичное /data/* без входа.
	// Они нужны только админ-контуру (postForm) — там отсутствие проверяется явно.
	cfg.BaseURL = strings.TrimRight(cfg.BaseURL, "/")
	if cfg.Timeout == 0 {
		cfg.Timeout = 15 * time.Second
	}
	if cfg.Log == nil {
		cfg.Log = slog.Default()
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

// getData дёргает публичный приёмник /data/<сущность> — GET с query-параметрами,
// без входа и CSRF (ровно так делает мост старого сайта через file_get_contents).
// Успех — любой 2xx; приёмник отвечает пустым телом.
func (c *Client) getData(ctx context.Context, path string, params url.Values) error {
	u := c.cfg.BaseURL + path
	if len(params) > 0 {
		u += "?" + params.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("tradesk GET %s: %w", path, err)
	}
	defer drain(resp)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("tradesk GET %s: status %d", path, resp.StatusCode)
	}
	return nil
}

// getDataString — как getData, но возвращает тело ответа. Приёмник заказа отдаёт
// номер заказа в кавычках (`"12345"`) либо строку `error`; кавычки снимаем — ровно
// это делал мост старого сайта (`str_replace('"', '', $data)`).
func (c *Client) getDataString(ctx context.Context, path string, params url.Values) (string, error) {
	u := c.cfg.BaseURL + path
	if len(params) > 0 {
		u += "?" + params.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return "", err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("tradesk GET %s: %w", path, err)
	}
	defer drain(resp)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("tradesk GET %s: status %d", path, resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	if err != nil {
		return "", fmt.Errorf("tradesk GET %s: чтение ответа: %w", path, err)
	}
	return strings.Trim(strings.TrimSpace(string(body)), `"`), nil
}

// postPlainForm — POST формой БЕЗ авторизации и CSRF (так шлёт мост старого сайта
// через curl в /api/request и /api/record). Не путать с postForm — тот для
// админ-контура Yii2 с сессией и токеном.
func (c *Client) postPlainForm(ctx context.Context, path string, fields url.Values) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.BaseURL+path, strings.NewReader(fields.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("tradesk POST %s: %w", path, err)
	}
	defer drain(resp)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("tradesk POST %s: status %d", path, resp.StatusCode)
	}
	return nil
}

// ensureLogin гарантирует активную сессию: если ещё не входили — выполняет вход.
// Переавторизация по протухшей сессии обрабатывается в postForm (retry once).
func (c *Client) ensureLogin(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.loggedIn {
		return nil
	}
	if c.cfg.Username == "" || c.cfg.Password == "" {
		return fmt.Errorf("tradesk: для админ-контура нужны Username и Password")
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
