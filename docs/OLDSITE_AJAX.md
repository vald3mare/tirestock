# Скрипты-мосты старого сайта (`/ajax/*.php`)

Как получены: у Вальдемара есть доступ в **админку Битрикса** старого tirestock.ru
(Контент → Структура сайта → Файлы и папки → `/ajax`), файлы читаются прямо там —
FTP не нужен. Снято 11.08.2026, исходники ниже приведены дословно.

Зачем этот документ: `/ajax/*.php` — вся связка между витриной на Битриксе и учётной
системой tradesk.ru. Из них вскрыт контракт приёмников, на который теперь работает
наш Go-адаптер (`api/internal/integrations/tradesk`, `…/oldsite`).

**Главный вывод:** Битрикс — тонкий прокси. Никакой общей БД, крона или очереди:
PHP-скрипт просто дёргает `tradesk.ru` серверным запросом и отдаёт ответ фронту.
Авторизации у приёмников нет (кроме пустого `CURLAUTH_BASIC` в request/record).

## Карта API tradesk

| Приёмник | Метод | Параметры | Ответ |
|---|---|---|---|
| `/data/backcall` | GET | `phone`, `comment` | пусто |
| `/api/addorder` | GET | `phone`, `name`, `comment`, `qty`, `product`, `code`, `price`, `city`, `type` | `"номер"` либо `error` |
| `/api/request` | POST | поля формы + `site` | — |
| `/api/record` | POST | `point_id`, `phone`, `name`, `date`, `time`, `comment`, `promo` | — |
| `/api/gift` | GET | `code`, `check` | — |
| `/api/login` | GET | `phone` | — (файл сломан) |

## ⚠️ Коды товаров — разные пространства

Старый сайт шлёт в `addorder` **свой** код («Код товара» на карточке, напр. `99302`).
Тот же товар в нашем фиде SelectTyres — `t668559`. Соответствия у нас нет, поэтому
наш адаптер шлёт свой код и дублирует опознание в `comment` (номер заказа с сайта,
позиция, код SelectTyres, название). Вопрос Виталию/автору tradesk: принимает ли
приёмник наши коды или нужна карта соответствия (её знает импорт в Битрикс).

## Скрипты

### `call.php` — Обратный звонок

**✅ ИСПОЛЬЗУЕМ.** `GET tradesk.ru/data/backcall?phone=&comment=`. Поля имени нет — складываем имя в комментарий. Реализовано: `integrations/tradesk` + мост `integrations/oldsite`.

```php
<?
if ($_POST) {
	file_get_contents('http://tradesk.ru/data/backcall?phone=' . urlencode($_POST['phone']) . '&comment=' . urlencode($_POST['comment']));
}
?>
```

### `order.php` — Заказ (купить в 1 клик)

**✅ ИСПОЛЬЗУЕМ.** `GET tradesk.ru/api/addorder?phone=&name=&comment=&qty=&product=&code=&price=&city=&type=`. **Одна позиция на вызов**; ответ — номер заказа в кавычках либо `error`. Реализовано: `tradesk/order.go`, `oldsite/order.go`.

```php
<?
if ($_POST) {
	$data = file_get_contents('http://tradesk.ru/api/addorder?phone=' . urlencode($_POST['phone']) . '&name=' . urlencode($_POST['name']) . '&comment=' . urlencode($_POST['comment']) . '&qty=' . $_POST['qty'] . '&product=' . urlencode($_POST['product']) . '&code=' . $_POST['code'] . '&price=' . $_POST['price'] . '&city=' . $_POST['city'] . '&type=' . $_POST['type']);
	echo str_replace('"', '', $data);	
}
?>
```

### `request.php` — Заявка с сайта

**🟡 ПРИГОДИТСЯ.** `POST tradesk.ru/api/request`, curl, все поля формы + `site=tirestock.ru`. Альтернатива backcall для форм с доп. полями (тип заявки). Пока наши формы шлют backcall.

