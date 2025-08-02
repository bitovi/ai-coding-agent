// Test parameter generation for create-jira-issue prompt
const fs = require('fs');

// Load the prompts
const prompts = JSON.parse(fs.readFileSync('./examples/prompts.json', 'utf8'));
const createJiraPrompt = prompts.find(p => p.name === 'create-jira-issue');

console.log('Prompt:', JSON.stringify(createJiraPrompt, null, 2));

// Simulate parameter generation logic from WebUIService.js
const exampleParams = {};
const promptParameters = createJiraPrompt.messages.filter(msg => msg.parameters);

promptParameters.forEach(paramInfo => {
  if (paramInfo.parameters.properties) {
    Object.entries(paramInfo.parameters.properties).forEach(([name, prop]) => {
      console.log(`Processing parameter: ${name}`, prop);
      if (prop.default !== undefined) {
        console.log(`Using default value for ${name}: ${prop.default}`);
        exampleParams[name] = prop.default;
      } else if (prop.type === 'string') {
        const value = prop.description ? `Example ${prop.description.toLowerCase()}` : `example ${name}`;
        console.log(`Using generated value for ${name}: ${value}`);
        exampleParams[name] = value;
      } else if (prop.type === 'number') {
        exampleParams[name] = 42;
      } else if (prop.type === 'boolean') {
        exampleParams[name] = true;
      } else {
        exampleParams[name] = `example ${name}`;
      }
    });
  }
});

console.log('Generated example parameters:', exampleParams);

// Test prompt processing
const { mergeParametersWithDefaults, processPrompt } = require('../public/js/prompt-utils.js');

const mergedParams = mergeParametersWithDefaults(createJiraPrompt, exampleParams);
console.log('Merged parameters:', mergedParams);

const processedPrompt = processPrompt(createJiraPrompt, mergedParams);
console.log('Processed prompt messages:', JSON.stringify(processedPrompt, null, 2));
