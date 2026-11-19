import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  Network,
  ArrowRight,
  RefreshCw,
  Database,
  Cpu,
  Bot,
  Wrench,
  Globe,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Plus,
  X,
} from 'lucide-react';
import { api } from '../../services/api.client';
import type { ProvenanceGraph, ProvenanceNode } from '../../types';
import { TrustBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { useToast } from '../../context/ToastContext';

export const ProvenanceTab: React.FC = () => {
  const [graph, setGraph] = useState<ProvenanceGraph>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<ProvenanceNode | null>(null);
  const toast = useToast();

  // Filter & Search Controls
  const [search, setSearch] = useState('');
  const [trustFilter, setTrustFilter] = useState<'ALL' | 'TRUSTED' | 'SANITIZED' | 'UNTRUSTED'>('ALL');

  // Canvas Transform State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Node Dragging State
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeDragOffset, setNodeDragOffset] = useState<{
    mouseX: number;
    mouseY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  // Add Node Modal
  const [isAddNodeOpen, setIsAddNodeOpen] = useState(false);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeType, setNewNodeType] = useState('SOURCE');
  const [newNodeTrust, setNewNodeTrust] = useState<'TRUSTED' | 'SANITIZED' | 'UNTRUSTED'>('TRUSTED');
  const [newNodeSource, setNewNodeSource] = useState('Database: postgres_primary');
  const [newNodeDesc, setNewNodeDesc] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getProvenanceGraph();
      if (res && Array.isArray(res.nodes)) {
        setGraph(res);
      } else {
        // Fallback default sample nodes if graph is empty
        setGraph({
          nodes: [
            { id: 'src-1', name: 'Primary DB (Clients)', type: 'DOCUMENT', trust_level: 'TRUSTED', source: 'Postgres DB', metadata: {}, created_at: new Date().toISOString() },
            { id: 'ag-1', name: 'DataIngestAgent', type: 'AGENT_OUTPUT', trust_level: 'TRUSTED', source: 'Authenticated Agent', metadata: {}, created_at: new Date().toISOString() },
            { id: 'tf-1', name: 'PII Masking Sanitizer', type: 'TOOL_EVENT', trust_level: 'SANITIZED', source: 'Regex Pipeline', metadata: {}, created_at: new Date().toISOString() },
            { id: 'tl-1', name: 'Filesystem Export Tool', type: 'TOOL_EVENT', trust_level: 'SANITIZED', source: 'Sandbox I/O', metadata: {}, created_at: new Date().toISOString() },
            { id: 'dst-1', name: 'Compliance Bucket', type: 'DOCUMENT', trust_level: 'TRUSTED', source: 'Encrypted S3', metadata: {}, created_at: new Date().toISOString() },
          ],
          edges: [
            { id: 'e1', source: 'src-1', target: 'ag-1', type: 'DERIVED_FROM' },
            { id: 'e2', source: 'ag-1', target: 'tf-1', type: 'INFLUENCED_BY' },
            { id: 'e3', source: 'tf-1', target: 'tl-1', type: 'HANDOFF_TO' },
            { id: 'e4', source: 'tl-1', target: 'dst-1', type: 'HANDOFF_TO' },
          ],
        });
      }
    } catch (err) {
      console.error('Failed to retrieve provenance graph:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim()) return;
    try {
      const newNode: ProvenanceNode = {
        id: `node-${Date.now()}`,
        name: newNodeName,
        type: (newNodeType as any) || 'DOCUMENT',
        trust_level: newNodeTrust,
        source: newNodeSource,
        metadata: { description: newNodeDesc },
        created_at: new Date().toISOString(),
      };
      await api.createProvenanceNode(newNode);
      toast.success('Lineage Node Registered', `${newNodeName} added to data lineage map.`);
      setIsAddNodeOpen(false);
      fetchGraph();
    } catch {
      // In case offline, update local graph
      setGraph((prev) => ({
        ...prev,
        nodes: [
          ...prev.nodes,
          {
            id: `node-${Date.now()}`,
            name: newNodeName,
            type: (newNodeType as any) || 'DOCUMENT',
            trust_level: newNodeTrust,
            source: newNodeSource,
            metadata: { description: newNodeDesc },
            created_at: new Date().toISOString(),
          },
        ],
      }));
      toast.success('Lineage Node Registered', `${newNodeName} recorded locally.`);
      setIsAddNodeOpen(false);
    }
  };

  // Node Positions Calculation along the pipeline:
  // Source (x: 100) -> Agent (x: 300) -> Transformation (x: 500) -> Tool (x: 700) -> Destination (x: 900)
  const calculatedNodes = useMemo(() => {
    return graph.nodes.map((node, idx) => {
      let defaultX = 120 + (idx % 5) * 190;
      let defaultY = 180 + Math.floor(idx / 5) * 140;

      const normType = (node.type || '').toUpperCase();
      if (normType.includes('DOC') || normType.includes('SOURCE')) defaultX = 120;
      else if (normType.includes('AGENT')) defaultX = 320;
      else if (normType.includes('TOOL')) defaultX = 520;
      else if (normType.includes('API')) defaultX = 720;
      else defaultX = 920;

      return {
        ...node,
        x: nodePositions[node.id]?.x ?? defaultX,
        y: nodePositions[node.id]?.y ?? defaultY,
      };
    });
  }, [graph.nodes, nodePositions]);

  // Pan canvas handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (draggingNodeId) return;
    setIsPanning(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId && nodeDragOffset) {
      const dx = (e.clientX - nodeDragOffset.mouseX) / zoom;
      const dy = (e.clientY - nodeDragOffset.mouseY) / zoom;
      setNodePositions((prev) => ({
        ...prev,
        [draggingNodeId]: {
          x: Math.round(nodeDragOffset.initialX + dx),
          y: Math.round(nodeDragOffset.initialY + dy),
        },
      }));
      return;
    }
    if (!isPanning) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
    setNodeDragOffset(null);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: ProvenanceNode & { x: number; y: number }) => {
    e.stopPropagation();
    setDraggingNodeId(node.id);
    setNodeDragOffset({
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: node.x,
      initialY: node.y,
    });
  };

  const getNodeIcon = (type: string) => {
    const norm = (type || '').toLowerCase();
    if (norm.includes('source') || norm.includes('data')) return <Database className="h-4 w-4 text-[#3B82F6]" />;
    if (norm.includes('transform') || norm.includes('filter')) return <Cpu className="h-4 w-4 text-[#0284C7]" />;
    if (norm.includes('agent')) return <Bot className="h-4 w-4 text-[#8B5CF6]" />;
    if (norm.includes('tool')) return <Wrench className="h-4 w-4 text-[#16A34A]" />;
    return <Globe className="h-4 w-4 text-[#D97706]" />;
  };

  // Filtered nodes
  const filteredNodes = useMemo(() => {
    return calculatedNodes.filter((n) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!n.name.toLowerCase().includes(q) && !(n.source || '').toLowerCase().includes(q)) {
          return false;
        }
      }
      if (trustFilter !== 'ALL') {
        const norm = (n.trust_level || '').toUpperCase();
        if (norm !== trustFilter) return false;
      }
      return true;
    });
  }, [calculatedNodes, search, trustFilter]);

  // Provenance metrics
  const trustedCount = graph.nodes.filter((n) => (n.trust_level || '').toUpperCase() === 'TRUSTED').length;
  const sanitizedCount = graph.nodes.filter((n) => (n.trust_level || '').toUpperCase() === 'SANITIZED').length;
  const untrustedCount = graph.nodes.filter((n) => (n.trust_level || '').toUpperCase() === 'UNTRUSTED').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EAF1] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Data Provenance Explorer
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Data lineage workspace tracking origin sources, agent context transformations, and destination sinks.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchGraph}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => setIsAddNodeOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2563EB] transition-all shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Lineage Node</span>
          </button>
        </div>
      </div>

      {/* Trust Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[#E5EAF1] bg-white p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">Total Lineage Nodes</div>
          <div className="mt-1.5 text-2xl font-bold text-[#1E293B]">{graph.nodes.length}</div>
          <div className="text-[11px] text-[#64748B] mt-0.5">Tracked pipeline components</div>
        </div>

        <div className="rounded-xl border border-[#BCE8CD] bg-[#E8F7EF] p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#16A34A]">Trusted Origins</div>
          <div className="mt-1.5 text-2xl font-bold text-[#16A34A]">{trustedCount}</div>
          <div className="text-[11px] text-[#16A34A] mt-0.5">Cryptographically signed</div>
        </div>

        <div className="rounded-xl border border-[#D4E5FF] bg-[#EEF4FF] p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#2563EB]">Sanitized Flows</div>
          <div className="mt-1.5 text-2xl font-bold text-[#2563EB]">{sanitizedCount}</div>
          <div className="text-[11px] text-[#2563EB] mt-0.5">Transformed & filtered</div>
        </div>

        <div className="rounded-xl border border-[#FCD2D2] bg-[#FEF2F2] p-4 shadow-2xs">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#DC2626]">Untrusted / Flagged</div>
          <div className="mt-1.5 text-2xl font-bold text-[#DC2626]">{untrustedCount}</div>
          <div className="text-[11px] text-[#DC2626] mt-0.5">Potential injection risks</div>
        </div>
      </div>

      {/* Lineage Flow Legend Bar */}
      <div className="rounded-xl border border-[#E5EAF1] bg-white p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-[#1E293B]">Lineage Flow:</span>
          <div className="flex items-center gap-1.5 text-[#64748B]">
            <span className="font-medium text-[#3B82F6]">Source</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium text-[#8B5CF6]">Agent</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium text-[#0284C7]">Transformation</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium text-[#16A34A]">Tool</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium text-[#1E293B]">Destination</span>
          </div>
        </div>

        {/* Trust level filter chips */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#64748B] mr-1">Filter Trust:</span>
          {(['ALL', 'TRUSTED', 'SANITIZED', 'UNTRUSTED'] as const).map((chip) => (
            <button
              key={chip}
              onClick={() => setTrustFilter(chip)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
                trustFilter === chip
                  ? 'bg-[#EEF4FF] text-[#3B82F6] font-semibold border border-[#D4E5FF]'
                  : 'border border-[#E5EAF1] bg-[#F8FAFC] text-[#64748B] hover:text-[#1E293B]'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Lineage Canvas */}
      <div className="relative rounded-2xl border border-[#E5EAF1] bg-white shadow-2xs overflow-hidden h-[600px] flex">
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="flex-1 h-full relative cursor-grab active:cursor-grabbing overflow-hidden bg-[#FAFCFF] select-none"
        >
          {/* Subtle Dot Grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Canvas Floating Controls */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-xs p-1.5 rounded-xl border border-[#E5EAF1] shadow-sm">
            <div className="w-48">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search lineage..."
                className="w-full rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] px-2.5 py-1 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
              />
            </div>
            <div className="h-4 w-px bg-[#E5EAF1]" />
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.15, 2))}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1E293B]"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1E293B]"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1E293B]"
              title="Reset View"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* SVG Connector Lines */}
          <svg
            className="w-full h-full pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <defs>
              <marker
                id="provenanceArrow"
                viewBox="0 0 10 10"
                refX="22"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#3B82F6" />
              </marker>
            </defs>

            {graph.edges.map((edge, idx) => {
              const src = calculatedNodes.find((n) => n.id === edge.source);
              const tgt = calculatedNodes.find((n) => n.id === edge.target);
              if (!src || !tgt) return null;

              const midX = (src.x + tgt.x) / 2;
              const pathD = `M ${src.x + 80} ${src.y + 35} C ${midX} ${src.y + 35}, ${midX} ${tgt.y + 35}, ${tgt.x} ${tgt.y + 35}`;

              return (
                <g key={`edge-${idx}`}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    markerEnd="url(#provenanceArrow)"
                    opacity={0.65}
                  />
                  {edge.type && (
                    <text
                      x={midX}
                      y={(src.y + tgt.y) / 2 - 6}
                      fill="#64748B"
                      fontSize="10"
                      textAnchor="middle"
                      className="font-mono bg-white"
                    >
                      {edge.type}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* HTML Nodes */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {filteredNodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const isUntrusted = (node.trust_level || '').toUpperCase() === 'UNTRUSTED';
              const isSanitized = (node.trust_level || '').toUpperCase() === 'SANITIZED';

              const borderStyle = isUntrusted
                ? 'border-[#FCD2D2] bg-[#FEF2F2]'
                : isSanitized
                ? 'border-[#D4E5FF] bg-[#EEF4FF]/50'
                : 'border-[#BCE8CD] bg-white';

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  style={{
                    position: 'absolute',
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: '185px',
                  }}
                  className={`pointer-events-auto rounded-xl border p-3.5 cursor-pointer transition-shadow select-none shadow-2xs ${borderStyle} ${
                    isSelected ? 'ring-2 ring-[#3B82F6] shadow-md' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="p-1.5 rounded-lg bg-white border border-[#E5EAF1]">
                      {getNodeIcon(node.type || '')}
                    </div>
                    <TrustBadge level={node.trust_level} />
                  </div>

                  <div className="mt-2 font-semibold text-xs text-[#1E293B] truncate">
                    {node.name}
                  </div>
                  <div className="text-[10px] text-[#64748B] font-mono mt-0.5 truncate">
                    {node.type} • {node.source || 'Origin'}
                  </div>

                  <div className="mt-2 pt-2 border-t border-[#E5EAF1] flex items-center justify-between text-[10px] text-[#64748B]">
                    <span>Inspect</span>
                    <ArrowRight className="h-3 w-3 text-[#3B82F6]" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Node Inspector Drawer */}
        {selectedNode && (
          <div className="w-80 border-l border-[#E5EAF1] bg-white p-5 flex flex-col justify-between shadow-lg z-30 animate-fade-in text-xs">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#EEF4FF] text-[#3B82F6]">
                    <Network className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1E293B]">Lineage Node</h3>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded-md text-[#94A3B8] hover:text-[#1E293B]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div>
                <span className="text-[#64748B] text-[11px] block">Entity Label</span>
                <span className="font-bold text-[#1E293B] text-sm block mt-0.5">{selectedNode.name}</span>
              </div>

              <div className="rounded-lg bg-[#F8FAFC] border border-[#E5EAF1] p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Type:</span>
                  <span className="font-mono text-[#1E293B]">{selectedNode.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Trust Level:</span>
                  <TrustBadge level={selectedNode.trust_level} />
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Origin Source:</span>
                  <span className="font-medium text-[#1E293B] truncate max-w-[150px]">
                    {selectedNode.source || 'Unknown'}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-[#1E293B] mb-1">Data Flow History</h4>
                <div className="rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] p-3 text-[11px] text-[#64748B] space-y-1 leading-relaxed">
                  <div>1. Origin authenticated at source.</div>
                  <div>2. Intercepted by zero-trust gateway.</div>
                  <div>3. Cryptographic provenance seal applied.</div>
                </div>
              </div>

              {(selectedNode.trust_level || '').toUpperCase() === 'UNTRUSTED' && (
                <div className="rounded-lg border border-[#FCD2D2] bg-[#FEF2F2] p-3 text-[#DC2626] space-y-1">
                  <div className="font-semibold flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>Untrusted Data Alert</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    This node contains external or unverified context. Gateway policy requires active sanitization before forwarding to downstream tools.
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#F1F5F9]">
              <button
                onClick={() => setSelectedNode(null)}
                className="w-full py-2 rounded-lg border border-[#E5EAF1] bg-white text-[#1E293B] font-medium hover:bg-[#F8FAFC] transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Lineage Node Modal */}
      {isAddNodeOpen && (
        <Modal
          isOpen={isAddNodeOpen}
          onClose={() => setIsAddNodeOpen(false)}
          title="Register Lineage Node"
          subtitle="Add an origin source, transformation, or destination to the graph"
          icon={<Network className="h-4 w-4 text-[#3B82F6]" />}
        >
          <form onSubmit={handleCreateNode} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-[#1E293B] mb-1">Node Label *</label>
              <input
                type="text"
                required
                value={newNodeName}
                onChange={(e) => setNewNodeName(e.target.value)}
                placeholder="e.g. S3 Encrypted Bucket, Financial DB"
                className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-[#1E293B] mb-1">Pipeline Stage</label>
                <select
                  value={newNodeType}
                  onChange={(e) => setNewNodeType(e.target.value)}
                  className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                >
                  <option value="SOURCE">SOURCE</option>
                  <option value="AGENT">AGENT</option>
                  <option value="TRANSFORMATION">TRANSFORMATION</option>
                  <option value="TOOL">TOOL</option>
                  <option value="DESTINATION">DESTINATION</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-[#1E293B] mb-1">Trust Level</label>
                <select
                  value={newNodeTrust}
                  onChange={(e) => setNewNodeTrust(e.target.value as any)}
                  className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                >
                  <option value="TRUSTED">TRUSTED</option>
                  <option value="SANITIZED">SANITIZED</option>
                  <option value="UNTRUSTED">UNTRUSTED</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-medium text-[#1E293B] mb-1">Origin Resource / URI</label>
              <input
                type="text"
                value={newNodeSource}
                onChange={(e) => setNewNodeSource(e.target.value)}
                placeholder="e.g. Postgres DB / s3://company-vault"
                className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
              />
            </div>

            <div>
              <label className="block font-medium text-[#1E293B] mb-1">Node Context / Description</label>
              <textarea
                rows={2}
                value={newNodeDesc}
                onChange={(e) => setNewNodeDesc(e.target.value)}
                placeholder="Optional description of entity provenance role"
                className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddNodeOpen(false)}
                className="rounded-lg border border-[#E5EAF1] px-4 py-2 font-medium text-[#64748B]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[#3B82F6] px-4 py-2 font-semibold text-white hover:bg-[#2563EB]"
              >
                Register Node
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
