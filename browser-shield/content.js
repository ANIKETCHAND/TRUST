/**
 * AgentTrust Browser Shield — Content Script
 * Intercepts prompt submission on supported AI web applications (ChatGPT, Claude).
 * Performs pre-flight DLP and policy checks via AgentTrust Core.
 */

(function () {
  console.log("[AgentTrust Browser Shield] Active on", window.location.hostname);

  // Banner Notification UI
  function showSecurityNotice(reason, findings) {
    const existing = document.getElementById("agenttrust-security-banner");
    if (existing) existing.remove();

    const banner = document.createElement("div");
    banner.id = "agenttrust-security-banner";
    banner.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      max-width: 420px;
      background: #0f172a;
      border: 1px solid #ef4444;
      border-left: 4px solid #ef4444;
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      padding: 16px;
      z-index: 9999999;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
    `;

    banner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-weight: 700; color: #ef4444; font-size: 14px; display: flex; align-items: center; gap: 6px;">
          🛡️ Action Blocked by AgentTrust
        </span>
        <button id="agenttrust-dismiss-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 18px; cursor: pointer;">&times;</button>
      </div>
      <p style="margin: 0 0 8px 0; color: #cbd5e1; line-height: 1.4;">${reason}</p>
      ${
        findings && findings.length > 0
          ? `<div style="background: #1e293b; padding: 8px; border-radius: 4px; font-size: 12px; color: #fca5a5;">
              Detected: <strong>${findings[0].description}</strong> (Count: ${findings[0].count})
            </div>`
          : ""
      }
      <div style="margin-top: 10px; font-size: 11px; color: #64748b; text-align: right;">
        Protected by AgentTrust Security Platform
      </div>
    `;

    document.body.appendChild(banner);
    document.getElementById("agenttrust-dismiss-btn").onclick = () => banner.remove();

    setTimeout(() => {
      if (document.getElementById("agenttrust-security-banner")) {
        banner.remove();
      }
    }, 8000);
  }

  let activeBlockedState = {
    isBlocked: false,
    reason: "",
    findings: [],
    lastScannedText: "",
  };

  let debounceTimer = null;

  async function performPreflightCheck(promptText, element) {
    if (!promptText || promptText.trim().length <= 3) {
      activeBlockedState.isBlocked = false;
      return;
    }
    if (promptText === activeBlockedState.lastScannedText) {
      return;
    }
    activeBlockedState.lastScannedText = promptText;

    try {
      const check = await chrome.runtime.sendMessage({
        type: "CHECK_ACTION",
        payload: {
          target_url: window.location.href,
          prompt_text: promptText,
          action_type: "submit_prompt",
        },
      });

      if (check && check.decision === "BLOCKED") {
        activeBlockedState.isBlocked = true;
        activeBlockedState.reason = check.reason;
        activeBlockedState.findings = check.findings || [];
        showSecurityNotice(check.reason, check.findings);
      } else {
        activeBlockedState.isBlocked = false;
        const banner = document.getElementById("agenttrust-security-banner");
        if (banner) banner.remove();
      }
    } catch (err) {
      console.error("[AgentTrust Browser Shield] Scan error:", err);
    }
  }

  // Continuous debounced DLP scanning on input / paste
  document.addEventListener("input", (e) => {
    const target = e.target;
    if (
      target.tagName === "TEXTAREA" ||
      target.getAttribute("contenteditable") === "true" ||
      target.getAttribute("role") === "textbox"
    ) {
      const text = target.value || target.innerText || "";
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        performPreflightCheck(text, target);
      }, 200);
    }
  }, true);

  // Synchronous Keydown Interceptor
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const target = e.target;
      if (
        target.tagName === "TEXTAREA" ||
        target.getAttribute("contenteditable") === "true" ||
        target.getAttribute("role") === "textbox"
      ) {
        const promptText = target.value || target.innerText || "";
        if (activeBlockedState.isBlocked) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          showSecurityNotice(activeBlockedState.reason, activeBlockedState.findings);
        } else if (promptText.trim().length > 3 && promptText !== activeBlockedState.lastScannedText) {
          // Immediately trigger check
          performPreflightCheck(promptText, target);
        }
      }
    }
  }, true);

  // Synchronous Click Interceptor for Send / Submit Buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest('button, [role="button"], input[type="submit"]');
    if (btn) {
      const isSubmitBtn =
        btn.getAttribute("data-testid")?.includes("send") ||
        btn.getAttribute("aria-label")?.toLowerCase().includes("send") ||
        btn.type === "submit" ||
        btn.querySelector('svg[data-testid*="send"]') !== null;

      if (isSubmitBtn && activeBlockedState.isBlocked) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        showSecurityNotice(activeBlockedState.reason, activeBlockedState.findings);
      }
    }
  }, true);
})();

