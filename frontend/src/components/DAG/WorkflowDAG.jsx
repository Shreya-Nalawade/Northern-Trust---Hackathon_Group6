import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TaskNode } from './TaskNode';
import { layoutDag } from './dagLayout';

const nodeTypes = { taskNode: TaskNode };

export function WorkflowDAG({ tasks, onNodeClick }) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const { nodes, edges } = layoutDag(tasks || []);
    return { initialNodes: nodes, initialEdges: edges };
  }, [tasks]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useMemo(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (event, node) => {
      onNodeClick?.(node.data);
    },
    [onNodeClick]
  );

  return (
    <div className="workflow-dag">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { strokeWidth: 1.5 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="var(--border-0)"
          gap={24}
          size={1}
          variant="dots"
        />
      </ReactFlow>
    </div>
  );
}

export default WorkflowDAG;
