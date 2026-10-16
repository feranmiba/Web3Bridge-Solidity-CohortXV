
import { NextResponse } from "next/server";

// POST: Upload a file to Pinata
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No file provided" },
      { status: 400 }
    );
  }

  const jwt = process.env.PINATA_JWT;

  if (!jwt) {
    return NextResponse.json(
      { error: "PINATA_JWT is not configured" },
      { status: 500 }
    );
  }

  const body = new FormData();
  body.append("network", "public");
  body.append("file", file, file.name);

  const res = await fetch("https://uploads.pinata.cloud/v3/files", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body,
  });

  const json = await res.json();

  if (!res.ok) {
    return NextResponse.json(json, { status: res.status });
  }

  return NextResponse.json({ cid: json.data.cid });
}



export async function GET(req: Request) {
  const url = new URL(req.url);
  const cid = url.searchParams.get("cid");
  const type = url.searchParams.get("type") ?? "metadata";
  const gateway = process.env.PINATA_GATEWAY_HOST;

  if (!cid || !/^[a-zA-Z0-9]+$/.test(cid)) {
    return NextResponse.json(
      { error: "Invalid IPFS CID" },
      { status: 400 }
    );
  }

  if (!gateway) {
    return NextResponse.json(
      { error: "PINATA_GATEWAY_HOST is not configured" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `https://${gateway}/ipfs/${cid}`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Gateway returned ${response.status}` },
        { status: 502 }
      );
    }

    // Images and other files are returned as binary data.
    if (type === "file") {
      const contentType =
        response.headers.get("content-type") ?? "application/octet-stream";

      return new Response(await response.arrayBuffer(), {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    // Metadata must be JSON.
    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Gateway did not return JSON metadata" },
        { status: 502 }
      );
    }

    return NextResponse.json(await response.json());
  } catch {
    return NextResponse.json(
      { error: "Failed to retrieve IPFS content" },
      { status: 502 }
    );
  }
}

