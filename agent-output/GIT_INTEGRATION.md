The project https://github.com/bitovi/git-mcp-server is used to provide a git MCP server, allowing the AI coding agent to clone, commit to, and push repositories.


The ai-coding-agent is dependent on this git-mcp-server to run.


In order to make both work, I'd like you to build a docker-compose.yml with a shared volume between them.  The shared volume is where:

- git-mcp-server will clone a repository, and
- ai-coding-agent will make changes


Also, we will need to figure out how to setup the `git-mcp-server` so it has access to a `~/.git-credentials` file. I'm able to change the git-mcp-server to meet our needs. If you want me to change it, please give me a prompt that I can pass to a coding agent that will have it make the required changes.  


Please write up your plan in a file in the `agent-output` folder. 