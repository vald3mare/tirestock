package selecttyres

import (
	"strings"
	"unicode"
)

// translit — базовая транслитерация кириллицы для slug (модели часто латиницей,
// но встречается и кириллица). Полнота SEO-URL — отдельная задача (сверка со старым
// сайтом), здесь важна лишь стабильность и уникальность.
var translit = map[rune]string{
	'а': "a", 'б': "b", 'в': "v", 'г': "g", 'д': "d", 'е': "e", 'ё': "e",
	'ж': "zh", 'з': "z", 'и': "i", 'й': "y", 'к': "k", 'л': "l", 'м': "m",
	'н': "n", 'о': "o", 'п': "p", 'р': "r", 'с': "s", 'т': "t", 'у': "u",
	'ф': "f", 'х': "h", 'ц': "c", 'ч': "ch", 'ш': "sh", 'щ': "sch", 'ъ': "",
	'ы': "y", 'ь': "", 'э': "e", 'ю': "yu", 'я': "ya",
}

// slugify формирует URL-slug из названия и добавляет числовую часть code для
// гарантированной уникальности (slug — UNIQUE в products).
func slugify(name, code string) string {
	var b strings.Builder
	prevDash := false
	for _, r := range strings.ToLower(name) {
		if tr, ok := translit[r]; ok {
			b.WriteString(tr)
			prevDash = false
			continue
		}
		if unicode.IsLetter(r) && r < unicode.MaxASCII || unicode.IsDigit(r) && r < unicode.MaxASCII {
			b.WriteRune(r)
			prevDash = false
			continue
		}
		if !prevDash {
			b.WriteByte('-')
			prevDash = true
		}
	}
	base := strings.Trim(b.String(), "-")
	num := digitsOnly(code)
	if base == "" {
		return "t" + num
	}
	if num == "" {
		return base
	}
	return base + "-" + num
}

func digitsOnly(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
