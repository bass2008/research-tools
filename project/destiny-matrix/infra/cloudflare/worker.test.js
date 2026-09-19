// Прогон: node --test infra/cloudflare/worker.test.js
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import worker, { handle } from "./worker.js";

const SUPPORT = "-1004473881250";
const CLIENT = 1068250612;
const SECRET = "s3cret";

function env() {
  const store = new Map();
  const calls = [];
  let topic = 100;
  globalThis.fetch = async (url, init) => {
    const method = String(url).split("/").pop();
    const payload = JSON.parse(init.body);
    calls.push([method, payload]);
    const result = method === "createForumTopic" ? { message_thread_id: ++topic } : {};
    return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
  };
  return {
    calls,
    store,
    env: {
      BOT_TOKEN: "test-token",
      SUPPORT_CHAT_ID: SUPPORT,
      WEBHOOK_SECRET: SECRET,
      THREADS: {
        get: async (key) => store.get(key) ?? null,
        put: async (key, value) => void store.set(key, value),
        delete: async (key) => void store.delete(key),
      },
    },
  };
}

const clientMessage = (text = "не приходит отчёт", id = 7, chat = CLIENT) => ({
  message: {
    message_id: id, text,
    from: { id: chat, is_bot: false, first_name: "Мария" },
    chat: { id: chat, type: "private", first_name: "Мария", username: "maria" },
  },
});

const supportReply = (topic, id = 42, is_bot = false) => ({
  message: {
    message_id: id, text: "уже чиним", message_thread_id: topic,
    from: { id: 11, is_bot, first_name: "Сергей" },
    chat: { id: Number(SUPPORT), type: "supergroup", title: "Поддержка" },
  },
});

afterEach(() => { delete globalThis.fetch; });

describe("бот поддержки", () => {
  it("первое сообщение заводит тему с именем клиента", async () => {
    const t = env();
    await handle(clientMessage(), t.env);

    assert.deepEqual(t.calls[0], ["createForumTopic", { chat_id: Number(SUPPORT), name: "Мария @maria" }]);
    assert.deepEqual(t.calls[1], ["copyMessage", {
      chat_id: Number(SUPPORT), from_chat_id: CLIENT, message_id: 7, message_thread_id: 101,
    }]);
    assert.equal(t.store.get(`chat:${CLIENT}`), "101");
    assert.equal(t.store.get("topic:101"), String(CLIENT));
  });

  it("второе сообщение уходит в ту же тему", async () => {
    const t = env();
    await handle(clientMessage("раз", 7), t.env);
    await handle(clientMessage("два", 8), t.env);

    assert.equal(t.calls.filter(([m]) => m === "createForumTopic").length, 1);
    assert.deepEqual(t.calls.filter(([m]) => m === "copyMessage").map(([, p]) => p.message_thread_id),
                     [101, 101]);
  });

  it("у двух клиентов свои темы", async () => {
    const t = env();
    await handle(clientMessage("раз", 7), t.env);
    await handle(clientMessage("раз", 1, 900900), t.env);

    assert.deepEqual(t.calls.filter(([m]) => m === "copyMessage").map(([, p]) => p.message_thread_id),
                     [101, 102]);
  });

  it("ответ из темы доходит до своего клиента", async () => {
    const t = env();
    await handle(clientMessage(), t.env);
    t.calls.length = 0;

    await handle(supportReply(101), t.env);

    assert.deepEqual(t.calls, [["copyMessage", {
      chat_id: CLIENT, from_chat_id: Number(SUPPORT), message_id: 42,
    }]]);
  });

  it("копии бота в группе не уезжают обратно клиенту", async () => {
    const t = env();
    await handle(clientMessage(), t.env);
    t.calls.length = 0;

    await handle(supportReply(101, 43, true), t.env);

    assert.deepEqual(t.calls, []);
  });

  it("служебная запись о заведении темы пропускается", async () => {
    const t = env();
    await handle(clientMessage(), t.env);
    t.calls.length = 0;

    await handle({ message: {
      message_id: 2, message_thread_id: 101, from: { id: 11, is_bot: false },
      chat: { id: Number(SUPPORT), type: "supergroup" },
      forum_topic_created: { name: "Мария @maria" },
    } }, t.env);

    assert.deepEqual(t.calls, []);
  });

  it("ответ в неизвестной теме игнорируется", async () => {
    const t = env();
    await handle(supportReply(999), t.env);
    assert.deepEqual(t.calls, []);
  });

  it("/start отвечает клиенту и молчит в группе", async () => {
    const t = env();
    await handle(clientMessage("/start"), t.env);

    assert.equal(t.calls.length, 1);
    assert.equal(t.calls[0][0], "sendMessage");
    assert.equal(t.calls[0][1].chat_id, CLIENT);
  });

  it("чужой POST без секрета получает отказ", async () => {
    const t = env();
    const response = await worker.fetch(new Request("https://bot.workers.dev/", {
      method: "POST", body: JSON.stringify(clientMessage()),
      headers: { "x-telegram-bot-api-secret-token": "guess" },
    }), t.env);

    assert.equal(response.status, 403);
    assert.deepEqual(t.calls, []);
  });

  it("отказ Telegram не заставляет повторять апдейт", async () => {
    const t = env();
    globalThis.fetch = async () => new Response(
      JSON.stringify({ ok: false, description: "bot is not a member of the supergroup chat" }),
      { status: 400 });

    const response = await worker.fetch(new Request("https://bot.workers.dev/", {
      method: "POST", body: JSON.stringify(clientMessage()),
      headers: { "x-telegram-bot-api-secret-token": SECRET },
    }), t.env);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });

  it("удалённая тема заводится заново, сообщение клиента не теряется", async () => {
    const t = env();
    t.store.set(`chat:${CLIENT}`, "8");
    t.store.set("topic:8", String(CLIENT));
    const calls = [];
    let topic = 8;
    globalThis.fetch = async (url, init) => {
      const method = String(url).split("/").pop();
      const payload = JSON.parse(init.body);
      calls.push([method, payload]);
      if (method === "copyMessage" && payload.message_thread_id === 8) {
        return new Response(JSON.stringify(
          { ok: false, description: "Bad Request: message thread not found" }), { status: 400 });
      }
      const result = method === "createForumTopic" ? { message_thread_id: ++topic } : {};
      return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
    };

    await handle(clientMessage(), t.env);

    assert.deepEqual(calls.map(([method]) => method),
      ["copyMessage", "createForumTopic", "copyMessage"]);
    assert.equal(calls.at(-1)[1].message_thread_id, 9);
    assert.equal(t.store.get(`chat:${CLIENT}`), "9");
    assert.equal(t.store.get("topic:9"), String(CLIENT));
    assert.equal(t.store.has("topic:8"), false);
  });
});
