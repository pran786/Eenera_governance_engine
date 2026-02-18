import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, FileText, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';

const BAND_COLORS = { Green: '#10B981', Amber: '#F59E0B', Red: '#EF4444' };
const STATUS_STYLES = {
  MET: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
  NOT_MET: 'bg-red-50 text-red-700 border-red-200',
  UNKNOWN: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function EvidencePackPage() {
  const [assessments, setAssessments] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

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
        setSelectedId(latest.id);
        await loadReport(latest.id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async (id) => {
    try {
      const res = await api.get(`/reports/${id}/preview`);
      setReport(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownload = async () => {
    if (!selectedId) return;
    setDownloading(true);
    try {
      const token = localStorage.getItem('eenera_token');
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/reports/${selectedId}/pdf`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('PDF generation failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eenera-report-${selectedId.slice(0, 8)}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error('Failed to download PDF');
    } finally {
      setDownloading(false);
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
    <div className="space-y-6" data-testid="evidence-pack-page">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading text-[#0B1F3B] tracking-tight">Evidence Pack</h1>
          <p className="text-sm text-slate-500 mt-1">Review and export governance assessment report</p>
        </div>
        <div className="flex items-center gap-3">
          {assessments.filter(a => a.status === 'completed').length > 1 && (
            <Select value={selectedId} onValueChange={(v) => { setSelectedId(v); loadReport(v); }}>
              <SelectTrigger className="w-56" data-testid="report-assessment-selector">
                <SelectValue placeholder="Select assessment" />
              </SelectTrigger>
              <SelectContent>
                {assessments.filter(a => a.status === 'completed').map(a => (
                  <SelectItem key={a.id} value={a.id}>Assessment {a.created_at?.slice(0, 10)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            onClick={handleDownload}
            disabled={downloading || !report}
            className="bg-[#0B1F3B] hover:bg-[#162B4D] text-white"
            data-testid="download-pdf-btn"
          >
            {downloading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
            Download PDF
          </Button>
        </div>
      </div>

      {!report ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="font-heading text-lg font-semibold text-[#0B1F3B] mb-2">No Report Available</h3>
            <p className="text-sm text-slate-500">Complete an assessment to generate the evidence pack.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-200 shadow-sm max-w-4xl mx-auto" data-testid="report-preview">
          <CardContent className="p-8">
            {/* Report Header */}
            <div className="text-center mb-8 pb-6 border-b-2 border-[#1E4FFF]">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Shield className="w-6 h-6 text-[#1E4FFF]" />
                <span className="font-heading text-xl font-bold text-[#0B1F3B]">EENERA</span>
              </div>
              <h2 className="font-heading text-2xl font-bold text-[#0B1F3B] mb-2">Governance Assessment Report</h2>
              <div className="text-sm text-slate-500 space-y-1">
                <p>Organisation: <span className="font-medium text-[#0B1F3B]">{report.organisation?.name}</span></p>
                <p>Framework: <span className="font-medium text-[#0B1F3B]">{report.framework?.name} v{report.framework_version?.version}</span></p>
                <p>Date: {report.date?.slice(0, 10)} | ID: {report.assessment_id?.slice(0, 12)}</p>
              </div>
            </div>

            {/* Executive Summary */}
            <section className="mb-8">
              <h3 className="font-heading text-lg font-semibold text-[#0B1F3B] mb-4 pb-2 border-b border-slate-200">1. Executive Summary</h3>
              <div className="flex items-center justify-center mb-4">
                <div className="text-center p-6 bg-slate-50 rounded-lg">
                  <div className="text-5xl font-bold font-heading" style={{ color: BAND_COLORS[report.score?.band] }} data-testid="report-score">
                    {report.score?.overall}%
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    Overall Score — <span className="font-semibold" style={{ color: BAND_COLORS[report.score?.band] }}>{report.score?.band}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-slate-50 rounded-md">
                  <div className="text-xl font-bold text-[#0B1F3B]">{report.score?.coverage}%</div>
                  <div className="text-xs text-slate-500">Coverage</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-md">
                  <div className="text-xl font-bold text-red-700">{report.summary?.high_risk_gaps}</div>
                  <div className="text-xs text-red-600">High-Risk Gaps</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-md">
                  <div className="text-xl font-bold text-amber-700">{report.summary?.medium_risk_gaps}</div>
                  <div className="text-xs text-amber-600">Medium-Risk</div>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-md">
                  <div className="text-xl font-bold text-blue-700">{report.summary?.low_risk_gaps}</div>
                  <div className="text-xs text-blue-600">Low-Risk</div>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                This assessment evaluates the organisation's policy documentation against structured UK ICO regulatory obligations. 
                The analysis identifies areas of compliance strength and remediation opportunities.
              </p>
            </section>

            {/* Score Breakdown */}
            <section className="mb-8">
              <h3 className="font-heading text-lg font-semibold text-[#0B1F3B] mb-4 pb-2 border-b border-slate-200">2. Score Breakdown</h3>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Theme</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Score</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(report.score?.themes || {}).map(([theme, data]) => (
                    <TableRow key={theme}>
                      <TableCell className="px-4 text-sm font-medium">{theme}</TableCell>
                      <TableCell className="px-4 text-sm font-mono">{data.score}%</TableCell>
                      <TableCell className="px-4">
                        <Badge className={`text-xs ${data.band === 'Green' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : data.band === 'Amber' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                          {data.band}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>

            {/* Control Assessment Table */}
            <section className="mb-8">
              <h3 className="font-heading text-lg font-semibold text-[#0B1F3B] mb-4 pb-2 border-b border-slate-200">3. Control Assessment Table</h3>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">ID</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Statement</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.control_assessments?.map((ca) => (
                    <TableRow key={ca.id}>
                      <TableCell className="px-4 font-mono text-xs">{ca.control_ref}</TableCell>
                      <TableCell className="px-4 text-xs">{ca.statement?.slice(0, 70)}</TableCell>
                      <TableCell className="px-4">
                        <Badge className={`text-xs ${STATUS_STYLES[ca.status]}`}>{ca.status}</Badge>
                      </TableCell>
                      <TableCell className="px-4 font-mono text-xs">{ca.confidence?.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>

            {/* Gaps */}
            <section className="mb-8">
              <h3 className="font-heading text-lg font-semibold text-[#0B1F3B] mb-4 pb-2 border-b border-slate-200">4. Identified Gaps</h3>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Gap</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Obligation</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Severity</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.gaps?.map((gap, i) => (
                    <TableRow key={gap.id}>
                      <TableCell className="px-4 font-mono text-xs">GAP-{String(i + 1).padStart(3, '0')}</TableCell>
                      <TableCell className="px-4 text-xs">{gap.obligation_title || '-'}</TableCell>
                      <TableCell className="px-4">
                        <Badge className={`text-xs ${gap.severity === 'high' ? 'bg-red-50 text-red-700 border-red-200' : gap.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {gap.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 text-xs">{gap.description?.slice(0, 60)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </section>

            {/* Tasks */}
            <section className="mb-8">
              <h3 className="font-heading text-lg font-semibold text-[#0B1F3B] mb-4 pb-2 border-b border-slate-200">5. Remediation Tasks</h3>
              {report.tasks?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Task</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Owner</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.tasks.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="px-4 text-xs">{t.description?.slice(0, 50)}</TableCell>
                        <TableCell className="px-4 text-xs">{t.assigned_to || '-'}</TableCell>
                        <TableCell className="px-4 text-xs">{t.status}</TableCell>
                        <TableCell className="px-4 text-xs">{t.due_date || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-slate-400">No tasks created yet.</p>
              )}
            </section>

            {/* Evidence Index */}
            <section className="mb-8">
              <h3 className="font-heading text-lg font-semibold text-[#0B1F3B] mb-4 pb-2 border-b border-slate-200">6. Evidence Index</h3>
              {report.evidence?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Evidence ID</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Source</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Hash</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.evidence.map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell className="px-4 font-mono text-xs">{ev.id?.slice(0, 12)}</TableCell>
                        <TableCell className="px-4 text-xs">{ev.source}</TableCell>
                        <TableCell className="px-4 font-mono text-xs">{ev.hash?.slice(0, 24)}...</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-slate-400">No evidence items.</p>
              )}
            </section>

            {/* Approval Log */}
            <section className="mb-8">
              <h3 className="font-heading text-lg font-semibold text-[#0B1F3B] mb-4 pb-2 border-b border-slate-200">7. Approval Log</h3>
              {report.approvals?.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Approver</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Role</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Date</TableHead>
                      <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.approvals.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="px-4 text-xs">{a.approver_name}</TableCell>
                        <TableCell className="px-4 text-xs">{a.role}</TableCell>
                        <TableCell className="px-4 text-xs">{a.created_at?.slice(0, 10)}</TableCell>
                        <TableCell className="px-4 text-xs">{a.action}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-slate-400">No approvals logged.</p>
              )}
            </section>

            {/* Disclaimer */}
            <div className="text-xs text-slate-400 pt-6 border-t border-slate-200 italic">
              This report reflects automated and manual evaluation of uploaded documentation. It does not constitute legal advice.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
