import re, json, time, html, urllib.request, urllib.parse, http.cookiejar
BASE = "https://www.twirpx.com"
jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
op.addheaders = [("User-Agent", "Mozilla/5.0")]
def get(u): return op.open(BASE + u, timeout=120).read().decode("utf-8", "replace")
def text(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()
gated = {"/files/nonscience/isoteric/magic/sexual_practices/": "Магические и сакральные сексуальные практики",
         "/files/nonscience/isoteric/esoteric_yoga/raja_yoga/kriya/": "Крийя йога",
         "/files/nonscience/isoteric/esoteric_yoga/tantra/sexual_practices/": "Тантрические сексуальные практики"}
first = next(iter(gated))
h = get(first)
form = re.search(r'<form method="post" action="/adult/confirm/">(.*?)</form>', h, re.S).group(1)
fields = dict(re.findall(r'<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"', form))
fields = {k: html.unescape(v) for k, v in fields.items()}
fields["IsConfirmed"] = "true"
print("поля формы:", sorted(fields))
r = op.open(urllib.request.Request(BASE + "/adult/confirm/", data=urllib.parse.urlencode(fields).encode(), method="POST"), timeout=60)
print("подтверждение:", r.status, r.geturl(), "| куки:", [c.name for c in jar])
out = open("items.jsonl", "a", encoding="utf-8"); plog = open("pages.jsonl", "a", encoding="utf-8")
queue = list(gated); names = dict(gated); seen = set(queue)
while queue:
    u = queue.pop(0); time.sleep(1.5)
    h = get(u)
    if "Материал «для взрослых»" in h.split("<body", 1)[-1][:20000] and 'data-object-type="file"' not in h:
        print("всё ещё закрыто:", u); continue
    body = h.split('data-object-type="file"', 1)[0]
    for cu, cn in re.findall(r'<a href="(/files/[^"?#]*)"[^>]*class="category-link"[^>]*>([^<]*)</a>', body):
        if cu.startswith(u) and cu != u and cu not in seen: seen.add(cu); names[cu] = html.unescape(cn); queue.append(cu); print("вложенный:", cu)
    got = 0
    for b in re.split(r'(?=<div[^>]*data-object-type="file")', h)[1:]:
        fid = re.search(r'data-object-id="(\d+)"', b); t = re.search(r'<h2>.*?<a [^>]*href="/file/\d+/"[^>]*>(.*?)</a>', b, re.S)
        if not fid or not t: continue
        desc = re.search(r'<div class="text bb">(.*?)</div>', b, re.S); size = re.search(r'<li class="size">([^<]*)</li>', b)
        created = re.search(r'class="created_date">добавлен <time[^>]*datetime="([^"]+)"', b); secs = re.search(r'<ul class="sections">(.*?)</ul>', b, re.S)
        out.write(json.dumps({"id": int(fid.group(1)), "title": text(t.group(1)), "formats": re.findall(r'<li class="fmt">([^<]*)</li>', b),
            "size": size.group(1).strip() if size else "", "added": created.group(1)[:10] if created else "", "description": text(desc.group(1)) if desc else "",
            "sections": text(secs.group(1)) if secs else "", "page": u, "page_name": names[u]}, ensure_ascii=False) + "\n"); got += 1
    out.flush()
    plog.write(json.dumps({"page": u, "name": names[u], "map_count": "", "items": got, "bytes": len(h), "gated": True}, ensure_ascii=False) + "\n"); plog.flush()
    print(names[u], "файлов:", got)
