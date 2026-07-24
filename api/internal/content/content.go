// Package content — фича «контентные страницы админки». Истина контента витрины
// (тексты, SEO-мета) живёт здесь. Правила блокировки URL/удаления — в сервисе.
package content

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"tirestock/api/internal/db"
)

// Sentinel-ошибки фичи.
var (
	ErrNotFound    = errors.New("content: page not found")
	ErrForbidden   = errors.New("content: операция запрещена для этой страницы")
	ErrSlugInvalid = errors.New("content: URL должен начинаться с /")
	ErrSlugTaken   = errors.New("content: страница с таким URL уже есть")
)

// Page — контентная страница. Locked/Deletable вычисляются из indexed/system,
// чтобы фронт сразу знал, можно ли менять URL и удалять.
type Page struct {
	ID              int64     `json:"id"`
	Slug            string    `json:"slug"`
	Title           string    `json:"title"`
	Body            string    `json:"body"`
	MetaTitle       string    `json:"meta_title"`
	MetaDescription string    `json:"meta_description"`
	Published       bool      `json:"published"`
	Indexed         bool      `json:"indexed"`
	System          bool      `json:"system"`
	UpdatedBy       string    `json:"updated_by"`
	UpdatedAt       time.Time `json:"updated_at"`
	Locked          bool      `json:"locked"`    // URL залочен (проиндексирована или системная)
	Deletable       bool      `json:"deletable"` // можно удалить (черновик, не системная)
}

func mkPage(id int64, slug, title, body, mt, md string, pub, idx, sys bool, by string, at pgtype.Timestamptz) Page {
	locked := idx || sys
	return Page{
		ID: id, Slug: slug, Title: title, Body: body, MetaTitle: mt, MetaDescription: md,
		Published: pub, Indexed: idx, System: sys, UpdatedBy: by, UpdatedAt: at.Time,
		Locked: locked, Deletable: !locked,
	}
}

// UpdateInput — редактируемые поля контента (без URL и статуса).
type UpdateInput struct {
	Title           string
	Body            string
	MetaTitle       string
	MetaDescription string
}

// Service — бизнес-логика контентных страниц поверх sqlc.
type Service struct {
	q *db.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{q: db.New(pool)}
}

func (s *Service) List(ctx context.Context) ([]Page, error) {
	rows, err := s.q.ListContentPages(ctx)
	if err != nil {
		return nil, fmt.Errorf("list content pages: %w", err)
	}
	pages := make([]Page, 0, len(rows))
	for _, r := range rows {
		pages = append(pages, mkPage(r.ID, r.Slug, r.Title, r.Body, r.MetaTitle, r.MetaDescription,
			r.Published, r.Indexed, r.System, r.UpdatedBy, r.UpdatedAt))
	}
	return pages, nil
}

func (s *Service) Get(ctx context.Context, id int64) (Page, error) {
	r, err := s.q.GetContentPage(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Page{}, ErrNotFound
	}
	if err != nil {
		return Page{}, fmt.Errorf("get content page: %w", err)
	}
	return mkPage(r.ID, r.Slug, r.Title, r.Body, r.MetaTitle, r.MetaDescription,
		r.Published, r.Indexed, r.System, r.UpdatedBy, r.UpdatedAt), nil
}

// BySlug ищет страницу по точному URL (админ-контекст, любой статус).
func (s *Service) BySlug(ctx context.Context, slug string) (Page, error) {
	r, err := s.q.GetContentPageBySlug(ctx, slug)
	if errors.Is(err, pgx.ErrNoRows) {
		return Page{}, ErrNotFound
	}
	if err != nil {
		return Page{}, fmt.Errorf("get content page by slug: %w", err)
	}
	return mkPage(r.ID, r.Slug, r.Title, r.Body, r.MetaTitle, r.MetaDescription,
		r.Published, r.Indexed, r.System, r.UpdatedBy, r.UpdatedAt), nil
}

