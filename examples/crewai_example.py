"""
CrewAI Multi-Agent Integration with CrossX Security Gateway (Section 19).
Demonstrates:
1. Wrapping CrewAI tools with CrossXCrewAIToolWrapper.
2. Safe execution of permitted read queries.
3. Intercepting and blocking destructive SQL injection / drop table attempts.
"""

from crossx import CrossXClient, CrossXBlockedError
from crossx.adapters import CrossXCrewAIToolWrapper


class DatabaseQueryTool:
    name = "db_query_tool"
    description = "Executes read queries on analytics database"

    def _run(self, query: str):
        return f"Executing query: {query}"


def main():
    crossx = CrossXClient(
        endpoint="http://localhost:8000",
        api_key="agk_live_test_key_sample"
    )

    # Wrap CrewAI Tool with CrossX Zero-Trust Interceptor
    raw_crew_tool = DatabaseQueryTool()
    guarded_crew_tool = CrossXCrewAIToolWrapper(client=crossx, tool=raw_crew_tool)

    print(f"CrewAI Tool '{guarded_crew_tool.name}' enrolled into CrossX Security Mesh.")

    # 1. Safe Query Execution
    safe_res = guarded_crew_tool.run("SELECT id, name FROM users LIMIT 10")
    print("Safe CrewAI tool execution result:", safe_res)

    # 2. Block Destructive Query Attempt
    try:
        print("\nAttempting destructive SQL injection 'DROP TABLE users' via CrewAI tool...")
        guarded_crew_tool.run("DROP TABLE users")
        print("WARNING: Destructive statement was not blocked!")
    except CrossXBlockedError as e:
        print("SUCCESS: Destructive statement BLOCKED by CrossX Zero-Trust Gateway!")
        print("Reason:", e.message)


if __name__ == "__main__":
    main()
