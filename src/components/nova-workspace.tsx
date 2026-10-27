"use client";

import { useMemo, useState } from "react";

import { analyzeSolarTracking } from "@/lib/engineering/solar";
import type { SolarAnalysis, SolarInput } from "@/lib/engineering/solar";
import type { AgentEvent, AgentRunResult } from "@/types/agent";

type View = "overview" | "agent" | "engineering" | "research" | "reports" | "history" | "settings";

const examples = [
  "Investigate whether a dual-axis solar tracker is worth the added complexity for a 10 m² panel array.",
  "Calculate the useful mechanical power from 420 N at 1.8 m/s with 82% efficiency.",
  "Find public research sources about photovoltaic tracking and summarize what needs verification.",
];

const defaultSolarInput: SolarInput = {
  panelAreaM2: 10,
  panelEfficiencyPct: 20,
  annualIrradianceKwhM2: 1_500,
  performanceRatioPct: 78,
  ratedPowerKw: 2,
  singleAxisGainPct: 12,
  dualAxisGainPct: 22,
  singleAxisPenaltyPct: 2,
  dualAxisPenaltyPct: 5,
};

const navItems: Array<{ id: View; label: string; hint: string; icon: string }> = [
  { id: "overview", label: "Overview", hint: "Workspace pulse", icon: "◈" },
  { id: "agent", label: "New task", hint: "Run an investigation", icon: "✦" },
  { id: "engineering", label: "Workbench", hint: "Solar tracking model", icon: "⌁" },
  { id: "research", label: "Evidence", hint: "Sources from runs", icon: "◎" },
  { id: "reports", label: "Reports", hint: "Review and export", icon: "▤" },
  { id: "history", label: "Run history", hint: "Local activity", icon: "◷" },
];

export function NovaWorkspace() {
  const [view, setView] = useState<View>("overview");
  const [objective, setObjective] = useState("");
  const [run, setRun] = useState<AgentRunResult | null>(null);
  const [history, setHistory] = useState<AgentRunResult[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem("nova-run-history");
      return stored ? (JSON.parse(stored) as AgentRunResult[]) : [];
    } catch {
      return [];
    }
  });
  const [isRunning, setIsRunning] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [solarInput, setSolarInput] = useState<SolarInput>(defaultSolarInput);
  const [solarAnalysis, setSolarAnalysis] = useState<SolarAnalysis>(() => analyzeSolarTracking(defaultSolarInput));

  async function executeObjective() {
    if (objective.trim().length < 3 || isRunning) return;
    setIsRunning(true);
    setRequestError(null);
    setView("agent");
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ objective, maxToolCalls: 6 }),
      });
      const payload = (await response.json()) as AgentRunResult | { error?: string };
      if (!response.ok || !isAgentRunResult(payload)) throw new Error("error" in payload ? payload.error : "The agent request failed.");
      setRun(payload);
      setHistory((current) => {
        const next = [payload, ...current.filter((item) => item.runId !== payload.runId)].slice(0, 12);
        try {
          window.localStorage.setItem("nova-run-history", JSON.stringify(next));
        } catch {
          // Keep the current run visible even if browser persistence is unavailable.
        }
        return next;
      });
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "The agent request failed.");
    } finally {
      setIsRunning(false);
    }
  }

  function updateSolarInput(key: keyof SolarInput, value: string) {
    const numericValue = Number(value);
    setSolarInput((current) => ({ ...current, [key]: Number.isFinite(numericValue) ? numericValue : 0 }));
  }

  function calculateSolar() {
    try {
      setSolarAnalysis(analyzeSolarTracking(solarInput));
    } catch {
      setRequestError("Check the workbench inputs: values must be positive and percentages must stay between 0 and 100.");
    }
  }

  const currentSources = useMemo(() => run?.sources ?? history.flatMap((item) => item.sources).slice(0, 8), [history, run]);

  return (
    <div className="nova-shell">
      <aside className="nova-sidebar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">N</div>
          <div>
            <p className="eyebrow">AETHRA / SYSTEM 01</p>
            <p className="brand-name">NOVA</p>
          </div>
        </div>
        <div className="sidebar-rule" />
        <p className="sidebar-label">Workspace</p>
        <nav className="primary-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${view === item.id ? "is-active" : ""}`} onClick={() => setView(item.id)}>
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span><strong>{item.label}</strong><small>{item.hint}</small></span>
              {view === item.id ? <span className="nav-pip" aria-hidden="true" /> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className={`nav-item ${view === "settings" ? "is-active" : ""}`} onClick={() => setView("settings")}>
            <span className="nav-icon" aria-hidden="true">◌</span>
            <span><strong>Settings</strong><small>Runtime configuration</small></span>
          </button>
          <div className="operator-card">
            <span className="status-dot" />
            <div><strong>Local workspace</strong><small>Read-only tools enabled</small></div>
          </div>
        </div>
      </aside>

      <main className="nova-main">
        <header className="topbar">
          <div><p className="eyebrow">AUTONOMOUS ENGINEERING INTELLIGENCE</p><h1>{pageTitle(view)}</h1></div>
          <div className="topbar-meta"><span className="live-indicator"><span className="status-dot" />SYSTEM READY</span><span className="date-stamp">OCT 27 / 2026</span></div>
        </header>

        {requestError ? <div className="alert error-alert" role="alert"><strong>Run attention</strong><span>{requestError}</span><button onClick={() => setRequestError(null)} aria-label="Dismiss error">×</button></div> : null}

        {view === "overview" ? <Overview onStart={() => setView("agent")} onOpenRun={() => setView("agent")} onExample={(value) => { setObjective(value); setView("agent"); }} run={run} history={history} /> : null}
        {view === "agent" ? <AgentView objective={objective} setObjective={setObjective} onRun={executeObjective} isRunning={isRunning} run={run} onExample={setObjective} /> : null}
        {view === "engineering" ? <EngineeringView input={solarInput} analysis={solarAnalysis} updateInput={updateSolarInput} onCalculate={calculateSolar} /> : null}
        {view === "research" ? <ResearchView sources={currentSources} run={run} onStart={() => setView("agent")} /> : null}
        {view === "reports" ? <ReportsView run={run} onStart={() => setView("agent")} /> : null}
        {view === "history" ? <HistoryView history={history} onSelect={(selected) => { setRun(selected); setView("agent"); }} onStart={() => setView("agent")} /> : null}
        {view === "settings" ? <SettingsView /> : null}
      </main>
    </div>
  );
}

