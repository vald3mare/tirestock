-- Страница «Пункты выдачи» стала кодовым роутом витрины (app/(storefront)/points,
-- вёрстка по макету Figma), поэтому:
--   1) удаляем осиротевшую системную контентную страницу '/points/' (её текст
--      больше не рендерится — роут перекрывает catch-all; в админке не нужна);
--   2) заводим SEO-мету маршрута '/points' (редактируется в разделе «SEO-мета»),
--      иначе generateMetadata подставил бы общий дефолт-шаблон вместо своего title.
DELETE FROM content_pages WHERE slug = '/points/';

INSERT INTO seo_meta (route, label, title, description, is_default, updated_by) VALUES
('/points', 'Пункты выдачи',
 'Пункты выдачи — TireStock, шины в Санкт-Петербурге',
 'Центральный склад и партнёрские пункты выдачи заказов TireStock в Санкт-Петербурге: адреса, метро, часы работы.',
 false, 'Виталий')
ON CONFLICT (route) DO NOTHING;
