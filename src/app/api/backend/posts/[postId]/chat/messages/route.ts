const postIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const maximumRequestBytes = 1_300_000;

function getErrorCode(error: unknown) {
  if (!(error instanceof Error) || !("cause" in error)) return undefined;
  const { cause } = error;
  if (cause instanceof Error) return cause.name;
  if (typeof cause !== "object" || cause === null || !("code" in cause)) {
    return undefined;
  }
  return typeof cause.code === "string" ? cause.code : undefined;
}

function getBackendOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return "invalid backend URL";
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;
  if (!postIdPattern.test(postId)) {
    return Response.json({ detail: "Post not found" }, { status: 404 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maximumRequestBytes) {
    return Response.json(
      { detail: "The image is too large. Choose a smaller image." },
      { status: 413 },
    );
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > maximumRequestBytes) {
    return Response.json(
      { detail: "The image is too large. Choose a smaller image." },
      { status: 413 },
    );
  }

  const backendUrl = (
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://127.0.0.1:8000"
  ).replace(/\/+$/, "");
  const headers = new Headers({ "Content-Type": "application/json" });
  const authorization = request.headers.get("authorization");
  if (authorization) headers.set("Authorization", authorization);

  try {
    const response = await fetch(
      `${backendUrl}/api/posts/${postId}/chat/messages`,
      {
        method: "POST",
        headers,
        body,
        cache: "no-store",
      },
    );
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    console.error("Chat proxy could not reach the backend.", {
      backendOrigin: getBackendOrigin(backendUrl),
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorCode: getErrorCode(error),
    });
    return Response.json(
      { detail: "Could not connect to the backend chat service." },
      { status: 502 },
    );
  }
}
