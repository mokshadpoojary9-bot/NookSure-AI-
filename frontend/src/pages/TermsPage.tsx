import { href } from "../router";

const REPO = "https://github.com/mokshadpoojary9-bot/NookSure-AI-";

export function TermsPage() {
  return (
    <article className="prose">
      <h1>Terms of Use</h1>
      <p className="lead">
        These terms apply to the NookSure AI website, its AI assistant and its MCP planning tools (for example, when
        used through Alexa+). By using NookSure you agree to them. Last updated: 23 October 2026.
      </p>

      <h2>Planning guidance, not a safety certificate</h2>
      <p>
        NookSure gives general planning guidance for preparing a home for someone with mobility needs. It never
        certifies a home as safe or accessible, and it doesn’t replace an occupational therapist, physiotherapist,
        doctor or qualified installer. It can’t see or inspect your home: its suggestions depend only on what you tell
        it, and the 3D views are illustrative, not to scale.
      </p>

      <h2>Your responsibility</h2>
      <ul>
        <li>You decide what to do in your home, and you’re responsible for doing it safely.</li>
        <li>
          Anything that bears weight or prevents falls — grab bars, handrails, ramps, transfer aids — must be a
          purpose-built product, correctly installed by a qualified professional. Never improvise these.
        </li>
        <li>In an emergency, or if someone is hurt or in danger, contact your local emergency services first.</li>
      </ul>

      <h2>AI replies can be wrong</h2>
      <p>
        The assistant uses Google’s Gemini AI. Its replies are guidance only, may be incomplete or wrong, and are not
        medical, legal or professional advice. Replies are labelled when they are sample text rather than live AI
        output.
      </p>

      <h2>Fair use</h2>
      <p>
        Please don’t misuse the service: no attempts to break, overload or get around its limits, and no automated
        bulk requests beyond normal use of the MCP tools. Requests are rate-limited.
      </p>

      <h2>No warranty</h2>
      <p>
        NookSure is provided free, “as is”, without warranties of any kind, and may change or be unavailable at times.
        As far as the law allows, its creator isn’t liable for loss or injury arising from use of the guidance or the
        service.
      </p>

      <h2>Content and credits</h2>
      <p>
        The 3D furniture models belong to their creators and are used under their licences — see{" "}
        <a href={href("/credits")}>Credits</a>.
      </p>

      <h2>Changes and contact</h2>
      <p>
        These terms may be updated; this page will show the new date. Questions can be raised on the project’s{" "}
        <a href={`${REPO}/issues`}>GitHub page</a>. See also the <a href={href("/privacy")}>Privacy Policy</a> and our{" "}
        <a href={href("/safety")}>safety principles</a>.
      </p>
    </article>
  );
}
