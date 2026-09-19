// Бот поддержки целиком: клиент пишет в личку, сообщение уходит в тему группы; ответ из темы
// возвращается клиенту. Живёт в Cloudflare, а не на нашей машине, по вынужденной причине: у
// сервера в Yandex Cloud нет связи с api.telegram.org ни в одну сторону (замер 12.09.2026 —
// вебхук не доходит, исходящие не соединяются), а узлы Cloudflare видят и Telegram, и нас.
//
// Состояние — только пара «тема ↔ чат», в KV двумя ключами, потому что искать надо в обе
// стороны: по чату при входящем сообщении и по теме при ответе. Переписку хранит сам Telegram.

const API = "https://api.telegram.org";

const GREETING = "Здравствуйте! Опишите вопрос — ответим здесь же. " +
  "Если вопрос по заказу, укажите почту, на которую покупали.";

export async function call(env, method, payload) {
  const answer = await fetch(`${API}/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await answer.json();
  if (!body.ok) throw new Error(`${method}: ${body.description ?? "отказ Telegram"}`);
  return body.result;
}

function title(chat) {
  const name = [chat.first_name, chat.last_name].filter(Boolean).join(" ").trim();
  const handle = chat.username ? `@${chat.username}` : "";
  return (`${name} ${handle}`.trim() || String(chat.id)).slice(0, 128);
}

async function topicFor(env, chat) {
  const known = await env.THREADS.get(`chat:${chat.id}`);
  if (known) return Number(known);
  const created = await call(env, "createForumTopic", {
    chat_id: Number(env.SUPPORT_CHAT_ID), name: title(chat),
  });
  const topic = created.message_thread_id;
  await env.THREADS.put(`chat:${chat.id}`, String(topic));
  await env.THREADS.put(`topic:${topic}`, String(chat.id));
  return topic;
}

async function forget(env, chat, topic) {
  await env.THREADS.delete(`chat:${chat.id}`);
  await env.THREADS.delete(`topic:${topic}`);
}

async function fromClient(env, message, chat) {
  if ((message.text ?? "").startsWith("/start")) {
    await call(env, "sendMessage", { chat_id: chat.id, text: env.GREETING ?? GREETING });
    return;
  }
  const copy = (topic) => call(env, "copyMessage", {
    chat_id: Number(env.SUPPORT_CHAT_ID),
    from_chat_id: chat.id,
    message_id: message.message_id,
    message_thread_id: topic,
  });
  const topic = await topicFor(env, chat);
  try {
    await copy(topic);
  } catch (failure) {
    // Тему в группе могли удалить руками, а пара в KV об этом не знает: Telegram отвечает
    // «message thread not found», и письмо клиента пропадало молча. Заводим тему заново.
    if (!/thread not found/i.test(String(failure))) throw failure;
    await forget(env, chat, topic);
    await copy(await topicFor(env, chat));
  }
}

async function fromSupport(env, message) {
  // Копии клиентских сообщений в группу кладёт сам бот: без этой проверки каждая копия уезжала
  // бы обратно клиенту, и диалог зациклился бы.
  if (message.from?.is_bot) return;
  // Служебные записи о заведении и переименовании темы телом не являются — копировать нечего.
  if (Object.keys(message).some((key) => key.startsWith("forum_topic"))) return;
  if (!message.message_thread_id) return;
  const chat = await env.THREADS.get(`topic:${message.message_thread_id}`);
  if (!chat) return;
  await call(env, "copyMessage", {
    chat_id: Number(chat),
    from_chat_id: Number(env.SUPPORT_CHAT_ID),
    message_id: message.message_id,
  });
}

export async function handle(update, env) {
  const message = update.message;
  if (!message) return;
  const chat = message.chat ?? {};
  if (chat.type === "private") await fromClient(env, message, chat);
  else if (String(chat.id) === String(env.SUPPORT_CHAT_ID)) await fromSupport(env, message);
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("support bot", { status: 200 });
    // Адрес открыт всему интернету, и секрет — единственное, что отличает апдейт от чужого POST.
    if (request.headers.get("x-telegram-bot-api-secret-token") !== env.WEBHOOK_SECRET) {
      return new Response("forbidden", { status: 403 });
    }
    let update;
    try {
      update = await request.json();
    } catch {
      return Response.json({ ok: true });
    }
    // Ответ обязан быть 200 в любом случае: на любой другой код Telegram повторяет апдейт, и
    // одно неудобное сообщение превратилось бы в бесконечный цикл доставки.
    try {
      await handle(update, env);
    } catch (failure) {
      console.error("апдейт не обработан", failure);
    }
    return Response.json({ ok: true });
  },
};
