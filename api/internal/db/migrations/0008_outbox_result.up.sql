-- Номер записи, который вернул приёмник tradesk (`/api/addorder` отдаёт номер
-- заказа). Это единственная ниточка между нашим заказом и учётной системой:
-- админка показывает его менеджеру, чтобы не дублировать данные tradesk у себя.
ALTER TABLE outbox ADD COLUMN result TEXT NOT NULL DEFAULT '';

-- Новый вид доставки: заявка (`/api/request` в tradesk) — формы услуг, хранения
-- и обратной связи с полем «тип». Раньше всё жило видом callback.
ALTER TABLE outbox DROP CONSTRAINT outbox_kind_check;
ALTER TABLE outbox ADD CONSTRAINT outbox_kind_check
    CHECK (kind IN ('order', 'callback', 'request'));
