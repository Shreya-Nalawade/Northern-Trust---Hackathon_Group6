// ─── Vertical DAG layout (top → bottom) ───────────────────────
// Topological sort + rank-based positioning, vertical orientation.

const NODE_WIDTH = 180;
const NODE_HEIGHT = 76;
const HORIZONTAL_GAP = 40;
const VERTICAL_GAP = 60;

export function layoutDag(tasks) {
  if (!tasks || tasks.length === 0) return { nodes: [], edges: [] };

  const taskMap = {};
  tasks.forEach((t) => {
    taskMap[t.task_id] = t;
  });

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

  const triggerTasks = tasks.filter((t) => t.trigger && (!t.depends_on || t.depends_on.length === 0));
  const mainTasks = tasks.filter((t) => !t.trigger || (t.depends_on && t.depends_on.length > 0));

  // Topological sort with ranks (rank = row in vertical layout)
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

  const rankGroups = {};
  let maxRank = 0;

  Object.entries(ranks).forEach(([taskId, rank]) => {
    if (!rankGroups[rank]) rankGroups[rank] = [];
    rankGroups[rank].push(taskId);
    maxRank = Math.max(maxRank, rank);
  });

  // Place trigger tasks below the main flow
  triggerTasks.forEach((t) => {
    const triggerRank = maxRank + 1;
    ranks[t.task_id] = triggerRank;
    if (!rankGroups[triggerRank]) rankGroups[triggerRank] = [];
    rankGroups[triggerRank].push(t.task_id);
  });

  // Assign positions — vertical: rank controls Y, index controls X
  const nodes = [];
  const positions = {};

  Object.entries(rankGroups).forEach(([rank, taskIds]) => {
    const r = parseInt(rank);
    const totalWidth = taskIds.length * NODE_WIDTH + (taskIds.length - 1) * HORIZONTAL_GAP;
    const startX = -totalWidth / 2;

    taskIds.forEach((taskId, index) => {
      const x = startX + index * (NODE_WIDTH + HORIZONTAL_GAP);
      const y = r * (NODE_HEIGHT + VERTICAL_GAP);

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

  // Create edges — vertical orientation uses Top/Bottom handles
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
              ? '#e5484d'
              : isCompleted
              ? '#00a67e'
              : 'var(--border-2)',
            strokeWidth: 1.5,
          },
          markerEnd: {
            type: 'arrowclosed',
            color: isFailed
              ? '#e5484d'
              : isCompleted
              ? '#00a67e'
              : 'var(--border-2)',
          },
        });
      }
    });

    // Trigger edges
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
          labelStyle: { fill: '#e5484d', fontSize: 10, fontWeight: 500 },
          labelBgStyle: { fill: 'var(--bg-0)', fillOpacity: 0.95 },
          labelBgPadding: [4, 2],
          style: {
            stroke: '#e5484d',
            strokeWidth: 1.5,
            strokeDasharray: '6 3',
          },
          markerEnd: {
            type: 'arrowclosed',
            color: '#e5484d',
          },
        });
      }
    }
  });

  return { nodes, edges };
}
