import re, sys, json, time, html, os, urllib.request, urllib.parse, urllib.error, http.cookiejar
BASE = "https://www.twirpx.com"
roots, skip = [], []
for l in open(sys.argv[1], encoding="utf-8"):
    l = l.strip()
    if l: (skip.append(l[1:]) if l.startswith("-") else roots.append(l))
jar = http.cookiejar.MozillaCookieJar("jar.txt")
if os.path.exists("jar.txt"): jar.load(ignore_discard=True, ignore_expires=True)
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)); op.addheaders = [("User-Agent", "Mozilla/5.0")]
BOOK_TABS = {"dictionary", "encyclopedia", "reference"}
def text(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()
def get(u, data=None):
    for a in range(3):
        try:
            r = op.open(urllib.request.Request(BASE + u, data=data), timeout=120); h = r.read().decode("utf-8", "replace")
            jar.save(ignore_discard=True, ignore_expires=True); return h
        except urllib.error.HTTPError as e:
            h = e.read().decode("utf-8", "replace")
            if "GRAYLISTED" in h: print("КАПЧА: адрес снова в сером списке, обход остановлен на", u, flush=True); sys.exit(2)
            print("ошибка", u, e.code, flush=True); time.sleep(10)
        except Exception as e:
            print("ошибка", u, e, flush=True); time.sleep(10)
    return None
def adult(h):
    form = re.search(r'<form method="post" action="/adult/confirm/">(.*?)</form>', h, re.S)
    if not form or 'data-object-type="file"' in h: return False
    f = {k: html.unescape(v) for k, v in re.findall(r'<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"', form.group(1))}; f["IsConfirmed"] = "true"
    get("/adult/confirm/", urllib.parse.urlencode(f).encode()); return True
done = {json.loads(l)["page"] for l in open("pages.jsonl", encoding="utf-8")} if os.path.exists("pages.jsonl") else set()
out = open("items.jsonl", "a", encoding="utf-8"); plog = open("pages.jsonl", "a", encoding="utf-8")
queue, seen, names = list(roots), set(roots), {}
ok = lambda u: not any(u.startswith(s) for s in skip) and "/periodic/" not in u
while queue:
    u = queue.pop(0)
    h = get(u); time.sleep(1.5)
    if h is None: continue
    if adult(h): h = get(u); time.sleep(1.5); print("18+:", u, flush=True)
    names.setdefault(u, text(re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S).group(1)) if re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S) else u)
    body = h.split('data-object-type="file"', 1)[0]
    for cu, cn, cnt in re.findall(r'<a href="(/files/[^"?#]*)"[^>]*class="category-link"[^>]*>([^<]*)</a>\s*(?:<span[^>]*>\s*([\d\s\xa0]+)\s*</span>)?', body):
        if cu.startswith(u) and cu != u and cu not in seen and ok(cu): seen.add(cu); names[cu] = html.unescape(cn).strip(); queue.append(cu)
    tabs = {t: int(re.sub(r"\D", "", c) or 0) for t, c in re.findall(r'<a href="[^"]*\?ft=([^"&]*)"[^>]*class="file-type-link"[^>]*>[^<]*</a>\s*(?:<[^>]+>\s*)*([\d\s\xa0]*)', h)} if "?" not in u else {}
    for t in tabs:
        if t in BOOK_TABS and f"{u}?ft={t}" not in seen: seen.add(f"{u}?ft={t}"); names[f"{u}?ft={t}"] = names[u] + f" [{t}]"; queue.insert(0, f"{u}?ft={t}")
    if u in done: continue
    got = 0
    for b in re.split(r'(?=<div[^>]*data-object-type="file")', h)[1:]:
        head = re.match(r'<div[^>]*>', b).group(0)
        fid = re.search(r'data-object-id="(\d+)"', head); t = re.search(r'<h2>.*?<a [^>]*href="/file/\d+/"[^>]*>(.*?)</a>', b, re.S)
        if not fid or not t: continue
        attr = lambda k: (re.search(rf'data-{k}="([^"]*)"', head) or [None, ""])[1]
        desc = re.search(r'<div class="text bb">(.*?)</div>', b, re.S); size = re.search(r'<li class="size">([^<]*)</li>', b)
        created = re.search(r'class="created_date">добавлен <time[^>]*datetime="([^"]+)"', b); secs = re.search(r'<ul class="sections">(.*?)</ul>', b, re.S)
        out.write(json.dumps({"id": int(fid.group(1)), "title": text(t.group(1)), "formats": re.findall(r'<li class="fmt">([^<]*)</li>', b),
            "size": size.group(1).strip() if size else "", "added": created.group(1)[:10] if created else "", "description": text(desc.group(1)) if desc else "",
            "sections": text(secs.group(1)) if secs else "", "status": attr("status"), "limited": attr("limited"), "file_type": attr("file-type"),
            "page": u, "page_name": names[u]}, ensure_ascii=False) + "\n"); got += 1
    out.flush()
    plog.write(json.dumps({"page": u, "name": names[u], "items": got, "tabs": tabs, "bytes": len(h)}, ensure_ascii=False) + "\n"); plog.flush()
    print(time.strftime("%H:%M:%S"), f"очередь {len(queue)}", u, names[u][:50], got, flush=True)
print("ГОТОВО", time.strftime("%H:%M:%S"), "страниц", len(seen), flush=True)