```php
<?
if ($_POST) {
	$data = $_POST;

	foreach ($data as $key=>$value) {
		$params[$key] = $value;
	}
	$params['site'] = 'tirestock.ru';

	$curl = curl_init();
	curl_setopt($curl, CURLOPT_FOLLOWLOCATION, 1);
	$url = "http://tradesk.ru/api/request";

	if (!empty($params)) {
	    curl_setopt($curl, CURLOPT_POST, true);
	    curl_setopt($curl, CURLOPT_POSTFIELDS, $params);
	}
	curl_setopt($curl, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
	curl_setopt($curl, CURLOPT_URL, $url);
	curl_setopt($curl, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt($curl, CURLOPT_CONNECTTIMEOUT, 5);
	curl_setopt($curl, CURLOPT_TIMEOUT, 30);

	$res = curl_exec($curl);
}

?>
```

### `record.php` — Онлайн-запись на сервис

**🟡 ПРИГОДИТСЯ.** `POST tradesk.ru/api/record`, curl. Поля (видно в закомментированной GET-версии): `point_id`, `phone`, `name`, `date` (Y-m-d), `time`, `comment`, `promo`. Нужен для форм «Онлайн запись» на сервисных страницах, когда добавим выбор даты/времени и пункта.

```php
<?
if ($_POST) {
	//file_get_contents('http://tradesk.ru/api/record?point_id=26&phone=' . urlencode($_POST['phone']) . '&name=' . urlencode($_POST['name']) . '&date=' . urlencode(date('Y-m-d', strtotime($_POST['date']))) . '&time=' . urlencode($_POST['time']) . '&comment=' . urlencode($_POST['comment']) . '&promo=' . urlencode($_POST['promo']));
	$data = $_POST;
	$data['date'] = date('Y-m-d', strtotime($_POST['date']));

	foreach ($data as $key=>$value) {
		$params[$key] = $value;
	}

	$curl = curl_init();
	curl_setopt($curl, CURLOPT_FOLLOWLOCATION, 1);
	$url = "http://tradesk.ru/api/record";

	if (!empty($params)) {
	    curl_setopt($curl, CURLOPT_POST, true);
	    curl_setopt($curl, CURLOPT_POSTFIELDS, $params);
	}
	curl_setopt($curl, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
	curl_setopt($curl, CURLOPT_URL, $url);
	curl_setopt($curl, CURLOPT_RETURNTRANSFER, 1);
	curl_setopt($curl, CURLOPT_CONNECTTIMEOUT, 5);
	curl_setopt($curl, CURLOPT_TIMEOUT, 30);

	$res = curl_exec($curl);
}

?>
```

### `gift.php` — Проверка подарочного сертификата

**⏳ БЭКЛОГ.** `GET tradesk.ru/api/gift?code=&check=`. Плюсы в коде превращаются обратно в `+` (артефакт urlencode). Функции подарочных сертификатов в новом сайте пока нет.

```php
<?
if ($_POST) {
	$code = str_replace(' ', '+', $_REQUEST['code']);
	$res = file_get_contents('http://tradesk.ru/api/gift?code=' . urlencode($code) . '&check=' . $_POST['check']);
	echo $res;
}
```

### `pec.php` — Расчёт доставки ПЭК

**🟡 ПРИГОДИТСЯ.** Прокси в калькулятор `calc.pecom.ru/bitrix/components/pecom/calc/ajax.php`. Отправитель зашит: `town = -463` (СПб). Принимает `city` (ID города в ПЭК), `volume`, `weight`. Нужен для блока «рассчитать доставку в регион» на карточке товара — на странице «Доставка» мы это обещаем.

```php
<?

$params = array(
	'places' => array(array(0, 0, 0, $_REQUEST['volume'], $_REQUEST['weight'], 0, 0)),
	'take' => array(
		'town' => -463,
		'tent' => 0,
		'gidro' => 0,
		'manip' => 0,
		'speed' => 0,
		'moscow' => 0,
	),
	'deliver' => array(
		'town' => $_REQUEST['city'],
		'tent' => 0,
		'gidro' => 0,
		'manip' => 0,
		'speed' => 0,
		'moscow' => 0,
	),
	'plombir' => 0,
	'strah' => 0,
	'ashan' => 0,
	'night' => 0,
	'pal' => 0,
	'pallets' => 0
);

$url = 'http://calc.pecom.ru/bitrix/components/pecom/calc/ajax.php?' . http_build_query($params);
$res = file_get_contents($url);

echo $res;

?>
```

### `city.php` — Автокомплит городов для ПЭК

