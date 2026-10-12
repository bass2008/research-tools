import re, json, time, html, urllib.request, collections
BASE = "https://www.twirpx.com"
pages = [json.loads(l) for l in open("pages.jsonl", encoding="utf-8")]
done = {p["page"] for p in pages}
queue = [p["page"] for p in pages]
names = {p["page"]: p["name"] for p in pages}
def fetch(u):
    for a in range(3):
        try:
            return urllib.request.urlopen(urllib.request.Request(BASE + u, headers={"User-Agent": "Mozilla/5.0"}), timeout=120).read().decode("utf-8", "replace")
        except Exception as e:
            print("ошибка", u, e, flush=True); time.sleep(10)
    return None
def text(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()
out = open("items.jsonl", "a", encoding="utf-8"); plog = open("pages.jsonl", "a", encoding="utf-8")
found = []
i = 0
while i < len(queue):
    u = queue[i]; i += 1
    h = fetch(u)
    if h is None: continue
    body = h.split('data-object-type="file"', 1)[0]
    for cu, cid, cn, cnt in re.findall(r'<a href="(/files/[^"?#]*)"[^>]*class="category-link"[^>]*data-category-id="(\d+)"[^>]*>([^<]*)</a>\s*(?:<span[^>]*>\s*([\d\s ]+)\s*</span>)?', body):
        if cu in done or not cu.startswith(u) or cu == u: continue
        done.add(cu); names[cu] = html.unescape(cn); queue.append(cu); found.append(cu)
        print(time.strftime("%H:%M:%S"), "новый подраздел", cu, html.unescape(cn)[:40], (cnt or "").strip(), flush=True)
    if u in {p["page"] for p in pages}:
        time.sleep(1.0); continue
    blocks = re.split(r'(?=<div[^>]*data-object-type="file")', h)[1:]; got = 0
    for b in blocks:
        fid = re.search(r'data-object-id="(\d+)"', b); t = re.search(r'<h2>.*?<a [^>]*href="/file/\d+/"[^>]*>(.*?)</a>', b, re.S)
        if not fid or not t: continue
        desc = re.search(r'<div class="text bb">(.*?)</div>', b, re.S); size = re.search(r'<li class="size">([^<]*)</li>', b)
        created = re.search(r'class="created_date">добавлен <time[^>]*datetime="([^"]+)"', b); secs = re.search(r'<ul class="sections">(.*?)</ul>', b, re.S)
        out.write(json.dumps({"id": int(fid.group(1)), "title": text(t.group(1)), "formats": re.findall(r'<li class="fmt">([^<]*)</li>', b),
            "size": size.group(1).strip() if size else "", "added": created.group(1)[:10] if created else "", "description": text(desc.group(1)) if desc else "",
            "sections": text(secs.group(1)) if secs else "", "page": u, "page_name": names[u]}, ensure_ascii=False) + "\n"); got += 1
    out.flush()
    plog.write(json.dumps({"page": u, "name": names[u], "map_count": "", "items": got, "bytes": len(h)}, ensure_ascii=False) + "\n"); plog.flush()
    print(time.strftime("%H:%M:%S"), "собран", u, got, flush=True)
    time.sleep(1.5)
print("ГОТОВО", time.strftime("%H:%M:%S"), "новых подразделов", len(found), flush=True)
