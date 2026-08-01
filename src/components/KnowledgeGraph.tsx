import { useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useApp } from '../context/AppContext';

import ListenButton from './ListenButton';
interface KnowledgeGraphProps {
  onClose: () => void;
}

type GraphNodeData = {
  label: string;
  emoji: string;
  color: string;
  size: number;
  type: string;
};

// عقدة مخصصة
function CustomNode({ data }: { data: GraphNodeData }) {
  return (
    <div className={`relative group`}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div 
        className="flex flex-col items-center justify-center rounded-2xl transition-all duration-300 hover:scale-110 cursor-pointer"
        style={{ 
          width: data.size, 
          height: data.size,
          backgroundColor: data.color + '20',
          border: `2px solid ${data.color}60`,
          boxShadow: `0 0 20px ${data.color}30, 0 0 60px ${data.color}10`
        }}
      >
        <span className="text-2xl" style={{ fontSize: data.size * 0.35 }}>{data.emoji}</span>
      </div>
      <div className="absolute -bottom-1 transform translate-y-full">
        <span className="text-xs font-medium text-white bg-black/70 px-2 py-0.5 rounded-full whitespace-nowrap backdrop-blur-sm">
          {data.label}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

const nodeTypes = { customNode: CustomNode };

export default function KnowledgeGraph({ onClose }: KnowledgeGraphProps) {
  const { notes, projects, language } = useApp();
  const KG = {
    ar: { title: 'خريطة العقل التفاعلية', stats: (n: number, p: number, t: number) => `${n} ملاحظة • ${p} مشروع • ${t} وسم • شبكة ذكاء اصطناعي`,
          reset: 'إعادة ضبط', project: '📁 مشروع', idea: '💡 فكرة', tag: '🏷️ وسم', note: '📝 ملاحظة',
          connections: (n: number) => `${n} اتصال`, hintDrag: '🖱️ اسحب للتنقل', hintZoom: '🔄 عجلة الفأرة للتكبير',
          hintClick: '👆 اضغط على أي عقدة لرؤية اتصالاتها', hintTag: '🏷️ اضغط على وسم لتصفية العرض' },
    en: { title: 'Interactive mind map', stats: (n: number, p: number, t: number) => `${n} notes • ${p} projects • ${t} tags • AI network`,
          reset: 'Reset', project: '📁 Project', idea: '💡 Idea', tag: '🏷️ Tag', note: '📝 Note',
          connections: (n: number) => `${n} connections`, hintDrag: '🖱️ Drag to pan', hintZoom: '🔄 Mouse wheel to zoom',
          hintClick: '👆 Click any node to see its connections', hintTag: '🏷️ Click a tag to filter the view' },
    es: { title: 'Mapa mental interactivo', stats: (n: number, p: number, t: number) => `${n} notas • ${p} proyectos • ${t} etiquetas • red de IA`,
          reset: 'Reiniciar', project: '📁 Proyecto', idea: '💡 Idea', tag: '🏷️ Etiqueta', note: '📝 Nota',
          connections: (n: number) => `${n} conexiones`, hintDrag: '🖱️ Arrastra para mover', hintZoom: '🔄 Rueda del ratón para zoom',
          hintClick: '👆 Haz clic en un nodo para ver sus conexiones', hintTag: '🏷️ Haz clic en una etiqueta para filtrar' },
    zh: { title: '交互式思维导图', stats: (n: number, p: number, t: number) => `${n} 条笔记 • ${p} 个项目 • ${t} 个标签 • AI 网络`,
          reset: '重置', project: '📁 项目', idea: '💡 想法', tag: '🏷️ 标签', note: '📝 笔记',
          connections: (n: number) => `${n} 个连接`, hintDrag: '🖱️ 拖动平移', hintZoom: '🔄 滚轮缩放',
          hintClick: '👆 点击任意节点查看其连接', hintTag: '🏷️ 点击标签筛选视图' },
  }[(language as 'ar'|'en'|'es'|'zh')] ?? {
    title: 'Interactive mind map', stats: (n: number, p: number, t: number) => `${n} notes • ${p} projects • ${t} tags • AI network`,
    reset: 'Reset', project: '📁 Project', idea: '💡 Idea', tag: '🏷️ Tag', note: '📝 Note',
    connections: (n: number) => `${n} connections`, hintDrag: '🖱️ Drag to pan', hintZoom: '🔄 Mouse wheel to zoom',
    hintClick: '👆 Click any node to see its connections', hintTag: '🏷️ Click a tag to filter the view' };
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [highlightTag, setHighlightTag] = useState<string | null>(null);
  const selectedData = selectedNode?.data as GraphNodeData | undefined;

  // بناء العقد والأضلاع
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const tagMap = new Map<string, string[]>();

    // عقد المشاريع (في الوسط)
    projects.forEach((project, idx) => {
      const angle = (idx / projects.length) * 2 * Math.PI;
      const radius = 150;
      const id = `project-${project.id}`;
      nodes.push({
        id,
        type: 'customNode',
        position: { 
          x: 600 + Math.cos(angle) * radius, 
          y: 350 + Math.sin(angle) * radius 
        },
        data: { 
          label: project.name, 
          emoji: '📁', 
          color: project.color, 
          size: 80,
          type: 'project'
        },
      });
    });

    // عقد الملاحظات (حول المشاريع)
    notes.forEach((note, idx) => {
      const angle = (idx / Math.max(1, notes.length)) * 2 * Math.PI;
      const radius = 280 + (idx % 3) * 60;
      const id = `note-${note.id}`;
      const color = note.type === 'idea' ? '#F59E0B' : '#8B5CF6';
      nodes.push({
        id,
        type: 'customNode',
        position: { 
          x: 600 + Math.cos(angle) * radius, 
          y: 350 + Math.sin(angle) * radius 
        },
        data: { 
          label: note.title.length > 18 ? note.title.substring(0, 18) + '...' : note.title, 
          emoji: note.type === 'idea' ? '💡' : '📝', 
          color, 
          size: note.isPinned ? 65 : 50,
          type: note.type
        },
      });

      // ربط الملاحظة بالمشروع
      if (note.projectId) {
        edges.push({
          id: `edge-${note.id}-project`,
          source: id,
          target: `project-${note.projectId}`,
          animated: true,
          style: { stroke: color, strokeWidth: 2, opacity: 0.6 },
          markerEnd: { type: MarkerType.ArrowClosed, color },
        });
      }

      // جمع الوسوم
      note.tags.forEach(tag => {
        const noteIds = tagMap.get(tag) ?? [];
        noteIds.push(id);
        tagMap.set(tag, noteIds);
      });
    });

    // عقد الوسوم (أعلى الملاحظات المرتبطة)
    const tagEntries = Array.from(tagMap.entries()).filter(([_, ids]) => ids.length >= 1);
    tagEntries.forEach(([tag, noteIds], idx) => {
      const tagId = `tag-${tag}`;
      const relatedNodes = noteIds.map(nid => nodes.find(n => n.id === nid)).filter(Boolean) as Node[];
      let avgX = 600, avgY = 50;
      if (relatedNodes.length > 0) {
        avgX = relatedNodes.reduce((s, n) => s + n.position.x, 0) / relatedNodes.length;
        avgY = Math.min(...relatedNodes.map(n => n.position.y)) - 120 + (idx % 3) * 30;
      }

      nodes.push({
        id: tagId,
        type: 'customNode',
        position: { x: avgX, y: Math.max(30, avgY) },
        data: { 
          label: `#${tag}`, 
          emoji: '🏷️', 
          color: '#10B981', 
          size: 40,
          type: 'tag'
        },
      });

      // ربط الوسم بملاحظاته
      noteIds.forEach(noteId => {
        edges.push({
          id: `edge-${tagId}-${noteId}`,
          source: tagId,
          target: noteId,
          style: { stroke: '#10B981', strokeWidth: 1, opacity: 0.4, strokeDasharray: '5 5' },
        });
      });
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [notes, projects]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // إعادة بناء عند تغير البيانات
  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    // إبراز الاتصالات
    const connectedEdges = initialEdges.filter(e => e.source === node.id || e.target === node.id);
    setEdges(prev => prev.map(e => ({
      ...e,
      style: {
        ...e.style,
        opacity: connectedEdges.some(ce => ce.id === e.id) ? 1 : 0.1,
        strokeWidth: connectedEdges.some(ce => ce.id === e.id) ? 3 : 1,
      }
    })));
    setNodes(prev => prev.map(n => ({
      ...n,
      style: {
        ...n.style,
        opacity: n.id === node.id || connectedEdges.some(ce => ce.source === n.id || ce.target === n.id) ? 1 : 0.3,
      }
    })));
  }, [initialEdges]);

  const resetHighlight = () => {
    setSelectedNode(null);
    setEdges(initialEdges);
    setNodes(initialNodes);
    setHighlightTag(null);
  };

  // تجميع كل الوسوم
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach(n => n.tags.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [notes]);

  return (
    <div className="fixed inset-0 pb-banner z-50 bg-gradient-to-br from-gray-950 via-indigo-950 to-purple-950 flex flex-col safe-all" data-listen-scope>
      {/* رأس النافذة */}
      <div className="bg-black/50 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-2xl">
            🕸️
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{KG.title}</h2>
            <p className="text-sm text-white/50">
              {KG.stats(notes.length, projects.length, allTags.length)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* أزرار الفلترة حسب الوسم */}
          <div className="flex flex-wrap gap-1 max-w-md overflow-x-auto">
            {allTags.slice(0, 8).map(tag => (
              <button
                key={tag}
                onClick={() => {
                  if (highlightTag === tag) {
                    resetHighlight();
                    return;
                  }
                  setHighlightTag(tag);
                  const taggedNotes = notes.filter(n => n.tags.includes(tag));
                  const taggedIds = taggedNotes.map(n => `note-${n.id}`);
                  setNodes(prev => prev.map(n => ({
                    ...n,
                    style: { ...n.style, opacity: n.id.startsWith('tag-') && n.data.label === `#${tag}` ? 1 : taggedIds.includes(n.id) || n.id === `tag-${tag}` ? 1 : 0.2 }
                  })));
                }}
                className={`px-2 py-1 rounded-full text-xs transition-all ${
                  highlightTag === tag
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
          <button onClick={resetHighlight} className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors">
            {KG.reset}
          </button>
          <ListenButton style="exciting" darkMode className="me-1" label="استمع للمحتوى" />
          <button onClick={onClose} className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* الرسم البياني */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.3}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(255,255,255,0.05)" gap={50} />
          <Controls className="!bg-black/50 !border-white/10 !rounded-xl" />
          <MiniMap 
            className="!bg-black/80 !border-white/10 !rounded-xl"
            maskColor="rgba(0,0,0,0.7)"
            nodeColor={(n) => (n.data as GraphNodeData).color || '#8B5CF6'}
          />
          
          {/* لوحة المعلومات */}
          <Panel position="bottom-center" className="!mb-6">
            {selectedNode ? (
              <div className="bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl p-5 shadow-2xl max-w-md">
                <div className="flex items-start gap-4">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: (selectedData?.color || '#8B5CF6') + '30' }}
                  >
                    {selectedData?.emoji}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-bold text-lg">{selectedData?.label}</h3>
                      <button onClick={resetHighlight} className="text-white/50 hover:text-white">✕</button>
                    </div>
                    <p className="text-sm text-white/50 mt-1">
                      {selectedData?.type === 'project' ? KG.project : 
                       selectedData?.type === 'idea' ? KG.idea : 
                       selectedData?.type === 'tag' ? KG.tag : KG.note}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/70">
                        {KG.connections(edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length)}
                      </span>
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedData?.color || '#8B5CF6' }} />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-white/60 text-sm flex items-center gap-6">
                <span>{KG.hintDrag}</span>
                <span>{KG.hintZoom}</span>
                <span>{KG.hintClick}</span>
                <span>{KG.hintTag}</span>
              </div>
            )}
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}
