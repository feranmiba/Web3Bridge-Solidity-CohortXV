export async function POST(req: Request) {
  const apiKey = process.env.PIMLICO_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: "Missing PIMLICO_API_KEY in frontend/.env.local. Please add your Pimlico API key to frontend/.env.local.",
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }

  const pimlicoUrl = `https://api.pimlico.io/v2/11155111/rpc?apikey=${apiKey}`;
  const res = await fetch(pimlicoUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await req.text(), // the JSON-RPC request, unchanged
  });

  return new Response(await res.text(), {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}
