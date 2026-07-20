import assert from "node:assert/strict";
import test from "node:test";
import { createChatCompletion, getOpenAICompatibleConfig, modelStatus, resolveChatCompletionsUrl } from "../server/openai-compatible.mjs";

test("resolves relay base URLs and explicit completion endpoints", () => {
  assert.equal(resolveChatCompletionsUrl({ OPENAI_BASE_URL: "https://relay.example/v1/" }), "https://relay.example/v1/chat/completions");
  assert.equal(resolveChatCompletionsUrl({ OPENAI_CHAT_COMPLETIONS_URL: "https://relay.example/openai/chat/completions" }), "https://relay.example/openai/chat/completions");
});

test("calls an OpenAI-compatible relay with custom authentication", async () => {
  let request;
  const result = await createChatCompletion([{ role: "user", content: "test" }], {
    OPENAI_API_KEY: "secret-key",
    OPENAI_BASE_URL: "https://relay.example/v1",
    OPENAI_MODEL: "relay-model",
    OPENAI_AUTH_HEADER: "x-api-key",
    OPENAI_AUTH_SCHEME: "",
    OPENAI_EXTRA_HEADERS_JSON: '{"X-Provider":"gateway"}',
  }, async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ model: "relay-model", choices: [{ message: { content: "ok" } }] }), { status: 200, headers: { "content-type": "application/json" } });
  });
  assert.equal(request.url, "https://relay.example/v1/chat/completions");
  assert.equal(request.init.headers["x-api-key"], "secret-key");
  assert.equal(request.init.headers["X-Provider"], "gateway");
  assert.equal(JSON.parse(request.init.body).model, "relay-model");
  assert.equal(result.content, "ok");
});

test("model status never exposes credentials", () => {
  const status = modelStatus({ OPENAI_API_KEY: "must-not-leak", OPENAI_BASE_URL: "https://relay.example/v1", OPENAI_MODEL: "custom-model" });
  assert.equal(status.configured, true);
  assert.equal(status.providerHost, "relay.example");
  assert.equal(status.model, "custom-model");
  assert.doesNotMatch(JSON.stringify(status), /must-not-leak/);
});

test("rejects unsafe extra headers", () => {
  assert.throws(() => getOpenAICompatibleConfig({ OPENAI_EXTRA_HEADERS_JSON: '{"Host":"evil.example"}' }), /OPENAI_EXTRA_HEADERS_JSON_INVALID/);
});
