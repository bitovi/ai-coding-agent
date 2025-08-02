

Information about the claude code sdk can be found here: https://docs.anthropic.com/en/docs/claude-code/sdk

Example prompts and MCP servers can be found in the `examples` directory.


## Specifications 

The specifications in the `specifications` directory should be kept up to date.


## Testing Prompts with Docker

To run docker (with disabled auth for testing):

```bash
docker run -d --name ai-coding-agent -p 3000:3000 --env-file .env -e DISABLE_AUTH=true ai-coding-agent
```

Listen for the docker logs:

```bash
docker logs ai-coding-agent
```

To test prompts with cURL:

```bash
# Test with streaming output
curl -X POST http://localhost:3000/prompt/clone-github-repository/run \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "parameters": {
      "repository": "bitovi/bitovi-jira-redirect"
    }
  }'
```

## Testing Prompts with local development

Start the server locally:

```bash
npm run dev
```

```bash
# Test with streaming output
curl -X POST http://localhost:3000/prompt/clone-github-repository/run \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{
    "parameters": {
      "repository": "bitovi/bitovi-jira-redirect"
    }
  }'
```

## Test files 

There are a wide variety of tests is located in the `tests` directory. 

These are not actively maintained. But if you are wanting to write a test, 
check the tests directory, it might already exist.  Also, if you end up writing a new one, 
create it in the `tests` directory.