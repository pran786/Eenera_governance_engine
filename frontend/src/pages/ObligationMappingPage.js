import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Scale, Loader2, ChevronRight, FileText } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_STYLES = {
  MET: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
  NOT_MET: 'bg-red-50 text-red-700 border-red-200',
  UNKNOWN: 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_DOTS = {
  MET: 'bg-emerald-500',
  PARTIAL: 'bg-amber-500',
  NOT_MET: 'bg-red-500',
  UNKNOWN: 'bg-slate-400',
};

export default function ObligationMappingPage() {
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [controlAssessments, setControlAssessments] = useState([]);
  const [themes, setThemes] = useState([]);
  const [selectedTheme, setSelectedTheme] = useState('all');
  const [selectedControl, setSelectedControl] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [overrideStatus, setOverrideStatus] = useState('');
  const [overrideRationale, setOverrideRationale] = useState('');
  const [overrideConfidence, setOverrideConfidence] = useState('1.0');
  const [saving, setSaving] = useState(false);

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
        await loadControls(latest.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadControls = async (assessmentId) => {
    try {
      const res = await api.get(`/control-assessments/assessment/${assessmentId}`);
      setControlAssessments(res.data);
      const uniqueThemes = [...new Set(res.data.map(c => c.theme).filter(Boolean))];
      setThemes(uniqueThemes);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredControls = selectedTheme === 'all'
    ? controlAssessments
    : controlAssessments.filter(c => c.theme === selectedTheme);

  const openDetail = (ctrl) => {
    setSelectedControl(ctrl);
    setOverrideStatus(ctrl.status);
    setOverrideRationale('');
    setOverrideConfidence(String(ctrl.confidence));
    setSheetOpen(true);
  };

  const handleOverride = async () => {
    if (!selectedControl) return;
    setSaving(true);
    try {
      await api.put(`/control-assessments/${selectedControl.id}`, {
        status: overrideStatus,
        confidence: parseFloat(overrideConfidence),
        rationale: overrideRationale || `Override to ${overrideStatus}`,
      });
      toast.success('Control assessment updated');
      await loadControls(selectedAssessmentId);
      setSheetOpen(false);
    } catch (e) {
      toast.error('Failed to update');
    } finally {
      setSaving(false);
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
    <div className="space-y-6" data-testid="obligations-page">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading text-[#0B1F3B] tracking-tight">Obligation Mapping</h1>
          <p className="text-sm text-slate-500 mt-1">Review and override control assessment statuses</p>
        </div>
        {assessments.length > 1 && (
          <Select value={selectedAssessmentId} onValueChange={(v) => { setSelectedAssessmentId(v); loadControls(v); }}>
            <SelectTrigger className="w-48" data-testid="assessment-selector">
              <SelectValue placeholder="Select assessment" />
            </SelectTrigger>
            <SelectContent>
              {assessments.filter(a => a.status === 'completed').map(a => (
                <SelectItem key={a.id} value={a.id}>Assessment {a.created_at?.slice(0, 10)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex gap-6">
        {/* Theme Sidebar */}
        <Card className="w-56 flex-shrink-0 border-slate-200 shadow-sm self-start sticky top-0">
          <CardHeader className="pb-2 border-b border-slate-100 py-3 px-4">
            <CardTitle className="text-xs font-heading text-slate-500 uppercase tracking-wider">Themes</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            <button
              onClick={() => setSelectedTheme('all')}
              data-testid="theme-all"
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                selectedTheme === 'all' ? 'bg-[#1E4FFF]/10 text-[#1E4FFF] font-semibold' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              All Controls ({controlAssessments.length})
            </button>
            {themes.map((t) => {
              const count = controlAssessments.filter(c => c.theme === t).length;
              return (
                <button
                  key={t}
                  onClick={() => setSelectedTheme(t)}
                  data-testid={`theme-btn-${t.toLowerCase().replace(/\s+/g, '-')}`}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedTheme === t ? 'bg-[#1E4FFF]/10 text-[#1E4FFF] font-semibold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t} ({count})
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Controls Table */}
        <Card className="flex-1 border-slate-200 shadow-sm">
          <CardHeader className="pb-2 border-b border-slate-100">
            <CardTitle className="text-sm font-heading text-slate-500 uppercase tracking-wider">
              {selectedTheme === 'all' ? 'All Controls' : selectedTheme} — {filteredControls.length} controls
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredControls.length === 0 ? (
              <div className="py-16 text-center">
                <Scale className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-400">No controls found. Generate an assessment first.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 w-24">Control</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Statement</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 w-28">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 w-24">Confidence</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredControls.map((ctrl, i) => (
                    <TableRow
                      key={ctrl.id}
                      className="cursor-pointer hover:bg-slate-50/50 transition-colors"
                      onClick={() => openDetail(ctrl)}
                      data-testid={`control-row-${ctrl.control_ref}`}
                    >
                      <TableCell className="px-4 font-mono text-xs text-slate-700">{ctrl.control_ref}</TableCell>
                      <TableCell className="px-4 text-sm text-slate-700">{ctrl.statement?.slice(0, 80)}{ctrl.statement?.length > 80 ? '...' : ''}</TableCell>
                      <TableCell className="px-4">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${STATUS_DOTS[ctrl.status]}`} />
                          <Badge className={`${STATUS_STYLES[ctrl.status]} text-xs`}>{ctrl.status}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 font-mono text-xs text-slate-600">{ctrl.confidence?.toFixed(2)}</TableCell>
                      <TableCell className="px-4">
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Control Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[450px] sm:max-w-[450px]" data-testid="control-detail-sheet">
          <SheetHeader>
            <SheetTitle className="font-heading">{selectedControl?.control_ref}</SheetTitle>
            <SheetDescription>Control Assessment Detail</SheetDescription>
          </SheetHeader>
          {selectedControl && (
            <ScrollArea className="h-[calc(100vh-120px)] mt-4">
              <div className="space-y-6 pr-4">
                <div>
                  <Label className="text-xs text-slate-500 uppercase tracking-wider">Statement</Label>
                  <p className="text-sm text-[#0B1F3B] mt-1">{selectedControl.statement}</p>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-slate-500 uppercase tracking-wider">Current Status</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOTS[selectedControl.status]}`} />
                    <Badge className={`${STATUS_STYLES[selectedControl.status]}`}>{selectedControl.status}</Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 uppercase tracking-wider">Rationale</Label>
                  <p className="text-sm text-slate-600 mt-1 bg-slate-50 rounded-md p-3">{selectedControl.rationale || 'No rationale provided'}</p>
                </div>
                <Separator />
                <div>
                  <Label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">Manual Override</Label>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs mb-1 block">Status</Label>
                      <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                        <SelectTrigger data-testid="override-status-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MET">MET</SelectItem>
                          <SelectItem value="PARTIAL">PARTIAL</SelectItem>
                          <SelectItem value="NOT_MET">NOT_MET</SelectItem>
                          <SelectItem value="UNKNOWN">UNKNOWN</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Confidence (0-1)</Label>
                      <Select value={overrideConfidence} onValueChange={setOverrideConfidence}>
                        <SelectTrigger data-testid="override-confidence-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1.0">1.0 - Certain</SelectItem>
                          <SelectItem value="0.8">0.8 - High</SelectItem>
                          <SelectItem value="0.6">0.6 - Medium</SelectItem>
                          <SelectItem value="0.4">0.4 - Low</SelectItem>
                          <SelectItem value="0.2">0.2 - Very Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Rationale</Label>
                      <Textarea
                        data-testid="override-rationale-input"
                        value={overrideRationale}
                        onChange={(e) => setOverrideRationale(e.target.value)}
                        placeholder="Reason for override..."
                        className="text-sm"
                      />
                    </div>
                    <Button
                      onClick={handleOverride}
                      disabled={saving}
                      className="w-full bg-[#0B1F3B] hover:bg-[#162B4D] text-white"
                      data-testid="save-override-btn"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      Save Override
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
