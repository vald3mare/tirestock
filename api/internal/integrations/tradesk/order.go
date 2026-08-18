package tradesk

import (
	"context"
	"fmt"
	"net/url"
	"strconv"
	"strings"
)

// Приёмник заказа tradesk. Контракт вскрыт из /ajax/order.php старого сайта
// (Битрикс) + его фронтенда (карточка товара, кнопка «Купить в 1 клик»), 11.08.2026:
//
//	GET http://tradesk.ru/api/addorder?phone=&name=&comment=&qty=&product=&code=&price=&city=&type=
//
// Ответ — номер заказа в кавычках (`"12345"`); строка `error` означает отказ.
// Старый сайт печатал его пользователю: «Ваш заказ №… принят».
//
// ⚠️ ОДНА ПОЗИЦИЯ НА ВЫЗОВ: параметры product/code/price/qty — скаляры (на старом
// сайте это был заказ в один клик с карточки). Многопозиционный заказ шлём N
// вызовами; в комментарий кладём наш номер заказа и «позиция i/N», чтобы менеджер
// видел, что строки относятся к одному заказу с сайта.
const (
	pathAddOrder = "/api/addorder"

	// Тип товара в номенклатуре старого сайта. Диски появятся, когда SelectTyres
	// включит их выгрузку (в фиде сейчас 0 дисков) — тогда прокинуть "wheels".
	orderTypeTyres = "tyres"

	// Город — константа: магазин работает только по Санкт-Петербургу (решение
	// 11.08.2026, мультигород отменён). Старый сайт слал ровно это значение
	// hidden-полем на карточке товара.
	orderCitySPb = "spb"
)

// deliverOrder шлёт заказ в tradesk — по одному вызову на позицию.
// Любая неудачная позиция возвращает ошибку: outbox оставит заказ и повторит.
// Возвращает номера записей, которые завёл tradesk (через запятую, если позиций
// несколько) — админка показывает их менеджеру.
func (c *Client) deliverOrder(ctx context.Context, in orderPayload) (string, error) {
	if strings.TrimSpace(in.Phone) == "" {
		return "", fmt.Errorf("tradesk order: пустой телефон")
	}
	if len(in.Items) == 0 {
		return "", fmt.Errorf("tradesk order: пустой заказ #%d", in.OrderID)
	}

	numbers := make([]string, 0, len(in.Items))
	for i, it := range in.Items {
		params := url.Values{
			"phone":   {in.Phone},
			"name":    {in.CustomerName},
			"comment": {orderComment(in, i)},
			"qty":     {strconv.Itoa(it.Qty)},
			"product": {it.Name},
			"code":    {it.Code},
			"price":   {strconv.Itoa(it.Price)},
			"city":    {orderCitySPb},
			"type":    {orderTypeTyres},
		}
		num, err := c.getDataString(ctx, pathAddOrder, params)
		if err != nil {
			return "", fmt.Errorf("tradesk order #%d, позиция %d/%d: %w", in.OrderID, i+1, len(in.Items), err)
		}
		if num == "" || strings.EqualFold(num, "error") {
			return "", fmt.Errorf("tradesk order #%d, позиция %d/%d: приёмник ответил %q", in.OrderID, i+1, len(in.Items), num)
		}
		numbers = append(numbers, num)
		// Номер в tradesk — единственная ниточка между нашим заказом и учёткой:
		// без него поддержка не сможет сопоставить обращение клиента с записью.
		c.cfg.Log.Info("tradesk: заказ принят",
			"наш_заказ", in.OrderID, "позиция", i+1, "всего", len(in.Items),
			"номер_tradesk", num, "код", it.Code)
	}
	return strings.Join(numbers, ", "), nil
}

// orderComment собирает комментарий позиции: наш номер заказа + позиция + код
// товара в НАШЕЙ номенклатуре (SelectTyres). Код нужен в тексте, потому что поле
// code приёмника исторически хранит код старого магазина — по нему наш товар
// не найдётся, и менеджеру нужна опора на название и наш код.
func orderComment(in orderPayload, i int) string {
	parts := []string{fmt.Sprintf("Заказ с сайта #%d", in.OrderID)}
	if len(in.Items) > 1 {
		parts = append(parts, fmt.Sprintf("позиция %d/%d", i+1, len(in.Items)))
	}
	if code := strings.TrimSpace(in.Items[i].Code); code != "" {
		parts = append(parts, "код SelectTyres: "+code)
	}
	if c := strings.TrimSpace(in.Comment); c != "" {
		parts = append(parts, c)
	}
	return strings.Join(parts, ". ")
}
