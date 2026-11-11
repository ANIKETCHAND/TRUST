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
    if (isVerified) return 'border-kali-border hover:border-kali-primary/80';
    return 'border-kali-warning/50 hover:border-kali-warning';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-kali-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-kali-primary">// AGENT_SECURITY</span>
            <span className="text-slate-500 font-mono">/</span>
            <span className="font-mono text-xs text-kali-cyan">PROVENANCE_GRAPH</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5 mt-1">
            <Network className="h-6 w-6 text-kali-primary" />
            Data Flow Provenance & Lineage Explorer
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable attribution graph tracking origin sources, agent context transformations, prompt injection tags, and tool actions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchGraph}
            className="inline-flex items-center gap-1.5 rounded border border-kali-border bg-kali-card px-3 py-1.5 font-mono text-xs font-semibold text-slate-200 hover:border-kali-primary hover:bg-kali-elevated transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-kali-primary ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC GRAPH</span>
          </button>
        </div>
      </div>

      {/* Provenance Verification Legend */}
      <div className="rounded border border-kali-border bg-kali-card p-3 shadow-kali-card">
        <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
          <div className="flex items-center gap-4">
            <span className="text-slate-400 font-bold">// LINEAGE_VERIFICATION:</span>
            <span className="inline-flex items-center gap-1.5 text-kali-secure">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>[VERIFIED_PROVENANCE]</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-kali-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>[UNVERIFIED / HEURISTIC]</span>
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            STRICT AUDIT RULE: NEVER INFER UNCONFIRMED ROOTS AS CERTIFIED
          </div>
        </div>
      </div>

      {loading && graph.nodes.length === 0 ? (
        <LoadingSpinner message="TRAVERSING DATA LINEAGE DIRECTED GRAPH..." />
      ) : (
        <>
          {/* Nodes Grid */}
          <div>
            <div className="mb-2 font-mono text-[11px] font-bold text-slate-400">
              // LINEAGE_NODES ({graph.nodes.length})
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {graph.nodes.map((node) => {
                const isVerified = node.trust_level === 'TRUSTED' || node.trust_level === 'SANITIZED';
                return (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={`cursor-pointer rounded-lg border bg-kali-card p-4 transition-all shadow-kali-card flex flex-col justify-between ${getNodeBorder(
                      node
                    )}`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          {getNodeIcon(node.type)}
                          <span className="rounded bg-kali-bg px-2 py-0.5 font-mono text-[10px] text-slate-300 border border-kali-border uppercase">
                            {node.type}
                          </span>
                        </div>
                        <TrustBadge trust={node.trust_level} />
                      </div>

                      <h3 className="mt-3 text-xs font-bold text-white line-clamp-2">{node.name}</h3>

                      {node.source && (
                        <p className="mt-1.5 text-[11px] text-slate-400 font-mono truncate" title={node.source}>
                          › {node.source}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 border-t border-kali-border pt-2.5 flex items-center justify-between font-mono text-[10px]">
                      <span className={isVerified ? 'text-kali-secure font-bold' : 'text-kali-warning font-bold'}>
                        {isVerified ? '[VERIFIED]' : '[HEURISTIC]'}
                      </span>
                      <span className="text-kali-cyan flex items-center gap-1 hover:underline">
                        <Eye className="h-3 w-3" /> Inspect
                      </span>
                    </div>
                  </div>
                );
              })}
              {graph.nodes.length === 0 && (
                <div className="col-span-4 py-12 text-center font-mono text-xs text-slate-500 rounded-lg border border-dashed border-kali-border bg-kali-card/50">
                  // NO PROVENANCE GRAPH NODES RECORDED
                </div>
              )}
            </div>
          </div>

          {/* Relationships / Edges Table */}
          <div className="rounded-lg border border-kali-border bg-kali-card p-4 shadow-kali-card">
            <div className="flex items-center justify-between border-b border-kali-border pb-3">
              <h2 className="text-xs font-bold text-white font-mono">// DIRECTED_PROVENANCE_EDGES ({graph.edges.length})</h2>
              <span className="font-mono text-[10px] text-kali-cyan">[DAG_TOPOLOGY]</span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-kali-border bg-kali-bg/95 text-[11px] text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Source Origin Node</th>
                    <th className="py-2.5 px-3 font-semibold">Relationship / Transformation</th>
                    <th className="py-2.5 px-3 font-semibold">Target Node / Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-kali-border text-slate-300">
                  {graph.edges.map((e) => {
                    const srcNode = graph.nodes.find((n) => n.id === e.source);
                    const tgtNode = graph.nodes.find((n) => n.id === e.target);
                    return (
                      <tr key={e.id} className="hover:bg-kali-elevated/40 transition-colors">
                        <td className="py-2.5 px-3 text-white font-sans font-semibold">
                          {srcNode ? srcNode.name : e.source}
                        </td>
                        <td className="py-2.5 px-3 text-kali-cyan font-bold flex items-center gap-1.5">
                          <ArrowRight className="h-3.5 w-3.5 text-kali-primary" />
                          <span>{e.type}</span>
                        </td>
                        <td className="py-2.5 px-3 text-white font-sans font-semibold">
                          {tgtNode ? tgtNode.name : e.target}
                        </td>
                      </tr>
                    );
                  })}
                  {graph.edges.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-8 text-center text-slate-500">
                        // NO DIRECTED RELATIONSHIPS AVAILABLE
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
        title={`NODE // ${selectedNode?.name || ''}`}
        subtitle={`ID: ${selectedNode?.id || ''}`}
        maxWidth="xl"
      >
        {selectedNode && (
          <div className="space-y-4 font-mono text-xs">
            <div className="grid grid-cols-2 gap-3 rounded border border-kali-border bg-kali-bg p-3">
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Node Classification</span>
                <span className="text-white font-bold">{selectedNode.type}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Trust Level</span>
                <div className="mt-1">
                  <TrustBadge trust={selectedNode.trust_level} />
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400 text-[10px] uppercase block">Origin Source</span>
                <span className="text-kali-cyan">{selectedNode.source || 'N/A'}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-300 font-semibold block mb-1">Raw Provenance Metadata & Evidence</span>
              <TerminalBox
                title={`PROVENANCE METADATA // ${truncateId(selectedNode.id, 8)}`}
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
