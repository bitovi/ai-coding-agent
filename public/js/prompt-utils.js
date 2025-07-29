/**
 * Shared utilities for prompt processing
 * Used by both frontend and backend
 */

/**
 * Merge request parameters with default values from prompt schema
 */
export function mergeParametersWithDefaults(prompt, requestParameters = {}) {
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

/**
 * Process prompt messages for parameter substitution
 */
export function processPrompt(prompt, parameters) {
  const processedMessages = prompt.messages.map(message => {
    if (message.parameters) {
      // Substitute parameters in content
      let content = message.content;
      
      // Simple parameter substitution
      for (const [key, value] of Object.entries(parameters)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        content = content.replace(regex, String(value));
      }
      
      return {
        role: message.role,
        content: content
      };
    }
    
    return {
      role: message.role,
      content: message.content
    };
  });

  return { ...prompt, messages: processedMessages };
}

/**
 * Get all missing required parameters for a prompt
 */
export function getMissingRequiredParameters(prompt, parameters = {}) {
  const missing = [];
  
  prompt.messages.forEach(message => {
    if (message.parameters && message.parameters.required) {
      message.parameters.required.forEach(paramName => {
        if (parameters[paramName] === undefined || parameters[paramName] === '') {
          missing.push(paramName);
        }
      });
    }
  });
  
  return missing;
}

/**
 * Validate parameters against prompt schema
 */
export function validateParameters(prompt, parameters = {}) {
  const errors = [];
  
  prompt.messages.forEach((message, messageIndex) => {
    if (message.parameters && message.parameters.properties) {
      Object.entries(parameters).forEach(([paramName, paramValue]) => {
        const paramSchema = message.parameters.properties[paramName];
        
        if (paramSchema) {
          // Type validation
          if (paramSchema.type === 'number' && typeof paramValue !== 'number') {
            if (isNaN(Number(paramValue))) {
              errors.push(`Parameter '${paramName}' must be a number`);
            }
          } else if (paramSchema.type === 'boolean' && typeof paramValue !== 'boolean') {
            if (paramValue !== 'true' && paramValue !== 'false') {
              errors.push(`Parameter '${paramName}' must be a boolean`);
            }
          } else if (paramSchema.type === 'string' && typeof paramValue !== 'string') {
            errors.push(`Parameter '${paramName}' must be a string`);
          }
        }
      });
    }
  });
  
  return errors;
}