function Overview({ onStart, onOpenRun, onExample, run, history }: { onStart: () => void; onOpenRun: () => void; onExample: (value: string) => void; run: AgentRunResult | null; history: AgentRunResult[] }) {
  return <div className="page-content overview-page">
    <section className="hero-grid">
      <div className="hero-copy">
        <span className="section-index">01 / 06 — MISSION CONTROL</span>
        <h2>Turn complex questions into <em>defensible</em> engineering work.</h2>
        <p>NOVA plans bounded investigations, selects validated tools, observes results, and shows its operational trail. Start with a question, not a chat.</p>
        <button className="primary-button" onClick={onStart}>Open agent workspace <span aria-hidden="true">↗</span></button>
      </div>
      <div className="signal-card">
        <div className="signal-header"><span>RUN READINESS</span><span className="green-text">● NOMINAL</span></div>
        <div className="signal-graphic" aria-hidden="true"><div className="signal-ring ring-one" /><div className="signal-ring ring-two" /><div className="signal-core">N</div><span className="signal-line line-a" /><span className="signal-line line-b" /></div>
        <div className="signal-footer"><span>READ-ONLY TOOLSET</span><strong>08</strong></div>
      </div>
    </section>
    <section className="metric-strip" aria-label="Workspace metrics">
      <Metric label="Tool registry" value="08" detail="validated operations" />
      <Metric label="Execution budget" value="06" detail="max tool calls / run" />
      <Metric label="Persistence" value="LOCAL" detail="browser run history" />
      <Metric label="Provider" value="OLLAMA" detail="localhost-only model" />
    </section>
    <section className="section-block">
      <div className="section-heading"><div><span className="section-index">START HERE</span><h3>Choose an investigation</h3></div><span className="muted-label">Different objectives, different paths</span></div>
      <div className="example-grid">{examples.map((example, index) => <button className="example-card" key={example} onClick={() => onExample(example)}><span>0{index + 1}</span><strong>{example}</strong><small>Run objective ↗</small></button>)}</div>
    </section>
    <section className="section-block lower-grid">
      <div><div className="section-heading"><div><span className="section-index">LATEST SIGNAL</span><h3>{run ? "Last execution" : "No execution yet"}</h3></div></div>{run ? <RunSummary run={run} onOpen={onOpenRun} /> : <EmptyState title="Your first run is waiting" body="Use one of the objectives above to see planning, tool selection, and bounded results in the workspace." action="Start a task" onAction={onStart} />}</div>
      <div className="principles-card"><span className="section-index">NOVA PRINCIPLES</span><div className="principle"><b>01</b><span><strong>Evidence over confidence</strong><small>Claims keep their source and status.</small></span></div><div className="principle"><b>02</b><span><strong>Visible operations</strong><small>Events show what actually ran.</small></span></div><div className="principle"><b>03</b><span><strong>Bounded autonomy</strong><small>Tools are validated and capped.</small></span></div></div>
    </section>
    {history.length > 0 ? <p className="history-note">{history.length} local run{history.length === 1 ? "" : "s"} retained in this browser.</p> : null}
  </div>;
}

