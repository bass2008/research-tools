import re, json, time, html, sys, urllib.request
BASE = "https://www.twirpx.com"
m = open("isoteric-root.html", encoding="utf-8").read()
cats = [("/files/nonscience/isoteric/", "197", "Эзотерика, мистицизм, оккультизм", None)]
cats += [(u, i, html.unescape(n), c) for u, i, n, c in re.findall(r'<a href="(/files/nonscience/isoteric/[^"?]*)"[^>]*data-category-id="(\d+)"[^>]*>([^<]*)</a>\s*(?:<span[^>]*>\s*([\d\s ]+)\s*</span>)?', m)]
seen = set()
cats = [c for c in cats if not (c[0] in seen or seen.add(c[0]))]
out = open("items.jsonl", "a", encoding="utf-8")
done = {json.loads(l)["page"] for l in open("pages.jsonl", encoding="utf-8")} if __import__("os").path.exists("pages.jsonl") else set()
plog = open("pages.jsonl", "a", encoding="utf-8")
def text(s): return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()
for n, (url, cid, name, cnt) in enumerate(cats, 1):
    if url in done: continue
    for attempt in range(3):
        try:
            req = urllib.request.Request(BASE + url, headers={"User-Agent": "Mozilla/5.0"})
            h = urllib.request.urlopen(req, timeout=120).read().decode("utf-8", "replace"); break
        except Exception as e:
            print("ошибка", url, e, flush=True); time.sleep(10); h = None
    if h is None: continue
    blocks = re.split(r'(?=<div[^>]*data-object-type="file")', h)[1:]
    got = 0
    for b in blocks:
        fid = re.search(r'data-object-id="(\d+)"', b)
        t = re.search(r'<h2>.*?<a [^>]*href="/file/\d+/"[^>]*>(.*?)</a>', b, re.S)
        if not fid or not t: continue
        fmts = re.findall(r'<li class="fmt">([^<]*)</li>', b)
        desc = re.search(r'<div class="text bb">(.*?)</div>', b, re.S)
        size = re.search(r'<li class="size">([^<]*)</li>', b)
        created = re.search(r'class="created_date">добавлен <time[^>]*datetime="([^"]+)"', b)
        secs = re.search(r'<ul class="sections">(.*?)</ul>', b, re.S)
        out.write(json.dumps({"id": int(fid.group(1)), "title": text(t.group(1)), "formats": fmts,
                              "size": size.group(1).strip() if size else "", "added": created.group(1)[:10] if created else "",
                              "description": text(desc.group(1)) if desc else "", "sections": text(secs.group(1)) if secs else "",
                              "page": url, "page_name": name}, ensure_ascii=False) + "\n")
        got += 1
    out.flush()
    plog.write(json.dumps({"page": url, "name": name, "map_count": (cnt or "").replace("\xa0", "").replace(" ", ""), "items": got, "bytes": len(h)}, ensure_ascii=False) + "\n"); plog.flush()
    print(time.strftime("%H:%M:%S"), f"{n}/{len(cats)}", name[:50], "файлов на странице:", got, flush=True)
    time.sleep(1.5)
print("ГОТОВО", time.strftime("%H:%M:%S"), flush=True)
