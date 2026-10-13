# Asking Claude

A tile with the `ai.ask` permission can ask Claude, Anthropic's model, with `tf.ai.ask`. Tilefold has no AI of its own and no account: questions use **the user's own Anthropic API key**, which they save in Settings → AI, and are billed to their Anthropic account. The tile never sees the key.

**Every question is shown to the user before it is sent.** Tilefold opens a dialog showing exactly what will be sent, which model will answer and how much of the tile's daily allowance is used. The user chooses **Don't send**, **Send once**, or **Send, and don't ask again until Tilefold restarts** (for this tile). Questions from several tiles wait in line; one dialog shows at a time.

The **Shell Tips** example (`examples/shell-tips`) is a complete tile that asks Claude.

## 1. Ask for the permission

```json
"permissions": [
  { "ai.ask": "to explain the error you select in one or two sentences" }
]
```

The user sees **Ask Claude questions using your Anthropic API key** with your reason. Say what you ask about and why: the user pays for it.

## 2. Ask

The short form is a prompt string:

```js
const answer = await tf.ai.ask("Explain exit code 127 in one sentence.");
answer.text; // "Exit code 127 means the shell couldn't find the command…"
```

The full form takes an object:

```js
const answer = await tf.ai.ask({
  system: "You explain shell errors briefly, as plain text.",
  messages: [
    { role: "user", content: "Why did `npm test` exit with 127?" },
    { role: "assistant", content: "The test script calls a program that isn't installed." },
    { role: "user", content: "How do I find which one?" },
  ],
  maxTokens: 300,
  model: "fast",
});
```

| Field | |
|---|---|
| `prompt` | One question, as a string. Give `prompt` or `messages`, not both |
| `system` | Instructions for the model: tone, length, format, language |
| `messages` | The conversation: 1 to 50 messages, `role` `"user"` or `"assistant"`, starting with `user`, alternating, ending with `user`, none empty |
| `maxTokens` | The longest answer, in tokens, 1 to 16,000; 4,096 when left out. Keep it small: it bounds the cost |
| `model` | `"default"` (Claude Opus 5.5, for harder questions) or `"fast"` (Claude Haiku 4.5, quicker and cheaper). `"default"` when left out |

The system text and messages together may be at most 200,000 characters.

**The answer:**

| Field | |
|---|---|
| `text` | The reply as plain text (the text parts of the answer, joined) |
| `model` | The model that answered. With `"default"`, Anthropic may answer with its recommended fallback model when the first one declines, so this can differ |
| `stopReason` | Why the answer ended: `"end_turn"` when it was complete, `"max_tokens"` when it hit `maxTokens` |
| `usage` | `{ inputTokens, outputTokens }`, counting every attempt |

## 3. Let the user take their time

A question waits for the user's choice in Tilefold's dialog, and an answer can take up to two minutes. A command handler has ten seconds, and an event handler half a second, so **never wait for `tf.ai.ask` inside a handler**. Start the question and return:

```js
let busy = false;

async function explain() {
  if (busy) return; // one question at a time
  busy = true;
  try {
    const answer = await tf.ai.ask({ prompt: "…", model: "fast", maxTokens: 300 });
    await tf.toast(answer.text.slice(0, 300));
  } catch (err) {
    // See "Errors" below.
  } finally {
    busy = false;
  }
}

tf.command(tf.t("cmd-explain"), () => {
  void explain();
}, { id: "explain" });
```

A question the user leaves unanswered in the dialog for more than five minutes expires and fails with `TypeError`.

## 4. Handle the answer

- **"Don't send" is a normal outcome**, not a failure. `tf.ai.ask` rejects with `AiDeclinedError`; say nothing, or show a quiet note.
- **Answer in the user's language.** `tf.ai.ask` doesn't know the user's language, but your strings do: put the language's name in each `tile.ftl` (`ai-language = Deutsch`) and ask for it in `system`.
- **Ask for plain text** when you show the answer in a notice or an overlay, and clean it anyway: notices hold 300 characters and show no Markdown.
- **Check `stopReason`.** `"max_tokens"` means the answer was cut.
- **Don't store or record answers** without a reason. Record what was asked about and the token count, not the text. Tilefold itself records each question as `tile.ai.ask` with the model, token counts and how many places were masked, and never stores the question or the answer.

## What Tilefold does to every question

1. **Checks** that the tile has `ai.ask`, that the user saved a key, and that the tile has allowance left today.
2. **Masks secrets.** Text that looks like a password, token, API key, `key=value` secret or private key block is replaced with `[redacted]` before the user sees it, and the dialog says how many places were masked. Masking catches common formats, not everything, so don't send what you don't need.
3. **Shows the dialog** and waits for the user.
4. **Sends exactly what was shown**, from the core, with the user's key. It retries once when Anthropic is busy (429, 529 or a 5xx answer).
5. **Counts the tokens** against the tile's allowance: **50,000 tokens per tile per day** (input and output together, days in UTC).

## Errors

`tf.ai.ask` rejects with an `Error` whose `name` says why:

| `name` | Why | What to do |
|---|---|---|
| `AiDeclinedError` | The user chose **Don't send** | Nothing; it's their choice |
| `AiNotSetUpError` | The user hasn't saved an Anthropic API key, or Anthropic refused it | Tell them to add their key in Settings → AI |
| `PermissionDeniedError` | The tile doesn't have `ai.ask` | Tell them to allow it in Settings → Tiles |
| `BudgetExceededError` | The tile used today's 50,000 tokens | Try again tomorrow |
| `RefusedError` | The model declined to answer | Rephrase, or say Claude couldn't help |
| `RateLimitError` | Anthropic is limiting the user's key | Try again later |
| `NetworkError` | Anthropic couldn't be reached or answered with an error | Try again later |
| `TypeError` | The question is malformed (see the rules above), or it expired in the dialog | Fix the call |
| `NotSupportedError` | This Tilefold can't ask a model | Tell the user to update |

On a Tilefold without AI for tiles, `tf.ai` is missing altogether; check `if (!tf.ai)` first.

## Testing

`test/fake-host.mjs` in this repository answers `tf.ai.ask` from a function you give it (`ai: (question) => "answer"`) and records every question. The function may return a promise, so a test can stand for a user who hasn't decided yet, or throw an error with a `name` to test your error handling. Without `ai`, asking fails with `AiNotSetUpError`. See `test/shell-tips.test.mjs`.

Copyright (c) 2026 Tilefold. Released under the MIT License.