function AgentView({ objective, setObjective, onRun, isRunning, run, onExample }: { objective: string; setObjective: (value: string) => void; onRun: () => void; isRunning: boolean; run: AgentRunResult | null; onExample: (value: string) => void }) {
  return <div className="page-content agent-page">
    <section className="workspace-intro"><div><span className="section-index">02 / AGENT WORKSPACE</span><h2>Give NOVA a real objective.</h2><p>It will create a plan, choose from bounded tools, and return an inspectable execution record.</p></div><div className="budget-chip"><span>MAX EXECUTION</span><strong>06 TOOL CALLS</strong></div></section>
    <div className="agent-layout">
      <div><TaskComposer objective={objective} setObjective={setObjective} onRun={onRun} isRunning={isRunning} /><div className="suggestions"><span>Try a structured objective</span>{examples.map((example) => <button key={example} onClick={() => onExample(example)}>{example}</button>)}</div></div>
      <aside className="agent-rail"><span className="section-index">OPERATING MODEL</span><div className="rail-step"><b>01</b><span><strong>Plan</strong><small>Objective becomes a task graph.</small></span></div><div className="rail-step"><b>02</b><span><strong>Act</strong><small>Only registered tools can run.</small></span></div><div className="rail-step"><b>03</b><span><strong>Observe</strong><small>Outputs revise the next step.</small></span></div><div className="rail-step"><b>04</b><span><strong>Report</strong><small>Results retain assumptions.</small></span></div></aside>
    </div>
    {run ? <ExecutionPanel run={run} /> : <div className="empty-execution"><span className="empty-icon">⌁</span><h3>Execution telemetry will appear here</h3><p>Every task exposes operational events, tool results, warnings, and the final status.</p></div>}
  </div>;
}

function TaskComposer({ objective, setObjective, onRun, isRunning }: { objective: string; setObjective: (value: string) => void; onRun: () => void; isRunning: boolean }) {
  return <div className="composer-card"><div className="composer-top"><span className="input-label"><span className="status-dot" />OBJECTIVE INPUT</span><span className="char-count">{objective.length} / 2,000</span></div><textarea value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="e.g. Investigate whether a dual-axis solar tracker is worth the complexity for my prototype..." rows={5} aria-label="Engineering objective" /><div className="composer-bottom"><span className="composer-note">Read-only tools · bounded execution · explicit assumptions</span><button className="primary-button" onClick={onRun} disabled={isRunning || objective.trim().length < 3}>{isRunning ? <><span className="spinner" />Running investigation</> : <>Run objective <span aria-hidden="true">↗</span></>}</button></div></div>;
}

