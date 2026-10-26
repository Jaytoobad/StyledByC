import { useRef, useState } from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { processImage } from '../lib/image';

type PhotoSlot = {
  id: number;
  label: string;
  required: boolean;
  caption: string;
};

export type StoredPhoto = {
  slotId: number;
  name: string;
  mimeType: string;
  dataBase64: string;
  preview: string; // data: URL for thumbnail display
  file: File; // kept for recompression on submit
};

type PhotoCaptureProps = {
  slot: PhotoSlot;
  photo: StoredPhoto | null;
  onChange: (photo: StoredPhoto | null) => void;
};

export function PhotoCapture({ slot, photo, onChange }: PhotoCaptureProps) {
  const takeInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const actionButton = (
    icon: JSX.Element,
    label: string,
    ref: React.RefObject<HTMLInputElement>,
    capture?: boolean | 'user' | 'environment'
  ) => (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: 44,
        fontSize: 16,
        border: '1px solid #c9c1b6',
        borderRadius: 6,
        cursor: 'pointer',
        background: '#fff',
      }}
    >
      {icon} {label}
      <input
        ref={ref}
        hidden
        type="file"
        accept="image/*"
        {...(capture ? { capture } : {})}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </label>
  );

  const handleFiles = async (files: FileList | null) => {
    setError('');
    if (!files || !files.length) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file (JPEG, PNG, or WebP).');
      return;
    }
    try {
      const processed = await processImage(file);
      const preview = `data:${processed.mimeType};base64,${processed.dataBase64}`;
      onChange({ ...processed, slotId: slot.id, preview, file });
    } catch {
      setError('Could not process that photo. Please try a different image.');
    }
  };

  return (
    <div style={{ border: '1px solid #e6e0d8', borderRadius: 8, padding: 16, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <b style={{ fontSize: 16 }}>{slot.label}</b>
        {slot.required && (
          <span style={{ fontSize: 14, paddingTop: 1, color: '#b00020' }}>
            (required)
          </span>
        )}
      </div>
      <p style={{ fontSize: 14, color: 'var(--sb-grey)', margin: '0 0 12 0' }}>
        {slot.caption}
      </p>
      {actionButton(<Camera size={16} />, 'Take photo', takeInput, 'user')}
      {actionButton(<ImageIcon size={16} />, 'Choose from gallery', galleryInput, undefined)}
      {error && (
        <p style={{ color: '#b00020', fontSize: 14, marginTop: 8 }}>{error}</p>
      )}
      {photo && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <img
            src={photo.preview}
            alt={photo.name}
            style={{
              width: 96,
              height: 96,
              objectFit: 'cover',
              borderRadius: 6,
              border: '1px solid #e6e0d8',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              type="button"
              className="btn-link"
              onClick={() => takeInput.current?.click()}
              style={{ minHeight: 44, fontSize: 15, padding: 0, textAlign: 'left' }}
            >
              Retake
            </button>
            <button
              type="button"
              className="btn-link"
              onClick={() => onChange(null)}
              style={{ minHeight: 44, fontSize: 15, padding: 0, textAlign: 'left' }}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
