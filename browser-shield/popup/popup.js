document.addEventListener("DOMContentLoaded", async () => {
  const statusPill = document.getElementById("status-pill");
  const toggle = document.getElementById("protection-toggle");
  const enrollmentSection = document.getElementById("enrollment-section");
  const enrolledDetails = document.getElementById("enrolled-details");
  const tokenPreview = document.getElementById("token-preview");
  const gatewayInput = document.getElementById("gateway-input");
  const secretInput = document.getElementById("secret-input");
  const enrollBtn = document.getElementById("enroll-btn");
  const enrollMsg = document.getElementById("enroll-msg");
  const blockedList = document.getElementById("blocked-list");
  const dashboardLink = document.getElementById("view-dashboard-link");

  // Load storage state
  const data = await chrome.storage.local.get([
    "enrolled",
    "gatewayUrl",
    "extensionToken",
    "protectionEnabled",
    "coreStatus",
    "blockedEvents",
  ]);

  if (data.gatewayUrl) gatewayInput.value = data.gatewayUrl;
  toggle.checked = data.protectionEnabled !== false;

  updateUI(data);

  toggle.addEventListener("change", () => {
    chrome.storage.local.set({ protectionEnabled: toggle.checked });
  });

  enrollBtn.addEventListener("click", async () => {
    const gatewayUrl = gatewayInput.value.trim();
    const secret = secretInput.value.trim();

    if (!secret) {
      enrollMsg.className = "msg error";
      enrollMsg.textContent = "Please enter enrollment secret key.";
      return;
    }

    enrollBtn.disabled = true;
    enrollBtn.textContent = "Enrolling...";

    const res = await chrome.runtime.sendMessage({
      type: "ENROLL",
      payload: { gatewayUrl, enrollmentSecret: secret },
    });

    enrollBtn.disabled = false;
    enrollBtn.textContent = "Enroll Extension";

    if (res && res.success) {
      enrollMsg.className = "msg success";
      enrollMsg.textContent = "Enrolled successfully!";
      const updated = await chrome.storage.local.get();
      updateUI(updated);
    } else {
      enrollMsg.className = "msg error";
      enrollMsg.textContent = res?.message || "Enrollment failed.";
    }
  });

  dashboardLink.addEventListener("click", async (e) => {
    e.preventDefault();
    const { gatewayUrl } = await chrome.storage.local.get("gatewayUrl");
    const dashUrl = gatewayUrl ? gatewayUrl.replace("/api/v1", "") : "http://localhost:8080";
    chrome.tabs.create({ url: dashUrl });
  });

  function updateUI(st) {
    if (st.enrolled) {
      enrollmentSection.classList.add("hidden");
      enrolledDetails.classList.remove("hidden");
      tokenPreview.textContent = st.extensionToken ? `${st.extensionToken.slice(0, 14)}...` : "Active";
    } else {
      enrollmentSection.classList.remove("hidden");
      enrolledDetails.classList.add("hidden");
    }

    const isOnline = st.coreStatus === "CONNECTED";
    statusPill.textContent = isOnline ? "ONLINE" : "OFFLINE";
    statusPill.className = `pill ${isOnline ? "pill-online" : "pill-offline"}`;

    // Render blocked events
    if (st.blockedEvents && st.blockedEvents.length > 0) {
      blockedList.innerHTML = st.blockedEvents
        .slice(0, 5)
        .map(
          (evt) => `
        <div class="blocked-item">
          <div class="blocked-reason">${evt.reason}</div>
          <div class="blocked-url">${new URL(evt.url).hostname} · ${new Date(evt.timestamp).toLocaleTimeString()}</div>
        </div>
      `
        )
        .join("");
    } else {
      blockedList.innerHTML = `<div class="empty-state">No violations recorded. All outbound AI actions verified.</div>`;
    }
  }
});
