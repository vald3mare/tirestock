// Package mock — мок-реализации внешних интеграций (SelectTyres, tradesk)
// для разработки витрины до выяснения реальных механизмов обмена.
package mock

import (
	"context"
	"sort"

	"tirestock/api/internal/catalog"
)

// CatalogSource — мок каталога в памяти. Товары — реальные модели брендов
// из DESIGN_SYSTEM.md «Контентные данные», цены реалистичные.
type CatalogSource struct {
	products []catalog.Product
}

var _ catalog.CatalogSource = (*CatalogSource)(nil)

func NewCatalogSource() *CatalogSource {
	return &CatalogSource{products: mockProducts}
}

func (s *CatalogSource) List(_ context.Context, f catalog.Filters, page, perPage int) ([]catalog.Product, int, error) {
	var matched []catalog.Product
	for _, p := range s.products {
		if f.Match(p) {
			matched = append(matched, p)
		}
	}
	sort.SliceStable(matched, func(i, j int) bool { return matched[i].Price < matched[j].Price })

	total := len(matched)
	from := (page - 1) * perPage
	if from >= total {
		return nil, total, nil
	}
	to := min(from+perPage, total)
	return matched[from:to], total, nil
}

func (s *CatalogSource) BySlug(_ context.Context, slug, _ string) (catalog.Product, error) {
	for _, p := range s.products {
		if p.Slug == slug {
			return p, nil
		}
	}
	return catalog.Product{}, catalog.ErrNotFound
}

var mockProducts = []catalog.Product{
	{
		ID: 1, Slug: "nokian-hakkapeliitta-10p-205-55-r16",
		Brand: "Nokian", Model: "Hakkapeliitta 10p",
		Name: "Nokian Hakkapeliitta 10p 205/55 R16", SizeLabel: "205/55 R16 94T",
		Width: 205, Profile: 55, Diameter: 16,
		Season: catalog.SeasonWinter, Spikes: true, Runflat: false,
		Price: 12490, Stock: 16,
	},
	{
		ID: 2, Slug: "nokian-hakkapeliitta-r5-195-65-r15",
		Brand: "Nokian", Model: "Hakkapeliitta R5",
		Name: "Nokian Hakkapeliitta R5 195/65 R15", SizeLabel: "195/65 R15 95R",
		Width: 195, Profile: 65, Diameter: 15,
		Season: catalog.SeasonWinter, Spikes: false, Runflat: false,
		Price: 9890, Stock: 12,
	},
	{
		ID: 3, Slug: "michelin-x-ice-north-4-205-55-r16",
		Brand: "Michelin", Model: "X-Ice North 4",
		Name: "Michelin X-Ice North 4 205/55 R16", SizeLabel: "205/55 R16 94T",
		Width: 205, Profile: 55, Diameter: 16,
		Season: catalog.SeasonWinter, Spikes: true, Runflat: false,
		Price: 13990, Stock: 8,
	},
	{
		ID: 4, Slug: "michelin-primacy-4-215-60-r17",
		Brand: "Michelin", Model: "Primacy 4+",
		Name: "Michelin Primacy 4+ 215/60 R17", SizeLabel: "215/60 R17 96H",
		Width: 215, Profile: 60, Diameter: 17,
		Season: catalog.SeasonSummer, Spikes: false, Runflat: false,
		Price: 15490, Stock: 10,
	},
	{
		ID: 5, Slug: "continental-icecontact-3-195-65-r15",
		Brand: "Continental", Model: "IceContact 3",
		Name: "Continental IceContact 3 195/65 R15", SizeLabel: "195/65 R15 95T",
		Width: 195, Profile: 65, Diameter: 15,
		Season: catalog.SeasonWinter, Spikes: true, Runflat: false,
		Price: 10990, Stock: 20,
	},
	{
		ID: 6, Slug: "continental-premiumcontact-7-225-45-r17",
		Brand: "Continental", Model: "PremiumContact 7",
		Name: "Continental PremiumContact 7 225/45 R17", SizeLabel: "225/45 R17 91Y",
		Width: 225, Profile: 45, Diameter: 17,
		Season: catalog.SeasonSummer, Spikes: false, Runflat: false,
		Price: 16990, Stock: 6,
	},
	{
		ID: 7, Slug: "bridgestone-blizzak-ice-205-60-r16",
		Brand: "Bridgestone", Model: "Blizzak Ice",
		Name: "Bridgestone Blizzak Ice 205/60 R16", SizeLabel: "205/60 R16 96T",
		Width: 205, Profile: 60, Diameter: 16,
		Season: catalog.SeasonWinter, Spikes: false, Runflat: false,
		Price: 9490, Stock: 14,
	},
	{
		ID: 8, Slug: "bridgestone-turanza-t005-205-55-r16-runflat",
		Brand: "Bridgestone", Model: "Turanza T005",
		Name: "Bridgestone Turanza T005 205/55 R16 RunFlat", SizeLabel: "205/55 R16 91V RunFlat",
		Width: 205, Profile: 55, Diameter: 16,
		Season: catalog.SeasonSummer, Spikes: false, Runflat: true,
		Price: 12990, Stock: 4,
	},
	{
		ID: 9, Slug: "pirelli-ice-zero-2-215-65-r16",
		Brand: "Pirelli", Model: "Ice Zero 2",
		Name: "Pirelli Ice Zero 2 215/65 R16", SizeLabel: "215/65 R16 102T",
		Width: 215, Profile: 65, Diameter: 16,
		Season: catalog.SeasonWinter, Spikes: true, Runflat: false,
		Price: 12490, Stock: 9,
	},
	{
		ID: 10, Slug: "hankook-ventus-prime-4-205-55-r16",
		Brand: "Hankook", Model: "Ventus Prime 4 K135",
		Name: "Hankook Ventus Prime 4 K135 205/55 R16", SizeLabel: "205/55 R16 91H",
		Width: 205, Profile: 55, Diameter: 16,
		Season: catalog.SeasonSummer, Spikes: false, Runflat: false,
		Price: 8490, Stock: 24,
	},
	{
		ID: 11, Slug: "yokohama-bluearth-4s-aw21-205-55-r16",
		Brand: "Yokohama", Model: "BluEarth-4S AW21",
		Name: "Yokohama BluEarth-4S AW21 205/55 R16", SizeLabel: "205/55 R16 94V",
		Width: 205, Profile: 55, Diameter: 16,
		Season: catalog.SeasonAllSeason, Spikes: false, Runflat: false,
		Price: 9990, Stock: 11,
	},
	{
		ID: 12, Slug: "gislaved-nord-frost-200-185-65-r15",
		Brand: "Gislaved", Model: "Nord*Frost 200",
		Name: "Gislaved Nord*Frost 200 185/65 R15", SizeLabel: "185/65 R15 92T",
		Width: 185, Profile: 65, Diameter: 15,
		Season: catalog.SeasonWinter, Spikes: true, Runflat: false,
		Price: 7490, Stock: 18,
	},
}
