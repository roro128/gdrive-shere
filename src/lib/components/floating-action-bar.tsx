import { Badge } from './ui/badge';
import { Button } from './ui/button';

export function FloatingActionBar({
  selectedCount,
  totalCount,
  onClearSelection,
  onSelectAll,
  onDownload,
  onTrash,
  onPermanentDelete,
  trash,
  busy,
  hasDownloadable,
  hasTrashable
}: {
  selectedCount: number;
  totalCount: number;
  onClearSelection: () => void;
  onSelectAll: (checked: boolean) => void;
  onDownload?: () => void;
  onTrash?: () => void;
  onPermanentDelete?: () => void;
  trash?: boolean;
  busy?: boolean;
  hasDownloadable?: boolean;
  hasTrashable?: boolean;
}) {
  if (selectedCount === 0) return null;

  const isAllSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="floating-action-bar" role="toolbar" aria-label="선택 항목 일괄 작업">
      <div className="floating-bar-info">
        <label className="floating-checkbox-label">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
            aria-label="전체 선택"
          />
          <Badge className="floating-count-badge">{selectedCount}</Badge>
          <span className="floating-count-text">개 선택됨</span>
        </label>
      </div>

      <div className="floating-bar-actions">
        {!trash && hasDownloadable && onDownload && (
          <Button
            variant="default"
            size="sm"
            className="floating-btn floating-btn-primary"
            disabled={busy}
            onClick={onDownload}
          >
            <svg
              viewBox="0 0 24 24"
              className="ui-icon"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>{busy ? '다운로드 중…' : '다운로드'}</span>
          </Button>
        )}

        {!trash && hasTrashable && onTrash && (
          <Button
            variant="destructive"
            size="sm"
            className="floating-btn floating-btn-danger"
            disabled={busy}
            onClick={onTrash}
          >
            <svg
              viewBox="0 0 24 24"
              className="ui-icon"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            <span>삭제 ({selectedCount})</span>
          </Button>
        )}

        {trash && onPermanentDelete && (
          <Button
            variant="destructive"
            size="sm"
            className="floating-btn floating-btn-danger"
            disabled={busy}
            onClick={onPermanentDelete}
          >
            <svg
              viewBox="0 0 24 24"
              className="ui-icon"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m7 7 10 10M17 7 7 17" />
            </svg>
            <span>영구 삭제 ({selectedCount})</span>
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="floating-btn floating-btn-ghost"
          onClick={onClearSelection}
          aria-label="선택 해제"
        >
          선택 해제
        </Button>
      </div>
    </div>
  );
}
