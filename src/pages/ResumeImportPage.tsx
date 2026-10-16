import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { VoiceInputWrapper } from '@/components/VoiceInputWrapper';
import { ArrowLeft, Upload, Smartphone, Award, MessageSquare, Search, FileText, Plus } from 'lucide-react';
import { FieldAIButton } from '@/components/ai-bridge/FieldAIButton';
import { useResumeStore } from '../stores/resumeStore';
import { ChatCompilationCard } from '../features/resume/components/ChatCompilationCard';
import { DocumentUploader } from '../features/resume/components/DocumentUploader';
import { CertificationCard } from '../features/resume/components/CertificationCard';
import { TakeawayCard } from '../features/resume/components/TakeawayCard';
import { MobileScanModal } from '../features/resume/components/MobileScanModal';
import { Button } from '../components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { BlurFade } from '../components/ui/blur-fade';
import { Skeleton } from '../components/ui/skeleton';
import type { DocumentUpload, CertificationScan, Takeaway } from '../types/resume';

export default function ResumeImportPage() {
  const navigate = useNavigate();
  const {
    chatCompilations, takeaways, certScans, documentUploads,
    fetchChatCompilations, fetchTakeaways, fetchCertScans,
    addTakeaway, removeTakeaway, addCertScan, addDocumentUpload,
    setDocumentUploads, setCertScans, isLoading,
  } = useResumeStore();

  const [activeTab, setActiveTab] = useState('chat');
  const [showMobileScan, setShowMobileScan] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSource, setChatSource] = useState<'chatgpt' | 'claude' | 'cursor' | 'manual'>('chatgpt');
  const [isExtracting, setIsExtracting] = useState(false);
  const [takeawayFilter, setTakeawayFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('all');

  useEffect(() => {
    fetchChatCompilations();
    fetchTakeaways();
    fetchCertScans();
  }, []);

  const handleExtractChat = async () => {
    if (!chatInput.trim()) return;
    setIsExtracting(true);
    try {
      const result = await (window as any).deskflowAPI?.resume?.extractFromChat(chatInput, chatSource);
      if (result?.takeaways) {
        result.takeaways.forEach((t: Takeaway) => addTakeaway(t));
      }
      setChatInput('');
    } catch (e) {
      console.error('[Import] Extract failed:', e);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleUploadDocument = async (file: File) => {
    const upload: DocumentUpload = {
      id: Date.now().toString(),
      userId: 'current',
      fileName: file.name,
      filePath: '',
      fileType: file.type,
      fileSize: file.size,
      extractedContent: '',
      takeawayCount: 0,
      status: 'uploading',
      createdAt: new Date().toISOString(),
    };
    addDocumentUpload(upload);

    try {
      const result = await (window as any).deskflowAPI?.resume?.uploadDocument(file);
      if (result) {
        setDocumentUploads((prev: DocumentUpload[]) =>
          prev.map((u) => u.id === upload.id ? { ...u, status: 'completed', extractedContent: result.content, takeawayCount: result.takeawayCount } : u)
        );
      }
    } catch (e) {
      setDocumentUploads((prev: DocumentUpload[]) =>
        prev.map((u) => u.id === upload.id ? { ...u, status: 'failed' } : u)
      );
    }
  };

  const handleMobileScan = async (type: 'certification' | 'document' | 'credential') => {
    setShowMobileScan(false);
    const scan: CertificationScan = {
      id: Date.now().toString(),
      userId: 'current',
      fileName: `scan-${Date.now()}`,
      filePath: '',
      fileType: 'image/jpeg',
      extractedData: {},
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    addCertScan(scan);
  };

  const filteredTakeaways = takeaways.filter((t) =>
    takeawayFilter === 'all' ? true : t.status === takeawayFilter
  );

  const chatSourceColors: Record<string, string> = {
    chatgpt: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
    claude: 'bg-orange-500/10 text-orange-400 ring-orange-500/20',
    cursor: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
    manual: 'bg-zinc-500/10 text-zinc-400 ring-zinc-500/20',
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
            <Upload className="w-5 h-5 text-[var(--page-accent)]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Import & Scan</h1>
            <p className="text-xs text-zinc-500">Extract resume content from chats, docs, and scans</p>
          </div>
        </div>
      </BlurFade>

      {/* Tabs */}
      <BlurFade delay={0.1}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" /> Chat Compilations
              {chatCompilations.length > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-300">
                  {chatCompilations.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Documents
            </TabsTrigger>
            <TabsTrigger value="certifications" className="gap-1.5">
              <Award className="w-3.5 h-3.5" /> Certifications
            </TabsTrigger>
            <TabsTrigger value="takeaways" className="gap-1.5">
              <Search className="w-3.5 h-3.5" /> Takeaways
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat" className="space-y-4 mt-4">
            {/* Paste Input */}
            <div className="rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[var(--page-accent)]" />
                <h3 className="text-sm font-semibold text-white">Paste Chat Transcript</h3>
              </div>
              <div className="flex gap-1.5">
                {(['chatgpt', 'claude', 'cursor', 'manual'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setChatSource(s)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 ring-1 ${
                      chatSource === s
                        ? chatSourceColors[s]
                        : 'bg-zinc-800/60 text-zinc-400 ring-zinc-700/30 hover:bg-zinc-700/50'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <VoiceInputWrapper>
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Paste your ChatGPT, Claude, or Cursor conversation here..."
                  rows={8}
                  className="w-full p-4 rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 ring-1 ring-zinc-700/50 text-sm text-white placeholder-zinc-500 outline-none focus:ring-[var(--page-accent)]/50 focus:ring-2 transition-all duration-150 resize-none font-mono leading-relaxed"
                />
              </VoiceInputWrapper>
              <FieldAIButton
                fieldName="chatInput"
                label="Chat Transcript"
                value={chatInput}
                onUpdate={setChatInput}
                allFields={{ chatInput, chatSource }}
                category="resume"
                context="Help extract resume information from this AI chat conversation"
              />
              <Button
                onClick={handleExtractChat}
                disabled={!chatInput.trim() || isExtracting}
                className="w-full"
                size="lg"
              >
                {isExtracting ? (
                  <><span className="animate-spin mr-2">⟳</span> Extracting...</>
                ) : (
                  <><Search className="w-4 h-4 mr-2" /> Extract Takeaways</>
                )}
              </Button>
            </div>

            {/* Chat Compilations List */}
            <div>
              <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Past Compilations</h3>
              {isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-[100px] rounded-xl" />
                  <Skeleton className="h-[100px] rounded-xl" />
                </div>
              ) : chatCompilations.length === 0 ? (
                <div className="text-center py-12 rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60">
                  <MessageSquare className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                  <p className="text-sm text-zinc-500">No compilations yet</p>
                  <p className="text-[10px] text-zinc-600 mt-1">Paste a chat transcript above to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {chatCompilations.map((c) => (
                    <ChatCompilationCard
                      key={c.id}
                      compilation={c}
                      onView={(id) => console.log('view', id)}
                      onDelete={(id) => console.log('delete', id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-4">
            <DocumentUploader
              uploads={documentUploads}
              onUpload={handleUploadDocument}
              onRemove={(id) => setDocumentUploads((prev: DocumentUpload[]) => prev.filter((u) => u.id !== id))}
            />
          </TabsContent>

          {/* Certifications Tab */}
          <TabsContent value="certifications" className="space-y-4 mt-4">
            <div className="flex gap-2">
              <Button onClick={() => setShowMobileScan(true)}>
                <Smartphone className="w-4 h-4 mr-2" /> Mobile Scan
              </Button>
              <Button variant="outline" onClick={() => {
                const scan: CertificationScan = {
                  id: Date.now().toString(),
                  userId: 'current',
                  fileName: 'manual-cert',
                  filePath: '',
                  fileType: 'manual',
                  extractedData: { name: '', issuer: '', dateEarned: '' },
                  status: 'pending',
                  createdAt: new Date().toISOString(),
                };
                addCertScan(scan);
              }}>
                <Plus className="w-4 h-4 mr-2" /> Add Manually
              </Button>
            </div>

            {certScans.length === 0 ? (
              <div className="text-center py-12 rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60">
                <Award className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No certifications scanned</p>
                <p className="text-[10px] text-zinc-600 mt-1">Use your phone to scan certificates or add them manually</p>
              </div>
            ) : (
              <div className="space-y-2">
                {certScans.map((s) => (
                  <CertificationCard
                    key={s.id}
                    scan={s}
                    onConfirm={(id) => console.log('confirm', id)}
                    onAddToResume={(id) => console.log('add', id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Takeaways Tab */}
          <TabsContent value="takeaways" className="space-y-4 mt-4">
            <div className="flex items-center gap-1.5">
              {(['all', 'pending', 'confirmed', 'rejected'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setTakeawayFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-150 ring-1 ${
                    takeawayFilter === f
                      ? 'bg-[var(--page-accent-15)] text-[var(--page-accent)] ring-[var(--page-accent)]/25'
                      : 'bg-zinc-800/60 text-zinc-400 ring-zinc-700/30 hover:bg-zinc-700/50'
                  }`}
                >
                  {f} ({takeaways.filter((t) => f === 'all' ? true : t.status === f).length})
                </button>
              ))}
            </div>

            {filteredTakeaways.length === 0 ? (
              <div className="text-center py-12 rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-800/40 border border-zinc-800/60">
                <Search className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No takeaways yet</p>
                <p className="text-[10px] text-zinc-600 mt-1">Import a chat or upload documents to extract takeaways</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredTakeaways.map((t) => (
                  <TakeawayCard
                    key={t.id}
                    takeaway={t}
                    onConfirm={(id) => console.log('confirm', id)}
                    onReject={(id) => console.log('reject', id)}
                    onUseInResume={(id) => console.log('use', id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </BlurFade>

      <MobileScanModal
        open={showMobileScan}
        onClose={() => setShowMobileScan(false)}
        onScan={handleMobileScan}
      />
    </div>
  );
}
