import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { TaskNode } from './TaskNode';
import { layoutDag } from './dagLayout';
import { getStateConfig } from '../../utils/helpers';

const nodeTypes = { taskNode: TaskNode };

const minimapStyle = {
  backgroundColor: 'rgba(15, 12, 30, 0.8)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
};

export function WorkflowDAG({ tasks, onNodeClick }) {
  const { initialNodes, initialEdges } = useMemo(() => {
    const { nodes, edges } = layoutDag(tasks || []);
    return { initialNodes: nodes, initialEdges: edges };
  }, [tasks]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes/edges when tasks change (real-time updates)
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

  const minimapNodeColor = useCallback((node) => {
    const config = getStateConfig(node.data?.state, true);
    return config.color;
  }, []);

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
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="rgba(255,255,255,0.03)"
          gap={20}
          size={1}
          variant="dots"
        />
        <Controls
          className="dag-controls"
          showInteractive={false}
        />
        <MiniMap
          style={minimapStyle}
          nodeColor={minimapNodeColor}
          nodeStrokeWidth={2}
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}

export default WorkflowDAG;
