import re, json, time, html, urllib.request, urllib.parse, http.cookiejar
BASE = "https://www.twirpx.com"
jar = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar)); op.addheaders = [("User-Agent", "Mozilla/5.0")]
def get(u):
    for a in range(3):
        try: return op.open(BASE + u, timeout=120).read().decode("utf-8", "replace")
        except Exception as e: print("ошибка", u, e, flush=True); time.sleep(10)
    return None
g = "/files/nonscience/isoteric/esoteric_yoga/raja_yoga/kriya/"
h = get(g); form = re.search(r'<form method="post" action="/adult/confirm/">(.*?)</form>', h, re.S).group(1)
f = {k: html.unescape(v) for k, v in re.findall(r'<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"', form)}; f["IsConfirmed"] = "true"
op.open(urllib.request.Request(BASE + "/adult/confirm/", data=urllib.parse.urlencode(f).encode(), method="POST"), timeout=60)
pages = list({json.loads(l)["page"]: json.loads(l) for l in open("pages.jsonl", encoding="utf-8")})
out = open("status.jsonl", "w", encoding="utf-8")
for n, u in enumerate(pages, 1):
    h = get(u)
    if h is None: continue
    cnt = collections_count = 0
    for head in re.findall(r'<div[^>]*data-object-type="file"[^>]*>', h):
        fid = re.search(r'data-object-id="(\d+)"', head).group(1)
        st = re.search(r'data-status="([^"]*)"', head); lim = re.search(r'data-limited="([^"]*)"', head); ft = re.search(r'data-file-type="([^"]*)"', head)
        out.write(json.dumps({"id": int(fid), "status": st.group(1) if st else "", "limited": lim.group(1) if lim else "", "file_type": ft.group(1) if ft else "", "page": u}) + "\n"); cnt += 1
    out.flush()
    print(time.strftime("%H:%M:%S"), f"{n}/{len(pages)}", u, cnt, flush=True)
    time.sleep(1.5)
print("ГОТОВО", time.strftime("%H:%M:%S"), flush=True)
