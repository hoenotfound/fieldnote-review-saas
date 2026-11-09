import { Header, Footer } from "@/components/chrome";

export const metadata = {
  title: "HD Review privacy information",
  description: "How HD Review handles customer review drafts and photo previews.",
};

export default function Privacy() {
  return (
    <>
      <Header />
      <main className="page">
        <section className="card" style={{ maxWidth: 820, margin: "36px auto" }}>
          <h1>Privacy information</h1>
          <p>
            HD Review, operated by DA Smarketing Solutions, helps you write a review about your own experience.
            It does not post reviews for you, and you do not need to provide
            your name, phone number or Google/Xiaohongshu password.
          </p>
          <h2>What stays on your device</h2>
          <p>
            Your text, selected answers and draft can be restored in this
            browser tab for up to two hours. Using Finish &amp; clear erases
            them from this tab immediately, even if the network is unavailable.
            Photo previews use local files and are not uploaded to HD Review.
            For shared kiosks, the optional kiosk setting does not restore
            earlier drafts after reloading. It also resets an inactive page
            after five minutes.
          </p>
          <h2>What is sent to AI</h2>
          <p>
            If you choose Help me write, your supplied text and selected
            answers are sent to the configured Google Gemini provider so it
            can prepare a draft. You can instead use your own words without
            requesting AI assistance. Provider-side processing and retention
            are subject to the provider's terms and settings.
          </p>
          <h2>Protecting the service</h2>
          <p>
            The service uses short-lived, salted identifiers derived from
            network information and a random browser cookie to limit repeated
            requests and preserve AI capacity for other customers. It does
            not store raw visitor IP addresses in its rate counters. If you
            reach a usage threshold, the operator may ask you to complete a
            Cloudflare Turnstile verification before another AI request.
            This verification involves Cloudflare processing browser and
            device signals under its own privacy terms.
            Manual writing remains available without completing it.
          </p>
          <h2>What the HD Review server retains</h2>
          <p>
            Review input is not stored as plaintext in the HD Review database.
            The server records a hash of the input, generation timing, outcome,
            language, location and token counts. Successful draft output may
            be cached encrypted for the two-hour customer session. Finish
            revokes the session and erases this cache when the server is
            reachable. Expired draft caches are cleared by the configured
            cleanup process, rather than at the exact expiry second.
          </p>
          <p>
            The daily cleanup is intended to remove generation metadata older
            than 30 days, expired guest-session records after 30 days and
            hashed request-limit counters after three days. Summary usage
            counters may be kept for up to 90 days. These periods describe
            the live database; backups and AI-provider retention may differ.
            The scheduled cleanup must be enabled and monitored by the
            operator before routine client use.
          </p>
          <h2>Sharing and deletion questions</h2>
          <p>
            Nothing is posted automatically. You choose whether to copy your
            draft or open the review platform. For a question about a
            particular visit or a deletion request, start with the business
            that provided your QR code so it can contact the HD Review
            operator. A direct operator contact and confirmed backup
            retention policy are being finalized for the pilot.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
