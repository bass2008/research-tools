import json

ENTRY_KEYS = ("n", "slug", "title", "roman", "matrix_number", "short", "keywords", "meaning",
              "in_positions", "plus", "minus", "combinations", "seo")


def test_arcanum_shape(client):
    r = client.get("/api/encyclopedia/arcanum/14")
    assert r.status_code == 200
    body = r.json()
    for key in ENTRY_KEYS:
        assert key in body, key
    assert body["n"] == 14 and body["matrix_number"] == 14
    assert body["slug"] == "temperance" and body["title"] == "Умеренность"
    assert body["roman"] == "XIV"
    assert len(body["combinations"]) == 21
    assert {"with", "href", "short"} <= set(body["combinations"][0])


def test_combination_links_are_ordered(client):
    body = client.get("/api/encyclopedia/arcanum/14").json()
    for item in body["combinations"]:
        a, b = sorted((14, item["with"]))
        assert item["href"] == f"/encyclopedia/combination/{a}-{b}"


def test_all_22_arcana_answer(client):
    for n in range(1, 23):
        r = client.get(f"/api/encyclopedia/arcanum/{n}")
        assert r.status_code == 200, n
        assert r.json()["n"] == n


def test_out_of_range_is_404(client):
    for n in (0, 23, 100):
        r = client.get(f"/api/encyclopedia/arcanum/{n}")
        assert r.status_code == 404, n
        assert "1" in r.json()["detail"]


def test_index_counts(client):
    body = client.get("/api/encyclopedia/index").json()
    assert len(body["arcana"]) == 22
    assert len(body["positions"]) == 37       # 20 разделов + 17 позиций матрицы
    assert body["combinations_count"] == 231
    assert body["pages"] == 298               # 22 + 37 + 231 + 7 + 1
    assert len(body["chakras"]) == 7


def test_generated_files_win_over_stub(client, tmp_path, monkeypatch):
    from app.config import settings
    entry = {"n": 14, "slug": "temperance", "title": "Умеренность", "short": "живой текст",
             "meaning": "абзац", "keywords": ["мера"], "in_positions": {"money": "…"},
             "plus": ["баланс"], "minus": ["затягивание"], "combinations": [],
             "seo": {"title": "t", "description": "d", "queries": ["14 аркан"]}}
    (tmp_path / "arcanum").mkdir()
    (tmp_path / "arcanum" / "14.json").write_text(json.dumps(entry, ensure_ascii=False),
                                                  encoding="utf-8")
    monkeypatch.setattr(settings, "encyclopedia_dir", tmp_path)
    body = client.get("/api/encyclopedia/arcanum/14").json()
    assert body["short"] == "живой текст"
    assert body["roman"] == "XIV"          # добито из таблицы
    assert "stub" not in body

    stub = client.get("/api/encyclopedia/arcanum/15").json()
    assert stub["stub"] is True
