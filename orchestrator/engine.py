from typing import Dict, List

class DAGError(Exception):
    pass

class DAG:
    """
    Core Directed Acyclic Graph logic for the Workflow Orchestrator.
    Handles dependency building and cycle detection.
    Supports rich task fields: type, service, condition, trigger, assignee.
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
            # Skip tasks that are only triggered on failure (not part of normal DAG)
            if task_def.get("trigger", "").startswith("on_failure_of:"):
                continue
            depends_on = task_def.get("depends_on", [])
            for dep in depends_on:
                if dep not in self.tasks:
                    raise DAGError(f"Task '{task_name}' depends on unknown task '{dep}'")
                self.adj_list[dep].append(task_name)
                self.in_degree[task_name] += 1

    def _detect_cycles(self):
        # Kahn's algorithm for topological sorting / cycle detection
        # Only check non-trigger tasks
        trigger_tasks = {
            name for name, td in self.tasks.items()
            if td.get("trigger", "").startswith("on_failure_of:")
        }
        normal_tasks = {name for name in self.tasks if name not in trigger_tasks}

        in_degree = {k: v for k, v in self.in_degree.items() if k in normal_tasks}
        queue = [node for node, deg in in_degree.items() if deg == 0]
        visited_count = 0
        
        while queue:
            node = queue.pop(0)
            visited_count += 1
            for neighbor in self.adj_list.get(node, []):
                if neighbor in in_degree:
                    in_degree[neighbor] -= 1
                    if in_degree[neighbor] == 0:
                        queue.append(neighbor)
                    
        if visited_count != len(normal_tasks):
            raise DAGError("Cycle detected in the workflow definition")

    def get_independent_tasks(self) -> List[str]:
        return [node for node, deg in self.in_degree.items() if deg == 0]

    def get_downstream_tasks(self, task_name: str) -> List[str]:
        return self.adj_list.get(task_name, [])

    def get_task_def(self, task_name: str) -> dict:
        return self.tasks.get(task_name, {})

    def get_failure_trigger_tasks(self, failed_task: str) -> List[str]:
        """Return tasks that should fire when the given task fails."""
        result = []
        for name, td in self.tasks.items():
            trigger = td.get("trigger", "")
            if trigger == f"on_failure_of:{failed_task}":
                result.append(name)
        return result
