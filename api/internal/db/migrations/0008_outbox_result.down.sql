ALTER TABLE outbox DROP CONSTRAINT outbox_kind_check;
DELETE FROM outbox WHERE kind = 'request';
ALTER TABLE outbox ADD CONSTRAINT outbox_kind_check
    CHECK (kind IN ('order', 'callback'));
ALTER TABLE outbox DROP COLUMN result;
