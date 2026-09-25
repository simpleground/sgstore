import { getFiles } from '@/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key } = await params;
  const object = await getFiles().get(key.join('/'));
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers({
    'content-type': object.contentType,
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
  });
  if (object.etag) {
    headers.set('etag', object.etag);
    if (request.headers.get('if-none-match') === object.etag)
      return new Response(null, { status: 304, headers });
  }
  if (object.size) headers.set('content-length', String(object.size));
  return new Response(object.body as BodyInit, { headers });
}
