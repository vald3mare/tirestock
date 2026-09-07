-- Раздел «SEO-мета» админки: title/description ключевых СТАТИЧЕСКИХ маршрутов
-- витрины (главная, каталог), плюс глобальный дефолт-шаблон. Контентные страницы
-- (content_pages) несут свою мету сами — тут только статические роуты.
-- SEO — священная корова (CLAUDE.md), поэтому мета редактируется, а не в коде.
--
-- route — ключ маршрута ('/', '/catalog'); зарезервированный '*' = дефолт-шаблон
-- (fallback, когда у роута пусто). Resolve в сервисе: строка роута ∥ дефолт по полям.
CREATE TABLE seo_meta (
    route       TEXT        PRIMARY KEY,
    label       TEXT        NOT NULL DEFAULT '', -- человекочитаемое имя для админки
    title       TEXT        NOT NULL DEFAULT '',
    description TEXT        NOT NULL DEFAULT '',
    is_default  BOOLEAN     NOT NULL DEFAULT false, -- true только у '*'
    updated_by  TEXT        NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Сид = текущая мета из кода (корневой layout + статические роуты).
INSERT INTO seo_meta (route, label, title, description, is_default, updated_by) VALUES
('*', 'По умолчанию (шаблон)',
 'TireStock — шины и диски в Санкт-Петербурге',
 'Интернет-магазин шин и дисков: подбор по размеру, шиномонтаж, хранение колёс.',
 true, 'Виталий'),
('/', 'Главная',
 'TireStock — шины и диски в Санкт-Петербурге',
 'Интернет-магазин шин и дисков: подбор по размеру, шиномонтаж, хранение колёс.',
 false, 'Виталий'),
('/catalog', 'Каталог шин',
 'Шины купить дёшево в Санкт-Петербурге, цены на резину',
 'Шины по низким ценам в Санкт-Петербурге. Большой ассортимент резины, доставка по России.',
 false, 'Виталий');
