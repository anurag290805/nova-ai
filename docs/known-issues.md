# Known issues and external dependencies

- **Inference termination:** HTTP abort and deadlines request cancellation but do not establish that Ollama has stopped its underlying CPU work. The API concurrency guard is per server process, not shared with other processes or direct Ollama clients. Browser cancellation closes the response and cannot preserve its final run record in that browser.
- **Execution visibility:** The API returns its event record only after the run ends; it does not currently stream live events. Cancellation propagation through a real Next.js server and Ollama has not been verified in this session.

- **Local model:** Ollama must be running on localhost and the configured model must be installed. CPU inference time varies with hardware and prompt length.
- **Research network:** Crossref and public source access can be unavailable or rate-limited. Failed retrievals remain failed tool results.
- **Research security:** The URL guard rejects common private hostnames and schemes, but a production deployment needs stronger SSRF controls, DNS/IP validation, egress policy, and content-size limits at the infrastructure layer.
- **Persistence:** Run history uses browser `localStorage`; it is not multi-user, durable, encrypted, or suitable for production data retention.
- **Authentication/rate limiting:** No user accounts or server-side request quota are implemented in this checkpoint.
- **PDF:** Report export uses the browser print pipeline and has not been validated as a paginated server-generated PDF.
- **Responsive QA:** CSS breakpoints cover desktop, tablet, and mobile layouts, but automated Playwright viewport coverage is not yet configured.
- **Solar model:** The first-order model uses user-adjustable assumptions and does not include geographic irradiance series, weather, shading, tracker control dynamics, structural loads, degradation, or measured validation.
- **Small-model solar prompting:** `llama3.2:1b` can omit required multi-parameter solar arguments or emit ambiguous text. NOVA permits one correction, rejects invalid values, and returns partial status when correction does not complete.
- **Plan latency:** Live plan generation adds one Ollama inference turn. This improves autonomy evidence but increases CPU latency; CP02 evaluation records planning and execution durations separately.
- **1B structured-plan reliability:** Current `llama3.2:1b` live runs can return plan JSON that fails schema validation. NOVA labels the fallback path explicitly, but those runs do not prove model-directed planning.
- **Live multi-tool gate:** In two current local attempts, the model stopped after a correct mechanical-power tool result rather than selecting the offered operating-energy tool. The runtime and mocked integration tests support the chain, but CP02 cannot claim a genuine live multi-tool demonstration yet.
- **Solar model argument error:** One explicit live solar run converted a stated `2 kW` rated power into numeric `2000`; the deterministic tool preserved the submitted value and emitted a physical-consistency warning. The scenario-energy values did not depend on rated power, but this is not full input-normalization reliability.
