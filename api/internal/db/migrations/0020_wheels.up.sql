-- Диски (колёсные) — ОТДЕЛЬНЫЙ тип товара, отдельный фид SelectTyres (секция wheels).
-- Полная изоляция от шин (products/product_offers): свой синк, свой prune, свой
-- каталог. Шинный конвейер не затрагивается — сломать его невозможно.
CREATE TABLE wheels (
    id           BIGSERIAL PRIMARY KEY,
    code         TEXT        NOT NULL DEFAULT '',   -- код SelectTyres (w…)
    slug         TEXT        NOT NULL UNIQUE,
    brand        TEXT        NOT NULL DEFAULT '',
    model        TEXT        NOT NULL DEFAULT '',
    name         TEXT        NOT NULL DEFAULT '',    -- p_full_name
    category     TEXT        NOT NULL DEFAULT '',    -- Легковые/Грузовые (p_category)
    width        DOUBLE PRECISION NOT NULL DEFAULT 0, -- ширина обода, дюймы (p_width)
    diameter     INT         NOT NULL DEFAULT 0,     -- посадочный диаметр, R (p_diameter)
    pcd          TEXT        NOT NULL DEFAULT '',     -- сверловка «5x112» (p_pcd)
    bolts_count  INT         NOT NULL DEFAULT 0,     -- число болтов (p_bolts_count)
    bolts_space  DOUBLE PRECISION NOT NULL DEFAULT 0, -- диаметр окружности болтов, мм (p_bolts_space)
    et           DOUBLE PRECISION NOT NULL DEFAULT 0, -- вылет ET (p_et)
    dia          DOUBLE PRECISION NOT NULL DEFAULT 0, -- центральное отверстие DIA (p_dia)
    color        TEXT        NOT NULL DEFAULT '',     -- код цвета (p_color, напр. BKYS)
    color_human  TEXT        NOT NULL DEFAULT '',     -- человекочитаемый цвет (p_human_readable_color)
    wheel_type   TEXT        NOT NULL DEFAULT '',     -- Литой/Кованый/Штампованный (p_type)
    image_url    TEXT        NOT NULL DEFAULT '',     -- p_photo
    price        BIGINT      NOT NULL DEFAULT 0,      -- снапшот базового города (СПб)
    stock        INT         NOT NULL DEFAULT 0,
    synced_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX wheels_code_key ON wheels (code) WHERE code <> '';
CREATE INDEX wheels_size_idx ON wheels (diameter, width);
CREATE INDEX wheels_brand_idx ON wheels (brand);
CREATE INDEX wheels_pcd_idx ON wheels (pcd);

-- Цена/остаток диска в городе (мультигород, как у шин, но своя таблица — изоляция).
CREATE TABLE wheel_offers (
    wheel_code TEXT        NOT NULL,
    city       TEXT        NOT NULL,
    price      BIGINT      NOT NULL,
    stock      INTEGER     NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (wheel_code, city)
);
CREATE INDEX wheel_offers_city_stock_idx ON wheel_offers (city, stock);
