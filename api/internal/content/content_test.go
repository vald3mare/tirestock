package content

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgtype"
)

func TestNormalizeSlug(t *testing.T) {
	cases := []struct {
		in      string
		want    string
		wantErr bool
	}{
		{"/info/oplata/", "/info/oplata/", false},
		{"  /Info/OPLATA/ ", "/info/oplata/", false}, // трим + нижний регистр
		{"info/oplata", "", true},                    // нет ведущего /
		{"", "", true},
		{"/a b/", "", true}, // пробел
	}
	for _, c := range cases {
		got, err := normalizeSlug(c.in)
		if c.wantErr {
			if !errors.Is(err, ErrSlugInvalid) {
				t.Errorf("normalizeSlug(%q): ожидалась ErrSlugInvalid, got %v", c.in, err)
			}
			continue
		}
		if err != nil || got != c.want {
			t.Errorf("normalizeSlug(%q) = %q, %v; want %q, nil", c.in, got, err, c.want)
		}
	}
}

func TestPageLockRules(t *testing.T) {
	var ts pgtype.Timestamptz
	cases := []struct {
		name              string
		indexed, system   bool
		wantLocked        bool
		wantDeletable     bool
	}{
		{"черновик", false, false, false, true},
		{"проиндексирована", true, false, true, false},
		{"системная", false, true, true, false},
	}
	for _, c := range cases {
		p := mkPage(1, "/x/", "T", "", "", "", true, c.indexed, c.system, "Вадим", ts)
		if p.Locked != c.wantLocked || p.Deletable != c.wantDeletable {
			t.Errorf("%s: Locked=%v Deletable=%v; want %v/%v",
				c.name, p.Locked, p.Deletable, c.wantLocked, c.wantDeletable)
		}
	}
}
