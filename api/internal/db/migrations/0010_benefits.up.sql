-- Раздел «Преимущества» админки: строка офферов над каталогом на главной
-- (компонент BenefitsBar). Истина контента витрины — наша админка (CLAUDE.md),
-- поэтому вытаскиваем захардкоженные офферы в редактируемую таблицу.
-- Порядок вывода — sort_order (ASC), затем id.
CREATE TABLE benefits (
    id         BIGSERIAL PRIMARY KEY,
    icon       TEXT        NOT NULL DEFAULT '', -- путь к svg-иконке, напр. '/icons/benefit-mount.svg'
    title      TEXT        NOT NULL,            -- крупная строка оффера
    note       TEXT        NOT NULL DEFAULT '', -- уточнение под заголовком
    sort_order INTEGER     NOT NULL DEFAULT 0,
    published  BOOLEAN     NOT NULL DEFAULT true,
    updated_by TEXT        NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Сид = текущие офферы из BenefitsBar.tsx (реальные офферы старого сайта).
INSERT INTO benefits (icon, title, note, sort_order, published, updated_by) VALUES
('/icons/benefit-mount.svg',    '−15% на шиномонтаж',      'при покупке шин',            10, true, 'Виталий'),
('/icons/benefit-storage.svg',  '−30% на хранение',        'при покупке от 4 шин',       20, true, 'Виталий'),
('/icons/benefit-paint.svg',    '−10% на покраску дисков', 'при покупке шин',            30, true, 'Виталий'),
('/icons/benefit-delivery.svg', 'Доставка в регионы РФ',   'расчёт на странице товара',  40, true, 'Виталий');