// PublicBySlug — рендер страницы на витрине: нормализует путь и отдаёт только
// ОПУБЛИКОВАННУЮ страницу (черновик → ErrNotFound).
func (s *Service) PublicBySlug(ctx context.Context, path string) (Page, error) {
	p, err := s.BySlug(ctx, NormalizePath(path))
	if err != nil {
		return Page{}, err
	}
	if !p.Published {
		return Page{}, ErrNotFound
	}
	return p, nil
}

// NormalizePath приводит путь к виду '/сегменты/' (ведущий и завершающий слэш),
// чтобы '/points', '/points/' и 'points' совпадали с сохранённым slug.
func NormalizePath(path string) string {
	path = "/" + strings.Trim(strings.TrimSpace(path), "/")
	if path != "/" {
		path += "/"
	}
	return path
}

// Create заводит новый черновик (не опубликован, не индексирован).
func (s *Service) Create(ctx context.Context, slug, title, editor string) (Page, error) {
	slug, err := normalizeSlug(slug)
	if err != nil {
		return Page{}, err
	}
	r, err := s.q.CreateContentPage(ctx, db.CreateContentPageParams{Slug: slug, Title: strings.TrimSpace(title), UpdatedBy: editor})
	if err != nil {
		if isUniqueViolation(err) {
			return Page{}, ErrSlugTaken
		}
		return Page{}, fmt.Errorf("create content page: %w", err)
	}
	return mkPage(r.ID, r.Slug, r.Title, r.Body, r.MetaTitle, r.MetaDescription,
		r.Published, r.Indexed, r.System, r.UpdatedBy, r.UpdatedAt), nil
}

// Update меняет контент/мета (URL и статус — отдельными операциями). Разрешено всегда.
func (s *Service) Update(ctx context.Context, id int64, in UpdateInput, editor string) error {
	if _, err := s.Get(ctx, id); err != nil {
		return err
	}
	return s.q.UpdateContentPage(ctx, db.UpdateContentPageParams{
		ID: id, Title: strings.TrimSpace(in.Title), Body: in.Body,
		MetaTitle: in.MetaTitle, MetaDescription: in.MetaDescription, UpdatedBy: editor,
	})
}

// Rename меняет URL — только для незалоченных (черновик, не системная).
func (s *Service) Rename(ctx context.Context, id int64, newSlug, editor string) error {
	p, err := s.Get(ctx, id)
	if err != nil {
		return err
	}
	if p.Locked {
		return ErrForbidden
	}
	slug, err := normalizeSlug(newSlug)
	if err != nil {
		return err
	}
	if err := s.q.RenameContentPage(ctx, db.RenameContentPageParams{ID: id, Slug: slug, UpdatedBy: editor}); err != nil {
		if isUniqueViolation(err) {
			return ErrSlugTaken
		}
		return fmt.Errorf("rename content page: %w", err)
	}
	return nil
}

// SetPublished публикует/снимает с публикации. Публикация закрепляет indexed липко.
func (s *Service) SetPublished(ctx context.Context, id int64, published bool, editor string) error {
	if _, err := s.Get(ctx, id); err != nil {
		return err
	}
	return s.q.SetContentPagePublished(ctx, db.SetContentPagePublishedParams{ID: id, Published: published, UpdatedBy: editor})
}

// Delete удаляет страницу — только незалоченную (черновик, не системная).
func (s *Service) Delete(ctx context.Context, id int64) error {
	p, err := s.Get(ctx, id)
	if err != nil {
		return err
	}
	if !p.Deletable {
		return ErrForbidden
	}
	return s.q.DeleteContentPage(ctx, id)
}

// normalizeSlug приводит URL к виду '/путь/': начинается со слэша, без пробелов.
func normalizeSlug(slug string) (string, error) {
	slug = strings.TrimSpace(strings.ToLower(slug))
	if slug == "" || !strings.HasPrefix(slug, "/") {
		return "", ErrSlugInvalid
	}
	if strings.ContainsAny(slug, " \t\n") {
		return "", ErrSlugInvalid
	}
	return slug, nil
}

func isUniqueViolation(err error) bool {
	return strings.Contains(err.Error(), "23505") || strings.Contains(err.Error(), "duplicate key")
}
