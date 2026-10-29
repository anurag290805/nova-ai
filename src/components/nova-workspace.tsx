"use client";

import { useMemo, useRef, useState } from "react";

import { analyzeSolarTracking } from "@/lib/engineering/solar";
import type { SolarAnalysis, SolarInput } from "@/lib/engineering/solar";
import type { AgentEvent, AgentRunResult } from "@/types/agent";

type View = "agent" | "engineering" | "research" | "reports" | "history" | "settings";

const examples = [
  "Calculate mechanical power for 50 Nm at 1500 RPM.",
  "Calculate the useful mechanical power from 420 N at 1.8 m/s with 82% efficiency.",
  "Calculate the power from 120 N of force at 2 m/s.",
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

const navItems: Array<{ id: View; label: string }> = [
  { id: "agent", label: "Workspace" },
  { id: "history", label: "History" },
  { id: "settings", label: "Settings" },
];

export function NovaWorkspace() {
  const [view, setView] = useState<View>("agent");
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
  const [activeObjective, setActiveObjective] = useState("");
  const [executionMode, setExecutionMode] = useState<"direct" | "structured">("direct");
  const requestController = useRef<AbortController | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [solarInput, setSolarInput] = useState<SolarInput>(defaultSolarInput);
  const [solarAnalysis, setSolarAnalysis] = useState<SolarAnalysis>(() => analyzeSolarTracking(defaultSolarInput));

  async function executeObjective() {
    if (objective.trim().length < 3 || requestController.current) return;
    const controller = new AbortController();
    requestController.current = controller;
    setIsRunning(true);
    setActiveObjective(objective.trim());
    setRequestError(null);
    setView("agent");
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ objective, maxToolCalls: 6, executionMode }),
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
      setRequestError(controller.signal.aborted ? "Cancellation requested. The connection was closed; Ollama may still be stopping its inference." : error instanceof Error ? error.message : "The agent request failed.");
    } finally {
      requestController.current = null;
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
      <header className="minimal-header">
        <button className="minimal-brand" onClick={() => setView("agent")} aria-label="NOVA workspace"><strong>NOVA</strong><span>by AETHRA</span></button>
        <nav className="minimal-nav" aria-label="Primary navigation">{navItems.map((item) => <button key={item.id} className={view === item.id ? "is-active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)}>{item.label}</button>)}</nav>
      </header>
      <main className="nova-main">
        {requestError ? <div className="alert error-alert" role="alert"><span>{requestError}</span><button onClick={() => setRequestError(null)} aria-label="Dismiss error">×</button></div> : null}
        {view === "agent" ? <AgentView objective={objective} setObjective={setObjective} onRun={executeObjective} onCancel={() => requestController.current?.abort()} isRunning={isRunning} activeObjective={activeObjective} run={run} onExample={setObjective} executionMode={executionMode} setExecutionMode={setExecutionMode} onNavigate={setView} /> : null}
        {view === "engineering" ? <EngineeringView input={solarInput} analysis={solarAnalysis} updateInput={updateSolarInput} onCalculate={calculateSolar} /> : null}
        {view === "research" ? <ResearchView sources={currentSources} run={run} onStart={() => setView("agent")} /> : null}
        {view === "reports" ? <ReportsView run={run} onStart={() => setView("agent")} /> : null}
        {view === "history" ? <HistoryView history={history} onSelect={(selected) => { setRun(selected); setView("agent"); }} onStart={() => setView("agent")} /> : null}
        {view === "settings" ? <SettingsView /> : null}
      </main>
    </div>
  );
}

function AgentView({ objective, setObjective, onRun, onCancel, isRunning, activeObjective, run, onExample, executionMode, setExecutionMode, onNavigate }: { objective: string; setObjective: (value: string) => void; onRun: () => void; onCancel: () => void; isRunning: boolean; activeObjective: string; run: AgentRunResult | null; onExample: (value: string) => void; executionMode: "direct" | "structured"; setExecutionMode: (value: "direct" | "structured") => void; onNavigate: (view: View) => void }) {
  return <div className="page-content agent-page">
    <section className="welcome"><span className="welcome-kicker">YOUR ENGINEERING WORKSPACE</span><h1>What would you like to work through?</h1><p>Give NOVA an objective. It can choose a tool, work through the result, and show you the evidence.</p></section>
    <div className="composer-card"><label htmlFor="objective">Your objective</label><textarea id="objective" value={objective} maxLength={2000} onChange={(event) => setObjective(event.target.value)} placeholder="Describe a calculation or engineering question..." rows={4} /><div className="composer-bottom"><label className="mode-select">Approach <select value={executionMode} onChange={(event) => setExecutionMode(event.target.value as "direct" | "structured")} disabled={isRunning}><option value="direct">Quick calculation</option><option value="structured">Structured investigation</option></select></label>{isRunning ? <button className="secondary-button" onClick={onCancel}>Cancel</button> : <button className="primary-button" onClick={onRun} disabled={objective.trim().length < 3}>Run objective <span aria-hidden="true">→</span></button>}</div></div>
    <div className="suggestions"><span>TRY AN EXAMPLE</span>{examples.map((example) => <button key={example} onClick={() => onExample(example)}>{example}</button>)}</div>
    <p className="mode-hint">Quick calculation offers arithmetic and mechanical power tools. Choose structured investigation for research, solar, and multi-step work.</p>
    {isRunning ? <section className="running-state" role="status" aria-live="polite"><span className="activity-indicator" aria-hidden="true" /><div><strong>Working on your objective</strong><p>{activeObjective}</p><small>Waiting for the local model. This can take a few minutes; detailed events appear when the run ends.</small></div></section> : run ? <ExecutionPanel run={run} onNavigate={onNavigate} /> : null}
    <div className="context-links"><span>EXPLORE</span><button onClick={() => onNavigate("engineering")}>Solar workbench</button><button onClick={() => onNavigate("research")}>Evidence</button><button onClick={() => onNavigate("reports")}>Reports</button></div>
  </div>;
}

function ExecutionPanel({ run, onNavigate }: { run: AgentRunResult; onNavigate: (view: View) => void }) {
  return <section className="execution-panel" aria-label="Investigation result"><div className="result-heading"><span className="welcome-kicker">{statusLabel(run.status)}</span><h2>Result</h2><p className="result-objective">{run.objective}</p></div><p className="result-summary">{run.finalSummary}</p>{run.warnings.length ? <div className="warning-box"><strong>Attention</strong>{run.warnings.map((warning, index) => <span key={index}>{warning}</span>)}</div> : null}<div className="result-actions"><button onClick={() => onNavigate("reports")}>Open report →</button>{run.sources.length ? <button onClick={() => onNavigate("research")}>View sources →</button> : null}</div><details className="technical-details"><summary>Execution details <span>{run.toolResults.length} tool result{run.toolResults.length === 1 ? "" : "s"}</span></summary><p className="detail-caption">Approach: {run.runtime.executionMode ?? "structured"} · Plan: {run.plan.source}</p><div className="timeline">{run.events.map((event) => <EventRow key={event.id} event={event} />)}</div>{run.toolResults.map((result, index) => <details className="tool-result" key={`${result.toolName}-${index}`}><summary>{result.toolName} · {result.status}</summary>{result.error ? <p className="error-text">{result.error}</p> : <pre>{JSON.stringify(result.data, null, 2)}</pre>}</details>)}</details></section>;
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
  return <div className="page-content report-page"><div className="report-toolbar"><div><span className="section-index">05 / REPORT STUDIO</span><h2>Technical investigation record</h2></div><button className="secondary-button" onClick={() => window.print()}>Print / save PDF ↗</button></div><article className="report-sheet"><div className="report-cover"><span className="report-kicker">NOVA BY AETHRA / TECHNICAL RECORD</span><h3>{reportTitle(run)}</h3><p>{run.objective}</p><div className="report-meta"><span>RUN {run.runId.slice(0, 8).toUpperCase()}</span><span>{run.mode === "ollama-local" ? "OLLAMA LOCAL" : "LOCAL DEMONSTRATION"}</span><span>{new Date(run.completedAt).toLocaleDateString()}</span></div></div><div className="report-section"><span className="section-index">EXECUTIVE SUMMARY</span><p className="report-lead">{run.finalSummary}</p></div><div className="report-columns"><div><span className="timeline-label">METHOD</span><p>NOVA received the objective, used the {run.runtime.executionMode === "direct" ? "direct calculation path" : "structured investigation path"}, and recorded its model decisions and registered tool activity.</p></div><div><span className="timeline-label">STATUS</span><p>{statusLabel(run.status)}. {run.warnings.length ? "Review the attention items before relying on the result." : "No runtime warnings were emitted."}</p></div></div><div className="report-section"><span className="section-index">ASSUMPTIONS & LIMITATIONS</span>{(run.plan.missingInformation.length ? run.plan.missingInformation : ["No additional missing information was recorded by the plan."]).map((item) => <p className="report-bullet" key={item}>— {item}</p>)}<p className="report-bullet">— Tool outputs are bounded engineering calculations and do not constitute laboratory validation or professional design approval.</p></div>{run.sources.length ? <div className="report-section"><span className="section-index">SOURCES</span>{run.sources.map((source) => <p className="report-source" key={source.url}><a href={source.url}>{source.title}</a><small>{source.url}</small></p>)}</div> : null}</article></div>;
}

function HistoryView({ history, onSelect, onStart }: { history: AgentRunResult[]; onSelect: (run: AgentRunResult) => void; onStart: () => void }) {
  return <div className="page-content history-page"><section className="workspace-intro"><div><span className="section-index">06 / LOCAL RUN HISTORY</span><h2>Inspect what NOVA actually did.</h2><p>Run records are stored in this browser only. No database or cloud persistence is being implied.</p></div></section>{history.length ? <div className="history-list">{history.map((item) => <button className="history-row" key={item.runId} onClick={() => onSelect(item)}><span className={`history-status ${item.status}`} /> <span><strong>{item.objective}</strong><small>{item.mode === "ollama-local" ? "Ollama local" : "Local demonstration"} · {item.toolResults.length} tool result{item.toolResults.length === 1 ? "" : "s"}</small></span><time>{new Date(item.completedAt).toLocaleString()}</time><span aria-hidden="true">→</span></button>)}</div> : <EmptyState title="History is empty" body="Completed runs will appear here and remain local to this browser." action="Open agent workspace" onAction={onStart} />}</div>;
}

function SettingsView() {
  return <div className="page-content settings-page"><section className="workspace-intro"><div><span className="section-index">RUNTIME SETTINGS</span><h2>Deliberate boundaries.</h2><p>Provider configuration stays server-side. The browser never receives credentials or direct tool permissions.</p></div></section><div className="settings-grid"><div className="setting-card"><span className="section-index">MODEL PROVIDER</span><h3>Ollama local adapter</h3><p>Live model mode uses only <code>OLLAMA_BASE_URL</code> on localhost and the configured local model.</p><span className="setting-status">LOCALHOST ONLY</span></div><div className="setting-card"><span className="section-index">EXECUTION SAFETY</span><h3>Read-only tool registry</h3><p>Math, engineering calculations, and public research retrieval are validated. External mutation tools are not registered.</p><span className="setting-status">10 TOOLS / 0 MUTATIONS</span></div><div className="setting-card"><span className="section-index">PERSISTENCE</span><h3>Browser-local history</h3><p>Run records are retained in localStorage for demonstration continuity. Configure a database before production use.</p><span className="setting-status">LOCAL DEVELOPMENT</span></div></div></div>;
}

function EmptyState({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) { return <div className="empty-state"><span className="empty-icon">＋</span><h3>{title}</h3><p>{body}</p><button className="secondary-button" onClick={onAction}>{action} ↗</button></div>; }
function statusLabel(status: AgentRunResult["status"]) { return status === "completed" ? "Investigation complete" : status === "partial" ? "Investigation partially complete" : status === "cancelled" ? "Investigation cancelled" : status === "timed_out" ? "Investigation timed out" : "Investigation failed"; }
function eventLabel(type: AgentEvent["type"]) { return type.replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()); }
function formatTime(timestamp: string) { return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function formatNumber(value: number) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value); }
function reportTitle(run: AgentRunResult) { return run.objective.length > 82 ? `${run.objective.slice(0, 79)}…` : run.objective; }
function isAgentRunResult(value: AgentRunResult | { error?: string }): value is AgentRunResult {
  return typeof value === "object" && value !== null && "runId" in value && "events" in value && "status" in value;
}
