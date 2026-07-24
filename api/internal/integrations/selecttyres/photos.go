package selecttyres

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// PhotoConfig — параметры Avito-фида «чистых» фото (без вотермарка).
type PhotoConfig struct {
	FeedURL string
	Timeout time.Duration // 0 → 6m
}

// PhotoClient — стриминговый парсер Avito-XML (по <Ad>).
type PhotoClient struct {
	cfg  PhotoConfig
	http *http.Client
}

func NewPhotoClient(cfg PhotoConfig) (*PhotoClient, error) {
	if strings.TrimSpace(cfg.FeedURL) == "" {
		return nil, fmt.Errorf("selecttyres: PhotoConfig.FeedURL обязателен")
	}
	if cfg.Timeout == 0 {
		cfg.Timeout = 6 * time.Minute
	}
	return &PhotoClient{cfg: cfg, http: &http.Client{Timeout: cfg.Timeout}}, nil
}

type xmlAd struct {
	ID     string `xml:"Id"`
	Images struct {
		Image []struct {
			URL string `xml:"url,attr"`
		} `xml:"Image"`
	} `xml:"Images"`
}

// Fetch скачивает Avito-фид и для каждого <Ad> с непустым фото зовёт fn(code, url).
// Разбор потоковый — весь файл в память не грузится.
func (c *PhotoClient) Fetch(ctx context.Context, fn func(code, url string) error) (parsed, withPhoto int, err error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.cfg.FeedURL, nil)
	if err != nil {
		return 0, 0, err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return 0, 0, fmt.Errorf("selecttyres: скачивание фото-фида: %w", err)
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return 0, 0, fmt.Errorf("selecttyres: фото-фид вернул статус %d", resp.StatusCode)
	}

	dec := xml.NewDecoder(resp.Body)
	for {
		tok, err := dec.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return parsed, withPhoto, fmt.Errorf("selecttyres: разбор фото-XML: %w", err)
		}
		se, ok := tok.(xml.StartElement)
		if !ok || se.Name.Local != "Ad" {
			continue
		}
		var ad xmlAd
		if err := dec.DecodeElement(&ad, &se); err != nil {
			return parsed, withPhoto, fmt.Errorf("selecttyres: разбор <Ad>: %w", err)
		}
		parsed++
		code := strings.TrimSpace(ad.ID)
		if code == "" || len(ad.Images.Image) == 0 {
			continue
		}
		url := strings.TrimSpace(ad.Images.Image[0].URL)
		if url == "" {
			continue
		}
		if err := fn(code, url); err != nil {
			return parsed, withPhoto, err
		}
		withPhoto++
	}
	return parsed, withPhoto, nil
}

// PhotoStore — приёмник чистых фото (обновление products.image_clean_url).
type PhotoStore interface {
	UpdateImageClean(ctx context.Context, code, url string) (int64, error)
}

// PhotoSyncer — фоновый контур: раз в interval тянет Avito-фид и обновляет чистые фото.
type PhotoSyncer struct {
	client   *PhotoClient
	store    PhotoStore
	interval time.Duration
	log      *slog.Logger
}

func NewPhotoSyncer(client *PhotoClient, store PhotoStore, interval time.Duration, log *slog.Logger) *PhotoSyncer {
	if interval <= 0 {
		interval = time.Hour
	}
	return &PhotoSyncer{client: client, store: store, interval: interval, log: log}
}

func (s *PhotoSyncer) Run(ctx context.Context) {
	if err := s.SyncOnce(ctx); err != nil {
		s.log.Error("selecttyres: первый синк фото не удался", "err", err)
	}
	t := time.NewTicker(s.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := s.SyncOnce(ctx); err != nil {
				s.log.Error("selecttyres: синк фото не удался", "err", err)
			}
		}
	}
}

func (s *PhotoSyncer) SyncOnce(ctx context.Context) error {
	start := time.Now()
	s.log.Info("selecttyres: синк фото начат")
	var updated int64
	parsed, withPhoto, err := s.client.Fetch(ctx, func(code, url string) error {
		n, err := s.store.UpdateImageClean(ctx, code, url)
		updated += n
		return err
	})
	if err != nil {
		return err
	}
	s.log.Info("selecttyres: синк фото завершён",
		"в_фиде", parsed, "с_фото", withPhoto, "обновлено", updated,
		"длительность", time.Since(start).Round(time.Second).String())
	return nil
}
