

Information about the claude code sdk can be found here: https://docs.anthropic.com/en/docs/claude-code/sdk

Example prompts and MCP servers can be found in the `examples` directory.


## Specifications 

The specifications in the `specifications` directory should be kept up to date.


## Frontend APIs 

The frontend APIs are defined in `src/services/web-client-services/`.

Read about them in `specifications/ui-apis.md` when needing to know how the 
backend API works. We should always follow this specification and keep it up to date with any backend changes.


## Frontend comands 

Make sure to run the frontend commands from the `frontend` directory.

```
cd frontend
```

## Starting the Frontend Development Server

To start the frontend development server, navigate to the `frontend` directory and run:

```bash
cd frontend
npm run dev
```


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

The maintained tests can be run with `npm test`. This should be done after every change.


There are a wide variety of unmaintained test scripts in the `tests` directory. 
These are not actively maintained. But if you are wanting to write a test, 
check the tests directory, it might already exist.  Also, if you end up writing a new one, 
create it in the `tests` directory.


## Coding Style 

When possible, use functions instead of classes like:

```javascript
function myFunc({ paramA = 1, paramB = 2 } = {}) {}
```


If we will need to do some dependency injection, structure the import
and function as follows:

```javascript
import foo as defaultFoo from 'foo';
function myFunc({ foo = defaultFoo } = {}) {}
```


## Control Behavior 

UI elements that are not interactive should not have hover effects. 
They shouldn't change background color or perform some other effect on hover.