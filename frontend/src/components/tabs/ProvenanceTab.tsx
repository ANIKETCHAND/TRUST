import React, { useEffect, useState, useCallback } from 'react';
import {
  Network,
  ArrowRight,
  RefreshCw,
  Eye,
  Database,
  Cpu,
  Bot,
  Wrench,
  Globe,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../../services/api.client';
import type { ProvenanceGraph, ProvenanceNode } from '../../types';
import { TrustBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { TerminalBox } from '../ui/TerminalBox';
import { truncateId } from '../../utils/formatters';

export const ProvenanceTab: React.FC = () => {
  const [graph, setGraph] = useState<ProvenanceGraph>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<ProvenanceNode | null>(null);

  const fetchGraph = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getProvenanceGraph();
      setGraph(res);
    } catch (err) {
      console.error('Failed to retrieve provenance graph:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  const getNodeIcon = (type: string) => {
    const norm = (type || '').toLowerCase();
    if (norm.includes('source') || norm.includes('data')) return <Database className="h-4 w-4 text-kali-primary" />;
    if (norm.includes('transform') || norm.includes('filter')) return <Cpu className="h-4 w-4 text-kali-cyan" />;
    if (norm.includes('agent') || norm.includes('handoff')) return <Bot className="h-4 w-4 text-purple-400" />;
    if (norm.includes('tool') || norm.includes('exec')) return <Wrench className="h-4 w-4 text-kali-secure" />;
    if (norm.includes('api') || norm.includes('external')) return <Globe className="h-4 w-4 text-kali-warning" />;
    return <Network className="h-4 w-4 text-slate-400" />;
  };

  const getNodeBorder = (node: ProvenanceNode) => {
    const isVerified = node.trust_level === 'TRUSTED' || node.trust_level === 'SANITIZED';
    if (isVerified) return 'border-white/10 hover:border-kali-primary/60';
    return 'border-amber-500/20 hover:border-amber-500/50';
  };

  const verifiedCount = graph.nodes.filter(n => n.trust_level === 'TRUSTED' || n.trust_level === 'SANITIZED').length;
  const unverifiedCount = graph.nodes.length - verifiedCount;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Network className="h-6 w-6 text-kali-cyan" />
            Data Flow Provenance & Lineage
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Attribution graph tracking origin sources, agent context transformations, and tool actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchGraph}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-kali-cyan/40 hover:bg-white/[0.06] hover:text-white transition-all"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-cyan ${loading ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Provenance Verification Legend & Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Total Lineage Nodes</span>
            <span className="text-xl font-bold text-white mt-1 block">{graph.nodes.length}</span>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-kali-cyan/10 border border-kali-cyan/20 text-kali-cyan">
            <Network className="h-5 w-5" />
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Verified Origins</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-bold text-kali-secure">{verifiedCount}</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-kali-secure font-medium">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified
              </span>
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-kali-secure/10 border border-kali-secure/20 text-kali-secure">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 block font-medium">Directed Edges</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-bold text-white">{graph.edges.length}</span>
              {unverifiedCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                  <AlertTriangle className="h-3 w-3" /> {unverifiedCount} Heuristic
                </span>
              )}
            </div>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <ArrowRight className="h-5 w-5" />
          </div>
        </div>
      </div>

      {loading && graph.nodes.length === 0 ? (
        <LoadingSpinner message="Traversing data lineage directed graph..." />
      ) : (
        <>
          {/* Nodes Grid */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Lineage Nodes ({graph.nodes.length})</h2>
              <span className="text-xs text-slate-400">Click a node to inspect payload</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {graph.nodes.map((node) => {
                const isVerified = node.trust_level === 'TRUSTED' || node.trust_level === 'SANITIZED';
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`cursor-pointer rounded-2xl border bg-white/[0.02] p-4.5 transition-all flex flex-col justify-between hover:bg-white/[0.045] ${getNodeBorder(
                      node
                    )}`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/10">
                            {getNodeIcon(node.type)}
                          </div>
                          <span className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-slate-300 border border-white/10 uppercase">
                            {node.type}
                          </span>
                        </div>
                        <TrustBadge trust={node.trust_level} />
                      </div>

                      <h3 className="mt-3 text-xs font-semibold text-white line-clamp-2 leading-relaxed">{node.name}</h3>

                      {node.source && (
                        <p className="mt-1.5 text-[11px] text-slate-400 font-mono truncate" title={node.source}>
                          {node.source}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 border-t border-white/10 pt-3 flex items-center justify-between text-[11px]">
                      <span className={isVerified ? 'text-kali-secure font-medium flex items-center gap-1' : 'text-amber-400 font-medium flex items-center gap-1'}>
                        {isVerified ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                        {isVerified ? 'Verified' : 'Heuristic'}
                      </span>
                      <span className="text-kali-cyan font-medium flex items-center gap-1 hover:underline">
                        <Eye className="h-3.5 w-3.5" /> Inspect
                      </span>
                    </div>
                  </div>
                );
              })}
              {graph.nodes.length === 0 && (
                <div className="col-span-4 py-12 text-center text-xs text-slate-500 rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
                  No provenance nodes recorded
                </div>
              )}
            </div>
          </div>

          {/* Relationships / Edges Table */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
              <h2 className="text-sm font-semibold text-white">Directed Flow Relationships ({graph.edges.length})</h2>
              <span className="text-xs font-medium text-kali-cyan">DAG Topology</span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 text-[11px] text-slate-400 font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Source Origin Node</th>
                    <th className="py-2.5 px-3">Relationship / Transformation</th>
                    <th className="py-2.5 px-3">Target Node / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {graph.edges.map((e) => {
                    const srcNode = graph.nodes.find((n) => n.id === e.source);
                    const tgtNode = graph.nodes.find((n) => n.id === e.target);
                    return (
                      <tr key={e.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3 px-3 text-white font-medium">
                          {srcNode ? srcNode.name : e.source}
                        </td>
                        <td className="py-3 px-3 text-kali-cyan font-medium">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-kali-cyan/10 border border-kali-cyan/20">
                            <ArrowRight className="h-3 w-3 text-kali-primary" />
                            <span>{e.type}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-white font-medium">
                          {tgtNode ? tgtNode.name : e.target}
                        </td>
                      </tr>
                    );
                  })}
                  {graph.edges.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-500">
                        No directed relationships available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* NODE DETAIL MODAL */}
      <Modal
        isOpen={!!selectedNode}
        onClose={() => setSelectedNode(null)}
        title={selectedNode?.name || 'Node Details'}
        subtitle={`ID: ${selectedNode?.id || ''}`}
        maxWidth="xl"
      >
        {selectedNode && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Classification</span>
                <span className="text-white font-semibold mt-0.5 block">{selectedNode.type}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Trust Status</span>
                <div className="mt-1">
                  <TrustBadge trust={selectedNode.trust_level} />
                </div>
              </div>
              <div className="col-span-2 pt-2 border-t border-white/10">
                <span className="text-slate-400 text-[10px] uppercase font-semibold block">Origin Source</span>
                <span className="text-kali-cyan font-mono text-[11px] mt-0.5 block">{selectedNode.source || 'N/A'}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-300 font-semibold block mb-1.5">Raw Metadata & Evidence</span>
              <TerminalBox
                title={`Metadata: ${truncateId(selectedNode.id, 8)}`}
                copyContent={JSON.stringify(selectedNode.metadata || {}, null, 2)}
                maxHeight="max-h-60"
              >
                <pre>{JSON.stringify(selectedNode.metadata || {}, null, 2)}</pre>
              </TerminalBox>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
