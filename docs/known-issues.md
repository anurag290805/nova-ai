# Known issues and external dependencies

- **Local model:** Ollama must be running on localhost and the configured model must be installed. CPU inference time varies with hardware and prompt length.
- **Research network:** Crossref and public source access can be unavailable or rate-limited. Failed retrievals remain failed tool results.
- **Research security:** The URL guard rejects common private hostnames and schemes, but a production deployment needs stronger SSRF controls, DNS/IP validation, egress policy, and content-size limits at the infrastructure layer.
- **Persistence:** Run history uses browser `localStorage`; it is not multi-user, durable, encrypted, or suitable for production data retention.
- **Authentication/rate limiting:** No user accounts or server-side request quota are implemented in this checkpoint.
- **PDF:** Report export uses the browser print pipeline and has not been validated as a paginated server-generated PDF.
- **Responsive QA:** CSS breakpoints cover desktop, tablet, and mobile layouts, but automated Playwright viewport coverage is not yet configured.
- **Solar model:** The first-order model uses user-adjustable assumptions and does not include geographic irradiance series, weather, shading, tracker control dynamics, structural loads, degradation, or measured validation.
- **Small-model solar prompting:** `llama3.2:1b` can omit required multi-parameter solar arguments or emit ambiguous text. NOVA permits one correction, rejects invalid values, and returns partial status when correction does not complete.
