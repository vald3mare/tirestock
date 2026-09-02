-- SEO-мета страницы «Статус заказа» (/status, URL 1:1 со старым сайтом).
-- Обратная интеграция tradesk. Редактируется в разделе «SEO-мета».
INSERT INTO seo_meta (route, label, title, description, is_default, updated_by) VALUES
('/status', 'Статус заказа',
 'Проверить статус заказа — TireStock',
 'Узнайте текущий статус и дату исполнения вашего заказа TireStock по номеру.',
 false, 'Виталий')
ON CONFLICT (route) DO NOTHING;
