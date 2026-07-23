import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadDataset } from '../api/client';
import type { UploadResponse } from '../types';

interface Props {
  onUploaded: (data: UploadResponse) => void;
}

export default function UploadZone({ onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<UploadResponse | null>(null);

  const onDrop = useCallback(
    async (accepted: File[], rejected: { errors: { message: string }[] }[]) => {
      setError(null);
      if (rejected.length > 0) {
        setError(rejected[0].errors[0]?.message ?? 'Invalid file');
        return;
      }
      const file = accepted[0];
      if (!file) return;
      setUploading(true);
      try {
        const result = await uploadDataset(file);
        setPreview(result);
        onUploaded(result);
      } catch (err: unknown) {
        const msg =
          (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          'Upload failed. Please try again.';
        setError(msg);
      } finally {
        setUploading(false);
      }
    },
    [onUploaded]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
    disabled: uploading,
  });

  return (
    <div className="upload-zone-wrapper">
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'dragover' : ''} ${uploading ? 'loading' : ''}`}
        aria-label="CSV file drop zone"
      >
        <input {...getInputProps()} />
        <div className="dropzone__content">
          {uploading ? (
            <>
              <span className="spinner" aria-hidden="true" />
              <p>Uploading…</p>
            </>
          ) : isDragActive ? (
            <>
              <span className="dropzone__icon">⬇️</span>
              <p>Drop it here!</p>
            </>
          ) : (
            <>
              <span className="dropzone__icon">📂</span>
              <p className="dropzone__main">Drag & drop a CSV file here</p>
              <p className="dropzone__sub">or click to browse — max 50 MB</p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="upload-error" role="alert">
          ⚠️ {error}
        </div>
      )}

      {preview && (
        <div className="upload-success">
          <div className="upload-success__header">
            <span className="upload-success__icon">✅</span>
            <strong>{preview.filename}</strong>
          </div>
          <div className="upload-success__meta">
            <span className="badge">{preview.rows.toLocaleString()} rows</span>
            <span className="badge">{preview.columns.length} columns</span>
          </div>
          <div className="upload-success__columns">
            <p className="label">Columns detected:</p>
            <div className="chip-list">
              {preview.columns.map((col) => (
                <span key={col} className="chip">{col}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
