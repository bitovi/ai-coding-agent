Read:
- `examples/mcp-servers.json`

I'd like to make it so when an authorization_token is provided in an `mcp-servers` configuration, the
`GET /api/connections` endpoint should return `"isAvailable": true,` for those connections.

Similarly, if an environment variable like `MCP_${serverName}_authorization_token` is passed, then 
`GET /api/connections` endpoint should return `"isAvailable": true,` for those connections.


This seems like we will need to change `AuthManager`'s `isAuthorized` method. 

Please think about different ways of doing this.  Lets make a minimal way. And lets make sure we can test this.

One way might be to pass the mcpServers configuration to AuthManager so `isAuthorized` can use it.



