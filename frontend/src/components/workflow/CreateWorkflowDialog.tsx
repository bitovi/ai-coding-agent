import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, X, ArrowDown } from 'lucide-react';

interface CreateWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateWorkflowDialog({ open, onOpenChange }: CreateWorkflowDialogProps) {
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [steps, setSteps] = useState<string[]>(['']);
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);

  const availableConnections = ['jira', 'figma', 'github', 'git-credentials'];

  const addStep = () => {
    setSteps([...steps, '']);
  };

  const removeStep = (index: number) => {
    if (steps.length > 1) {
      setSteps(steps.filter((_, i) => i !== index));
    }
  };

  const updateStep = (index: number, value: string) => {
    const newSteps = [...steps];
    newSteps[index] = value;
    setSteps(newSteps);
  };

  const toggleConnection = (connection: string) => {
    if (selectedConnections.includes(connection)) {
      setSelectedConnections(selectedConnections.filter(c => c !== connection));
    } else {
      setSelectedConnections([...selectedConnections, connection]);
    }
  };

  const handleSave = () => {
    // In real implementation, this would save to API
    console.log('Creating workflow:', {
      name: workflowName,
      description: workflowDescription,
      steps: steps.filter(step => step.trim() !== ''),
      connections: selectedConnections
    });
    
    // Reset form
    setWorkflowName('');
    setWorkflowDescription('');
    setSteps(['']);
    setSelectedConnections([]);
    onOpenChange(false);
  };

  const isValid = workflowName.trim() !== '' && 
                  workflowDescription.trim() !== '' && 
                  steps.some(step => step.trim() !== '') &&
                  selectedConnections.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Workflow</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="workflow-name">Workflow Name</Label>
              <Input
                id="workflow-name"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                placeholder="e.g., Feature Development Workflow"
              />
            </div>
            
            <div>
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                value={workflowDescription}
                onChange={(e) => setWorkflowDescription(e.target.value)}
                placeholder="Describe what this workflow does..."
                rows={3}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Workflow Steps</Label>
              <Button size="sm" variant="outline" onClick={addStep}>
                <Plus className="h-3 w-3 mr-1" />
                Add Step
              </Button>
            </div>
            
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs flex items-center justify-center font-medium">
                      {index + 1}
                    </div>
                    <Input
                      value={step}
                      onChange={(e) => updateStep(index, e.target.value)}
                      placeholder={`Step ${index + 1} description...`}
                      className="flex-1"
                    />
                    {steps.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeStep(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="flex justify-center">
                      <ArrowDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Connections */}
          <div className="space-y-4">
            <Label>Required Connections</Label>
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3">
                  {availableConnections.map((connection) => (
                    <div
                      key={connection}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedConnections.includes(connection)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleConnection(connection)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{connection}</span>
                        {selectedConnections.includes(connection) && (
                          <Badge variant="secondary" className="bg-blue-500 text-white">
                            Selected
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  Select the services this workflow will need to connect to
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!isValid}>
              Create Workflow
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}