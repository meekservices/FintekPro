# Standard Operating Procedure (SOP): CERT-In Cyber Incident Reporting, SEBI CSCRF & NTP Synchronization

**Document Code**: `FINTEK-SOP-CERTIN-CYBER-2026-05`  
**Standard Version**: SOP-CERTIN-1.1.0  
**Effective Date**: November 2026  
**Governing Authorities**: Indian Computer Emergency Response Team (CERT-In) under IT Act Section 70B & SEBI Cyber Security and Cyber Resilience Framework (CSCRF) (August 2024 / January 2025)  
**Applicability**: Chief Information Security Officer (CISO), Cloud Infrastructure Ops, SRE, Engineering, Legal  

---

## 1. Statutory Mandate & Scope

Under the **CERT-In Cyber Security Directions (No. 20(3)/2022-CERT-In)** and SEBI's unified **Cyber Security and Cyber Resilience Framework (CSCRF)**, regulated fintech entities and market intermediary platforms must adhere to institutional cybersecurity hygiene.

This Standard Operating Procedure establishes the mandatory protocols for:
1. **Network Time Protocol (NTP) Time Server Synchronization** across all infrastructure ($\pm 50\text{ ms}$).
2. **SEBI CSCRF Cyber Resilience Architecture** (SOC operations, Zero-Trust network access, Cyber Crisis Management Plan).
3. **Mandatory 6-Hour Security Incident Reporting** to CERT-In and SEBI.
4. **5-Year to 7-Year Local Log Preservation** within Indian sovereign jurisdiction.

---

## 2. Official Indian Standard Time (IST) NTP Synchronization Protocol

Under CERT-In Direction 2(i), all server instances, Docker containers, database clusters, and AI inference environments must synchronize their system clocks with designated national time servers:

### 2.1 Primary & Secondary NTP Sources
- **Primary NTP Server**: National Physical Laboratory (NPL), CSIR (`time.nplindia.org`)
- **Secondary NTP Server**: National Informatics Centre (NIC) (`time.nic.in` / `samay1.nic.in`)
- **Allowed Drift Tolerance**: Maximum **$\pm 50\text{ milliseconds}$** drift from Indian Standard Time (IST).

### 2.2 Infrastructure Configuration
All Google Cloud / Linux server nodes must enforce chrony/systemd-timesyncd configuration:
```ini
# /etc/chrony/chrony.conf
server time.nplindia.org iburst minpoll 4 maxpoll 8
server samay1.nic.in iburst minpoll 4 maxpoll 8
server time.google.com iburst

# Reject unsynchronized timestamps in transaction audit trails
maxdrift 100
makestep 0.1 3
rtconutc
```
- **Audit Requirement**: If system clock drift exceeds $100\text{ ms}$, the order execution bridge and cryptographic audit pack signers (`sebi-audit-service.ts`) raise an urgent infrastructure alarm.

---

## 3. SEBI Cyber Security and Cyber Resilience Framework (CSCRF) Standards

In adherence to the SEBI CSCRF master directives:
1. **Regulated Entity (RE) Cyber Tiering**:
   - The platform enforces security controls aligned with SEBI's **Mid-Size & Qualified RE Cybersecurity Baseline**.
2. **24x7 Security Operations Center (SOC)**:
   - Automated SIEM and log analysis monitoring anomalous logins, credential stuffing, and sudden API spike attacks.
3. **Zero-Trust Network Access & Token Rotation**:
   - Production database and Redis clusters reside in private VPC subnets with zero public IP assignment.
   - Internal microservice JWT tokens and database credentials are rotated on a strict 30-day automated schedule.
4. **Biannual Cyber Crisis Drills (CCMP)**:
   - The CISO leads simulated cyber-attack, ransomware recovery, and failover drills every 6 months to ensure RTO $< 2\text{ hours}$ and RPO $< 15\text{ minutes}$.

---

## 4. Mandatory 6-Hour Cyber Incident Reporting Protocol

Under CERT-In Direction 2(v) and SEBI CSCRF guidelines, any confirmed cybersecurity incident from the statutory list must be reported to CERT-In and SEBI within **6 hours** of becoming aware.

### 4.1 Reportable Incident Categories for FintekPro
1. Unauthorized access to production databases or client PII.
2. AI Governance Engine bypass (unauthorized automated orders routed to exchange).
3. Critical API key or broker credentials leak (Upstox, IndianAPI, Cloud SQL).
4. Ransomware attacks or database denial-of-service (DDoS $> 10\text{ Gbps}$).
5. Malicious code injection in client web/mobile applications.

### 4.2 The 6-Hour Escalation Timeline
```mermaid
timeline
    title 6-Hour Statutory CERT-In Reporting Lifecycle
    T0 (00:00) : Incident Detected by SIEM / OpsAlert
    T+1 (01:00) : CISO & Incident Response Team Assembled; Breach Contained
    T+3 (03:00) : Scope of Impact & PII Assessment Completed
    T+5 (05:00) : Formal Incident Dossier Drafted in CERT-In Reporting Format
    T+6 (06:00) : Statutory Submission to incident@cert-in.org.in & SEBI CSCRF Portal
```

### 4.3 Incident Notification Payload
Submissions to `incident@cert-in.org.in` and the SEBI CSCRF Incident Portal must include:
- Name of Organization: `FintekPro Financial Services LLP / FintekPro Platform`
- Type of Incident (e.g. `Ransomware / Data Leak / Gateway Compromise`).
- IP addresses, domains, and hashes of attacker tools identified.
- Estimated number of client accounts impacted and PII exposure assessment.
- Immediate containment actions taken.

---

## 5. 5-Year to 7-Year Log Preservation within Indian Sovereign Jurisdiction

Under CERT-In Direction 2(iv) and SEBI CSCRF:

1. **Mandatory Storage Duration**:
   - All system logs, firewall access logs, user authentication sessions, API transaction requests, and database mutation queries must be preserved for **5 years** (extended to **7 years** for financial trade and advisory records under SEBI/PMLA).
2. **Data Residency Requirement**:
   - In accordance with RBI, SEBI, and CERT-In sovereign data mandates, **all primary and archival logs must reside strictly in data centers located within the territorial borders of the Republic of India** (e.g. Google Cloud `asia-south1` [Mumbai] and `asia-south2` [Delhi]).
3. **WORM & Cryptographic Tamper-Proofing**:
   - Logs must be streamed in real-time to an append-only, Write-Once-Read-Many (WORM) Cloud Storage bucket protected by Object Retention locks.
   - Modifying or truncating historical audit logs triggers an automated critical alert.

---

## 6. Post-Incident Forensic & Remediation Cadence

1. **Chain of Custody Preservation**:
   - Digital disk snapshots, memory dumps, and network pcap captures must be hashed with SHA-256 and stored in an isolated forensic bucket for law enforcement (Cyber Cell / CERT-In) review.
2. **Root Cause Analysis (RCA)**:
   - Comprehensive RCA submitted to FintekPro Board of Directors and SEBI within **14 calendar days** of incident resolution.
3. **Mandatory Red-Team Testing**:
   - Following any major incident, third-party CERT-In empaneled security auditors must conduct an adversarial penetration test before full service restoration.

---

*FintekPro Information Security & Incident Response Desk*  
*Standard Operating Procedure — CERT-In, CSCRF & Cybersecurity*
