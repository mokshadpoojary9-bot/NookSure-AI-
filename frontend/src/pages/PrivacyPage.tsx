import { href } from "../router";

const REPO = "https://github.com/mokshadpoojary9-bot/NookSure-AI-";

/** Plain description of what NookSure actually stores and sends — keep in step with the code. */
export function PrivacyPage() {
  return (
    <article className="prose">
      <h1>Privacy Policy</h1>
      <p className="lead">
        NookSure AI is a home-safety planning tool. This page says plainly what it stores, where, and what it sends
        to other services. Last updated: 23 October 2026.
      </p>

      <h2>Using it as a guest</h2>
      <p>
        Without signing in, your plan (home layout, mobility aids, furniture, what you noticed, your notes and which
        steps are done) is saved only in your own browser’s local storage. It isn’t sent to NookSure. “Start over” in
        the planner deletes it, as does clearing your browser’s site data.
      </p>

      <h2>Signing in with Google</h2>
      <p>
        Sign-in is optional and uses Google through Firebase Authentication (a Google service). Firebase receives your
        Google account’s name, email address and profile photo so you can stay signed in. If you save a plan, it is
        stored in Cloud Firestore (also Google) under your own account, with its title, the plan answers and checklist,
        and when it was created and updated. Security rules let only you read, change or delete your saved plans, and
        you can delete any of them on the Saved plans page.
      </p>

      <h2>The AI assistant</h2>
      <p>
        When you send a message, the conversation (up to your last 20 messages) goes to the NookSure server, which
        passes it to Google’s Gemini AI to write a reply. NookSure doesn’t store your messages; if a request fails, the
        server logs only the type of error, not what you wrote. Google processes the messages under its Gemini API
        terms and may keep them for a time, so please don’t include personal details such as names, addresses or health
        information.
      </p>

      <h2>Voice input and read-aloud</h2>
      <p>
        The microphone button uses your browser’s built-in speech recognition. Some browsers, including Chrome, send
        the audio to their own speech service (for Chrome, Google) to turn it into text. NookSure doesn’t receive or
        keep any audio — only the text you choose to send. Read-aloud uses your device’s built-in voices.
      </p>

      <h2>Voice assistants and other AI agents (MCP)</h2>
      <p>
        NookSure’s planning tools can also be used by AI agents, such as Alexa+, through its MCP server. The tools only
        compute a plan from the answers they’re given; nothing is stored, and no account is needed. The agent you use
        has its own privacy policy for what it does with your requests.
      </p>

      <h2>What we don’t do</h2>
      <ul>
        <li>No analytics, advertising or tracking cookies.</li>
        <li>No selling or sharing of your information.</li>
        <li>No photos of your home — NookSure can’t see or inspect it.</li>
      </ul>

      <h2>Hosting and technical logs</h2>
      <p>
        The website is hosted on Vercel and the server on Render. Like most hosts, they keep standard request logs
        (such as IP address, time and the page or address requested) for operation and security. To prevent abuse, the
        server counts requests per IP address in memory for one minute; those counts aren’t saved.
      </p>

      <h2>Children</h2>
      <p>NookSure is meant for adults planning a home, and isn’t directed at children.</p>

      <h2>Questions and changes</h2>
      <p>
        Questions or requests (for example, to delete data from your account) can be raised on the project’s{" "}
        <a href={`${REPO}/issues`}>GitHub page</a>. If this policy changes, this page will be updated with a new date.
        See also the <a href={href("/terms")}>Terms of Use</a>.
      </p>
    </article>
  );
}
