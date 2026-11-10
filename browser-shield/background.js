/**
 * AgentTrust Browser Shield — Background Service Worker
 * Manages secure enrollment tokens, policy caching, and event reporting to AgentTrust Core.
 */

const DEFAULT_GATEWAY = "http://localhost:8080/api/v1";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["gatewayUrl", "protectionEnabled", "enrolled"], (data) => {
    if (!data.gatewayUrl) {
      chrome.storage.local.set({ gatewayUrl: DEFAULT_GATEWAY });
    }
    if (data.protectionEnabled === undefined) {
      chrome.storage.local.set({ protectionEnabled: true });
    }
    if (data.enrolled === undefined) {
      chrome.storage.local.set({ enrolled: false });
    }
  });
});

// Periodic heartbeat / health check
chrome.alarms.create("agenttrust-shield-heartbeat", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "agenttrust-shield-heartbeat") {
    checkGatewayHealth();
  }
});

async function checkGatewayHealth() {
  const { gatewayUrl, enrolled, extensionToken } = await chrome.storage.local.get([
    "gatewayUrl",
    "enrolled",
    "extensionToken",
  ]);
  const url = gatewayUrl || DEFAULT_GATEWAY;

  try {
    const res = await fetch(`${url}/browser-shield/status`);
    if (res.ok) {
      const data = await res.json();
      chrome.storage.local.set({ coreStatus: "CONNECTED", supportedWorkflows: data.supported_workflows });
    } else {
      chrome.storage.local.set({ coreStatus: "DEGRADED" });
    }
  } catch (err) {
    chrome.storage.local.set({ coreStatus: "OFFLINE" });
  }
}

// Message handler from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "CHECK_ACTION") {
    handleActionCheck(message.payload).then(sendResponse);
    return true; // async response
  } else if (message.type === "REPORT_INCIDENT") {
    handleReportIncident(message.payload).then(sendResponse);
    return true;
  } else if (message.type === "ENROLL") {
    handleEnrollment(message.payload).then(sendResponse);
    return true;
  }
});

async function handleActionCheck(payload) {
  const { gatewayUrl, protectionEnabled, extensionToken } = await chrome.storage.local.get([
    "gatewayUrl",
    "protectionEnabled",
    "extensionToken",
  ]);

  if (!protectionEnabled) {
    return { decision: "ALLOWED", reason: "Browser Shield protection disabled by user." };
  }

  const url = `${gatewayUrl || DEFAULT_GATEWAY}/browser-shield/check-action`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(extensionToken ? { "X-Extension-Token": extensionToken } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { decision: "ALLOWED", reason: "AgentTrust gateway check non-200; permitted with warning." };
    }

    const result = await res.json();

    // Cache recent blocked event in local storage
    if (result.decision === "BLOCKED") {
      const { blockedEvents = [] } = await chrome.storage.local.get("blockedEvents");
      blockedEvents.unshift({
        timestamp: new Date().toISOString(),
        url: payload.target_url,
        reason: result.reason,
      });
      chrome.storage.local.set({ blockedEvents: blockedEvents.slice(0, 20) });
    }

    return result;
  } catch (err) {
    // Fail-secure / fallback behavior: log local warning
    return {
      decision: "BLOCKED",
      reason: `AgentTrust Gateway Unreachable (${err.message}). Action held by security policy.`,
    };
  }
}

async function handleReportIncident(payload) {
  const { gatewayUrl } = await chrome.storage.local.get("gatewayUrl");
  const url = `${gatewayUrl || DEFAULT_GATEWAY}/browser-shield/events`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok ? await res.json() : { status: "ERROR" };
  } catch (err) {
    return { status: "ERROR", error: err.message };
  }
}

async function handleEnrollment({ enrollmentSecret, gatewayUrl }) {
  const endpoint = `${gatewayUrl || DEFAULT_GATEWAY}/browser-shield/enroll`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        browser_name: "Chrome",
        extension_version: "0.2.0",
        enrollment_secret: enrollmentSecret,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return { success: false, message: err.detail || "Enrollment rejected." };
    }

    const data = await res.json();
    await chrome.storage.local.set({
      enrolled: true,
      extensionToken: data.extension_token,
      gatewayUrl: gatewayUrl || DEFAULT_GATEWAY,
      coreStatus: "CONNECTED",
    });

    return { success: true, tokenPrefix: data.token_prefix };
  } catch (err) {
    return { success: false, message: `Connection error: ${err.message}` };
  }
}
