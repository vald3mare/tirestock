package tradesk

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"

	"tirestock/api/internal/orders"
)

// Deliver реализует orders.OrderDelivery: маршрутизирует payload outbox по виду
// (order/callback) в соответствующий контроллер tradesk. Идемпотентность гарантирует
// вызывающая сторона (outbox: одна строка — одна доставка).
func (c *Client) Deliver(ctx context.Context, kind string, payload []byte) error {
	switch kind {
	case orders.KindCallback:
		return c.deliverCallback(ctx, payload)
	case orders.KindOrder:
		return c.deliverOrder(ctx, payload)
	default:
		return fmt.Errorf("tradesk: неизвестный вид outbox %q", kind)
	}
}

// deliverCallback шлёт заявку «обратный звонок» в контроллер backcall.
//
// TODO(разведка формы): подтвердить со старого сайта tirestock.ru точные имена полей
// приёмника и actionPath. В админке backcall/create отсутствует (404), поэтому создание
// идёт тем же URL, что и форма старого сайта. Ниже — предположение по паттерну Yii2
// ActiveForm (модель Backcall с атрибутами phone/name/comment).
func (c *Client) deliverCallback(ctx context.Context, payload []byte) error {
	var in orders.CallbackInput
	if err := json.Unmarshal(payload, &in); err != nil {
		return fmt.Errorf("tradesk callback: разбор payload: %w", err)
	}
	fields := url.Values{
		fieldBackcallPhone:   {in.Phone},
		fieldBackcallName:    {in.Name},
		fieldBackcallComment: {in.Comment},
	}
	return c.postForm(ctx, pathBackcallForm, pathBackcallCreate, fields)
}

// deliverOrder шлёт заказ в контроллер order.
//
// TODO(разведка формы): подтвердить имена полей и формат позиций (order controller).
// Заказ содержит список позиций — уточнить, ждёт ли tradesk массив
// OrderItem[i][slug]/[qty]/[price] или иной формат.
func (c *Client) deliverOrder(ctx context.Context, payload []byte) error {
	var in orderPayload
	if err := json.Unmarshal(payload, &in); err != nil {
		return fmt.Errorf("tradesk order: разбор payload: %w", err)
	}
	fields := url.Values{
		fieldOrderPhone:   {in.Phone},
		fieldOrderName:    {in.CustomerName},
		fieldOrderComment: {in.Comment},
	}
	for i, it := range in.Items {
		fields.Set(fmt.Sprintf(fieldOrderItemSlugFmt, i), it.Slug)
		fields.Set(fmt.Sprintf(fieldOrderItemQtyFmt, i), fmt.Sprint(it.Qty))
		fields.Set(fmt.Sprintf(fieldOrderItemPriceFmt, i), fmt.Sprint(it.Price))
	}
	return c.postForm(ctx, pathOrderForm, pathOrderCreate, fields)
}

// orderPayload повторяет структуру, которую orders.CreateOrder кладёт в outbox.
type orderPayload struct {
	OrderID      int64              `json:"order_id"`
	CustomerName string             `json:"customer_name"`
	Phone        string             `json:"phone"`
	Comment      string             `json:"comment"`
	Items        []orders.OrderItem `json:"items"`
	Total        int                `json:"total"`
}

// ── КОНТРАКТ ПРИЁМНИКА tradesk ─────────────────────────────────────────────────
// ВСЕ значения ниже — ПРЕДПОЛОЖЕНИЯ по паттерну Yii2 ActiveForm. Обязательно
// подтвердить путём осмотра формы «обратный звонок»/оформления на старом сайте
// tirestock.ru (View Source → name="…" полей и action формы) ДО первой реальной
// записи. Разведка admin-контура показала контроллеры backcall и order.
const (
	pathBackcallForm     = "/backcall/index"  // страница со свежим CSRF (форма создания — с сайта)
	pathBackcallCreate   = "/backcall/create" // TODO: подтвердить actionPath приёмника
	fieldBackcallPhone   = "Backcall[phone]"
	fieldBackcallName    = "Backcall[name]"
	fieldBackcallComment = "Backcall[comment]"

	pathOrderForm     = "/order/index"
	pathOrderCreate   = "/order/create" // TODO: подтвердить actionPath приёмника
	fieldOrderPhone   = "Order[phone]"
	fieldOrderName    = "Order[name]"
	fieldOrderComment = "Order[comment]"
	// Позиции заказа: TODO подтвердить формат (табличный ввод Yii2).
	fieldOrderItemSlugFmt  = "OrderItem[%d][slug]"
	fieldOrderItemQtyFmt   = "OrderItem[%d][qty]"
	fieldOrderItemPriceFmt = "OrderItem[%d][price]"
)
