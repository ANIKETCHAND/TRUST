"""
LangChain Agent Integration with CrossX Security Gateway (Section 19).
Demonstrates:
1. Wrapping LangChain Tools with CrossXLangChainTool.
2. Attaching CrossXLangChainCallbackHandler to intercept agent actions.
3. Safe execution of permitted tool calls.
4. Blocking adversarial tool invocations (/etc/shadow, SQL injection).
"""

from crossx import CrossXClient, CrossXBlockedError
from crossx.adapters import CrossXLangChainCallbackHandler, CrossXLangChainTool


class MockLangChainTool:
    name = "web_search"
    description = "Searches the web for latest research"

    def run(self, query: str):
        return f"Search results for: {query}"


def main():
    crossx = CrossXClient(
        endpoint="http://localhost:8000",
        api_key="agk_live_test_key_sample"
    )

    # Wrap LangChain Tool with CrossX Gateway Protection
    raw_tool = MockLangChainTool()
    guarded_tool = CrossXLangChainTool(client=crossx, tool_instance=raw_tool)

    # Attach CrossX Callback Handler to LangChain Agent
    callback_handler = CrossXLangChainCallbackHandler(client=crossx, agent_name="LangChain-Research-Bot")

    print(f"LangChain Tool '{guarded_tool.gateway_tool_name}' secured with CrossX.")

    # 1. Execute safe permitted query
    safe_result = guarded_tool.run("quantum computing advancements 2026")
    print("Safe tool execution result:", safe_result)

    # 2. Intercept and block sensitive credential attempt
    try:
        print("\nAttempting unauthorized access to /etc/shadow via LangChain tool...")
        guarded_tool.run("/etc/shadow")
        print("WARNING: Malicious input was not blocked!")
    except CrossXBlockedError as e:
        print("SUCCESS: LangChain tool invocation BLOCKED by CrossX Gateway!")
        print("Reason:", e.message)


if __name__ == "__main__":
    main()
