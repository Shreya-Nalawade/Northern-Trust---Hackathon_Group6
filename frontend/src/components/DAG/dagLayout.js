// ─── Dagre-based auto-layout for workflow DAG ─────────────────
// Implements a simple layered layout without external dagre dependency
// by using a topological sort + rank assignment approach.

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;
const HORIZONTAL_GAP = 80;
const VERTICAL_GAP = 50;

export function layoutDag(tasks) {
  if (!tasks || tasks.length === 0) return { nodes: [], edges: [] };

  // Build adjacency map
  const taskMap = {};
  tasks.forEach((t) => {
    taskMap[t.task_id] = t;
  });

  // Compute ranks using BFS from roots
  const inDegree = {};
  const children = {};
  tasks.forEach((t) => {
    inDegree[t.task_id] = 0;
    children[t.task_id] = [];
  });

  tasks.forEach((t) => {
    const deps = t.depends_on || [];
    deps.forEach((dep) => {
      if (children[dep]) {
        children[dep].push(t.task_id);
      }
      inDegree[t.task_id] = (inDegree[t.task_id] || 0) + 1;
    });
  });

  // Filter out special trigger-based tasks from main flow if they have no normal deps
  const triggerTasks = tasks.filter((t) => t.trigger && (!t.depends_on || t.depends_on.length === 0));
  const mainTasks = tasks.filter((t) => !t.trigger || (t.depends_on && t.depends_on.length > 0));

  // Topological sort with ranks
  const ranks = {};
  const queue = [];

  mainTasks.forEach((t) => {
    if (inDegree[t.task_id] === 0 && !t.trigger) {
      queue.push(t.task_id);
      ranks[t.task_id] = 0;
    }
  });

  while (queue.length > 0) {
    const current = queue.shift();
    const nextRank = (ranks[current] || 0) + 1;
    children[current]?.forEach((childId) => {
      inDegree[childId]--;
      ranks[childId] = Math.max(ranks[childId] || 0, nextRank);
      if (inDegree[childId] === 0) {
        queue.push(childId);
      }
    });
  }

  // Group by rank
  const rankGroups = {};
  let maxRank = 0;

  Object.entries(ranks).forEach(([taskId, rank]) => {
    if (!rankGroups[rank]) rankGroups[rank] = [];
    rankGroups[rank].push(taskId);
    maxRank = Math.max(maxRank, rank);
  });

  // Place trigger tasks at a special rank
  triggerTasks.forEach((t) => {
    const triggerRank = maxRank + 1;
    ranks[t.task_id] = triggerRank;
    if (!rankGroups[triggerRank]) rankGroups[triggerRank] = [];
    rankGroups[triggerRank].push(t.task_id);
  });

  // Assign positions
  const nodes = [];
  const positions = {};

  Object.entries(rankGroups).forEach(([rank, taskIds]) => {
    const r = parseInt(rank);
    const totalHeight = taskIds.length * NODE_HEIGHT + (taskIds.length - 1) * VERTICAL_GAP;
    const startY = -totalHeight / 2;

    taskIds.forEach((taskId, index) => {
      const x = r * (NODE_WIDTH + HORIZONTAL_GAP);
      const y = startY + index * (NODE_HEIGHT + VERTICAL_GAP);

      positions[taskId] = { x, y };

      const task = taskMap[taskId];
      nodes.push({
        id: taskId,
        type: 'taskNode',
        position: { x, y },
        data: {
          ...task,
          label: taskId,
        },
      });
    });
  });

  // Create edges
  const edges = [];
  tasks.forEach((task) => {
    const deps = task.depends_on || [];
    deps.forEach((dep) => {
      if (positions[dep] && positions[task.task_id]) {
        const isCompleted = taskMap[dep]?.state === 'COMPLETED';
        const isFailed = taskMap[dep]?.state === 'FAILED';

        edges.push({
          id: `${dep}->${task.task_id}`,
          source: dep,
          target: task.task_id,
          type: 'smoothstep',
          animated: taskMap[dep]?.state === 'IN_PROGRESS' || taskMap[dep]?.state === 'DISPATCHED',
          style: {
            stroke: isFailed
              ? '#ef4444'
              : isCompleted
              ? '#10b981'
              : '#475569',
            strokeWidth: 2,
          },
          markerEnd: {
            type: 'arrowclosed',
            color: isFailed
              ? '#ef4444'
              : isCompleted
              ? '#10b981'
              : '#475569',
          },
        });
      }
    });

    // Trigger edges (e.g., on_failure_of)
    if (task.trigger) {
      const match = task.trigger.match(/on_failure_of:(.+)/);
      if (match && positions[match[1]] && positions[task.task_id]) {
        edges.push({
          id: `${match[1]}-fail->${task.task_id}`,
          source: match[1],
          target: task.task_id,
          type: 'smoothstep',
          animated: false,
          label: 'on failure',
          labelStyle: { fill: '#ef4444', fontSize: 10, fontWeight: 600 },
          labelBgStyle: { fill: '#1e1b2e', fillOpacity: 0.9 },
          labelBgPadding: [4, 2],
          style: {
            stroke: '#ef4444',
            strokeWidth: 2,
            strokeDasharray: '6 3',
          },
          markerEnd: {
            type: 'arrowclosed',
            color: '#ef4444',
          },
        });
      }
    }
  });

  return { nodes, edges };
}
