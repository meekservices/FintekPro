/**
 * Email Intelligence Page — /admin/copilot/email
 * Displays classified email inbox, urgency chips, and draft reply approval.
 * GUARDRAIL: Admin must approve draft → then use Zoho Mail API to send.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

const URGENCY_COLORS: Record<string,string> = {
  critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e",
};
const CAT_LABELS: Record<string,string> = {
  investor_enquiry:"Investor Enquiry", kyc_issue:"KYC Issue", complaint:"Complaint",
  partner_enquiry:"Partner Enquiry", loan_enquiry:"Loan", mf_enquiry:"MF",
  pms_aif_enquiry:"PMS/AIF", reit_invit:"REIT/InvIT", compliance:"Compliance",
  support:"Support", other:"Other",
};

export default function EmailIntelligencePage() {
  const [selected, setSelected] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState("");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["copilot-emails", filter],
    queryFn:  async () => {
      const r = await fetch(`/api/admin/copilot/mail/inbox?limit=50${filter ? `&urgency=${filter}` : ""}`);
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const emails = data?.data ?? [];

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/admin/copilot/mail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: "default", accountId: "", limit: 50 }),
      });
      qc.invalidateQueries({ queryKey: ["copilot-emails"] });
    } finally { setSyncing(false); }
  }

  async function handleApprove(emailId: string) {
    await fetch("/api/admin/copilot/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentType: "mail", entityId: emailId, entityType: "ai_email_classifications", action: "approve" }),
    });
    qc.invalidateQueries({ queryKey: ["copilot-emails"] });
    setSelected(null);
  }

  const s: any = {
    page: { minHeight:"100vh", background:"#0f172a", color:"#f1f5f9", fontFamily:"'Inter',sans-serif", display:"flex", flexDirection:"column" as const },
    topbar: { display:"flex", alignItems:"center", gap:"1rem", padding:"1rem 1.5rem", borderBottom:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.02)" },
    body: { display:"flex", flex:1, overflow:"hidden" },
    list: { width:380, borderRight:"1px solid rgba(255,255,255,0.08)", overflowY:"auto" as const },
    detail: { flex:1, overflowY:"auto" as const, padding:"1.5rem" },
    chip: (u:string) => ({ background:URGENCY_COLORS[u]+"22", color:URGENCY_COLORS[u], border:`1px solid ${URGENCY_COLORS[u]}44`, borderRadius:20, padding:"0.15rem 0.5rem", fontSize:"0.7rem", fontWeight:700, textTransform:"uppercase" as const }),
    row: (sel:boolean) => ({ padding:"1rem", borderBottom:"1px solid rgba(255,255,255,0.06)", cursor:"pointer", background:sel?"rgba(99,102,241,0.15)":"transparent", transition:"background 0.15s" }),
    btn: (color:string) => ({ background:color, border:"none", borderRadius:8, padding:"0.5rem 1.25rem", color:"#fff", fontWeight:700, cursor:"pointer", fontSize:"0.85rem" }),
  };

  return (
    <div style={s.page}>
      <div style={s.topbar}>
        <Link href="/admin/copilot"><span style={{ fontSize:"1.25rem", cursor:"pointer" }}>←</span></Link>
        <span style={{ fontSize:"1.25rem" }}>📧</span>
        <div>
          <div style={{ fontWeight:700 }}>Email Intelligence</div>
          <div style={{ fontSize:"0.75rem", color:"#64748b" }}>Classify · Draft · Approve — never auto-send</div>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:"0.75rem" }}>
          {["","critical","high","medium","low"].map(f => (
            <button key={f} onClick={()=>setFilter(f)} style={{ ...s.btn(filter===f?"#6366f1":"rgba(255,255,255,0.08)"), fontSize:"0.78rem", padding:"0.35rem 0.8rem" }}>{f||"All"}</button>
          ))}
          <button onClick={handleSync} disabled={syncing} style={s.btn("#6366f1")}>{syncing?"Syncing…":"↻ Sync"}</button>
        </div>
      </div>
      <div style={s.body}>
        <div style={s.list}>
          {isLoading && <div style={{ padding:"2rem", color:"#64748b", textAlign:"center" }}>Loading…</div>}
          {emails.map((e:any) => (
            <div key={e.id} style={s.row(selected?.id===e.id)} onClick={()=>setSelected(e)}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"0.25rem" }}>
                <span style={{ fontWeight:600, fontSize:"0.85rem" }}>{e.senderName||e.senderEmail}</span>
                <span style={s.chip(e.urgency)}>{e.urgency}</span>
              </div>
              <div style={{ fontSize:"0.82rem", color:"#cbd5e1", marginBottom:"0.25rem", whiteSpace:"nowrap" as const, overflow:"hidden", textOverflow:"ellipsis" }}>{e.subject}</div>
              <div style={{ display:"flex", gap:"0.5rem" }}>
                <span style={s.chip("medium")}>{CAT_LABELS[e.category]||e.category}</span>
                <span style={{ fontSize:"0.68rem", color:"#475569" }}>{e.approvalStatus}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={s.detail}>
          {!selected ? (
            <div style={{ textAlign:"center", color:"#475569", marginTop:"4rem" }}>
              <div style={{ fontSize:"2rem", marginBottom:"0.5rem" }}>📧</div>
              <div>Select an email to view details</div>
            </div>
          ) : (
            <>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.5rem" }}>
                <div>
                  <h2 style={{ margin:0, fontSize:"1.1rem", fontWeight:700 }}>{selected.subject}</h2>
                  <div style={{ fontSize:"0.82rem", color:"#94a3b8", marginTop:"0.25rem" }}>From: {selected.senderName||selected.senderEmail}</div>
                </div>
                <div style={{ display:"flex", gap:"0.75rem" }}>
                  {selected.approvalStatus==="draft" && (
                    <button onClick={()=>handleApprove(selected.id)} style={s.btn("#22c55e")}>✓ Approve Draft</button>
                  )}
                  <button onClick={()=>setSelected(null)} style={s.btn("rgba(255,255,255,0.08)")}>Close</button>
                </div>
              </div>
              <InfoRow label="Category" value={CAT_LABELS[selected.category]||selected.category} />
              <InfoRow label="Urgency" value={selected.urgency?.toUpperCase()} />
              <InfoRow label="Intent" value={selected.intent} />
              <InfoRow label="Action Required" value={selected.actionRequired} />
              <InfoRow label="Client Name" value={selected.clientName||"—"} />
              <InfoRow label="Product Interest" value={selected.productInterest||"—"} />
              <InfoRow label="Confidence Score" value={`${((selected.confidenceScore||0)*100).toFixed(0)}%`} />
              <div style={{ marginTop:"1.5rem" }}>
                <div style={{ fontWeight:600, fontSize:"0.85rem", color:"#94a3b8", marginBottom:"0.75rem" }}>AI DRAFT REPLY</div>
                <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:"1rem", fontSize:"0.85rem", lineHeight:1.7, whiteSpace:"pre-wrap" as const, color:"#e2e8f0" }}>
                  {selected.draftReply}
                </div>
                <div style={{ marginTop:"0.75rem", fontSize:"0.72rem", color:"#eab308", display:"flex", gap:"0.5rem" }}>
                  <span>⚠️</span>
                  <span>This draft requires Admin approval before sending. Do not send without review.</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:"flex", gap:"1rem", marginBottom:"0.75rem", padding:"0.75rem", background:"rgba(255,255,255,0.03)", borderRadius:8 }}>
      <div style={{ fontSize:"0.78rem", color:"#64748b", fontWeight:600, minWidth:140 }}>{label}</div>
      <div style={{ fontSize:"0.85rem", color:"#e2e8f0" }}>{value}</div>
    </div>
  );
}
