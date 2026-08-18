-- Инфостраницы «Доставка», «Оплата», «Гарантия» стали статическими роутами
-- витрины по URL старого сайта (/delivery/, /payment/, /warranty/) — требование
-- SEO 1:1. Демо-сиды из 0006 с выдуманными URL удаляем, чтобы не плодить
-- дубли контента. /about/, /reviews/, /points/ остаются контентными: их URL
-- совпадают со старым сайтом.
DELETE FROM content_pages WHERE slug IN ('/dostavka/', '/info/oplata/', '/garantiya/');
