import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { AlertCircle, FileText, Download, Upload, Plus, Loader2, Building2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const BAND_COLORS = { Green: '#10B981', Amber: '#F59E0B', Red: '#EF4444' };
const STATUS_COLORS = { met: '#10B981', partial: '#F59E0B', not_met: '#EF4444', unknown: '#94A3B8' };

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState('');
  const [assessments, setAssessments] = useState([]);
  const [currentAssessment, setCurrentAssessment] = useState(null);
  const [score, setScore] = useState(null);
  const [gaps, setGaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showOrgDialog, setShowOrgDialog] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [frameworks, setFrameworks] = useState([]);
  const [versions, setVersions] = useState([]);
  const [seeding, setSeeding] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [orgRes, fwRes] = await Promise.all([
        api.get('/organisations'),
        api.get('/frameworks'),
      ]);
      setOrgs(orgRes.data);
      setFrameworks(fwRes.data);
      if (orgRes.data.length > 0) {
        const orgId = orgRes.data[0].id;
        setSelectedOrg(orgId);
        await loadOrgAssessments(orgId);
      }
      if (fwRes.data.length > 0) {
        const verRes = await api.get(`/frameworks/${fwRes.data[0].id}/versions`);
        setVersions(verRes.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadOrgAssessments = async (orgId) => {
    try {
      const res = await api.get('/assessments', { params: { org_id: orgId } });
      setAssessments(res.data);
      if (res.data.length > 0) {
        const latest = res.data[res.data.length - 1];
        const fullRes = await api.get(`/assessments/${latest.id}`);
        setCurrentAssessment(fullRes.data);
        setScore(fullRes.data.score);
        setGaps(fullRes.data.gaps || []);
      } else {
        setCurrentAssessment(null);
        setScore(null);
        setGaps([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => { loadData(); }, [loadData]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await api.post('/seed');
      toast.success(res.data.message);
      await loadData();
    } catch (e) {
      toast.error('Failed to seed data');
    } finally {
      setSeeding(false);
    }
  };

  const handleCreateOrg = async () => {
    if (!newOrgName.trim()) return;
    try {
      const res = await api.post('/organisations', { name: newOrgName });
      setOrgs([...orgs, res.data]);
      setSelectedOrg(res.data.id);
      setShowOrgDialog(false);
      setNewOrgName('');
      toast.success('Organisation created');
    } catch (e) {
      toast.error('Failed to create organisation');
    }
  };

  const handleUploadSample = async () => {
    if (!selectedOrg) {
      toast.error('Select or create an organisation first');
      return;
    }
    try {
      const res = await api.post(`/documents/upload?org_id=${selectedOrg}&use_sample=true`);
      toast.success(`Uploaded: ${res.data.filename} (${res.data.chunks} chunks)`);
    } catch (e) {
      toast.error('Upload failed');
    }
  };

  const handleCreateAssessment = async () => {
    if (!selectedOrg || versions.length === 0) {
      toast.error('Need an organisation and framework version');
      return;
    }
    try {
      const res = await api.post('/assessments', {
        org_id: selectedOrg,
        framework_version_id: versions[0].id,
      });
      toast.success('Assessment created');
      setGenerating(true);
      const genRes = await api.post(`/assessments/${res.data.id}/generate`);
      toast.success(genRes.data.message);
      await loadOrgAssessments(selectedOrg);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleExport = async () => {
    if (!currentAssessment) return;
    try {
      const token = localStorage.getItem('eenera_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/reports/${currentAssessment.id}/pdf`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('PDF generation failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eenera-report-${currentAssessment.id.slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error('Failed to download PDF');
    }
  };

  const scoreData = score ? [
    { name: 'Score', value: score.overall },
    { name: 'Remaining', value: 100 - score.overall },
  ] : [];

  const bandColor = score ? BAND_COLORS[score.band] || '#94A3B8' : '#94A3B8';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="dashboard-loading">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading text-[#0B1F3B] tracking-tight" data-testid="dashboard-title">
            Governance Overview
          </h1>
          <p className="text-sm text-slate-500 mt-1">UK ICO / GDPR Compliance Assessment</p>
        </div>
        <div className="flex items-center gap-3">
          {frameworks.length === 0 && (
            <Button onClick={handleSeed} disabled={seeding} variant="outline" data-testid="seed-btn" className="text-sm">
              {seeding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Seed ICO/GDPR Data
            </Button>
          )}
          <Button onClick={() => setShowOrgDialog(true)} variant="outline" data-testid="create-org-btn" className="text-sm">
            <Plus className="w-4 h-4 mr-2" />
            New Organisation
          </Button>
        </div>
      </div>

      {/* Org Selector + Quick Actions */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <Select value={selectedOrg} onValueChange={(v) => { setSelectedOrg(v); loadOrgAssessments(v); }}>
              <SelectTrigger className="w-56" data-testid="org-selector">
                <SelectValue placeholder="Select organisation" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator orientation="vertical" className="h-8" />
          <Button onClick={handleUploadSample} variant="outline" size="sm" data-testid="upload-sample-btn">
            <Upload className="w-4 h-4 mr-2" />
            Upload Sample Policy
          </Button>
          <Button onClick={handleCreateAssessment} disabled={generating} size="sm" className="bg-[#0B1F3B] hover:bg-[#162B4D] text-white" data-testid="generate-assessment-btn">
            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
            Generate Assessment
          </Button>
          {currentAssessment && (
            <Button onClick={handleExport} variant="outline" size="sm" data-testid="export-btn">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Score + Stats */}
      {score ? (
        <div className="grid grid-cols-12 gap-6">
          {/* Score Circle */}
          <Card className="col-span-12 lg:col-span-5 border-slate-200 shadow-sm">
            <CardHeader className="pb-2 border-b border-slate-100">
              <CardTitle className="text-sm font-heading text-slate-500 uppercase tracking-wider">Compliance Score</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 flex flex-col items-center">
              <div className="relative w-48 h-48" data-testid="score-circle">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={scoreData} innerRadius={60} outerRadius={80} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                      <Cell fill={bandColor} />
                      <Cell fill="#E2E8F0" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold font-heading" style={{ color: bandColor }} data-testid="score-value">
                    {score.overall}%
                  </span>
                  <span className="text-xs font-medium text-slate-500 uppercase">{score.band}</span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-6 text-sm">
                <div className="text-center">
                  <div className="text-lg font-semibold text-[#0B1F3B]" data-testid="coverage-value">{score.coverage}%</div>
                  <div className="text-xs text-slate-500">Coverage</div>
                </div>
                <Separator orientation="vertical" className="h-8" />
                <div className="text-center">
                  <div className="text-lg font-semibold text-[#0B1F3B]">{score.total_controls}</div>
                  <div className="text-xs text-slate-500">Controls</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status Breakdown */}
          <div className="col-span-12 lg:col-span-7 space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-sm font-heading text-slate-500 uppercase tracking-wider">Control Status</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { key: 'met', label: 'Met', color: STATUS_COLORS.met },
                    { key: 'partial', label: 'Partial', color: STATUS_COLORS.partial },
                    { key: 'not_met', label: 'Not Met', color: STATUS_COLORS.not_met },
                    { key: 'unknown', label: 'Unknown', color: STATUS_COLORS.unknown },
                  ].map((s) => (
                    <div key={s.key} className="text-center p-3 bg-slate-50 rounded-md" data-testid={`status-${s.key}`}>
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                        <span className="text-xs font-medium text-slate-500">{s.label}</span>
                      </div>
                      <div className="text-2xl font-bold text-[#0B1F3B]">{score.status_counts?.[s.key] || 0}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Theme Breakdown */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 border-b border-slate-100">
                <CardTitle className="text-sm font-heading text-slate-500 uppercase tracking-wider">Theme Scores</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {Object.entries(score.themes || {}).map(([theme, data]) => (
                  <div key={theme} className="flex items-center justify-between" data-testid={`theme-${theme.toLowerCase().replace(/\s+/g,'-')}`}>
                    <span className="text-sm font-medium text-[#0B1F3B]">{theme}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${data.score}%`, backgroundColor: BAND_COLORS[data.band] }} />
                      </div>
                      <span className="text-sm font-mono font-medium w-10 text-right" style={{ color: BAND_COLORS[data.band] }}>
                        {data.score}%
                      </span>
                      <Badge className={`text-xs ${data.band === 'Green' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : data.band === 'Amber' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        {data.band}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Critical Gaps */}
          <Card className="col-span-12 border-slate-200 shadow-sm">
            <CardHeader className="pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-heading text-slate-500 uppercase tracking-wider">Critical Gaps</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/gaps-tasks')} data-testid="view-all-gaps-btn">
                View All
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              {gaps.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">No gaps identified yet</p>
              ) : (
                <div className="space-y-2">
                  {gaps.filter(g => g.severity === 'high').slice(0, 5).map((gap, i) => (
                    <div key={gap.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-md animate-fade-in-up" style={{ animationDelay: `${i * 0.05}s` }} data-testid={`gap-item-${i}`}>
                      <div className="flex items-center gap-3">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-[#0B1F3B]">{gap.control_ref || gap.control_id}</div>
                          <div className="text-xs text-slate-500">{gap.description?.slice(0, 80)}</div>
                        </div>
                      </div>
                      <Badge className="bg-red-50 text-red-700 border-red-200 text-xs">High</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold text-[#0B1F3B] mb-2">No Assessment Yet</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
              Create an organisation, upload a privacy policy, then generate an assessment to see your compliance score.
            </p>
            <div className="flex items-center justify-center gap-3">
              {frameworks.length === 0 && (
                <Button onClick={handleSeed} disabled={seeding} variant="outline" data-testid="seed-btn-empty">
                  {seeding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  1. Seed Framework
                </Button>
              )}
              <Button onClick={() => setShowOrgDialog(true)} variant="outline" data-testid="create-org-btn-empty">
                {frameworks.length === 0 ? '2.' : '1.'} Create Organisation
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Org Dialog */}
      <Dialog open={showOrgDialog} onOpenChange={setShowOrgDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organisation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Organisation Name</Label>
              <Input
                data-testid="org-name-input"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOrgDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateOrg} className="bg-[#0B1F3B] hover:bg-[#162B4D] text-white" data-testid="confirm-create-org-btn">
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
