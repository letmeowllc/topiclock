export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('OK');
    const update = await request.json();
    if (!update.message) return new Response('OK');
    const msg = update.message;
    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = msg.text || '';
    const threadId = msg.message_thread_id;
    if (!threadId || !userId) return new Response('OK');
    const token = env.BOT_TOKEN;
    const isAdmin = await checkAdmin(token, chatId, userId);
    const key = `locked:${chatId}`;
    const lockedTopics = JSON.parse(await env.KV.get(key) || '[]');
    const isLocked = lockedTopics.includes(threadId);
    if (isLocked && !isAdmin) {
      await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_id: msg.message_id })
      });
      const warn = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, message_thread_id: threadId, text: `⚠️ ${msg.from.first_name}, эта тема закрыта.` })
      }).then(r => r.json());
      if (warn.ok) {
        await new Promise(r => setTimeout(r, 5000));
        await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: warn.result.message_id })
        });
      }
      return new Response('OK');
    }
    if (isAdmin && text.startsWith('/lock')) {
      if (!lockedTopics.includes(threadId)) {
        lockedTopics.push(threadId);
        await env.KV.put(key, JSON.stringify(lockedTopics));
        await sendMsg(token, chatId, threadId, '🔒 Тема заблокирована.');
      }
    }
    if (isAdmin && text.startsWith('/unlock')) {
      const idx = lockedTopics.indexOf(threadId);
      if (idx > -1) {
        lockedTopics.splice(idx, 1);
        await env.KV.put(key, JSON.stringify(lockedTopics));
        await sendMsg(token, chatId, threadId, '🔓 Тема разблокирована.');
      }
    }
    return new Response('OK');
  }
};

async function checkAdmin(token, chatId, userId) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${chatId}&user_id=${userId}`);
    const data = await res.json();
    return data.result?.status === 'creator' || data.result?.status === 'administrator';
  } catch { return false; }
}

async function sendMsg(token, chatId, threadId, text) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_thread_id: threadId, text: text })
  });
                          }
