import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { isRouteErrorResponse, useLoaderData, useParams, useRouteError } from 'react-router';
import { formatBytes, getFileKind } from '$lib/workspace-model';
import { formatWorkspaceTimestamp } from '$lib/workspace-presentation';
import { Card } from '$lib/components/ui/card';
import { cloudflareContext } from '$lib/server/cloudflare-context';
import { resolvePublicShareFile } from '$lib/server/share-link-access';
import { createRequestEvent } from '$lib/server/runtime';

export async function loader({ request, params, context }: LoaderFunctionArgs) {
  const cloudflare = context.get(cloudflareContext);
  const event = createRequestEvent(request, cloudflare.env, cloudflare.ctx, {
    token: params.token ?? ''
  });
  const file = await resolvePublicShareFile(event);
  return {
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    modifiedTime: file.modifiedTime,
    origin: new URL(request.url).origin,
    token: params.token ?? ''
  };
}

export const meta: MetaFunction<typeof loader> = ({ loaderData }) => {
  const title = loaderData?.name ? `${loaderData.name} · GShare` : 'GShare · 공유 파일';
  const shareUrl = loaderData
    ? `${loaderData.origin}/share/${encodeURIComponent(loaderData.token)}`
    : undefined;
  const previewUrl = loaderData
    ? new URL(publicApiUrl(loaderData.token, 'preview'), loaderData.origin).toString()
    : undefined;
  return [
    { title },
    { name: 'description', content: 'GShare로 공유된 파일 미리보기' },
    { name: 'referrer', content: 'no-referrer' },
    { name: 'robots', content: 'noindex, nofollow' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: 'GShare로 공유된 파일 미리보기' },
    { property: 'og:type', content: 'website' },
    ...(shareUrl ? [{ property: 'og:url', content: shareUrl }] : []),
    ...(loaderData?.mimeType.startsWith('image/') && previewUrl
      ? [
          { property: 'og:image', content: previewUrl },
          { property: 'og:image:alt', content: loaderData.name }
        ]
      : []),
    {
      name: 'twitter:card',
      content: loaderData?.mimeType.startsWith('image/') ? 'summary_large_image' : 'summary'
    }
  ];
};

function publicApiUrl(token: string, kind: 'preview' | 'download'): string {
  const suffix = kind === 'preview' ? '/preview' : '';
  return `/api/share-links/${encodeURIComponent(token)}${suffix}`;
}

function SharePreview({
  mimeType,
  name,
  token
}: {
  mimeType: string;
  name: string;
  token: string;
}) {
  const src = publicApiUrl(token, 'preview');
  switch (getFileKind(mimeType)) {
    case 'image':
      return <img src={src} alt={name} />;
    case 'video':
      return <video src={src} controls playsInline aria-label={`${name} 동영상 미리보기`} />;
    case 'audio':
      return <audio src={src} controls aria-label={`${name} 오디오 미리보기`} />;
    case 'pdf':
    case 'text':
      return <iframe title={`${name} 미리보기`} src={src} />;
    default:
      return <p className="share-preview-empty">이 파일은 미리보기를 지원하지 않습니다.</p>;
  }
}

export default function Share() {
  const file = useLoaderData<typeof loader>();
  const { token = '' } = useParams();

  return (
    <main className="share-shell">
      <Card className="share-card">
        <header className="share-header">
          <div>
            <p className="eyebrow">GSHARE · SHARED FILE</p>
            <h1>{file.name}</h1>
            <p className="share-file-meta">
              {file.mimeType.split('/').pop()?.toUpperCase() ?? '파일'}
              <span aria-hidden="true">·</span>
              {formatBytes(file.size)}
              <span aria-hidden="true">·</span>
              {formatWorkspaceTimestamp(file.modifiedTime)}
            </p>
          </div>
          <a className="primary-button" href={publicApiUrl(token, 'download')} download>
            다운로드
          </a>
        </header>
        <section className="share-preview" aria-label="파일 미리보기">
          <SharePreview mimeType={file.mimeType} name={file.name} token={token} />
        </section>
        <footer className="share-footer">GShare 공유 링크</footer>
      </Card>
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  const invalidLink = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="auth-shell">
      <Card className="auth-card">
        <p className="eyebrow">GSHARE · SHARED FILE</p>
        <h1>{invalidLink ? '공유 링크를 찾을 수 없습니다.' : '파일을 불러오지 못했습니다.'}</h1>
        <p className="muted">
          {invalidLink
            ? '링크가 해제되었거나 파일이 휴지통으로 이동했을 수 있습니다.'
            : '잠시 후 다시 시도해주세요.'}
        </p>
      </Card>
    </main>
  );
}
