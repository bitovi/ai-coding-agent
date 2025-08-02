## Behavior

In order for the clone-github-repository to work with either ClaudeCodeSDKService or ClaudeCodeService, git credentials are needed.

Currently, they can be passed via an environment varaible (GIT_TOKEN) to docker and `scripts/setup-git-credentials` will put it in the right place.

Or, if the user is running the node service, Claude will call to bash and use the host's `.git-credentials`.


If there isn't a proper `.git-credentials` file (or SSH files), I'd like I'd like to show that as a missing connection that needs to be authorized in "Your Connections" on the homepage.  If someone clicks the "authorize" button, it will prompt the user for a git token.

If they provide a token, a service will save `git-credentials` similar to how `scripts/setup-git-credentials` does.  Then the connection will show "connected".


## Implementation

I'd like an additional prompts property `connections` to specify a prompt's claude code's environment needs.

For example the clone-github-repository prompt might have a git-credentials connection dependency listed as follows

```
{
    "name": "clone-github-repository",
    "connections": {"claude_code": ["git-credentials"]},
    ...
}
```


We need some sort of code construction to manage these extra connection needs.

There's already some work that was previously done around this ( `credentialValidators` ). I don't think this code is being used anymore, but might be reincorporated for this need. 

