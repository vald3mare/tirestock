// Package catalog — фича «каталог»: модель товара, фильтры, источник данных, HTTP.
package catalog

import (
	"context"
	"errors"
)

// Season — сезонность шины.
type Season string

const (
	SeasonSummer    Season = "summer"
	SeasonWinter    Season = "winter"
	SeasonAllSeason Season = "allseason"
)

// Product — read-модель товара (истина — SelectTyres, у нас только чтение).
type Product struct {
	ID        int64  `json:"id"`
	Slug      string `json:"slug"`
	Brand     string `json:"brand"`
	Model     string `json:"model"`
	Name      string `json:"name"`       // «Nokian Hakkapeliitta 10p 205/55 R16»
	SizeLabel string `json:"size_label"` // «205/55 R16 94T»
	Width     int    `json:"width"`
	Profile   int    `json:"profile"`
	Diameter  int    `json:"diameter"`
	Season    Season `json:"season"`
	Spikes    bool   `json:"spikes"`
	Runflat   bool   `json:"runflat"`
	Price     int    `json:"price"` // рубли за штуку
	Stock     int    `json:"stock"`
}

// ErrNotFound — товар не найден (sentinel фичи).
var ErrNotFound = errors.New("catalog: product not found")

// CatalogSource — источник каталога. Реализации: integrations/mock (сейчас),
// synced-БД / selecttyres (позже). Интерфейс объявляет потребитель — catalog.
type CatalogSource interface {
	List(ctx context.Context, f Filters, page, perPage int) (items []Product, total int, err error)
	BySlug(ctx context.Context, slug string) (Product, error)
}

// Service — бизнес-логика каталога поверх источника.
type Service struct {
	src CatalogSource
}

func NewService(src CatalogSource) *Service {
	return &Service{src: src}
}

func (s *Service) List(ctx context.Context, f Filters, page, perPage int) ([]Product, int, error) {
	return s.src.List(ctx, f, page, perPage)
}

func (s *Service) BySlug(ctx context.Context, slug string) (Product, error) {
	return s.src.BySlug(ctx, slug)
}
