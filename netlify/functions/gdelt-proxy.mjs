const GDELT_DOC_URL = "https://api.gdeltproject.org/api/v2/doc/doc";

const DEFAULT_QUERY = '"Northern California" OR "Mt Shasta" OR Redding OR "Tehama County" OR Sacramento OR earthquake OR wildfire OR infrastructure';

export async function handler(event) {
  const params = event.queryStringParameters || {};
  const query = params.query || DEFAULT_QUERY;
  const maxrecords = params.maxrecords || "20";

  const url = new URL(GDELT_DOC_URL);
  url.searchParams.set("query", query);
  url.searchParams.set("mode", "ArtList");
  url.searchParams.set("format", "json");
  url.searchParams.set("maxrecords", maxrecords);
  url.searchParams.set("sort", "HybridRel");

  try {
    const response = await fetch(url.toString(), {
      headers: { "user-agent": "parallax-watchtower/0.1" }
    });

    const text = await response.text();

    return {
      statusCode: response.status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=60"
      },
      body: text
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "access-control-allow-origin": "*"
      },
      body: JSON.stringify({ error: error instanceof Error ? error.message : "GDELT proxy failed" })
    };
  }
}
