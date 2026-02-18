import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Upload, Plus, Database, RefreshCw, Loader2, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function FrameworkManagementPage() {
  const [frameworks, setFrameworks] = useState([]);
  const [versions, setVersions] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [controls, setControls] = useState([]);
  const [selectedFw, setSelectedFw] = useState(null);
  const [selectedVer, setSelectedVer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showFwDialog, setShowFwDialog] = useState(false);
  const [newFwName, setNewFwName] = useState('');
  const [newFwDesc, setNewFwDesc] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadFrameworks();
  }, []);

  const loadFrameworks = async () => {
    try {
      const res = await api.get('/frameworks');
      setFrameworks(res.data);
      if (res.data.length > 0) {
        setSelectedFw(res.data[0]);
        await loadVersions(res.data[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async (fwId) => {
    try {
      const res = await api.get(`/frameworks/${fwId}/versions`);
      setVersions(res.data);
      if (res.data.length > 0) {
        setSelectedVer(res.data[0]);
        await loadObligationsAndControls(res.data[0].id);
      } else {
        setObligations([]);
        setControls([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadObligationsAndControls = async (verId) => {
    try {
      const [oblRes, ctrlRes] = await Promise.all([
        api.get(`/frameworks/${verId}/obligations`),
        api.get(`/frameworks/${verId}/controls`),
      ]);
      setObligations(oblRes.data);
      setControls(ctrlRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await api.post('/seed');
      toast.success(res.data.message);
      await loadFrameworks();
    } catch (e) {
      toast.error('Failed to seed');
    } finally {
      setSeeding(false);
    }
  };

  const handleUploadCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedFw) formData.append('framework_id', selectedFw.id);
      const res = await api.post('/frameworks/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(res.data.message);
      await loadFrameworks();
    } catch (e) {
      toast.error('CSV import failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateFramework = async () => {
    if (!newFwName.trim()) return;
    try {
      const res = await api.post('/frameworks', { name: newFwName, description: newFwDesc });
      toast.success('Framework created');
      setShowFwDialog(false);
      setNewFwName('');
      setNewFwDesc('');
      await loadFrameworks();
    } catch (e) {
      toast.error('Failed');
    }
  };

  const handleDownloadTemplate = () => {
    const template = 'theme,obligation,obligation_description,control_id,control,weight\nLawful Basis,"Lawful Basis for Processing","Organisation must identify lawful basis",LB-001,"A lawful basis is identified for each processing activity",3\n';
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eenera-framework-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const themes = [...new Set(obligations.map(o => o.theme))];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="frameworks-page">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold font-heading text-[#0B1F3B] tracking-tight">Framework Management</h1>
          <p className="text-sm text-slate-500 mt-1">Import, version, and manage compliance frameworks</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleDownloadTemplate} variant="outline" size="sm" data-testid="download-template-btn">
            <Download className="w-4 h-4 mr-2" />
            CSV Template
          </Button>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm" disabled={uploading} data-testid="upload-csv-btn">
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            Import CSV
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleUploadCSV} />
          <Button onClick={() => setShowFwDialog(true)} variant="outline" size="sm" data-testid="new-framework-btn">
            <Plus className="w-4 h-4 mr-2" />
            New Framework
          </Button>
          <Button onClick={handleSeed} disabled={seeding} size="sm" className="bg-[#0B1F3B] hover:bg-[#162B4D] text-white" data-testid="seed-framework-btn">
            {seeding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
            Seed ICO/GDPR
          </Button>
        </div>
      </div>

      {/* Framework List */}
      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-4 border-slate-200 shadow-sm">
          <CardHeader className="pb-2 border-b border-slate-100">
            <CardTitle className="text-sm font-heading text-slate-500 uppercase tracking-wider">Frameworks</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {frameworks.length === 0 ? (
              <div className="py-8 text-center">
                <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No frameworks. Seed or import one.</p>
              </div>
            ) : (
              frameworks.map((fw) => (
                <button
                  key={fw.id}
                  onClick={() => { setSelectedFw(fw); loadVersions(fw.id); }}
                  data-testid={`fw-btn-${fw.name.replace(/\s+/g, '-').toLowerCase()}`}
                  className={`w-full text-left px-3 py-3 rounded-md text-sm transition-colors ${
                    selectedFw?.id === fw.id ? 'bg-[#1E4FFF]/10 text-[#1E4FFF] font-semibold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <div className="font-medium">{fw.name}</div>
                  {fw.description && <div className="text-xs text-slate-400 mt-0.5 truncate">{fw.description}</div>}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="col-span-8 space-y-6">
          {/* Versions */}
          {selectedFw && (
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-heading text-slate-500 uppercase tracking-wider">
                  Versions — {selectedFw.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {versions.length === 0 ? (
                  <p className="text-sm text-slate-400">No versions. Import a CSV to create one.</p>
                ) : (
                  <div className="flex gap-3 flex-wrap">
                    {versions.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => { setSelectedVer(v); loadObligationsAndControls(v.id); }}
                        data-testid={`ver-btn-${v.version}`}
                        className={`px-4 py-2 rounded-md border text-sm transition-colors ${
                          selectedVer?.id === v.id
                            ? 'bg-[#1E4FFF]/10 border-[#1E4FFF] text-[#1E4FFF] font-medium'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        v{v.version}
                        <Badge className="ml-2 text-xs bg-emerald-50 text-emerald-700 border-emerald-200">{v.status}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Obligations & Controls */}
          {selectedVer && (
            <Tabs defaultValue="obligations">
              <TabsList>
                <TabsTrigger value="obligations" data-testid="tab-obligations">Obligations ({obligations.length})</TabsTrigger>
                <TabsTrigger value="controls" data-testid="tab-controls">Controls ({controls.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="obligations">
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80">
                          <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Theme</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Title</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Description</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {obligations.map((obl) => (
                          <TableRow key={obl.id}>
                            <TableCell className="px-4">
                              <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-xs">{obl.theme}</Badge>
                            </TableCell>
                            <TableCell className="px-4 text-sm font-medium">{obl.title}</TableCell>
                            <TableCell className="px-4 text-xs text-slate-500">{obl.description?.slice(0, 80)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="controls">
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50/80">
                          <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">ID</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Theme</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4">Statement</TableHead>
                          <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-4 w-20">Weight</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {controls.map((ctrl) => (
                          <TableRow key={ctrl.id}>
                            <TableCell className="px-4 font-mono text-xs">{ctrl.control_id}</TableCell>
                            <TableCell className="px-4">
                              <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-xs">{ctrl.theme}</Badge>
                            </TableCell>
                            <TableCell className="px-4 text-xs">{ctrl.statement}</TableCell>
                            <TableCell className="px-4 text-xs font-mono">{ctrl.weight}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* New Framework Dialog */}
      <Dialog open={showFwDialog} onOpenChange={setShowFwDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">New Framework</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input data-testid="fw-name-input" value={newFwName} onChange={(e) => setNewFwName(e.target.value)} placeholder="e.g. SOC 2 Type II" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input data-testid="fw-desc-input" value={newFwDesc} onChange={(e) => setNewFwDesc(e.target.value)} placeholder="Description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFwDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateFramework} className="bg-[#0B1F3B] hover:bg-[#162B4D] text-white" data-testid="confirm-create-fw-btn">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