**🟡 ПРИГОДИТСЯ.** Ищет города в инфоблоке 24 по началу названия, отдаёт `{name, id}`, где id — `PEC_ID`. ЭТО ГОРОДА ДОСТАВКИ ТК, а не городские поддомены — с отменой мультигорода остаётся актуальным (нужен свой справочник PEC_ID).

```php
<?
require_once($_SERVER["DOCUMENT_ROOT"]."/bitrix/modules/main/include/prolog_before.php");
CModule::IncludeModule('iblock');

$cities = array();
$res = CIBlockElement::GetList(array(), array('IBLOCK_ID' => 24, 'NAME' => $_REQUEST['q'] . '%'), false, false, array('ID', 'NAME', 'PROPERTY_PEC_ID'));
while ($ob = $res->GetNext()) {
	$cities[] = array(
		'name' => $ob['NAME'],
		'id' => $ob['PROPERTY_PEC_ID_VALUE']
	);
}

echo json_encode($cities);

die();
?>
```

### `email.php` — Форма «Отправить сообщение»

**⚪️ НЕ НУЖЕН.** Просто `mail()` на info@tirestock.ru, мимо tradesk. У нас все обращения идут в tradesk через outbox — заявка не теряется и видна менеджеру, а не в почте.

```php
<?
if ($_POST) {
    $text = '';
    if ($_REQUEST['name'] != '') $text .= 'Имя: ' . $_REQUEST['name'] . "\r\n";
    if ($_REQUEST['email'] != '') $text .= 'E-mail: ' . $_REQUEST['email'] . "\r\n";
    if ($_REQUEST['phone'] != '') $text .= 'Телефон: ' . $_REQUEST['phone'] . "\r\n";
    $text .= $_REQUEST['text'];

    mail('info@tirestock.ru', 'Сообщение с сайта TireStock.ru', $text);
}
?>
```

### `review.php` — Отзывы о шинах

**🟡 ПРИГОДИТСЯ.** Сырой SQL к таблице `review` (не инфоблок!) по `model_id`, пагинация по 10, разметка schema.org/Review с рейтингом. Источник данных для страницы «Отзывы» и блока отзывов на карточке — но таблица живёт в БД Битрикса, нужен доступ/выгрузка.

```php
<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");

$data = '';

$page = 0;
if ($_REQUEST['page'] > 0) $page = $_REQUEST['page'];
$offset = $page * 10;

$res = $DB->Query("SELECT * FROM review WHERE model_id=".$_REQUEST['model_id']." ORDER BY review_date DESC LIMIT ".$offset.", 10");
if ($res->SelectedRowsCount() > 0) {
    while ($ob = $res->GetNext()) {
    	$desc = str_replace(array('Достоинства:', 'Недостатки:', 'Комментарий:'), array('<b>Достоинства:</b>', '<br/><b>Недостатки:</b>', '<br/><b>Комментарий:</b>'), $ob['review_description']);
		$desc = preg_replace('/^<br\/>/', '', $desc);
		$n = $ob['review_rating'];

    	$data .= '<li itemprop="review" itemscope itemtype="https://schema.org/Review">';
		$data .= '<b itemprop="author" itemscope itemtype="https://schema.org/Person"><span itemprop="name">'.$ob['review_author'].'</span></b>, <em itemprop="datePublished" content="'.date('Y-m-d', strtotime($ob['review_date'])).'">'.date('d.m.Y', strtotime($ob['review_date'])).'</em>';
		$data .= '<div class="review-rating">';
		for ($i = 1; $i <= 5; $i++) {
			$data .= '<div class="review-rating-star">';
			if ($n >= $i) $data .= '<em></em>';
			$data .= '</div>';
		}
		$data .= '</div>';
		$data .= '<p itemprop="reviewBody">'.$desc.'</p>';
		$data .= '<div itemprop="reviewRating" itemscope itemtype="https://schema.org/Rating">';
        $data .='<meta itemprop="worstRating" content="1">';
        $data .='<meta itemprop="ratingValue" content="'.$ob['review_rating'].'">';
        $data .='<meta itemprop="bestRating" content="5"/>';
        $data .='</div>';
		$data .= '</li>';
    }
}

echo $data;

require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php");
?>
```

### `desc.php` — Описание раздела каталога

**⚪️ НЕ НУЖЕН.** Отдаёт описание/видео/отзывы раздела из свойств инфоблока (`UF_VIDEO`, `UF_REVIEW`). У нас контент разделов ведётся в своей админке (`content_pages`).

