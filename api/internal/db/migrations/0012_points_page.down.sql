DELETE FROM seo_meta WHERE route = '/points';
-- Возврат демо-страницы '/points/' (была системной, текст-заглушка).
INSERT INTO content_pages (slug, title, body, published, indexed, system, updated_by)
VALUES ('/points/', 'Пункты выдачи', '', true, false, true, '')
ON CONFLICT (slug) DO NOTHING;
