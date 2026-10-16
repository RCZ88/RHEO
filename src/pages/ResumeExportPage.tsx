import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Download, BarChart3, FileText, TrendingUp, Search, AlertTriangle, CheckCircle } from 'lucide-react';
import { useResumeStore } from '../stores/resumeStore';
import { VersionCard } from '../features/resume/components/VersionCard';
import { ExportSettings } from '../features/resume/components/ExportSettings';
import { BlurFade } from '../components/ui/blur-fade';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Skeleton } from '../components/ui/skeleton';
import { AnimatedCircularProgressBar } from '../components/ui/animated-circular-progress-bar';
import { NumberTicker } from '../components/ui/number-ticker';
import type { ExportSettings as ExportSettingsType } from '../types/resume';

export default function ResumeExportPage() {
  const navigate = useNavigate();
  const { versions, score, reports, fetchVersions, fetchReports, saveVersion, exportResume, resumeContent, isSaving, isLoading } = useResumeStore();
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [settings, setSettings] = useState<ExportSettingsType>({
    format: 'pdf',
    targetRole: '',
    targetCompany: '',
    includePhoto: false,
    customSections: [],
  });
  const [activeTab, setActiveTab] = useState('versions');

  useEffect(() => {
    fetchVersions();
    fetchReports();
  }, []);

  const handleSaveVersion = async () => {
    await saveVersion({
      versionName: `v${versions.length + 1} - ${settings.targetRole || 'Untitled'}`,
      targetRole: settings.targetRole,
      targetCompany: settings.targetCompany,
      content: resumeContent,
      score: score.current,
      scoreBreakdown: score.breakdown,
      isCurrent: true,
    });
  };

  const handleExport = async () => {
    if (!selectedVersion) return;
    const result = await exportResume(selectedVersion, settings.format);
    if (result.success) {
      console.log('Exported to:', result.filePath);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5" style={{ '--page-accent': 'rgb(99, 102, 241)' } as any}>
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/resume')} className="text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-9 h-9 rounded-lg bg-[var(--page-accent-15)] flex items-center justify-center ring-1 ring-[var(--page-accent)]/20">
            <Download className="w-5 h-5 text-[var(--page-accent)]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Export & Reports</h1>
            <p className="text-xs text-zinc-500">Export your resume and view improvement reports</p>
          </div>
        </div>
      </BlurFade>

      {/* Tabs */}
      <BlurFade delay={0.1}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="versions" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Versions
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> Reports
            </TabsTrigger>
          </TabsList>

          {/* Versions Tab */}
          <TabsContent value="versions" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Saved Versions</h3>
                  <button onClick={handleSaveVersion} className="text-xs text-[var(--page-accent)] hover:text-[var(--page-accent)]/80 flex items-center gap-1 transition-colors">
                    <FileText className="w-3 h-3" /> Save Current
                  </button>
                </div>

                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-[120px] rounded-xl" />
                    <Skeleton className="h-[120px] rounded-xl" />
                  </div>
                ) : versions.length === 0 ? (
                  <div className="text-center py-12 rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60">
                    <FileText className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                    <p className="text-sm text-zinc-500">No versions saved</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Build your resume first, then save a version here</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {versions.map((v) => (
                      <VersionCard
                        key={v.id}
                        version={v}
                        isActive={selectedVersion === v.id}
                        onSelect={setSelectedVersion}
                        onDelete={(id) => console.log('delete', id)}
                        onExport={(id, fmt) => { setSelectedVersion(id); setSettings((s) => ({ ...s, format: fmt as any })); }}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60 p-5">
                <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-4">Export Settings</h3>
                <ExportSettings
                  settings={settings}
                  onSettingsChange={setSettings}
                  onExport={handleExport}
                  isExporting={isSaving}
                />
              </div>
            </div>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4 mt-4">
            {/* Score Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BlurFade delay={0}>
                <div className="rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-[var(--page-accent)]" />
                    <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Overall Score</h4>
                  </div>
                  <AnimatedCircularProgressBar
                    value={score.current}
                    size={80}
                    strokeWidth={8}
                    gaugePrimaryColor={score.current >= 75 ? '#16a34a' : score.current >= 50 ? '#ca8a04' : '#dc2626'}
                    gaugeSecondaryColor="color-mix(in srgb, var(--color-foreground) 14%, transparent)"
                  >
                    <NumberTicker value={score.current} className="text-lg font-bold text-[var(--color-foreground)] tabular-nums" />
                  </AnimatedCircularProgressBar>
                </div>
              </BlurFade>

              <BlurFade delay={0.05}>
                <div className="rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Sections Complete</h4>
                  </div>
                  <p className="text-3xl font-bold text-white tabular-nums">
                    {reports?.completionReport ? Object.values(reports.completionReport.sectionsComplete).filter(Boolean).length : 0}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-1">of 7 phases</p>
                </div>
              </BlurFade>

              <BlurFade delay={0.1}>
                <div className="rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="w-4 h-4 text-blue-400" />
                    <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">ATS Score</h4>
                  </div>
                  <p className="text-3xl font-bold text-white tabular-nums">
                    {reports?.atsReport?.score || '—'}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-1">ATS compatibility</p>
                </div>
              </BlurFade>
            </div>

            {/* Keyword Analysis */}
            {reports?.keywordReport && (
              <BlurFade delay={0.15}>
                <div className="rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60 p-5">
                  <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Keyword Analysis</h4>
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-zinc-500">Match Rate</span>
                      <span className="text-xs font-bold text-[var(--page-accent)] tabular-nums">{reports.keywordReport.matchRate}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${reports.keywordReport.matchRate}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-full bg-[var(--page-accent)]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-emerald-400 font-semibold mb-1.5 uppercase tracking-wider">Matched</p>
                      <div className="flex flex-wrap gap-1">
                        {reports.keywordReport.matchedKeywords.map((k) => (
                          <span key={k} className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20 font-mono">{k}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-amber-400 font-semibold mb-1.5 uppercase tracking-wider">Missing</p>
                      <div className="flex flex-wrap gap-1">
                        {reports.keywordReport.missingKeywords.map((k) => (
                          <span key={k} className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 font-mono">{k}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </BlurFade>
            )}

            {/* Improvement Suggestions */}
            {reports?.atsReport?.suggestions && reports.atsReport.suggestions.length > 0 && (
              <BlurFade delay={0.2}>
                <div className="rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60 p-5">
                  <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Improvement Suggestions</h4>
                  <div className="space-y-2">
                    {reports.atsReport.suggestions.map((s, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-zinc-800/30 ring-1 ring-zinc-700/20">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-zinc-300 leading-relaxed">{s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </BlurFade>
            )}

            {!reports && !isLoading && (
              <div className="text-center py-12 rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60">
                <BarChart3 className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No reports available yet</p>
                <p className="text-[10px] text-zinc-600 mt-1">Complete the builder to generate reports</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </BlurFade>
    </div>
  );
}
