package catalog

import "testing"

func TestValidCity(t *testing.T) {
	for _, c := range AllCities {
		if !ValidCity(c) {
			t.Errorf("ValidCity(%q) = false, ожидалось true", c)
		}
	}
	if ValidCity("spb ") || ValidCity("") || ValidCity("piter") {
		t.Error("ValidCity пропустил невалидный город")
	}
}
