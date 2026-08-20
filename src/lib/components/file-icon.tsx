import { getFileKind, isFolderMimeType } from '../workspace-model';

export type FileCategory =
  'folder' | 'image' | 'video' | 'audio' | 'pdf' | 'code' | 'archive' | 'document' | 'file';

export function getFileCategory(name: string, mimeType: string): FileCategory {
  if (isFolderMimeType(mimeType)) return 'folder';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return 'pdf';

  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) return 'archive';
  if (
    [
      'js',
      'ts',
      'tsx',
      'jsx',
      'json',
      'html',
      'css',
      'scss',
      'py',
      'rs',
      'go',
      'c',
      'cpp',
      'sql',
      'sh',
      'ps1',
      'yaml',
      'yml',
      'md'
    ].includes(ext) ||
    mimeType.includes('json') ||
    mimeType.includes('javascript') ||
    mimeType.includes('xml')
  ) {
    return 'code';
  }
  if (
    ['doc', 'docx', 'txt', 'rtf', 'odt', 'csv', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext) ||
    mimeType.includes('document') ||
    mimeType.includes('sheet') ||
    mimeType.includes('text/plain')
  ) {
    return 'document';
  }

  const kind = getFileKind(mimeType);
  if (kind === 'image') return 'image';
  if (kind === 'video') return 'video';
  if (kind === 'audio') return 'audio';

  return 'file';
}

export function FileIcon({
  name,
  mimeType,
  thumbnailUrl,
  className = ''
}: {
  name: string;
  mimeType: string;
  thumbnailUrl?: string | null;
  className?: string;
}) {
  const category = getFileCategory(name, mimeType);

  if ((category === 'image' || category === 'video') && thumbnailUrl) {
    return (
      <div className={`file-badge file-badge-${category} ${className}`} aria-hidden="true">
        <img src={thumbnailUrl} alt="" loading="lazy" decoding="async" className="thumbnail-img" />
        {category === 'video' && (
          <span className="video-badge-overlay">
            <svg viewBox="0 0 24 24" className="video-play-mini" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`file-badge file-badge-${category} ${className}`} aria-hidden="true">
      {category === 'folder' && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"
            fill="currentColor"
            fillOpacity="0.18"
          />
        </svg>
      )}
      {category === 'image' && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
      )}
      {category === 'video' && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" />
        </svg>
      )}
      {category === 'audio' && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      )}
      {category === 'pdf' && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M9 15v-4h1.5a1.5 1.5 0 0 1 0 3H9" />
          <path d="M15 15h-2v-4h2" />
        </svg>
      )}
      {category === 'code' && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      )}
      {category === 'archive' && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="21 8 21 21 3 21 3 8" />
          <rect width="22" height="5" x="1" y="3" rx="1" />
          <line x1="10" x2="14" y1="12" y2="12" />
        </svg>
      )}
      {category === 'document' && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" x2="8" y1="13" y2="13" />
          <line x1="16" x2="8" y1="17" y2="17" />
          <line x1="10" x2="8" y1="9" y2="9" />
        </svg>
      )}
      {category === 'file' && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )}
    </div>
  );
}