function ExecutionPanel({ run }: { run: AgentRunResult }) {
  return <section className="execution-panel"><div className="execution-header"><div><span className="section-index">EXECUTION RECORD / {run.runId.slice(0, 8).toUpperCase()}</span><h3>{statusLabel(run.status)}</h3></div><div className={`mode-badge ${run.mode === "ollama-local" ? "live-mode" : "local-mode"}`}><span className="status-dot" />{run.mode === "ollama-local" ? "OLLAMA LOCAL" : "LOCAL DEMONSTRATION"}</div></div><div className="objective-echo"><span>OBJECTIVE</span><strong>{run.objective}</strong></div><div className="execution-grid"><div className="timeline"><span className="timeline-label">EVENT TIMELINE</span>{run.events.map((event) => <EventRow key={event.id} event={event} />)}</div><div className="result-column"><div className="result-card final-result"><span className="timeline-label">FINAL OUTPUT</span><p>{run.finalSummary}</p>{run.warnings.length ? <div className="warning-box"><strong>Uncertainty / attention</strong>{run.warnings.map((warning) => <span key={warning}>{warning}</span>)}</div> : null}</div>{run.toolResults.map((result, index) => <details className="result-card tool-result" key={`${result.toolName}-${index}`} open={index === run.toolResults.length - 1}><summary><span className="tool-status">{result.status === "completed" ? "✓" : "!"}</span><span><strong>{result.toolName}</strong><small>{result.summary}</small></span><span className="chevron">⌄</span></summary>{result.error ? <p className="error-text">{result.error}</p> : <pre>{JSON.stringify(result.data, null, 2)}</pre>}</details>)}</div></div>{run.plan ? <div className="plan-footer"><span className="timeline-label">PLAN REVISION {run.plan.revision}</span><div className="plan-steps">{run.plan.steps.map((step) => <span key={step.id} className={`plan-step ${step.status}`}><i />{step.title}</span>)}</div></div> : null}</section>;
}

function EventRow({ event }: { event: AgentEvent }) {
  return <div className="event-row"><span className={`event-marker ${event.type.includes("failed") ? "failed" : event.type.includes("warning") ? "warning" : ""}`}>{event.type.includes("tool") ? "⌁" : event.type === "task_completed" ? "✓" : "·"}</span><div><div className="event-meta"><strong>{eventLabel(event.type)}</strong><time>{formatTime(event.timestamp)}</time></div><p>{event.message}</p></div></div>;
}

function EngineeringView({ input, analysis, updateInput, onCalculate }: { input: SolarInput; analysis: SolarAnalysis; updateInput: (key: keyof SolarInput, value: string) => void; onCalculate: () => void }) {
  return <div className="page-content workbench-page"><section className="workspace-intro"><div><span className="section-index">03 / ENGINEERING WORKBENCH</span><h2>Solar tracking, with the assumptions visible.</h2><p>Adjust the scenario inputs and compare consistent outputs from the same deterministic model.</p></div><span className="model-badge">DETERMINISTIC MODEL / ESTIMATE</span></section><div className="workbench-layout"><section className="control-panel"><div className="panel-heading"><span className="section-index">MODEL INPUTS</span><span className="muted-label">All units explicit</span></div><div className="input-grid">{solarFields.map((field) => <label key={field.key}><span>{field.label}<small>{field.unit}</small></span><input type="number" min="0" max={field.percent ? 100 : undefined} step="any" value={input[field.key]} onChange={(event) => updateInput(field.key, event.target.value)} /></label>)}</div><button className="primary-button full-button" onClick={onCalculate}>Recalculate scenarios <span aria-hidden="true">↗</span></button></section><section className="analysis-panel"><div className="panel-heading"><span className="section-index">SCENARIO OUTPUT</span><span className="green-text">● ALIGNED DATASET</span></div><div className="scenario-cards">{analysis.scenarios.map((scenario) => <div className={`scenario-card ${scenario.id}`} key={scenario.id}><span>{scenario.label}</span><strong>{formatNumber(scenario.annualEnergyKwh)}</strong><small>kWh / year</small><div className="scenario-delta">{scenario.id === "fixed" ? "BASELINE" : `+${formatNumber(scenario.netGainPct)}% NET`}</div></div>)}</div><SolarChart analysis={analysis} /><div className="assumptions"><span className="timeline-label">ASSUMPTIONS & LIMITS</span>{analysis.assumptions.map((assumption) => <p key={assumption}><i />{assumption}</p>)}{analysis.warnings.map((warning) => <p className="warning-text" key={warning}><i />{warning}</p>)}</div></section></div></div>;
}

const solarFields: Array<{ key: keyof SolarInput; label: string; unit: string; percent?: boolean }> = [
  { key: "panelAreaM2", label: "Panel area", unit: "m²" },
  { key: "panelEfficiencyPct", label: "Panel efficiency", unit: "%", percent: true },
  { key: "annualIrradianceKwhM2", label: "Annual irradiance", unit: "kWh/m²" },
  { key: "performanceRatioPct", label: "Performance ratio", unit: "%", percent: true },
  { key: "ratedPowerKw", label: "Rated power", unit: "kW" },
  { key: "singleAxisGainPct", label: "Single-axis gain", unit: "%", percent: true },
  { key: "dualAxisGainPct", label: "Dual-axis gain", unit: "%", percent: true },
  { key: "singleAxisPenaltyPct", label: "Single-axis penalty", unit: "%", percent: true },
  { key: "dualAxisPenaltyPct", label: "Dual-axis penalty", unit: "%", percent: true },
];