```php
<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");

CModule::IncludeModule('iblock');

$arFilter = array("IBLOCK_ID" => $_REQUEST['IBLOCK_ID'], "ID" => $_REQUEST["IBLOCK_SECTION_ID"]);
$ar = CIBlockSection::GetList(array("SORT"=>"ASC"), $arFilter, false, array('IBLOCK_ID', 'IBLOCK_SECTION_ID', 'ID', 'DESCRIPTION', 'UF_VIDEO', 'UF_REVIEW'))->Fetch();

$data = array(
	'video' => '',
	'review' => '',
	'description' => ''
);

if (!empty($ar['UF_REVIEW'])) {
	$data['review'] = '<ul class="comment-list">';
	foreach($ar['UF_REVIEW'] as $key=>$review) {
		$arReview = unserialize($review);
		$data['review'] .= '<li>';
			$data['review'] .= '<b>'.$arReview['HEADER'].'</b>, <em>'.$arReview['DATE'].'</em>';
			$data['review'] .= '<p>'.$arReview['TEXT'].'</p>';
		$data['review'] .= '</li>';
	}
	$data['review'] .= '</ul>';
}

if (!empty($ar['UF_VIDEO'])) {
	foreach($ar['UF_VIDEO'] as $key=>$video) {
		$data['video'] .= '<div class="mb-20">'.$video.'</div>';
	}
}

if ($ar['DESCRIPTION'] != '') {
	$data['description'] = '<div class="description">' . $ar['DESCRIPTION'] . '</div>';
}

echo json_encode($data);

require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php");
?>
```

### `add2cart.php` — Корзина Битрикса + формула цены

**⚪️ НЕ НУЖЕН.** Кладёт товар в корзину Битрикса, попутно считая цену: пересчёт от закупки по полосам маржи + **наценка города** (`MARGIN`/`MARGIN_MIN`/`MARGIN_EXTRA`) + зашитая в цену доставка для городов с `FREE_DELIVERY`. С отменой мультигорода городская часть формулы НЕАКТУАЛЬНА; наша цена — РРЦ из фида SelectTyres. Ценен как справка о том, как считалось раньше.

