from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai.agents.agent_builder.base_agent import BaseAgent
from typing import List

from skill_sentinel.tools.custom_tool import ReadFileTool, GrepTool


@CrewBase
class SkillScanner():
    """SkillScanner crew — analyzes Agent Skill packages for security threats."""

    agents: List[BaseAgent]
    tasks: List[Task]

    # ------------------------------------------------------------------
    # Agents
    # ------------------------------------------------------------------

    @agent
    def skillmd_analyzer_agent(self) -> Agent:
        return Agent(
            config=self.agents_config['skillmd_analyzer_agent'],  # type: ignore[index]
            tools=[ReadFileTool()],
            max_iter=15,
            verbose=False,
        )

    @agent
    def file_verification_agent(self) -> Agent:
        return Agent(
            config=self.agents_config['file_verification_agent'],  # type: ignore[index]
            tools=[ReadFileTool(), GrepTool()],
            max_iter=25,
            verbose=False,
        )

    @agent
    def report_synthesizer_agent(self) -> Agent:
        return Agent(
            config=self.agents_config['report_synthesizer_agent'],  # type: ignore[index]
            tools=[],  # Pure synthesis — no tools needed
            verbose=False,
        )

    # ------------------------------------------------------------------
    # Tasks
    # ------------------------------------------------------------------

    @task
    def skillmd_analysis_task(self) -> Task:
        return Task(
            config=self.tasks_config['skillmd_analysis_task'],  # type: ignore[index]
        )

    @task
    def file_verification_task(self) -> Task:
        return Task(
            config=self.tasks_config['file_verification_task'],  # type: ignore[index]
            context=[self.skillmd_analysis_task()],
        )

    @task
    def report_synthesis_task(self) -> Task:
        return Task(
            config=self.tasks_config['report_synthesis_task'],  # type: ignore[index]
            context=[self.skillmd_analysis_task(), self.file_verification_task()],
            output_file='report.json',
        )

    def _make_report_synthesis_task(
        self,
        context_tasks: List[Task],
        output_file: str = "report.json",
    ) -> Task:
        """Create the report synthesis task with dynamic context."""
        return Task(
            config=self.tasks_config['report_synthesis_task'],  # type: ignore[index]
            context=context_tasks,
            output_file=output_file,
        )

    # ------------------------------------------------------------------
    # Crew builders
    # ------------------------------------------------------------------

    @crew
    def crew(self) -> Crew:
        """Default crew with all tasks (used by CrewAI CLI commands)."""
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential,
            verbose=False,
        )

    def build_crew(
        self,
        include_file_verification: bool = True,
        output_file: str = "report.json",
    ) -> Crew:
        """
        Build a crew with explicit task control.

        Args:
            include_file_verification: If False, skip the file verification task
                (e.g., when the skill package contains only SKILL.md).
            output_file: Path where the final report JSON will be written.
        """
        agent_list = [
            self.skillmd_analyzer_agent(),
            self.report_synthesizer_agent(),
        ]
        task_list = [self.skillmd_analysis_task()]

        if include_file_verification:
            agent_list.insert(1, self.file_verification_agent())
            fv_task = self.file_verification_task()
            task_list.append(fv_task)

        # Report synthesis always last, with context from all preceding tasks
        report_task = self._make_report_synthesis_task(
            context_tasks=list(task_list),
            output_file=output_file,
        )
        task_list.append(report_task)

        return Crew(
            agents=agent_list,
            tasks=task_list,
            process=Process.sequential,
            verbose=False,
        )
