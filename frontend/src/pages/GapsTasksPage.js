import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, CheckSquare, Plus, Loader2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const SEV_STYLES = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-blue-50 text-blue-700 border-blue-200',
};

const TASK_STATUS_STYLES = {
  open: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

export default function GapsTasksPage() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [gaps, setGaps] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [selectedGap, setSelectedGap] = useState(null);
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [approvingId, setApprovingId] = useState(null);

  useEffect(() => {
    loadAssessments();
  }, []);

  const loadAssessments = async () => {
    try {
      const res = await api.get('/assessments');
      setAssessments(res.data);
      const completed = res.data.filter(a => a.status === 'completed');
      if (completed.length > 0) {
        const latest = completed[completed.length - 1];
        setSelectedAssessmentId(latest.id);
        await loadGapsAndTasks(latest.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadGapsAndTasks = async (assessmentId) => {
    try {
      const [gapRes, taskRes] = await Promise.all([
        api.get(`/gaps/assessment/${assessmentId}`),
        api.get(`/tasks/assessment/${assessmentId}`),
      ]);
      setGaps(gapRes.data);
      setTasks(taskRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateTask = async () => {
    if (!selectedGap || !taskDesc.trim()) return;
    setCreating(true);
    try {
      await api.post('/tasks', {
        gap_id: selectedGap.id,
        assessment_id: selectedAssessmentId,
        description: taskDesc,
        assigned_to: taskAssignee,
        due_date: taskDueDate,
      });
      toast.success('Task created');
      setShowTaskDialog(false);
      setTaskDesc('');
      setTaskAssignee('');
      setTaskDueDate('');
      await loadGapsAndTasks(selectedAssessmentId);
    } catch (e) {
      toast.error('Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const handleApprove = async (taskId, action) => {
    setApprovingId(taskId);
    try {
      await api.post('/approvals', { task_id: taskId, action });
      toast.success(`Task ${action}`);
      await loadGapsAndTasks(selectedAssessmentId);
    } catch (e) {
      toast.error('Failed');
    } finally {
      setApprovingId(null);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      await api.put(`/tasks/${taskId}`, { status: 'completed' });
      toast.success('Task marked complete');
      await loadGapsAndTasks(selectedAssessmentId);
    } catch (e) {
      toast.error('Failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="gaps-tasks-page">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading text-[#0B1F3B] tracking-tight">Gaps & Tasks</h1>
          <p className="text-sm text-slate-500 mt-1">Manage compliance gaps and remediation tasks</p>
        </div>
      </div>

      <Tabs defaultValue="gaps" className="space-y-4">
        <TabsList>
          <TabsTrigger value="gaps" data-testid="tab-gaps">
            <AlertCircle className="w-4 h-4 mr-2" />
            Gaps ({gaps.length})
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <CheckSquare className="w-4 h-4 mr-2" />
            Tasks ({tasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gaps">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 border-b border-slate-100">
              <CardTitle className="text-sm font-heading text-slate-500 uppercase tracking-wider">Identified Gaps</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {gaps.length === 0 ? (
                <div className="py-16 text-center">
                  <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">No gaps found. Generate an assessment first.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Control</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Obligation</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Severity</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Description</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gaps.map((gap, i) => (
                      <TableRow key={gap.id} data-testid={`gap-row-${i}`}>
                        <TableCell className="px-4 font-mono text-xs">{gap.control_ref || '-'}</TableCell>
                        <TableCell className="px-4 text-sm">{gap.obligation_title || '-'}</TableCell>
                        <TableCell className="px-4">
                          <Badge className={`text-xs ${SEV_STYLES[gap.severity] || SEV_STYLES.medium}`}>
                            {gap.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 text-sm text-slate-600 max-w-xs truncate">{gap.description}</TableCell>
                        <TableCell className="px-4">
                          <Badge className="bg-slate-100 text-slate-600 border-slate-200 text-xs">{gap.status}</Badge>
                        </TableCell>
                        <TableCell className="px-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setSelectedGap(gap); setShowTaskDialog(true); setTaskDesc(gap.recommended_action || `Address: ${gap.description?.slice(0, 50)}`); }}
                            data-testid={`create-task-btn-${i}`}
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Task
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 border-b border-slate-100">
              <CardTitle className="text-sm font-heading text-slate-500 uppercase tracking-wider">Remediation Tasks</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {tasks.length === 0 ? (
                <div className="py-16 text-center">
                  <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">No tasks yet. Create tasks from gaps above.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Description</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 w-32">Assigned To</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 w-28">Due Date</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 w-28">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 w-48">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task, i) => (
                      <TableRow key={task.id} data-testid={`task-row-${i}`}>
                        <TableCell className="px-4 text-sm">{task.description}</TableCell>
                        <TableCell className="px-4 text-sm text-slate-600">{task.assigned_to || '-'}</TableCell>
                        <TableCell className="px-4 text-sm text-slate-600">{task.due_date || '-'}</TableCell>
                        <TableCell className="px-4">
                          <Badge className={`text-xs ${TASK_STATUS_STYLES[task.status] || TASK_STATUS_STYLES.open}`}>
                            {task.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4">
                          <div className="flex items-center gap-2">
                            {task.status === 'open' && (
                              <Button size="sm" variant="outline" onClick={() => handleCompleteTask(task.id)} data-testid={`complete-task-btn-${i}`}>
                                <Check className="w-3.5 h-3.5 mr-1" />
                                Complete
                              </Button>
                            )}
                            {(task.status === 'completed' || task.status === 'open') && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                  onClick={() => handleApprove(task.id, 'approved')}
                                  disabled={approvingId === task.id}
                                  data-testid={`approve-task-btn-${i}`}
                                >
                                  {approvingId === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                  onClick={() => handleApprove(task.id, 'rejected')}
                                  disabled={approvingId === task.id}
                                  data-testid={`reject-task-btn-${i}`}
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Task Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent data-testid="create-task-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Create Remediation Task</DialogTitle>
          </DialogHeader>
          {selectedGap && (
            <div className="text-xs text-slate-500 bg-slate-50 rounded-md p-3 mb-2">
              Gap: {selectedGap.control_ref} — {selectedGap.severity} severity
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                data-testid="task-description-input"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Describe the remediation action..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assigned To</Label>
                <Input
                  data-testid="task-assignee-input"
                  value={taskAssignee}
                  onChange={(e) => setTaskAssignee(e.target.value)}
                  placeholder="e.g. DPO"
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  data-testid="task-due-date-input"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskDialog(false)}>Cancel</Button>
            <Button
              onClick={handleCreateTask}
              disabled={creating}
              className="bg-[#0B1F3B] hover:bg-[#162B4D] text-white"
              data-testid="confirm-create-task-btn"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
