-- Возврат услуги «Хранение»: снова публикуем оффер «−30% на хранение».
UPDATE benefits SET published = true WHERE title ILIKE '%хранени%';