function SolarChart({ analysis }: { analysis: SolarAnalysis }) {
  const max = Math.max(...analysis.scenarios.map((scenario) => scenario.annualEnergyKwh));
  return <div className="chart-card"><div className="chart-header"><span className="timeline-label">ANNUAL ENERGY / KWH</span><span className="muted-label">Computed from current inputs</span></div><div className="bar-chart" role="img" aria-label="Bar chart comparing annual energy for fixed, single-axis, and dual-axis scenarios">{analysis.scenarios.map((scenario) => <div className="bar-group" key={scenario.id}><div className="bar-value">{formatNumber(scenario.annualEnergyKwh)}</div><div className={`bar ${scenario.id}`} style={{ height: `${Math.max(8, (scenario.annualEnergyKwh / max) * 100)}%` }} /><span>{scenario.label.replace(" tracking", "")}</span></div>)}</div></div>;
}

function ResearchView({ sources, run, onStart }: { sources: Array<{ title: string; url: string; doi?: string }>; run: AgentRunResult | null; onStart: () => void }) {
  return <div className="page-content research-page"><section className="workspace-intro"><div><span className="section-index">04 / EVIDENCE LEDGER</span><h2>Sources stay attached to the work.</h2><p>NOVA can search public Crossref metadata when research is requested. Retrieved content is untrusted evidence, never an instruction.</p></div><span className="model-badge">PUBLIC METADATA / CROSSREF</span></section>{sources.length ? <div className="source-list">{sources.map((source, index) => <a className="source-row" href={source.url} target="_blank" rel="noreferrer" key={`${source.url}-${index}`}><span className="source-index">0{index + 1}</span><span><strong>{source.title}</strong><small>{source.doi ? `DOI ${source.doi}` : source.url}</small></span><span aria-hidden="true">↗</span></a>)}</div> : <EmptyState title="No source references yet" body="Run a research-oriented objective to populate the evidence ledger with actual public references." action="Open agent workspace" onAction={onStart} />}{run?.mode === "local-demonstration" && run.sources.length === 0 ? <p className="disclosure">This run did not produce source references. NOVA keeps missing evidence explicit rather than inventing citations.</p> : null}</div>;
}

function ReportsView({ run, onStart }: { run: AgentRunResult | null; onStart: () => void }) {
  if (!run) return <div className="page-content"><EmptyState title="No report to review" body="Complete an agent run first. The report view will use the actual plan, events, results, sources, and limitations from that run." action="Start an investigation" onAction={onStart} /></div>;
  return <div className="page-content report-page"><div className="report-toolbar"><div><span className="section-index">05 / REPORT STUDIO</span><h2>Technical investigation record</h2></div><button className="secondary-button" onClick={() => window.print()}>Print / save PDF ↗</button></div><article className="report-sheet"><div className="report-cover"><span className="report-kicker">NOVA BY AETHRA / TECHNICAL RECORD</span><h3>{reportTitle(run)}</h3><p>{run.objective}</p><div className="report-meta"><span>RUN {run.runId.slice(0, 8).toUpperCase()}</span><span>{run.mode === "ollama-local" ? "OLLAMA LOCAL" : "LOCAL DEMONSTRATION"}</span><span>{new Date(run.completedAt).toLocaleDateString()}</span></div></div><div className="report-section"><span className="section-index">EXECUTIVE SUMMARY</span><p className="report-lead">{run.finalSummary}</p></div><div className="report-columns"><div><span className="timeline-label">METHOD</span><p>NOVA received the objective, generated a structured plan, executed only registered read-only tools within a six-call budget, and recorded each operational event.</p></div><div><span className="timeline-label">STATUS</span><p>{statusLabel(run.status)}. {run.warnings.length ? "Review the attention items before relying on the result." : "No runtime warnings were emitted."}</p></div></div><div className="report-section"><span className="section-index">ASSUMPTIONS & LIMITATIONS</span>{(run.plan.missingInformation.length ? run.plan.missingInformation : ["No additional missing information was recorded by the plan."]).map((item) => <p className="report-bullet" key={item}>— {item}</p>)}<p className="report-bullet">— Tool outputs are bounded engineering calculations and do not constitute laboratory validation or professional design approval.</p></div>{run.sources.length ? <div className="report-section"><span className="section-index">SOURCES</span>{run.sources.map((source) => <p className="report-source" key={source.url}><a href={source.url}>{source.title}</a><small>{source.url}</small></p>)}</div> : null}</article></div>;
}

