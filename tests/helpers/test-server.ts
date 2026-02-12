import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

export async function createTestServer(
  registerFn: (server: McpServer, client: any) => void,
  mockClient: any,
) {
  const server = new McpServer({ name: "test", version: "0.0.1" });
  registerFn(server, mockClient);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const mcpClient = new Client({ name: "test-client", version: "0.0.1" });
  await server.connect(serverTransport);
  await mcpClient.connect(clientTransport);
  return {
    server,
    mcpClient,
    cleanup: async () => {
      await mcpClient.close();
      await server.close();
    },
  };
}

export async function callTool(
  mcpClient: Client,
  name: string,
  args: Record<string, unknown> = {},
) {
  return mcpClient.callTool({ name, arguments: args });
}
