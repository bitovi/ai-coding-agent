



## Tools being used

We should output that some tool use is being used.  For example `mcp__jira__getAccessibleAtlassianResources` is being called.

```
{
  "type": "assistant",
  "message": {
    "id": "msg_01DNtjmDRQ9z631kJTQ6Vxkf",
    "type": "message",
    "role": "assistant",
    "model": "claude-sonnet-4-20250514",
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_015KkkHiz13QsG5fVczmsc4M",
        "name": "mcp__jira__getAccessibleAtlassianResources",
        "input": {}
      }
    ],
    "stop_reason": null,
    "stop_sequence": null,
    "usage": {
      "input_tokens": 4,
      "cache_creation_input_tokens": 21386,
      "cache_read_input_tokens": 0,
      "output_tokens": 86,
      "service_tier": "standard"
    }
  },
  "parent_tool_use_id": null,
  "session_id": "0ce8853f-aabe-488c-bbc2-a05f10b1cdc3"
}
```

The following has a tool with input's (arguments):

```
{
  "type": "assistant",
  "message": {
    "id": "msg_0154BpvVDUu5S2WFR3TXUHwa",
    "type": "message",
    "role": "assistant",
    "model": "claude-sonnet-4-20250514",
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_01HjxGPdkuSjRioaCW3t65iA",
        "name": "mcp__jira__createJiraIssue",
        "input": {
          "cloudId": "74eb923a-a968-44b2-8b4c-5b69e7266b8c",
          "projectKey": "Order",
          "issueTypeName": "Task",
          "summary": "Example brief summary of the issue",
          "description": "Example detailed description of the issue"
        }
      }
    ],
    "stop_reason": null,
    "stop_sequence": null,
    "usage": {
      "input_tokens": 7,
      "cache_creation_input_tokens": 202,
      "cache_read_input_tokens": 21386,
      "output_tokens": 192,
      "service_tier": "standard"
    }
  },
  "parent_tool_use_id": null,
  "session_id": "0ce8853f-aabe-488c-bbc2-a05f10b1cdc3"
}
```

Another example:

```
{
  "type": "assistant",
  "message": {
    "id": "msg_01FGGad4y3Sez9LaQJYbnpcS",
    "type": "message",
    "role": "assistant",
    "model": "claude-sonnet-4-20250514",
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_01KGYmSQRLLpa6aYSJk4c2Fc",
        "name": "mcp__jira__getVisibleJiraProjects",
        "input": {
          "cloudId": "74eb923a-a968-44b2-8b4c-5b69e7266b8c",
          "action": "create"
        }
      }
    ],
    "stop_reason": null,
    "stop_sequence": null,
    "usage": {
      "input_tokens": 8,
      "cache_creation_input_tokens": 248,
      "cache_read_input_tokens": 21588,
      "output_tokens": 129,
      "service_tier": "standard"
    }
  },
  "parent_tool_use_id": null,
  "session_id": "0ce8853f-aabe-488c-bbc2-a05f10b1cdc3"
}
```





## Result of a tool call

We should provide the result of a tool call. If JSON, we should output the JSON.

```
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "tool_use_id": "toolu_015KkkHiz13QsG5fVczmsc4M",
        "type": "tool_result",
        "content": [
          {
            "type": "text",
            "text": "[{\"id\":\"74eb923a-a968-44b2-8b4c-5b69e7266b8c\",\"url\":\"https://bitovi-training.atlassian.net\",\"name\":\"bitovi-training\",\"scopes\":[\"read:jira-work\",\"write:jira-work\"],\"avatarUrl\":\"https://site-admin-avatar-cdn.prod.public.atl-paas.net/avatars/240/compass.png\"}]"
          }
        ]
      }
    ]
  },
  "parent_tool_use_id": null,
  "session_id": "0ce8853f-aabe-488c-bbc2-a05f10b1cdc3"
}
```

Another example:

```
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "tool_use_id": "toolu_01K5spJQtNBx5xnqY3pu246c",
        "type": "tool_result",
        "content": [
          {
            "type": "text",
            "text": "{\"id\":\"12643\",\"key\":\"ORDER-76\",\"self\":\"https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/3/issue/12643\"}"
          }
        ]
      }
    ]
  },
  "parent_tool_use_id": null,
  "session_id": "0ce8853f-aabe-488c-bbc2-a05f10b1cdc3"
}
```


Here's an error result:

```
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "content": "{\"error\":true,\"message\":\"Failed to create issue: Bad Request. {\\\"errorMessages\\\":[],\\\"errors\\\":{\\\"project\\\":\\\"valid project is required\\\"}}\"}",
        "is_error": true,
        "tool_use_id": "toolu_01HjxGPdkuSjRioaCW3t65iA"
      }
    ]
  },
  "parent_tool_use_id": null,
  "session_id": "0ce8853f-aabe-488c-bbc2-a05f10b1cdc3"
}
```

Another error example:

```
{
  "type": "user",
  "message": {
    "role": "user",
    "content": [
      {
        "type": "tool_result",
        "content": "MCP tool \"getVisibleJiraProjects\" response (50635 tokens) exceeds maximum allowed tokens (25000). Please use pagination, filtering, or limit parameters to reduce the response size.",
        "is_error": true,
        "tool_use_id": "toolu_01KGYmSQRLLpa6aYSJk4c2Fc"
      }
    ]
  },
  "parent_tool_use_id": null,
  "session_id": "0ce8853f-aabe-488c-bbc2-a05f10b1cdc3"
}
```