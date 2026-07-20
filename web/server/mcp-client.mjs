import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export function resolvePythonExecutable() {
  const configured = process.env.MCP_PYTHON_EXECUTABLE?.trim();
  if (configured) return configured;
  const activeCondaPython = process.env.CONDA_PREFIX && basename(process.env.CONDA_PREFIX).toLowerCase() === "python_310"
    ? join(process.env.CONDA_PREFIX, process.platform === "win32" ? "python.exe" : "bin/python")
    : null;
  const candidates = process.platform === "win32" ? [
    "D:\\software\\Anaconda\\envs\\Python_310\\python.exe",
    activeCondaPython,
    join(homedir(), "anaconda3", "envs", "Python_310", "python.exe"),
    join(homedir(), "miniconda3", "envs", "Python_310", "python.exe"),
  ] : [
    activeCondaPython,
    join(homedir(), "anaconda3", "envs", "Python_310", "bin", "python"),
    join(homedir(), "miniconda3", "envs", "Python_310", "bin", "python"),
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate)) || (process.platform === "win32" ? "python.exe" : "python3");
}

function providerDefinitions() {
  const python = resolvePythonExecutable();
  return {
    eastmoney: { command: python, args: [fileURLToPath(new URL("../mcp/eastmoney_server.py", import.meta.url))] },
    ifind: { command: python, args: [fileURLToPath(new URL("../mcp/ifind_server.py", import.meta.url))] },
    alipay: { command: python, args: [fileURLToPath(new URL("../mcp/alipay_fund_server.py", import.meta.url))] },
    rag: { command: python, args: [fileURLToPath(new URL("../mcp/rag_server.py", import.meta.url))] },
  };
}

const connections = new Map();

function childEnv() {
  return Object.fromEntries(Object.entries(process.env).filter((entry) => typeof entry[1] === "string"));
}

async function connectProvider(provider) {
  const existing = connections.get(provider);
  if (existing) return existing;
  const definition = providerDefinitions()[provider];
  if (!definition) throw new Error(`不支持的 MCP 数据源：${provider}`);
  const pending = (async () => {
    const transport = new StdioClientTransport({ ...definition, env: childEnv(), stderr: "inherit" });
    const client = new Client({ name: "guanlan-fund-agent", version: "1.0.0" });
    try {
      await client.connect(transport);
      return { client, transport };
    } catch (error) {
      await transport.close().catch(() => {});
      throw error;
    }
  })();
  connections.set(provider, pending);
  try {
    return await pending;
  } catch (error) {
    connections.delete(provider);
    throw error;
  }
}

export function parseMcpResult(result) {
  if (result?.structuredContent) return result.structuredContent;
  const text = result?.content?.find?.((item) => item.type === "text")?.text;
  let payload = text;
  if (typeof text === "string") {
    try { payload = JSON.parse(text); } catch { /* keep plain text */ }
  }
  if (result?.isError) {
    const message = payload?.error || payload?.response?.message || (typeof payload === "string" ? payload : "MCP 数据源请求失败");
    throw new Error(message);
  }
  return payload;
}

export async function callMcpTool(provider, name, args = {}) {
  const { client } = await connectProvider(provider);
  return parseMcpResult(await client.callTool({ name, arguments: args }));
}

export async function getMcpStatus() {
  const results = await Promise.all(Object.keys(providerDefinitions()).map(async (provider) => {
    const configured = provider === "ifind"
      ? Boolean(process.env.IFIND_ACCESS_TOKEN?.trim() || process.env.IFIND_REFRESH_TOKEN?.trim())
      : provider === "alipay" ? Boolean(process.env.ALIPAY_FUND_API_URL?.trim()) : true;
    if (!configured) return { provider, connected: false, configured: false, tools: [] };
    try {
      const { client } = await connectProvider(provider);
      const listed = await client.listTools();
      return {
        provider,
        connected: true,
        configured,
        tools: listed.tools.map((tool) => tool.name),
      };
    } catch (error) {
      return { provider, connected: false, configured: false, tools: [], error: error instanceof Error ? error.message : "连接失败" };
    }
  }));
  return { providers: results, checkedAt: new Date().toISOString() };
}

export async function closeMcpConnections() {
  const current = [...connections.values()];
  connections.clear();
  await Promise.all(current.map(async (pending) => {
    const connection = await pending.catch(() => null);
    await connection?.client.close().catch(() => {});
  }));
}
