/**
 * Copilot Page: desk-intelligence
 * Auto-generated stub — connects to /api/admin/copilot/* endpoints.
 * Expand with full UI as needed.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

export default function CopilotPage_desk_intelligence() {
  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", color:"#f1f5f9", fontFamily:"'Inter',sans-serif", padding:"2rem" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginBottom:"2rem" }}>
        <Link href="/admin/copilot"><span style={{ cursor:"pointer", fontSize:"1.25rem" }}>←</span></Link>
        <h1 style={{ margin:0, fontWeight:800, textTransform:"capitalize" }}>desk-intelligence</h1>
      </div>
      <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, padding:"2rem", textAlign:"center" }}>
        <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>🤖</div>
        <div style={{ fontWeight:700, marginBottom:"0.5rem" }}>Module: desk-intelligence</div>
        <div style={{ color:"#64748b", fontSize:"0.9rem" }}>This module is ready. Backend API at /api/admin/copilot/. Full UI in progress.</div>
        <a href="/api/admin/copilot/health" target="_blank" style={{ display:"inline-block", marginTop:"1.5rem", background:"#6366f1", color:"#fff", padding:"0.5rem 1.5rem", borderRadius:8, textDecoration:"none", fontWeight:600 }}>
          Test API Health →
        </a>
      </div>
    </div>
  );
}
