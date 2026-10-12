"""MCP сохраняет общий протокол после удаления обработчика чакр."""
from types import SimpleNamespace

from arcanatasks import mcp_server as server


def test_test_task_prompt_and_submission_use_the_selected_stand(monkeypatch):
    target = SimpleNamespace(name="test", url="https://test.invalid")
    monkeypatch.setattr(server, "stand", lambda name: target if name == "test" else None)
    monkeypatch.setattr(server.client, "get_job", lambda selected, task_id: {
        "job_id": task_id, "type": "test", "params": {}, "due_at": None,
    })
    job = server.get_job("test:12")
    assert job["job_id"] == "test:12" and job["type"] == "test"
    assert "Связь с MCP работает." in job["prompt"]
    sent = []
    def submit(selected, task_id, **payload):
        sent.append((selected, task_id, payload))
        return {"accepted": True}
    monkeypatch.setattr(server.client, "submit_result", submit)
    assert server.submit_result("test:12", result="Связь с MCP работает.") == {"accepted": True}
    assert sent == [(target, "12", {"result": "Связь с MCP работает.", "error": None})]


def test_mcp_transports_validation_and_closed_job_errors(monkeypatch):
    monkeypatch.setattr(server, "stand", lambda name: SimpleNamespace(name=name))
    monkeypatch.setattr(server.client, "submit_result", lambda *a, **kw: {"accepted": False, "problems": ["bad result"]})
    assert server.submit_result("test:12", result={})["problems"] == ["bad result"]
    def closed(*args):
        raise server.client.JobUnknown()
    monkeypatch.setattr(server.client, "get_job", closed)
    assert "error" in server.get_job("test:12")
