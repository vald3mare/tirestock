-- Контентные страницы админки (раздел «Страницы»). Истина контента витрины —
-- наша админка (см. CLAUDE.md). Правила блокировки:
--   indexed=true (проиндексирована) → URL залочен, удалять нельзя (только снять с публикации);
--   system=true (системная, напр. «Пункты выдачи») → не удаляется, URL залочен;
--   черновик (indexed=false, system=false) → URL можно менять и удалять до публикации.
-- Публикация делает indexed=true «липко» (SEO-адрес закрепляется навсегда).
CREATE TABLE content_pages (
    id               BIGSERIAL PRIMARY KEY,
    slug             TEXT        NOT NULL UNIQUE, -- URL-путь, напр. '/info/oplata/'
    title            TEXT        NOT NULL,
    body             TEXT        NOT NULL DEFAULT '',
    meta_title       TEXT        NOT NULL DEFAULT '',
    meta_description TEXT        NOT NULL DEFAULT '',
    published        BOOLEAN     NOT NULL DEFAULT false,
    indexed          BOOLEAN     NOT NULL DEFAULT false, -- липкий флаг: закрепляет URL после первой публикации
    system           BOOLEAN     NOT NULL DEFAULT false,
    updated_by       TEXT        NOT NULL DEFAULT '',
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Сид страниц из макета (демо-контент; реальные тексты — за Виталием).
INSERT INTO content_pages (slug, title, body, meta_title, meta_description, published, indexed, system, updated_by, updated_at) VALUES
('/info/oplata/', 'Оплата',
 'Оплатить заказ можно наличными или картой при получении, банковским переводом или электронными деньгами. При доставке в регионы — предоплата по счёту. Все цены на сайте указаны в рублях и включают НДС.',
 'Оплата заказа — TireStock, шины и диски в СПб',
 'Способы оплаты в интернет-магазине TireStock: наличными и картой при получении, банковский перевод.',
 true, true, false, 'Софья', '2026-07-18'),
('/dostavka/', 'Доставка', 'Доставка по городу и области, самовывоз со склада, отправка в регионы транспортными компаниями.',
 'Доставка шин и дисков — TireStock', 'Условия доставки TireStock: по городу, самовывоз, регионы.',
 true, true, false, 'Софья', '2026-07-18'),
('/garantiya/', 'Гарантия', 'Гарантия производителя на все шины и диски. Возврат и обмен по закону о защите прав потребителей.',
 'Гарантия — TireStock', 'Гарантийные условия на шины и диски в TireStock.',
 true, true, false, 'Виталий', '2026-07-12'),
('/about/', 'О магазине', 'TireStock — интернет-магазин шин и дисков в Санкт-Петербурге. Работаем с 2010 года.',
 'О магазине TireStock', 'О компании TireStock — шины и диски в СПб с 2010 года.',
 true, true, false, 'Виталий', '2026-07-12'),
('/reviews/', 'Отзывы', 'Отзывы наших покупателей о шинах, дисках и сервисе.',
 'Отзывы о TireStock', 'Реальные отзывы покупателей интернет-магазина TireStock.',
 true, true, false, 'Софья', '2026-07-05'),
('/points/', 'Пункты выдачи', 'Заберите заказ на центральном складе или в удобном партнёрском пункте выдачи.',
 'Пункты выдачи — TireStock', 'Адреса пунктов выдачи заказов TireStock.',
 true, true, true, '', '2026-07-15'),
('/storage/', 'Хранение колёс', 'Сезонное хранение шин и колёс на складе. Приём, мойка, хранение до сезона.',
 'Хранение колёс — TireStock', 'Сезонное хранение шин и колёс в TireStock.',
 true, true, false, 'Вадим', '2026-07-18'),
('/promo/winter/', 'Акция: зимняя переобувка', 'Скидки на зимние шины и бесплатный шиномонтаж при покупке комплекта.',
 '', '',
 false, false, false, 'Софья', '2026-07-23');
