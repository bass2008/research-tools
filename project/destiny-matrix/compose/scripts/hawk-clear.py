import argparse
import json
import os
import sys
import urllib.request

API = "https://api.hawk.so/graphql"


def call(query, variables=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    with urllib.request.urlopen(urllib.request.Request(API, body, headers), timeout=30) as resp:
        answer = json.load(resp)
    if answer.get("errors"):
        raise SystemExit(f"Hawk: {answer['errors'][0].get('message')}")
    return answer["data"]


parser = argparse.ArgumentParser(description="Удалить события проекта Hawk вместе с повторами.")
parser.add_argument("project", help="точное имя проекта, например «acrana-sense.ru test»")
parser.add_argument("--match", default="", help="удалять только события, в заголовке которых есть эта строка")
parser.add_argument("--apply", action="store_true", help="удалить; без флага только показать список")
args = parser.parse_args()

email, password = os.environ.get("HAWK_EMAIL"), os.environ.get("HAWK_PASSWORD")
if not email or not password:
    raise SystemExit("задайте HAWK_EMAIL и HAWK_PASSWORD")

token = call("mutation($e: String!, $p: String!) { login(email: $e, password: $p) { accessToken } }",
             {"e": email, "p": password})["login"]["accessToken"]

projects = [p for w in call("{ workspaces { projects { id name } } }", token=token)["workspaces"] for p in w["projects"] or []]
project = next((p for p in projects if p["name"] == args.project), None)
if not project:
    raise SystemExit(f"проекта «{args.project}» нет; есть: {', '.join(p['name'] for p in projects)}")

events, skip = [], 0
while True:
    page = call("""query($ids: [ID!], $skip: Int!) { workspaces { projects(ids: $ids) {
                     events(limit: 50, skip: $skip) { id totalCount payload { title } marks { resolved } } } } }""",
                {"ids": [project["id"]], "skip": skip}, token)
    portion = next((p["events"] for w in page["workspaces"] for p in w["projects"] or []), None) or []
    events += portion
    if len(portion) < 50:
        break
    skip += 50

events = [e for e in events if args.match in e["payload"]["title"]]
for e in events:
    mark = "resolved" if e["marks"]["resolved"] else "open"
    print(f"{e['totalCount']:>6}  {mark:<8}  {e['payload']['title']}")
print(f"{project['name']}: {len(events)} групп, {sum(e['totalCount'] for e in events)} событий")

if not args.apply:
    print("ничего не удалено; для удаления добавьте --apply")
    sys.exit(0)

removed = 0
for e in events:
    if call("mutation($p: ID!, $e: ID!) { removeEvent(projectId: $p, eventId: $e) }",
            {"p": project["id"], "e": e["id"]}, token)["removeEvent"]:
        removed += 1
print(f"удалено групп: {removed} из {len(events)}")
