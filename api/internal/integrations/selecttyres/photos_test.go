package selecttyres

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

const sampleAds = `<Ads formatVersion="3" target="Avito.ru">
  <Ad><Id>t1</Id><Title>A</Title>
    <Images><Image url="https://ex/media/a.png"/></Images></Ad>
  <Ad><Id>t2</Id><Title>B</Title>
    <Images></Images></Ad>
  <Ad><Id>t3</Id><Title>C</Title>
    <Images><Image url="https://ex/media/c.jpg"/></Images></Ad>
</Ads>`

func TestPhotoClient_Fetch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		_, _ = w.Write([]byte(sampleAds))
	}))
	defer srv.Close()

	c, err := NewPhotoClient(PhotoConfig{FeedURL: srv.URL})
	if err != nil {
		t.Fatal(err)
	}
	got := map[string]string{}
	parsed, withPhoto, err := c.Fetch(context.Background(), func(code, url string) error {
		got[code] = url
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if parsed != 3 || withPhoto != 2 {
		t.Errorf("parsed=%d withPhoto=%d, ожидалось 3 и 2", parsed, withPhoto)
	}
	if got["t1"] != "https://ex/media/a.png" || got["t3"] != "https://ex/media/c.jpg" {
		t.Errorf("неверные url: %+v", got)
	}
	if _, ok := got["t2"]; ok {
		t.Error("t2 без фото не должен попасть в fn")
	}
}
