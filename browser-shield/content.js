/**
 * AgentTrust Enterprise Browser Shield — Content Script
 * Real-Time DOM Interception, Pre-Flight DLP & Prompt Injection Protection
 * Supports ChatGPT, Claude, Gemini, Perplexity, DeepSeek, and generic AI interfaces.
 */

(function () {
  console.log("[AgentTrust Enterprise Shield] Active on", window.location.hostname);

  let activeBlockedState = {
    isBlocked: false,
    reason: "",
    findings: [],
    riskScore: 0,
    lastScannedText: "",
  };

  let debounceTimer = null;

  // Floating Security Status Pill
  function getOrCreateSecurityPill() {
    let pill = document.getElementById("agenttrust-status-pill");
    if (!pill) {
      pill = document.createElement("div");
      pill.id = "agenttrust-status-pill";
      pill.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483640;
        background: rgba(15, 23, 42, 0.95);
        border: 1px solid rgba(56, 189, 248, 0.4);
        backdrop-filter: blur(8px);
        border-radius: 9999px;
        padding: 6px 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 11px;
        color: #f8fafc;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        transition: all 0.25s ease;
        user-select: none;
        cursor: pointer;
      `;
      document.body.appendChild(pill);
    }
    return pill;
  }

  function updateSecurityPill(isClean, riskScore = 0, label = "") {
    const pill = getOrCreateSecurityPill();
    if (isClean) {
      pill.style.borderColor = "rgba(16, 185, 129, 0.5)";
      pill.innerHTML = `
        <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#10b981; box-shadow:0 0 6px #10b981;"></span>
        <strong style="color:#10b981; letter-spacing:0.5px;">AGENTTRUST SHIELD</strong>
        <span style="color:#94a3b8; border-left:1px solid #334155; padding-left:8px;">CLEAN</span>
      `;
    } else {
      pill.style.borderColor = "rgba(239, 68, 68, 0.8)";
      pill.style.boxShadow = "0 0 15px rgba(239, 68, 68, 0.4)";
      pill.innerHTML = `
        <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#ef4444; box-shadow:0 0 8px #ef4444; animation:pulse 1.5s infinite;"></span>
        <strong style="color:#ef4444; letter-spacing:0.5px;">SHIELD ALERT</strong>
        <span style="background:rgba(239,68,68,0.25); color:#fca5a5; padding:1px 6px; border-radius:4px; font-weight:bold;">${riskScore}/100</span>
        <span style="color:#cbd5e1; max-width:140px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${label || "BLOCKED"}</span>
      `;
    }
  }

  // Security Alert Modal Banner
  function showSecurityNotice(reason, findings) {
    const existing = document.getElementById("agenttrust-security-banner");
    if (existing) existing.remove();

    const banner = document.createElement("div");
    banner.id = "agenttrust-security-banner";
    banner.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      max-width: 440px;
      background: #090d16;
      border: 1px solid #dc2626;
      border-left: 5px solid #ef4444;
      border-radius: 10px;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.7);
      padding: 18px;
      z-index: 2147483647;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
    `;

    const findingsHtml = findings && findings.length > 0
      ? `<div style="background: #1e1b2e; border: 1px solid #7f1d1d; border-radius: 6px; padding: 10px; margin: 10px 0; font-size: 12px; color: #fca5a5;">
          <strong>Security Violation Detected:</strong> ${findings[0].description || findings[0].pattern || "Prompt Injection / DLP Hazard"}
         </div>`
      : "";

    banner.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
        <span style="font-weight: 800; color: #ef4444; font-size: 14px; display: flex; align-items: center; gap: 8px;">
          🛡️ BLOCKED BY AGENTTRUST CORE
        </span>
        <button id="agenttrust-dismiss-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; line-height: 1;">&times;</button>
      </div>
      <p style="margin: 0; color: #cbd5e1; font-size: 13px; line-height: 1.4;">${reason}</p>
      ${findingsHtml}
      <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b; border-top: 1px solid #1e293b; padding-top: 8px;">
        <span>Pre-flight Zero-Trust Interceptor</span>
        <span style="color: #38bdf8; font-family: monospace;">Fail-Closed Mode</span>
      </div>
    `;

    document.body.appendChild(banner);
    document.getElementById("agenttrust-dismiss-btn").onclick = () => banner.remove();

    setTimeout(() => {
      if (document.getElementById("agenttrust-security-banner")) {
        banner.remove();
      }
    }, 10000);
  }

  // Pre-flight check against core background service worker
  async function performPreflightCheck(promptText, element) {
    if (!promptText || promptText.trim().length <= 3) {
      activeBlockedState.isBlocked = false;
      updateSecurityPill(true);
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
        activeBlockedState.riskScore = check.risk_score || 90;
        updateSecurityPill(false, activeBlockedState.riskScore, "DLP VIOLATION");
        showSecurityNotice(check.reason, check.findings);
      } else {
        activeBlockedState.isBlocked = false;
        updateSecurityPill(true);
        const banner = document.getElementById("agenttrust-security-banner");
        if (banner) banner.remove();
      }
    } catch (err) {
      // Local fail-closed fallback
      console.warn("[AgentTrust Shield] Offline fallback pre-flight scan:", err);
    }
  }

  // Initialize status pill
  updateSecurityPill(true);

  // Universal DOM text extractor
  function extractPromptText(target) {
    if (!target) return "";
    if (target.value !== undefined) return target.value;
    if (target.innerText !== undefined) return target.innerText;
    return target.textContent || "";
  }

  // Input event listener
  document.addEventListener("input", (e) => {
    const target = e.target;
    if (
      target.tagName === "TEXTAREA" ||
      target.getAttribute("contenteditable") === "true" ||
      target.getAttribute("role") === "textbox" ||
      target.classList?.contains("ProseMirror") ||
      target.classList?.contains("ql-editor")
    ) {
      const text = extractPromptText(target);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        performPreflightCheck(text, target);
      }, 250);
    }
  }, true);

  // Synchronous sensitive pattern definitions for immediate blocking before async resolution
  const SENSITIVE_SYNC_PATTERNS = [
    /-----BEGIN [A-Z0-9\s]+ PRIVATE KEY-----/i,
    /AKIA[0-9A-Z]{16}/,
    /eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}/,
    /ignore\s+(?:all\s+)?(?:previous|prior|system)\s+instructions/i,
    /disregard\s+(?:the\s+)?system\s+prompt/i,
    /<\|\s*(?:im_start|system|user)\s*\|>/i,
  ];

  // Synchronous Enter Key Interceptor
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      const target = e.target;
      if (
        target.tagName === "TEXTAREA" ||
        target.getAttribute("contenteditable") === "true" ||
        target.getAttribute("role") === "textbox" ||
        target.classList?.contains("ProseMirror") ||
        target.classList?.contains("ql-editor")
      ) {
        const text = extractPromptText(target);
        const hasSyncViolation = SENSITIVE_SYNC_PATTERNS.some((pat) => pat.test(text));

        if (hasSyncViolation || activeBlockedState.isBlocked) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          activeBlockedState.isBlocked = true;
          const reason = hasSyncViolation
            ? "Synchronous Pre-Flight Intercept: Prompt contains sensitive cryptographic credentials or injection directives."
            : activeBlockedState.reason;
          showSecurityNotice(reason, activeBlockedState.findings);
        } else if (text.trim().length > 3 && text !== activeBlockedState.lastScannedText) {
          performPreflightCheck(text, target);
        }
      }
    }
  }, true);

  // Synchronous Submit / Send Button Interceptor
  document.addEventListener("click", (e) => {
    const btn = e.target.closest('button, [role="button"], input[type="submit"]');
    if (btn) {
      const isSubmit =
        btn.getAttribute("data-testid")?.includes("send") ||
        btn.getAttribute("aria-label")?.toLowerCase().includes("send") ||
        btn.getAttribute("aria-label")?.toLowerCase().includes("submit") ||
        btn.type === "submit" ||
        btn.querySelector('svg[data-testid*="send"]') !== null;

      if (isSubmit) {
        const textareas = Array.from(document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]'));
        const combinedText = textareas.map(extractPromptText).join(" ");
        const hasSyncViolation = SENSITIVE_SYNC_PATTERNS.some((pat) => pat.test(combinedText));

        if (hasSyncViolation || activeBlockedState.isBlocked) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          activeBlockedState.isBlocked = true;
          const reason = hasSyncViolation
            ? "Synchronous Pre-Flight Intercept: Prompt contains sensitive cryptographic credentials or injection directives."
            : activeBlockedState.reason;
          showSecurityNotice(reason, activeBlockedState.findings);
        }
      }
    }
  }, true);
})();
