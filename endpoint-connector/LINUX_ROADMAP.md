# AgentTrust Endpoint Connector: Linux Support Roadmap

This specification outlines Phase 2 of the endpoint architecture: extending AgentTrust Endpoint Connector to enterprise Linux distributions (Ubuntu 22.04+, RHEL 9+, Debian 12+).

---

## 1. Architectural Strategy

Rather than porting Windows-specific hooks, the Linux connector will leverage native Linux kernel interfaces with least-privilege principles.

### Candidate Kernel Enforcement Interfaces:

1. **eBPF (Extended Berkeley Packet Filter)**:
   - Primary candidate for low-overhead, kernel-level telemetry.
   - Tracepoints on `sys_enter_execve`, `sys_enter_connect`, and `sys_enter_openat`.
   - Filtered exclusively by `cgroup` or PID namespaces containing AI agent workloads.
2. **Linux Audit Subsystem (`auditd`)**:
   - Secondary candidate for environments where custom eBPF programs are restricted by kernel lock-down policies.
   - Rules watching configured workspace paths (e.g. `/opt/agenttrust/workspaces`).
3. **`fanotify`**:
   - For real-time filesystem interception before suspicious scripts are executed.

---

## 2. Containment Mechanics on Linux

- **Process Suspension**: `SIGSTOP` signal sent to the agent process group (reversibility via `SIGCONT`).
- **Network Containment**: Scoped `nftables` or `iptables` drop rules restricted to the agent PID/cgroup, preserving management SSH connectivity.
- **Workspace Isolation**: Read-only remount of the specific container or workspace volume.

---

## 3. Implementation Phases

| Phase | Milestone | Deliverable |
|---|---|---|
| 2.1 | Telemetry Collector | Auditd / eBPF prototype for `execve` tracking in Python/Rust |
| 2.2 | Package & Systemd | `.deb` and `.rpm` packaging with `systemd` unit file |
| 2.3 | Safe Containment | `SIGSTOP` / `SIGCONT` workflow with automated audit logging |
| 2.4 | OSQuery / Wazuh | Optional syslog/socket forwarding into existing SIEMs |
