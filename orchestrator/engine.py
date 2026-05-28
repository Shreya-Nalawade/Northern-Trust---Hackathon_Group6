from typing import Dict, List, Set

class DAGError(Exception):
    pass

class DAG:
    """
    Core Directed Acyclic Graph logic for the Workflow Orchestrator.
    Handles dependency building and cycle detection.
    """
    def __init__(self, definition: dict):
        self.name = definition.get("name", "unknown")
        self.tasks: Dict[str, dict] = definition.get("tasks", {})
        self.adj_list: Dict[str, List[str]] = {task: [] for task in self.tasks}
        self.in_degree: Dict[str, int] = {task: 0 for task in self.tasks}
        
        self._build_graph()
        self._detect_cycles()

    def _build_graph(self):
        for task_name, task_def in self.tasks.items():
            depends_on = task_def.get("depends_on", [])
            for dep in depends_on:
                if dep not in self.tasks:
                    raise DAGError(f"Task '{task_name}' depends on unknown task '{dep}'")
                self.adj_list[dep].append(task_name)
                self.in_degree[task_name] += 1

    def _detect_cycles(self):
        # Kahn's algorithm for topological sorting / cycle detection
        in_degree = self.in_degree.copy()
        queue = [node for node, deg in in_degree.items() if deg == 0]
        visited_count = 0
        
        while queue:
            node = queue.pop(0)
            visited_count += 1
            for neighbor in self.adj_list[node]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)
                    
        if visited_count != len(self.tasks):
            raise DAGError("Cycle detected in the workflow definition")

    def get_independent_tasks(self) -> List[str]:
        return [node for node, deg in self.in_degree.items() if deg == 0]

    def get_downstream_tasks(self, task_name: str) -> List[str]:
        return self.adj_list.get(task_name, [])
