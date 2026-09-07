package catalog

import "context"

// Диски (колёсные) — отдельный тип товара, изолированный от шин (products).
// Модель зеркалит шинную (Source-интерфейс, мультигород через офферы), но со
// своими атрибутами: ширина в дюймах, сверловка PCD, вылет ET, ЦО DIA, цвет, тип.

// Wheel — диск на витрине.
type Wheel struct {
	ID         int64   `json:"id"`
	Slug       string  `json:"slug"`
	Code       string  `json:"code"`
	Brand      string  `json:"brand"`
	Model      string  `json:"model"`
	Name       string  `json:"name"`
	Width      float64 `json:"width"`    // ширина обода, дюймы
	Diameter   int     `json:"diameter"` // посадочный диаметр, R
	PCD        string  `json:"pcd"`      // сверловка «5x112»
	ET         float64 `json:"et"`       // вылет
	DIA        float64 `json:"dia"`      // центральное отверстие
	Color      string  `json:"color"`    // человекочитаемый цвет
	WheelType  string  `json:"wheel_type"`
	Price      int     `json:"price"`
	Stock      int     `json:"stock"`
	ImageURL   string  `json:"image_url"`
}

// SyncWheel — строка для upsert синком дисков. Price/Stock — снапшот базового города.
type SyncWheel struct {
	Code       string
	Slug       string
	Brand      string
	Model      string
	Name       string
	Category   string
	Width      float64
	Diameter   int
	PCD        string
	BoltsCount int
	BoltsSpace float64
	ET         float64
	DIA        float64
	Color      string
	ColorHuman string
	WheelType  string
	ImageURL   string
	Price      int
	Stock      int
	Offers     []CityOffer
}

// WheelFilters — фильтры каталога дисков (URL query). City — мультигород.
type WheelFilters struct {
	Diameter *int
	Width    *float64
	PCD      string
	Brand    string
	Type     string // Литой/Кованый/Штампованный
	PriceMin *int
	PriceMax *int
	Sort     string // "" | price_asc | price_desc | name
	City     string
}

// WheelFacets — реальные значения фильтров дисков в наличии (для сайдбара).
type WheelFacets struct {
	Brands    []string  `json:"brands"`
	Diameters []int     `json:"diameters"`
	Widths    []float64 `json:"widths"`
	PCDs      []string  `json:"pcds"`
	Types     []string  `json:"types"`
}

// WheelSource — источник каталога дисков. Реализация: DBWheelSource.
type WheelSource interface {
	List(ctx context.Context, f WheelFilters, page, perPage int) (items []Wheel, total int, err error)
	BySlug(ctx context.Context, slug, city string) (Wheel, error)
	Facets(ctx context.Context, city string) (WheelFacets, error)
}

// WheelService — бизнес-логика каталога дисков поверх источника.
type WheelService struct {
	src WheelSource
}

func NewWheelService(src WheelSource) *WheelService { return &WheelService{src: src} }

func (s *WheelService) List(ctx context.Context, f WheelFilters, page, perPage int) ([]Wheel, int, error) {
	return s.src.List(ctx, f, page, perPage)
}
func (s *WheelService) BySlug(ctx context.Context, slug, city string) (Wheel, error) {
	return s.src.BySlug(ctx, slug, city)
}
func (s *WheelService) Facets(ctx context.Context, city string) (WheelFacets, error) {
	return s.src.Facets(ctx, city)
}
