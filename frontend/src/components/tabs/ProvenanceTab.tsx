import React, { useEffect, useState } from 'react';
import { Network, ArrowRight, RefreshCw, Eye } from 'lucide-react';
import { api } from '../../services/api.client';
import type { ProvenanceGraph, ProvenanceNode } from '../../types';
import { TrustBadge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';

export const ProvenanceTab: React.FC = () => {
  const [graph, setGraph] = useState<ProvenanceGraph>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<ProvenanceNode | null>(null);

  const fetchGraph = async () => {
    try {
      setLoading(true);
      const res = await api.getProvenanceGraph();
      setGraph(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Network className="h-7 w-7 text-cyan-400" />
            Provenance & Data-Flow Lineage Explorer
          </h1>
          <p className="text-sm text-slate-400">
            Auditable graph of origin sources, prompt injection risk tags, agent transformations, and influenced tool actions.
          </p>
        </div>
        <button
          onClick={fetchGraph}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Graph
        </button>
      </div>

      {loading && graph.nodes.length === 0 ? (
        <LoadingSpinner message="BUILDING PROVENANCE GRAPH LINEAGE..." />
      ) : (
        <>
          {/* Visual Pipeline / Flow Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {graph.nodes.map((node, idx) => (
              <div
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className="cursor-pointer rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur transition-all hover:border-cyan-500/50 hover:bg-slate-900/80 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300 border border-slate-700">
                      {node.type}
                    </span>
                    <TrustBadge trust={node.trust_level} />
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-white line-clamp-2">{node.name}</h3>
                  {node.source && (
                    <p className="mt-2 text-xs text-slate-400 font-mono truncate" title={node.source}>
                      Src: {node.source}
                    </p>
                  )}
                </div>

                <div className="mt-4 border-t border-slate-800/80 pt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono">Node #{idx + 1}</span>
                  <span className="text-cyan-400 flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Inspect
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Relationships / Edges Table */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 backdrop-blur">
            <h2 className="text-sm font-semibold text-white border-b border-slate-800 pb-3">
              Provenance Information Flow & Lineage Edges
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Source Origin Node</th>
                    <th className="py-2.5 px-3 font-semibold">Relationship Type</th>
                    <th className="py-2.5 px-3 font-semibold">Target Action / Transform Node</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                  {graph.edges.map((e) => {
                    const srcNode = graph.nodes.find((n) => n.id === e.source);
                    const tgtNode = graph.nodes.find((n) => n.id === e.target);
                    return (
                      <tr key={e.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 text-white font-sans font-medium">
                          {srcNode ? srcNode.name : e.source}
                        </td>
                        <td className="py-2.5 px-3 text-cyan-400 font-semibold flex items-center gap-1.5">
                          <ArrowRight className="h-3.5 w-3.5" /> {e.type}
                        </td>
                        <td className="py-2.5 px-3 text-white font-sans font-medium">
                          {tgtNode ? tgtNode.name : e.target}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Node Detail Modal using shared Modal */}
      <Modal
        isOpen={!!selectedNode}
        onClose={() => setSelectedNode(null)}
        title={selectedNode?.name || ''}
        subtitle={selectedNode?.id}
      >
        {selectedNode && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-slate-400 font-semibold">Node Classification:</span>
              <span className="font-mono text-white">{selectedNode.type}</span>
            </div>
            <div className="flex items-center justify-between bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-slate-400 font-semibold">Trust Assessment:</span>
              <TrustBadge trust={selectedNode.trust_level} />
            </div>
            <div>
              <span className="font-semibold text-slate-400">Metadata & Provenance Details:</span>
              <pre className="mt-1 max-h-48 overflow-auto rounded bg-slate-950 p-3 font-mono text-[11px] text-cyan-300 border border-slate-800">
                {JSON.stringify(selectedNode.metadata || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
