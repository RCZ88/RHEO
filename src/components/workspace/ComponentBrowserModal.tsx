import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Plus, Loader2 } from 'lucide-react';

type LibraryId = string;

interface Component {
  slug: string;
  name: string;
  description: string;
  category: string;
  code?: string;
  tags?: string[];
  source: LibraryId;
}

interface ComponentBrowserModalProps {
  open: boolean;
  onClose: () => void;
  libraryId: LibraryId;
  onAddComponent: (component: Component) => void;
}

function getSourceAccent(source: LibraryId): string {
  switch (source) {
    case '21st-dev': return '#22d3ee';
    case 'aceternity': return '#a78bfa';
    case 'refero': return '#34d399';
    case 'magicui': return '#f472b6';
    case 'shadcn': return '#60a5fa';
    case 'cult-ui': return '#fb923c';
    case 'fragments-ui': return '#a78bfa';
    case 'reactbits': return '#34d399';
  }
}

export default function ComponentBrowserModal({ open, onClose, libraryId, onAddComponent }: ComponentBrowserModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [componentDetails, setComponentDetails] = useState<Record<string, Component>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchRef = useRef(searchQuery);
  searchRef.current = searchQuery;

  const fetchComponentDetail = useCallback(async (slug: string) => {
    if (componentDetails[slug]) return;
    setDetailLoading(p => ({ ...p, [slug]: true }));
    try {
      const dapi = (window as any).deskflowAPI;
      let result: any = null;
      if (libraryId === 'aceternity') {
        result = await dapi?.aceternityFetchComponent?.(slug);
      } else if (libraryId === '21st-dev') {
        result = await dapi?.mcpCallTool?.('21st-dev', 'get_component', { slug });
      } else if (libraryId === 'refero') {
        result = await dapi?.fetchReferoSystem?.(slug);
      } else if (libraryId === 'magicui') {
        result = await dapi?.mcpCallTool?.('magicui', 'get_registry_item', { name: slug });
      } else if (libraryId === 'shadcn') {
        result = await dapi?.mcpCallTool?.('shadcn-ui-mcp', 'get_component', { componentName: slug });
      } else if (libraryId === 'cult-ui') {
        result = await dapi?.mcpCallTool?.('cult-ui', 'get_component', { slug });
      } else if (libraryId === 'fragments-ui') {
        result = await dapi?.mcpCallTool?.('fragments-ui', 'get_component', { slug });
      } else if (libraryId === 'reactbits') {
        result = await dapi?.mcpCallTool?.('reactbits', 'get_component', { name: slug });
      }
      if (result?.success || result?.component) {
        const data = result.component || result.result?.content?.[0]?.text || {};
        const detail = typeof data === 'string' ? JSON.parse(data) : data;
        setComponentDetails(p => ({ ...p, [slug]: {
          slug,
          name: detail.name || slug,
          description: detail.description || '',
          category: detail.category || 'General',
          code: detail.code || detail.content || detail.markup || '',
          tags: detail.tags || [],
          source: libraryId,
        }}));
      }
    } catch {} finally {
      setDetailLoading(p => ({ ...p, [slug]: false }));
    }
  }, [libraryId, componentDetails]);

  useEffect(() => {
    if (expandedSlug) {
      fetchComponentDetail(expandedSlug);
    }
  }, [expandedSlug, fetchComponentDetail]);

  const categories = ['All', 'Hero Sections', 'Cards', 'Testimonials', 'Backgrounds', 'Animations', 'Layouts'];

  const fetchComponents = useCallback(async (query: string) => {
    setLoading(true);
    setError('');
    try {
      const dapi = (window as any).deskflowAPI;
      let result: any = null;

      if (libraryId === 'aceternity') {
        result = await dapi?.aceternityFetchRegistry?.();
      } else if (libraryId === '21st-dev') {
        result = await dapi?.mcpCallTool?.('21st-dev', 'search_components', { query });
      } else if (libraryId === 'refero') {
        result = await dapi?.fetchReferoCatalog?.(false, query);
      } else if (libraryId === 'magicui') {
        result = await dapi?.mcpCallTool?.('magicui', 'search_registry_items', { query });
      } else if (libraryId === 'shadcn') {
        result = await dapi?.mcpCallTool?.('shadcn-ui-mcp', 'list_components', { query });
      } else if (libraryId === 'cult-ui') {
        result = await dapi?.mcpCallTool?.('cult-ui', 'search_components', { query });
      } else if (libraryId === 'fragments-ui') {
        result = await dapi?.mcpCallTool?.('fragments-ui', 'search_components', { query });
      } else if (libraryId === 'reactbits') {
        result = await dapi?.mcpCallTool?.('reactbits', 'search_components', { query });
      }

      if (result?.success) {
        const items = result.components || result.systems || result.result?.content?.[0]?.text || [];
        const parsed = typeof items === 'string' ? JSON.parse(items).components || [] : items;
        setComponents(parsed.map((c: any) => ({
          slug: c.slug || c.id,
          name: c.name,
          description: c.description || '',
          category: c.category || 'General',
          code: c.code || c.content,
          tags: c.tags || [],
          source: libraryId,
        })));
      } else {
        setError(result?.error || 'Failed to fetch components');
        setComponents([]);
      }
    } catch (e) {
      setError(String(e));
      setComponents([]);
    } finally {
      setLoading(false);
    }
  }, [libraryId]);

  useEffect(() => {
    if (open) {
      fetchComponents('');
    } else {
      setComponents([]);
      setSearchQuery('');
      setActiveCategory('All');
      setExpandedSlug(null);
      setError('');
    }
  }, [open, libraryId, fetchComponents]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchComponents(value);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const filteredComponents = components.filter(comp => {
    const matchesSearch = comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         comp.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || comp.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddToContext = (component: Component) => {
    onAddComponent(component);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-3xl max-h-[80vh] rounded-xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-800/60 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800/60">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">
                  Browse Components — {libraryId === '21st-dev' ? '21st.dev' : 
                                 libraryId === 'aceternity' ? 'Aceternity UI' : 
                                 libraryId === 'refero' ? 'Refero' : 
                                 libraryId === 'magicui' ? 'Magic UI' : 
                                 libraryId === 'shadcn' ? 'shadcn/ui' : 
                                 libraryId === 'cult-ui' ? 'Cult UI' : 
                                 libraryId === 'fragments-ui' ? 'Fragments UI' : 
                                 libraryId === 'reactbits' ? 'React Bits' : 'Unknown'}
                </h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Search and add components to your design context
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-zinc-800/60 transition-colors duration-150"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Search */}
            <div className="p-6 border-b border-zinc-800/60">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search components..."
                  className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/60 border border-zinc-800/60 rounded-lg
                    text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-cyan-400/40
                    transition-colors duration-150"
                />
              </div>
            </div>

            {/* Categories */}
            <div className="px-6 pb-4">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={activeCategory === cat
                      ? "px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap bg-zinc-700/60 text-zinc-100"
                      : "px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/60 transition-colors duration-150"
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Component Grid */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {loading && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
                  <span className="ml-2 text-sm text-zinc-500">Loading components...</span>
                </div>
              )}

              {error && !loading && (
                <div className="text-center py-8">
                  <p className="text-sm text-red-400">{error}</p>
                  <button
                    onClick={() => fetchComponents(searchQuery)}
                    className="mt-2 text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {filteredComponents.map(item => (
                    <div
                      key={item.slug}
                      className="rounded-lg p-3 bg-zinc-800/40 border border-zinc-800/40
                        hover:border-zinc-700/60 transition-colors duration-150
                        flex flex-col gap-2 cursor-pointer"
                      onClick={() => setExpandedSlug(item.slug === expandedSlug ? null : item.slug)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-zinc-200">{item.name}</span>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-600 px-1.5 py-0.5
                          rounded bg-zinc-800/60">{item.category}</span>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-2">{item.description}</p>

                      {/* Source badge */}
                      <span
                        className="self-start text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{
                          color: getSourceAccent(item.source),
                          backgroundColor: `${getSourceAccent(item.source)}15`,
                        }}
                      >
                        {item.source === '21st-dev' ? '21st.dev' : 
                         item.source === 'aceternity' ? 'Aceternity' : 
                         item.source === 'refero' ? 'Refero' : 
                         item.source === 'magicui' ? 'Magic UI' : 
                         item.source === 'shadcn' ? 'shadcn/ui' : 
                         item.source === 'cult-ui' ? 'Cult UI' : 
                         item.source === 'fragments-ui' ? 'Fragments UI' : 
                         item.source === 'reactbits' ? 'React Bits' : 'Unknown'}
                      </span>

                      {/* Code Preview (expanded) */}
                      {expandedSlug === item.slug && (
                        <div className="mt-2">
                          {detailLoading[item.slug] ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="w-4 h-4 text-zinc-400 animate-spin" />
                            </div>
                          ) : (
                            (componentDetails[item.slug]?.code || item.code) && (
                              <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/40
                                text-xs text-zinc-400 font-mono overflow-x-auto max-h-48 overflow-y-auto">
                                {componentDetails[item.slug]?.code || item.code}
                              </pre>
                            )
                          )}
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToContext(item);
                        }}
                        className="self-end px-2.5 py-1 rounded-md text-xs font-medium
                          text-cyan-400 hover:bg-cyan-400/10 transition-colors duration-150"
                      >
                        Add →
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {!loading && !error && filteredComponents.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-zinc-500">
                    {searchQuery ? 'No components found. Try different keywords.' : 'No components found in this category.'}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}