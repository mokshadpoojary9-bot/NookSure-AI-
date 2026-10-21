import manifest from "../components/room3d/models.manifest.json";

interface ModelEntry {
  id: string;
  name: string;
  room: string;
  source: string;
  author: string;
  license: string;
}

const models = manifest.models as ModelEntry[];
const attribution = models.filter((m) => m.license.startsWith("CC-BY"));
const cc0 = models.filter((m) => m.license === "CC0");

/** "Sketchfab: https://…" → the URL, if there is one. */
const urlOf = (source: string) => /https?:\/\/\S+/.exec(source)?.[0];

const LICENSE_URL: Record<string, string> = {
  "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
  CC0: "https://creativecommons.org/publicdomain/zero/1.0/",
};

export function CreditsPage() {
  return (
    <article className="prose">
      <h1>Credits</h1>
      <p className="lead">
        The 3D room view uses free 3D models made by other people. Thank you to the creators below.
      </p>

      <h2>Models that require attribution (CC BY 4.0)</h2>
      {attribution.length === 0 ? (
        <p>None.</p>
      ) : (
        <ul className="credits-list">
          {attribution.map((m) => {
            const url = urlOf(m.source);
            return (
              <li key={m.id}>
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    “{m.name}”
                  </a>
                ) : (
                  <>“{m.name}”</>
                )}{" "}
                by <strong>{m.author}</strong>, licensed under{" "}
                <a href={LICENSE_URL[m.license]} target="_blank" rel="noopener noreferrer">
                  {m.license}
                </a>
                . Textures resized and model re-centred for the web.
              </li>
            );
          })}
        </ul>
      )}

      <h2>Public-domain models (CC0)</h2>
      <p>
        From{" "}
        <a href="https://polyhaven.com" target="_blank" rel="noopener noreferrer">
          Poly Haven
        </a>
        , released under{" "}
        <a href={LICENSE_URL.CC0} target="_blank" rel="noopener noreferrer">
          CC0
        </a>{" "}
        (no attribution required — listed with thanks): {cc0.map((m) => m.name).join(", ")}.
      </p>
    </article>
  );
}