function HistoryView({ history, onSelect, onStart }: { history: AgentRunResult[]; onSelect: (run: AgentRunResult) => void; onStart: () => void }) {
  return <div className="page-content history-page"><section className="workspace-intro"><div><span className="section-index">06 / LOCAL RUN HISTORY</span><h2>Inspect what NOVA actually did.</h2><p>Run records are stored in this browser only. No database or cloud persistence is being implied.</p></div></section>{history.length ? <div className="history-list">{history.map((item) => <button className="history-row" key={item.runId} onClick={() => onSelect(item)}><span className={`history-status ${item.status}`} /> <span><strong>{item.objective}</strong><small>{item.mode === "ollama-local" ? "Ollama local" : "Local demonstration"} · {item.toolResults.length} tool result{item.toolResults.length === 1 ? "" : "s"}</small></span><time>{new Date(item.completedAt).toLocaleString()}</time><span aria-hidden="true">→</span></button>)}</div> : <EmptyState title="History is empty" body="Completed runs will appear here and remain local to this browser." action="Open agent workspace" onAction={onStart} />}</div>;
}

function SettingsView() {
  return <div className="page-content settings-page"><section className="workspace-intro"><div><span className="section-index">RUNTIME SETTINGS</span><h2>Deliberate boundaries.</h2><p>Provider configuration stays server-side. The browser never receives credentials or direct tool permissions.</p></div></section><div className="settings-grid"><div className="setting-card"><span className="section-index">MODEL PROVIDER</span><h3>Ollama local adapter</h3><p>Live model mode uses only <code>OLLAMA_BASE_URL</code> on localhost and the configured local model.</p><span className="setting-status">LOCALHOST ONLY</span></div><div className="setting-card"><span className="section-index">EXECUTION SAFETY</span><h3>Read-only tool registry</h3><p>Math, engineering calculations, and public research retrieval are validated. External mutation tools are not registered.</p><span className="setting-status">09 TOOLS / 0 MUTATIONS</span></div><div className="setting-card"><span className="section-index">PERSISTENCE</span><h3>Browser-local history</h3><p>Run records are retained in localStorage for demonstration continuity. Configure a database before production use.</p><span className="setting-status">LOCAL DEVELOPMENT</span></div></div></div>;
}

function RunSummary({ run, onOpen }: { run: AgentRunResult; onOpen: () => void }) { return <div className="run-summary"><div className="summary-status"><span className={`status-pill ${run.status}`}>{run.status}</span><span>{run.toolResults.length} tool result{run.toolResults.length === 1 ? "" : "s"}</span></div><p>{run.finalSummary}</p><button className="text-button" onClick={onOpen}>Open execution record ↗</button></div>; }
function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) { return <div className="empty-state"><span className="empty-icon">＋</span><h3>{title}</h3><p>{body}</p><button className="secondary-button" onClick={onAction}>{action} ↗</button></div>; }
function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function pageTitle(view: View) { return navItems.find((item) => item.id === view)?.label ?? "Settings"; }
function statusLabel(status: AgentRunResult["status"]) { return status === "completed" ? "Investigation complete" : status === "partial" ? "Investigation partially complete" : status === "cancelled" ? "Investigation cancelled" : "Investigation failed"; }
function eventLabel(type: AgentEvent["type"]) { return type.replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()); }
function formatTime(timestamp: string) { return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function formatNumber(value: number) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value); }
function reportTitle(run: AgentRunResult) { return run.objective.length > 82 ? `${run.objective.slice(0, 79)}…` : run.objective; }
function isAgentRunResult(value: AgentRunResult | { error?: string }): value is AgentRunResult {
  return typeof value === "object" && value !== null && "runId" in value && "events" in value && "status" in value;
}
