import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  GitFork,
  Plus,
  RefreshCw,
  ShieldX,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Copy,
  X,
} from 'lucide-react';
import { api } from '../../services/api.client';
import type { Delegation, Agent } from '../../types';
import { Modal } from '../ui/Modal';
import { truncateId } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

interface GraphNode {
  id: string;
  name: string;
  role: string;
  status: 'active' | 'limited' | 'revoked';
  depth: number;
  x: number;
  y: number;
  parentAgentId?: string;
  delegationId?: string;
  scope?: any;
  expiresAt?: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  scopeTool: string;
  status: string;
}

export const DelegationTab: React.FC = () => {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  // Graph View & Transform controls
  const [viewMode, setViewMode] = useState<'graph' | 'tree'>('graph');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState('');

  // Node Dragging State
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeDragOffset, setNodeDragOffset] = useState<{
    mouseX: number;
    mouseY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  // Inspector State
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [parentId, setParentId] = useState('');
  const [childId, setChildId] = useState('');
  const [scopeTool, setScopeTool] = useState('filesystem_tool');
  const [scopeOp, setScopeOp] = useState('read_file');
  const [maxDepth, setMaxDepth] = useState(1);
  const [hoursValid, setHoursValid] = useState(4);
  const [issuedTokenData, setIssuedTokenData] = useState<any>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Revoke Modal state
  const [revokeTarget, setRevokeTarget] = useState<Delegation | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [delList, agentList] = await Promise.all([
        api.listDelegations(),
        api.listAgents('active'),
      ]);
      setDelegations(delList);
      setAgents(agentList);
      if (agentList.length >= 2) {
        if (!parentId) setParentId(agentList[0].id);
        if (!childId) setChildId(agentList[1].id);
      }
    } catch (err: any) {
      toast.error('Delegation Fetch Error', err.message);
    } finally {
      setLoading(false);
    }
  }, [childId, parentId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute graph nodes & edges
  const { nodes, edges } = useMemo(() => {
    const calculatedNodes: GraphNode[] = [];
    const calculatedEdges: GraphEdge[] = [];

    // Root / Parent agents
    const childAgentIds = new Set(delegations.map((d) => d.child_agent_id));

    // Position agents in layout
    agents.forEach((ag, idx) => {
      const isChild = childAgentIds.has(ag.id);
      const delegation = delegations.find((d) => d.child_agent_id === ag.id);

      let status: 'active' | 'limited' | 'revoked' = 'active';
      if (ag.status === 'revoked' || (delegation && delegation.status === 'revoked')) {
        status = 'revoked';
      } else if (delegation && (delegation.max_depth || 1) <= 1) {
        status = 'limited';
      }

      // Default layout coordinates
      let defaultX = 140;
      let defaultY = 120 + idx * 110;

      if (viewMode === 'tree') {
        if (!isChild) {
          defaultX = 140;
          defaultY = 100 + idx * 130;
        } else {
          defaultX = 500;
          defaultY = 100 + (idx % 4) * 130;
        }
      } else {
        // Organic radial / hierarchy layout
        const angle = (idx / Math.max(1, agents.length)) * 2 * Math.PI;
        defaultX = 380 + Math.cos(angle) * (isChild ? 240 : 120);
        defaultY = 280 + Math.sin(angle) * (isChild ? 180 : 90);
      }

      calculatedNodes.push({
        id: ag.id,
        name: ag.name,
        role: ag.role,
        status,
        depth: isChild ? 2 : 1,
        x: nodePositions[ag.id]?.x ?? defaultX,
        y: nodePositions[ag.id]?.y ?? defaultY,
        parentAgentId: delegation?.parent_agent_id,
        delegationId: delegation?.id,
        scope: delegation?.scope,
        expiresAt: delegation?.expires_at,
      });
    });

    // Edges
    delegations.forEach((d) => {
      calculatedEdges.push({
        id: d.id,
        source: d.parent_agent_id,
        target: d.child_agent_id,
        scopeTool: d.scope?.tool_name || 'tool',
        status: d.status,
      });
    });

    return { nodes: calculatedNodes, edges: calculatedEdges };
  }, [agents, delegations, viewMode, nodePositions]);

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

  // Node Drag
  const handleNodeMouseDown = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    setDraggingNodeId(node.id);
    setNodeDragOffset({
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: node.x,
      initialY: node.y,
    });
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleCreateDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parentId === childId) {
      toast.warning('Invalid Hierarchy', 'Parent and Child agents must be distinct.');
      return;
    }

    try {
      const result = await api.createDelegation({
        parent_agent_id: parentId,
        child_agent_id: childId,
        scope: {
          tool_name: scopeTool,
          operation: scopeOp,
        },
        max_depth: Number(maxDepth),
        expires_in_hours: Number(hoursValid),
      });

      setIssuedTokenData(result);
      toast.success('Delegation Established', 'Subscoping contract generated.');
      fetchData();
    } catch (err: any) {
      toast.error('Delegation Failed', err.message);
    }
  };

  const handleRevokeConfirm = async () => {
    if (!revokeTarget || !revokeReason.trim()) return;
    setIsRevoking(true);
    try {
      await api.revokeDelegation(revokeTarget.id, revokeReason);
      toast.info('Delegation Revoked', 'Delegation token neutralized.');
      setRevokeTarget(null);
      setRevokeReason('');
      if (selectedNode?.delegationId === revokeTarget.id) {
        setSelectedNode((prev) => (prev ? { ...prev, status: 'revoked' } : null));
      }
      fetchData();
    } catch (err: any) {
      toast.error('Revocation Error', err.message);
    } finally {
      setIsRevoking(false);
    }
  };

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.filter(
      (n) => n.name.toLowerCase().includes(q) || n.role.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)
    );
  }, [nodes, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E5EAF1] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">
            Delegation Graph
          </h1>
          <p className="text-xs text-[#64748B] mt-1">
            Interactive multi-tier agent delegation hierarchy and subscoped token management.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5EAF1] bg-white px-3 py-2 text-xs font-medium text-[#1E293B] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-all shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-[#3B82F6] ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => {
              setIssuedTokenData(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2563EB] transition-all shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Delegation</span>
          </button>
        </div>
      </div>

      {/* Graph Workspace Layout */}
      <div className="relative rounded-2xl border border-[#E5EAF1] bg-white shadow-2xs overflow-hidden h-[620px] flex">
        {/* Graph Canvas Container */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="flex-1 h-full relative cursor-grab active:cursor-grabbing overflow-hidden bg-[#FAFCFF] select-none"
        >
          {/* Subtle Canvas Dot Grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Floating Controls Bar at Top Left */}
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-white/95 backdrop-blur-xs p-1.5 rounded-xl border border-[#E5EAF1] shadow-sm">
            {/* Search Nodes */}
            <div className="w-44">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search agents..."
                className="w-full rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] px-2.5 py-1 text-xs text-[#1E293B] focus:border-[#3B82F6] focus:outline-none"
              />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] p-0.5 text-xs">
              <button
                onClick={() => setViewMode('graph')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  viewMode === 'graph' ? 'bg-white shadow-2xs font-semibold text-[#3B82F6]' : 'text-[#64748B]'
                }`}
              >
                Graph
              </button>
              <button
                onClick={() => setViewMode('tree')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  viewMode === 'tree' ? 'bg-white shadow-2xs font-semibold text-[#3B82F6]' : 'text-[#64748B]'
                }`}
              >
                Tree
              </button>
            </div>

            <div className="h-4 w-px bg-[#E5EAF1]" />

            {/* Zoom Controls */}
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.15, 2))}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1E293B] hover:bg-[#F1F5F9]"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1E293B] hover:bg-[#F1F5F9]"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleResetView}
              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1E293B] hover:bg-[#F1F5F9]"
              title="Reset View"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* SVG Graph Drawing Layer */}
          <svg
            className="w-full h-full pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            <defs>
              <marker
                id="delegationArrow"
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

            {/* Edges */}
            {edges.map((edge) => {
              const srcNode = nodes.find((n) => n.id === edge.source);
              const tgtNode = nodes.find((n) => n.id === edge.target);
              if (!srcNode || !tgtNode) return null;

              const isHighlighted = selectedNode?.id === srcNode.id || selectedNode?.id === tgtNode.id;

              // Smooth cubic bezier path
              const midX = (srcNode.x + tgtNode.x) / 2;
              const pathD = `M ${srcNode.x + 80} ${srcNode.y + 35} C ${midX} ${srcNode.y + 35}, ${midX} ${tgtNode.y + 35}, ${tgtNode.x} ${tgtNode.y + 35}`;

              return (
                <g key={edge.id}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isHighlighted ? '#3B82F6' : '#94A3B8'}
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    strokeDasharray={edge.status === 'REVOKED' ? '4 4' : undefined}
                    markerEnd="url(#delegationArrow)"
                    opacity={isHighlighted ? 1 : 0.6}
                  />
                  <text
                    x={midX}
                    y={(srcNode.y + tgtNode.y) / 2 - 6}
                    fill="#64748B"
                    fontSize="10"
                    textAnchor="middle"
                    className="font-mono bg-white"
                  >
                    {edge.scopeTool}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* HTML Interactive Nodes Layer */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {filteredNodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;

              // Node Color Theme
              const borderTheme =
                node.status === 'revoked'
                  ? 'border-[#FCD2D2] bg-[#FEF2F2]'
                  : node.status === 'limited'
                  ? 'border-[#FDE3B7] bg-[#FFF4E5]'
                  : 'border-[#D4E5FF] bg-white';

              const activeRing = isSelected ? 'ring-2 ring-[#3B82F6] shadow-md' : 'shadow-2xs';

              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  onMouseDown={(e) => handleNodeMouseDown(e, node)}
                  style={{
                    position: 'absolute',
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    width: '180px',
                  }}
                  className={`pointer-events-auto rounded-xl border p-3 cursor-pointer transition-shadow select-none ${borderTheme} ${activeRing}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] font-semibold text-[#64748B]">
                      DEPTH {node.depth}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        node.status === 'revoked'
                          ? 'bg-[#DC2626]'
                          : node.status === 'limited'
                          ? 'bg-[#F59E0B]'
                          : 'bg-[#3B82F6]'
                      }`}
                    />
                  </div>

                  <div className="mt-1 font-semibold text-xs text-[#1E293B] truncate">
                    {node.name}
                  </div>
                  <div className="text-[10px] text-[#64748B] font-mono truncate mt-0.5">
                    {node.role}
                  </div>

                  <div className="mt-2 pt-2 border-t border-[#E5EAF1] flex items-center justify-between text-[10px]">
                    <span className="text-[#64748B]">{node.parentAgentId ? 'Child Agent' : 'Root Agent'}</span>
                    <span
                      className={`font-semibold capitalize ${
                        node.status === 'revoked'
                          ? 'text-[#DC2626]'
                          : node.status === 'limited'
                          ? 'text-[#D97706]'
                          : 'text-[#3B82F6]'
                      }`}
                    >
                      {node.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right-Side Inspector Drawer */}
        {selectedNode && (
          <div className="w-80 border-l border-[#E5EAF1] bg-white p-5 flex flex-col justify-between shadow-lg z-30 animate-fade-in">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#EEF4FF] text-[#3B82F6]">
                    <GitFork className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1E293B]">Delegation Inspector</h3>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="p-1 rounded-md text-[#94A3B8] hover:text-[#1E293B]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-[#64748B] block text-[11px]">Selected Agent</span>
                  <span className="font-bold text-[#1E293B] text-sm">{selectedNode.name}</span>
                </div>

                <div className="rounded-lg bg-[#F8FAFC] border border-[#E5EAF1] p-3 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Role:</span>
                    <span className="font-mono text-[#1E293B]">{selectedNode.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Delegation Depth:</span>
                    <span className="font-semibold text-[#1E293B]">Tier {selectedNode.depth}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Parent Agent:</span>
                    <span className="font-mono text-[#3B82F6]">
                      {selectedNode.parentAgentId ? truncateId(selectedNode.parentAgentId, 8) : 'Root (None)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#64748B]">Token Status:</span>
                    <span
                      className={`font-semibold capitalize ${
                        selectedNode.status === 'revoked'
                          ? 'text-[#DC2626]'
                          : selectedNode.status === 'limited'
                          ? 'text-[#F59E0B]'
                          : 'text-[#16A34A]'
                      }`}
                    >
                      {selectedNode.status}
                    </span>
                  </div>
                </div>

                {selectedNode.scope && (
                  <div>
                    <span className="text-[#64748B] font-medium block mb-1">Subscoped Boundary</span>
                    <div className="rounded-lg border border-[#E5EAF1] p-2.5 font-mono text-[11px] bg-[#F8FAFC] space-y-1">
                      <div>Tool: <strong className="text-[#3B82F6]">{selectedNode.scope.tool_name}</strong></div>
                      <div>Op: <strong className="text-[#1E293B]">{selectedNode.scope.operation}</strong></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {selectedNode.delegationId && selectedNode.status !== 'revoked' && (
              <div className="pt-4 border-t border-[#F1F5F9]">
                <button
                  onClick={() => {
                    const del = delegations.find((d) => d.id === selectedNode.delegationId);
                    if (del) {
                      setRevokeTarget(del);
                      setRevokeReason('');
                    }
                  }}
                  className="w-full py-2 rounded-lg border border-[#FCD2D2] bg-[#FEF2F2] text-[#DC2626] font-medium text-xs hover:bg-[#FDE2E2] transition-colors"
                >
                  Revoke Delegation Contract
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delegation Creation Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Establish Agent Delegation"
          subtitle="Issue a cryptographic subscoping delegation contract"
          icon={<GitFork className="h-4 w-4 text-[#3B82F6]" />}
        >
          {issuedTokenData ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-[#BCE8CD] bg-[#E8F7EF] p-4 text-xs text-[#1E293B] space-y-1">
                <div className="font-semibold text-[#16A34A] flex items-center gap-1.5">
                  <Check className="h-4 w-4" />
                  <span>Delegation Contract Established</span>
                </div>
                <p className="text-[#64748B]">
                  Child agent has received an ephemeral scoped token with maximum depth constraint.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#1E293B] mb-1">
                  Delegation Token
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-[#E5EAF1] bg-[#F8FAFC] p-2.5 font-mono text-xs text-[#3B82F6]">
                  <span className="flex-1 truncate">{issuedTokenData.delegation_token || 'TOKEN-GRANTED'}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(issuedTokenData.delegation_token || '');
                      setCopiedToken(true);
                      setTimeout(() => setCopiedToken(false), 2000);
                    }}
                    className="p-1 rounded text-[#64748B] hover:text-[#1E293B]"
                  >
                    {copiedToken ? <Check className="h-4 w-4 text-[#16A34A]" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg bg-[#3B82F6] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2563EB]"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateDelegation} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Parent Agent</label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                  >
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Child Agent</label>
                  <select
                    value={childId}
                    onChange={(e) => setChildId(e.target.value)}
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                  >
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Scoped Tool</label>
                  <input
                    type="text"
                    value={scopeTool}
                    onChange={(e) => setScopeTool(e.target.value)}
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Scoped Operation</label>
                  <input
                    type="text"
                    value={scopeOp}
                    onChange={(e) => setScopeOp(e.target.value)}
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Max Delegation Depth</label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={maxDepth}
                    onChange={(e) => setMaxDepth(Number(e.target.value))}
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                  />
                </div>
                <div>
                  <label className="block font-medium text-[#1E293B] mb-1">Expiration (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="72"
                    value={hoursValid}
                    onChange={(e) => setHoursValid(Number(e.target.value))}
                    className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-[#E5EAF1] px-4 py-2 font-medium text-[#64748B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#3B82F6] px-4 py-2 font-semibold text-white hover:bg-[#2563EB]"
                >
                  Create Delegation
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}

      {/* Revocation Confirmation Modal */}
      {revokeTarget && (
        <Modal
          isOpen={!!revokeTarget}
          onClose={() => setRevokeTarget(null)}
          title="Revoke Delegation"
          subtitle={`Revoke delegation #${truncateId(revokeTarget.id, 8)}`}
          icon={<ShieldX className="h-4 w-4 text-[#DC2626]" />}
        >
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-[#FCD2D2] bg-[#FEF2F2] p-3 text-[#DC2626]">
              Revoking this delegation will immediately invalidate all child execution permissions under this contract.
            </div>

            <div>
              <label className="block font-medium text-[#1E293B] mb-1">Reason for Revocation *</label>
              <textarea
                rows={3}
                required
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="State the reason for revoking this delegation contract..."
                className="w-full rounded-lg border border-[#E5EAF1] bg-white p-2 text-[#1E293B] focus:border-[#DC2626]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                className="rounded-lg border border-[#E5EAF1] px-4 py-2 font-medium text-[#64748B]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!revokeReason.trim() || isRevoking}
                onClick={handleRevokeConfirm}
                className="rounded-lg bg-[#DC2626] px-4 py-2 font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50"
              >
                {isRevoking ? 'Revoking...' : 'Confirm Revocation'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
