# ai-coding-agent


This is an AI coding agent that runs Claude Code while providing it 
access tokens for MCP services.

## Environment Variables

It takes the following environment variables:

- __EMAIL__ - An email for the current user. Example:
  ```
  austin@bitovi.com
  ```
- __MCP_SERVERS__ - either a JSON array or a path to a JSON file. The JSON should look like:
  ```json
  [
    {
        "name": "NAME OF SERVICE",
        "type": "TYPE OF SERVICE", 
        "url": "URL TO MCP SERVICE",
        "authorization_token": null // or a string authorization token
        "tool_configuration": {},
        "oauth_provider_configuration": OAuthProviderConfiguration
    }
  ]
  ```

  This is a superset of the `mcp_servers` option passed to `anthropic.beta.messages.create`. More information can be found about that SDK here: https://github.com/anthropics/anthropic-sdk-typescript

  It supports an additional optional `oauth_provider_configuration`. See [OAuthProviderConfiguration](./specifications/oauth-provider-configuration.json) for more information.

- __PROMPTS__ - either a json array or a path to a JSON file. The JSON should look like:
  ```json
  [
    {
        "name": "Name of prompt",
        "mcp_servers": ["MCP NAME OF SERVICE"],
        "messages": [{
            "role": "ROLE",
            "content": "CONTENT",
            "parameters" : {}
        }]
    }
  ]
  ```

  Each item in  `PROMPTS[].mcp_servers` array must match a entry's `name` 
  in the `MCP_SERVERS` name.

  The `PROMPTS[].messages` array matches the the `messages` option passed to `anthropic.beta.messages.create` with the exception of `parameters`. 

  The parameters let people specify what parameters the prompt takes. When a prompt is called, arguments can be provided which will be substituted into the `messages.content`.
  See [Parameters Specification](./specifications/parameters.json) for more information.

- `ACCESS_TOKEN` a token that is used to match all incoming requests.
  
## Important Context

The following URL should be injested to understand how things work:

- https://docs.anthropic.com/en/docs/claude-code/mcp
- https://raw.githubusercontent.com/bitovi/claude-experiments/refs/heads/main/get-pkce-token.js

## Endpoints

### `GET /index.html`

The index page looks like:

![index page example](./specifications/index.png "Index Page Example")

The index page has two main lists:

- Your prompts - A list of prompts available in the service. For each prompt, it also provides:
  - A link to see the activity for the prompt
  - A list of the MCP services the prompt uses. MCP services that 
    are authorized are in green. MCP services that are not authorized are in red.

- Your Connections - A list of MCP services. Each MCP service is green if it's
  been authorized and red if it has not. Clicking an MCP service will start the authorization flow for that service.

### `GET /prompts/{PROMPT_NAME}/activity.html`

A list of prompts that have been run and their output. It can also show prompts that are pending due to needed authorizations.

Each prompt has a button that enables re-running the prompt.

### `POST /mcp/{MCP_NAME}/authorize`

Initiates an authorization flow for the MCP service.

This endpoint will match an MCP configuration by MCP_NAME. 

If the MCP configuration has a `authorization_token`, this does nothing b/c it's already authorized.

If the MCP configuration has a `oauth_provider_configuration` it will establish the
proper configuration. 

If no `oauth_provider_configuration` is provided, it will use the MCP url to look for a well known endpoint similar to the code in: https://raw.githubusercontent.com/bitovi/claude-experiments/refs/heads/main/get-pkce-token.js

Once the authorization is complete, the tokens (including refresh) for the authorization will be stored in a Map that maps the MCP service name to the tokens.

### `POST /prompt/{PROMPT_NAME}/run`

This endpoints runs a prompt if there's an available access token for each of the mcp_servers. It runs as a streaming SSE service.

If there's 
not an available access token, then the prompt is saved in array of prompts to be run and an error is returned. The user is also emailed a message to return and authorize the necessary mcp_servers.

If all of the MCP services are available, the prompt is run. The results of the prompt are returned to user.  

Look at https://raw.githubusercontent.com/bitovi/claude-experiments/refs/heads/main/example-official-jira-mcp-with-pkce-token.js on how to call anthropic.beta.messages.create
with access tokens.


