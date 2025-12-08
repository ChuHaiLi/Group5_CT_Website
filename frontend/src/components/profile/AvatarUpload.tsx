import React, { ChangeEvent, useId, useRef } from "react";

export interface AvatarUploadProps {
  avatarUrl?: string;
  onChange: (file: File | null, previewUrl: string) => void;
  buttonLabel?: string;
  size?: number;
}

const fallbackAvatar =
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80";

export const AvatarUpload: React.FC<AvatarUploadProps> = ({
  avatarUrl,
  onChange,
  buttonLabel = "Upload new avatar",
  size = 120,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      onChange(null, avatarUrl ?? fallbackAvatar);
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const preview = typeof reader.result === "string" ? reader.result : "";
      onChange(file, preview);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileDialog = () => {
    inputRef.current?.click();
  };

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <img
        src={avatarUrl || fallbackAvatar}
        alt="Profile avatar"
        className="rounded-full border-4 border-white shadow-2xl shadow-slate-400/40 object-cover"
        style={{ width: size, height: size }}
      />
      <div>
        <button
          type="button"
          className="rounded-full bg-[#3B82F6] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/40 transition hover:bg-[#2563EB]"
          onClick={triggerFileDialog}
        >
          {buttonLabel}
        </button>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleInputChange}
        />
      </div>
    </div>
  );
};

export default AvatarUpload;
