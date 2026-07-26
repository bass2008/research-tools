"""taskworker — тонкий транспорт LLM-задач между FastAPI конвейера и Claude Code.

Своего интеллекта нет и к Anthropic API не ходит (tech-design §7):

* `taskworker mcp`       — stdio MCP-сервер: status / get_job / submit_result;
* `taskworker wait-jobs` — блокирующее ожидание джобов (Claude запускает в фоне).
"""

__version__ = "0.1.0"
