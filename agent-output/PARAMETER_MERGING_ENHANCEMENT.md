# Parameter Merging with Defaults Enhancement

## Overview
Enhanced the AI Coding Agent to properly merge request parameters with default values defined in prompt schemas. This ensures that default values are automatically applied when parameters are not explicitly provided in requests.

## Changes Made

### 1. Added Parameter Merging Logic (`index.js`)

Added the `mergeParametersWithDefaults()` method to the `AICodingAgent` class:

```javascript
/**
 * Merge request parameters with default values from prompt schema
 */
mergeParametersWithDefaults(prompt, requestParameters = {}) {
  const mergedParameters = { ...requestParameters };
  
  // Extract all parameter schemas from all messages
  prompt.messages.forEach(message => {
    if (message.parameters && message.parameters.properties) {
      Object.entries(message.parameters.properties).forEach(([paramName, paramSchema]) => {
        // If parameter not provided in request but has a default value, use the default
        if (mergedParameters[paramName] === undefined && paramSchema.default !== undefined) {
          mergedParameters[paramName] = paramSchema.default;
        }
      });
    }
  });
  
  return mergedParameters;
}
```

### 2. Updated Prompt Execution Endpoint

Modified the `/prompt/:promptName/run` endpoint to use parameter merging:

```javascript
// Before
const parameters = req.body.parameters || {};

// After
const requestParameters = req.body.parameters || {};
const parameters = this.mergeParametersWithDefaults(prompt, requestParameters);
```

### 3. Enhanced UI Indicators (`WebUIService.js`)

- Added 🔧 emoji indicator for parameters that have default values
- Updated form help text to explain that defaults will be automatically applied
- Improved parameter display to show which values have defaults

### 4. Created Comprehensive Tests

Added test scripts to verify the parameter merging functionality:
- `tests/test-parameter-merging.js` - Unit tests for the merging logic
- `tests/test-api-parameter-merging.js` - API integration test

## Benefits

1. **User Experience**: Users don't need to specify all parameters - defaults are applied automatically
2. **Consistency**: Ensures default values defined in prompts are actually used
3. **Backwards Compatibility**: Existing code continues to work unchanged
4. **Transparency**: UI clearly shows which parameters have defaults

## Examples

### Prompt with Defaults (create-jira-issue)
```json
{
  "issueType": {
    "type": "string",
    "description": "Type of issue (Task, Bug, Story, etc.)",
    "default": "Task"
  }
}
```

**Request without issueType:**
```json
{
  "parameters": {
    "summary": "Fix bug",
    "description": "Need to fix the login issue"
  }
}
```

**Merged parameters (what gets executed):**
```json
{
  "summary": "Fix bug",
  "description": "Need to fix the login issue",
  "issueType": "Task"  // <- Applied from default
}
```

### Override Behavior
If a user provides a value, it overrides the default:
```json
{
  "parameters": {
    "summary": "Fix bug",
    "description": "Need to fix the login issue",
    "issueType": "Bug"  // <- User override, default ignored
  }
}
```

## Test Results

All tests pass:
- ✅ Default values are applied when parameters are missing
- ✅ User-provided values override defaults
- ✅ Prompts without defaults work unchanged
- ✅ Multiple parameter defaults are handled correctly

## UI Improvements

The prompt activity page now shows:
- 🔧 indicator next to parameters with defaults
- Clear explanation of parameter substitution
- Notice that defaults will be automatically applied
- Default values displayed in parameter schema

This enhancement makes the AI Coding Agent more user-friendly and ensures prompt schemas are fully utilized.