```php
<?
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");

CModule::IncludeModule('sale');
CModule::IncludeModule('iblock');

global $city;
global $brand_rrc;
global $margin_l;
global $margin_m;
global $margin_s;
global $margin_extra;
global $useDiscount;

$res = CIBlockElement::GetList(array(), array('IBLOCK_ID' => 23), false, false, array('ID', 'PROPERTY_STOCK_ID',  'PROPERTY_CITY_ID', 'PROPERTY_DELIVERY_TIME'));
while ($ob = $res->GetNext()) {
	$stocks[$ob['PROPERTY_STOCK_ID_VALUE']] = $ob;
}

$el = CIBlockElement::GetList(array(), array('ID' => $_REQUEST['id']))->GetNextElement();
$fields = $el->GetFields();
$props = $el->GetProperties();
$product = $fields;
$product['PROPERTIES'] = $props;

$price = CPrice::GetBasePrice($_REQUEST['id']);
$price = (float)$price['PRICE'];
$productPrice = $price;

//цена со скидкой
if ($useDiscount && $product['IBLOCK_ID'] == 21 && !in_array($product['PROPERTIES']['STOCK']['VALUE'], [19,114])) {
	$margin = (($price - $product['PROPERTIES']['STOCK_PRICE']['VALUE']) / $product['PROPERTIES']['STOCK_PRICE']['VALUE']) * 100;
	if ($margin > 18) {
		if ($stocks[$product['PROPERTIES']['STOCK']['VALUE']]['PROPERTY_CITY_ID_VALUE'] != 'spb') {
			if ($product['PROPERTIES']['B2B_PRICE']['VALUE'] > 0) {
				if ($product['PROPERTIES']['STOCK_PRICE']['VALUE'] < 5000) {
					$_price = round($product['PROPERTIES']['STOCK_PRICE']['VALUE'] * $margin_l) + $margin_extra;
				}
				elseif ($product['PROPERTIES']['STOCK_PRICE']['VALUE'] < 8000) {
					$_price = round($product['PROPERTIES']['STOCK_PRICE']['VALUE'] * $margin_m) + $margin_extra;
				}
				else {
					$_price = round($product['PROPERTIES']['STOCK_PRICE']['VALUE'] * $margin_s) + $margin_extra;
				}
				if ($_price < $productPrice - 100) {
					$price = $_price;
				}
			}
		}
		else {
			if ($product['PROPERTIES']['STOCK_PRICE']['VALUE'] < 5000) {
				$price = round($product['PROPERTIES']['STOCK_PRICE']['VALUE'] * $margin_l);
			}
			elseif ($product['PROPERTIES']['STOCK_PRICE']['VALUE'] < 8000) {
				$price = round($product['PROPERTIES']['STOCK_PRICE']['VALUE'] * $margin_m);
			}
			else {
				$price = round($product['PROPERTIES']['STOCK_PRICE']['VALUE'] * $margin_s);
			}
		}
	}
	if ($product['PROPERTIES']['PRICE']['VALUE'] > 0) {
		$price = $product['PROPERTIES']['PRICE']['VALUE'];
	}
}

$margin = 0;
if ($city['PROPERTIES']['MARGIN']['VALUE'] > 0) {
	$margin = round($price * ($city['PROPERTIES']['MARGIN']['VALUE'] / 100));
	$margin = ceil($margin / 10) * 10;
	if ($margin < $city['PROPERTIES']['MARGIN_MIN']['VALUE']) $margin = $city['PROPERTIES']['MARGIN_MIN']['VALUE'];
}
if ($city['PROPERTIES']['MARGIN_EXTRA']['VALUE'] > 0) {
	$margin += $city['PROPERTIES']['MARGIN_EXTRA']['VALUE'];
}
if ($margin > 0) $price += $margin;

if ($city['PROPERTIES']['FREE_DELIVERY']['VALUE'] > 0) {
	if ($product['IBLOCK_CODE'] == 'tyres') {
		if ($product['PROPERTIES']['WIDTH']['VALUE'] < 100) {
			$volume = round((pow($product['PROPERTIES']['WIDTH']['VALUE'] * 0.0254, 2) * ($product['PROPERTIES']['HEIGHT']['VALUE'] * 0.0254)), 2);
		}
		else {
			$volume = round(pow($product['PROPERTIES']['DIAMETR']['VALUE'] * 0.0254 + ($product['PROPERTIES']['WIDTH']['VALUE'] * $product['PROPERTIES']['HEIGHT']['VALUE'] / 1000 / 100 * 2), 2) * ($product['PROPERTIES']['WIDTH']['VALUE'] / 1000), 2); 
		}
		$stockCity = strtoupper($stocks[$product['PROPERTIES']['STOCK']['VALUE']]['PROPERTY_CITY_ID_VALUE']);
		$delivery_price = ceil($volume * 250 * $city['PROPERTIES']['DELIVERY_PRICE_' . $stockCity]['VALUE'] / 10) * 10;
	}
	else {
		$delivery_price = 400;
	}
	$price += $delivery_price;
}

$arFields = array(
	'PRODUCT_ID' => $product['ID'], 
	'PRICE' => $price,
	'CURRENCY' => 'RUB',
	'LID' => 's2',
	'NAME' => $product['NAME'],
	'QUANTITY' => $_REQUEST['quantity']
);

CSaleBasket::Add($arFields);

$cntBasketItems = 0;
$res = CSaleBasket::GetList(false, array("FUSER_ID" => CSaleBasket::GetBasketUserID(), "LID" => SITE_ID, "ORDER_ID" => "NULL"), false, false, array("ID", "QUANTITY", "PRICE"));
while ($ob = $res->GetNext()) {
	$cntBasketItems += $ob['QUANTITY'];
}

echo $cntBasketItems;
die();

require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php");
?>
```

### `auth.php` — Вход клиента по телефону (сломан)

**⚪️ НЕ НУЖЕН.** `GET tradesk.ru/api/login?phone=`. Файл нерабочий: `switch $_POST['action'] {` без скобок — parse error, никогда не исполнялся. Личного кабинета в новом сайте нет.

```php
<?

if (isset($_POST['action'])) {

	switch $_POST['action'] {
		case 'login':
			$data = file_get_contents('http://tradesk.ru/api/login?phone=' . $_POST['phone']);
			if ($data) return 1;
			else return 0;
		break;

		case 'auth':
		break;

		default:
		break;
	}

}

?>
```
